"""API endpoints for EV Workshop operations.

This module provides whitelisted (callable from JS) and internal functions
for the EV Workshop workflow. All functions are accessed via frappe.call()
from the JavaScript frontend.

Key APIs:
    - send_quote_whatsapp: Opens WhatsApp Web with a pre-filled quote message
    - send_ready_notification: Opens WhatsApp Web with vehicle-ready notification
    - create_job_invoice: Creates and submits a Sales Invoice from Job Master
    - create_stock_entry_for_job: Creates a Material Issue Stock Entry for spare parts
    - make_invoice: Creates an editable (unsubmitted) Sales Invoice via mapped doc
    - get_erpnext_items: Fetches items from ERPNext Item doctype for search

Pricing logic:
    - Customer type "Customer": Invoice includes separate rows for parts + labor
    - Customer type "Retailer": Invoice includes part-only rows (no labor)

Account resolution:
    Income account and cost center are resolved from the company abbreviation
    (e.g., "Sales - EI", "Main - EI" for company with abbr "EI").
"""

import frappe
from frappe.model.mapper import get_mapped_doc
from urllib.parse import quote

from ev_workshop.utils import (
	MAX_ITEM_LOOKUP_LIMIT,
	build_quote_message,
	build_ready_message,
	ensure_erpnext_item,
	get_company,
	get_or_create_customer,
	normalize_mobile,
	resolve_job_customer,
	whatsapp_share_url,
)


def _job_doc(docname):
	"""Load a Job Master with a read-permission check."""
	if not frappe.has_permission("Job Master", "read", docname):
		frappe.throw("Not permitted to access this Job Master.", frappe.PermissionError)
	return frappe.get_doc("Job Master", docname)


# ============================================================================
# ITEM SEARCH
# ============================================================================

@frappe.whitelist()
def get_erpnext_items(item_class=None, search_text=None, limit=50):
	"""Fetch items from ERPNext Item doctype for invoicing.

	Used by the Job Item child table to search and select items.
	Returns ERPNext Items that have EV Workshop custom fields populated.

	Args:
		item_class: Filter by classification (Spare Part / Service / Consumable)
		search_text: Partial match on item_code
		limit: Maximum results (default 50)

	Returns:
		list[dict]: Matching items with their details
	"""
	filters = {"disabled": 0}

	if item_class:
		filters["ev_item_class"] = item_class

	if search_text:
		# Escape LIKE wildcards so %/_ are matched literally
		safe = str(search_text).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
		filters["item_code"] = ["like", f"%{safe}%"]

	try:
		limit = min(int(limit or 50), MAX_ITEM_LOOKUP_LIMIT)
	except (TypeError, ValueError):
		limit = 50

	items = frappe.get_all(
		"Item",
		fields=[
			"name", "item_code", "item_name", "item_group", "stock_uom",
			"standard_rate", "ev_item_class", "ev_hsn_code",
			"ev_sgst_percent", "ev_cgst_percent", "ev_igst_percent",
		],
		filters=filters,
		order_by="item_name",
		limit=limit,
	)

	return items


# ============================================================================
# HELPER FUNCTIONS (internal, not whitelisted)
# ============================================================================

def _build_invoice_items(doc):
	"""Build Sales Invoice line items from Job Master items.

	Pricing logic based on customer_type:
	    - Customer: Creates TWO rows per item (part + labor)
	    - Retailer: Creates ONE row per item (part only)

	Account names are resolved from the company abbreviation to support
	multi-company deployments.

	Args:
		doc: Job Master document

	Returns:
		list[dict]: Invoice item dicts ready for Sales Invoice.append("items", ...)
	"""
	invoice_items = []
	customer_type = doc.customer_type or "Customer"

	# Resolve company abbreviation for account names (never hardcoded)
	company = doc.get("company") or frappe.defaults.get_user_default("company") or frappe.db.get_default("company")
	if not company:
		frappe.throw("Please set a default Company before creating invoices.")
	company_abbr = frappe.db.get_value("Company", company, "abbr")
	if not company_abbr:
		frappe.throw(f"Company {company} has no abbreviation.")
	income_account = f"Sales - {company_abbr}"
	cost_center = f"Main - {company_abbr}"

	for item in doc.items:
		item_name = item.item_name or item.item_no
		item_code = ensure_erpnext_item(item.item_no)

		# Part line item (always included for both Customer and Retailer)
		invoice_items.append({
			"item_code": item_code,
			"item_name": item_name,
			"qty": item.qty,
			"rate": item.rate,
			"amount": item.amount,
			"income_account": income_account,
			"cost_center": cost_center,
		})

		# Labor line item (Customer only — Retailers don't pay fitting charges)
		if customer_type != "Retailer" and item.labor_amount and item.labor_amount > 0:
			invoice_items.append({
				"item_code": item_code,
				"item_name": f"{item_name} - Fitting/Labor",
				"qty": item.qty,
				"rate": item.labor_cost,
				"amount": item.labor_amount,
				"income_account": income_account,
				"cost_center": cost_center,
			})

	return invoice_items


def _format_mobile_number(mobile):
	"""Format mobile number for WhatsApp (add Indian country code 91).

	Thin wrapper over :func:`ev_workshop.utils.normalize_mobile` kept for
	backward compatibility.
	"""
	if not mobile:
		return None
	return normalize_mobile(mobile)


def _build_quote_message(doc):
	"""Build WhatsApp-formatted quote message.

	Delegates to :func:`ev_workshop.utils.build_quote_message` (single source
	of truth, shared with the Job Master controller). Kept for backward
	compatibility.
	"""
	return build_quote_message(doc)


def _build_ready_message(doc):
	"""Build WhatsApp-formatted vehicle-ready notification.

	Delegates to :func:`ev_workshop.utils.build_ready_message`. Kept for
	backward compatibility.
	"""
	return build_ready_message(doc)


# ============================================================================
# WHATSAPP NOTIFICATION APIs
# ============================================================================

@frappe.whitelist()
def send_quote_whatsapp(docname):
	"""Send quote via WhatsApp to customer.

	Opens WhatsApp Web in a new browser tab with a pre-filled message
	containing the itemized quote. The user must click "Send" in WhatsApp.

	Args:
		docname: Job Master document name

	Returns:
		dict: {"url": WhatsApp Web URL, "message": Plain text message}

	Raises:
		frappe.ValidationError: If no items or mobile number is missing
	"""
	doc = _job_doc(docname)

	if not doc.items:
		frappe.throw("Please add at least one item in Parts and Labour before sending quote.")

	mobile = _format_mobile_number(doc.mobile_no)
	if not mobile:
		frappe.throw("Customer mobile number is not available.")

	message = _build_quote_message(doc)
	encoded_message = quote(message)
	whatsapp_url = f"https://wa.me/{mobile}?text={encoded_message}"

	return {"url": whatsapp_url, "message": message}


@frappe.whitelist()
def send_ready_notification(docname):
	"""Send vehicle ready notification via WhatsApp.

	Opens WhatsApp Web with a pre-filled message notifying the customer
	that their vehicle is ready for pickup.

	Args:
		docname: Job Master document name

	Returns:
		dict: {"url": WhatsApp Web URL, "message": Plain text message}

	Raises:
		frappe.ValidationError: If mobile number is missing
	"""
	doc = _job_doc(docname)

	mobile = _format_mobile_number(doc.mobile_no)
	if not mobile:
		frappe.throw("Customer mobile number is not available.")

	message = _build_ready_message(doc)
	encoded_message = quote(message)
	whatsapp_url = f"https://wa.me/{mobile}?text={encoded_message}"

	return {"url": whatsapp_url, "message": message}


# ============================================================================
# INVOICE CREATION APIs
# ============================================================================

@frappe.whitelist()
def make_invoice(source_name, target_doc=None):
	"""Create an editable Sales Invoice from Job Master.

	Uses Frappe's mapped doc pattern to pre-fill a Sales Invoice from
	the Job Master. The user can review and edit before submitting.

	This is a fallback path — the primary path is create_job_invoice()
 which auto-submits.

	Args:
		source_name: Job Master document name
		target_doc: Existing target document (optional, for re-mapping)

  Returns:
	Sales Invoice: Unsubmitted invoice document for review
	"""
	if not frappe.has_permission("Job Master", "read", source_name):
		frappe.throw("Not permitted to access this Job Master.", frappe.PermissionError)
	if not frappe.has_permission("Sales Invoice", "create"):
		frappe.throw("Not permitted to create a Sales Invoice.", frappe.PermissionError)

	def set_missing_values(source, target):
		"""Populate customer, company, and items on the target invoice."""
		target.customer = get_or_create_customer(resolve_job_customer(source))
		target.company = (
			source.get("company")
			or frappe.defaults.get_user_default("company")
			or frappe.db.get_default("company")
		)

		# Add invoice items (part + labor rows based on customer_type)
		for inv_item in _build_invoice_items(source):
			target.append("items", inv_item)

	doc = get_mapped_doc(
		"Job Master",
		source_name,
		{
			"Job Master": {
				"doctype": "Sales Invoice",
				"field_map": {
					"name": "job_reference",
					"grand_total": "total",
				},
			}
		},
		target_doc,
		set_missing_values,
	)

	return doc


@frappe.whitelist()
def create_job_invoice(docname):
	"""Create and auto-submit Sales Invoice from Job Master.

	This is the primary invoice creation path called by the "Mark as Ready"
	workflow button. Unlike make_invoice(), this creates and immediately
	submits the invoice.

	Args:
		docname: Job Master document name

	Returns:
		str: Sales Invoice name if successful, None if failed or no items

	Note:
		Errors are logged but not thrown to the user — the workflow
		continues even if invoice creation fails. The user can retry
		later from the Payments tab.
	"""
	doc = _job_doc(docname)

	if not doc.items:
		return None

	if not frappe.has_permission("Sales Invoice", "create"):
		frappe.throw("Not permitted to create a Sales Invoice.", frappe.PermissionError)

	try:
		# Resolve customer (ownership first, legacy fallbacks after)
		customer = get_or_create_customer(resolve_job_customer(doc))
		company = (
			doc.get("company")
			or frappe.defaults.get_user_default("company")
			or frappe.db.get_default("company")
		)

		invoice_items = _build_invoice_items(doc)

		# Create and submit Sales Invoice
		si = frappe.get_doc({
			"doctype": "Sales Invoice",
			"customer": customer,
			"company": company,
			"due_date": doc.date,
			"job_reference": doc.name,
			"items": invoice_items,
		})
		si.insert()
		si.submit()
		return si.name
	except Exception as e:
		frappe.log_error(f"Invoice Creation Failed: {str(e)}", "Job Master Invoice")
		return None


# ============================================================================
# STOCK ENTRY API
# ============================================================================

@frappe.whitelist()
def create_stock_entry_for_job(docname):
	"""Create Stock Entry for spare parts when job is marked Ready.

	Creates a Material Issue Stock Entry that deducts spare parts from
	the Stores warehouse. Only items with item_class="Spare Part" are
	included — service and consumable items are excluded.

	Called automatically by the "Mark as Ready" workflow button.

	Args:
		docname: Job Master document name

	Returns:
		str: Stock Entry name if successful, None if no spare parts or failed

	Note:
		Uses "Stores - {abbr}" as source warehouse. This must match
		the actual warehouse name in ERPNext.
	"""
	doc = _job_doc(docname)

	if not doc.items:
		return None

	if not frappe.has_permission("Stock Entry", "create"):
		frappe.throw("Not permitted to create a Stock Entry.", frappe.PermissionError)

	company = (
		frappe.defaults.get_user_default("company")
		or frappe.db.get_default("company")
	)
	if not company:
		frappe.throw("Please set a default Company before issuing stock.")
	company_abbr = frappe.db.get_value("Company", company, "abbr")
	if not company_abbr:
		frappe.throw(f"Company {company} has no abbreviation.")

	# Filter to spare parts only (exclude Service and Consumable items)
	stock_items = []
	for item in doc.items:
		item_class = frappe.db.get_value("Item Master", item.item_no, "item_class")
		if item_class == "Spare Part":
			stock_items.append({
				"item_code": ensure_erpnext_item(item.item_no),
				"qty": item.qty,
				"s_warehouse": f"Stores - {company_abbr}",
				"t_warehouse": None,  # Material Issue — no target warehouse
			})

	if not stock_items:
		return None

	try:
		se = frappe.get_doc({
			"doctype": "Stock Entry",
			"stock_entry_type": "Material Issue",
			"company": company,
			"items": stock_items,
		})
		se.insert()
		se.submit()
		return se.name
	except Exception as e:
		frappe.log_error(f"Stock Entry Creation Failed: {str(e)}", "Job Master Stock Entry")
		return None
