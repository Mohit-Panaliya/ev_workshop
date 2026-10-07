import frappe

from ev_workshop.utils import (
	build_quote_message,
	build_ready_message,
	get_company,
	get_or_create_customer,
	whatsapp_share_url,
)

#: Hard cap for item lookups so a crafted `limit` cannot dump the table.
MAX_LOOKUP_LIMIT = 100


def _job_doc(docname):
	"""Load a Job Master with a read-permission check."""
	if not frappe.has_permission("Job Master", "read", docname):
		frappe.throw("Not permitted to access this Job Master.", frappe.PermissionError)
	return frappe.get_doc("Job Master", docname)


@frappe.whitelist()
def get_erpnext_items(item_class=None, search_text=None, limit=50):
	"""
	Fetch items from ERPNext Item doctype for invoicing.
	Usage: frappe.call('ev_workshop.api.get_erpnext_items', {'item_class': 'Spare Part'})

	Requires the ``ev_*`` Custom Fields on Item (shipped as fixtures).
	"""
	try:
		limit = min(int(limit or 50), MAX_LOOKUP_LIMIT)
	except (TypeError, ValueError):
		limit = 50

	filters = {"disabled": 0}

	# Filter by item class if provided (custom field)
	if item_class:
		filters["ev_item_class"] = item_class

	# Search by item code or name (escape LIKE wildcards)
	if search_text:
		safe = str(search_text).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
		filters["item_code"] = ["like", f"%{safe}%"]

	return frappe.get_all(
		"Item",
		fields=[
			"name",
			"item_code",
			"item_name",
			"item_group",
			"stock_uom",
			"standard_rate",
			"ev_item_class",
			"ev_hsn_code",
			"ev_sgst_percent",
			"ev_cgst_percent",
			"ev_igst_percent",
		],
		filters=filters,
		order_by="item_name",
		limit=limit,
	)


@frappe.whitelist()
def send_quote_whatsapp(docname):
	"""Return a WhatsApp share URL with the job quote (does not send)."""
	doc = _job_doc(docname)

	if not doc.items:
		frappe.throw("Please add at least one item in the Parts and Labour table before sending quote.")

	message = build_quote_message(doc)
	return {"url": whatsapp_share_url(doc.mobile_no, message), "message": message}


@frappe.whitelist()
def send_ready_notification(docname):
	"""Return a WhatsApp share URL with the vehicle-ready note (does not send)."""
	doc = _job_doc(docname)

	message = build_ready_message(doc)
	return {"url": whatsapp_share_url(doc.mobile_no, message), "message": message}


@frappe.whitelist()
def make_invoice(source_name, target_doc=None):
	"""
	Draft a Sales Invoice from Job Master (returns unsaved mapped doc).
	Called from the "Create Invoice" button in Job Master.
	"""
	from frappe.model.mapper import get_mapped_doc

	if not frappe.has_permission("Job Master", "read", source_name):
		frappe.throw("Not permitted to access this Job Master.", frappe.PermissionError)
	if not frappe.has_permission("Sales Invoice", "create"):
		frappe.throw("Not permitted to create a Sales Invoice.", frappe.PermissionError)

	def set_missing_values(source, target):
		customer_name = frappe.db.get_value("Customer History Master", source.history_no, "customer_name")
		target.customer = get_or_create_customer(customer_name)
		target.company = get_company()
		# NOTE: grand_total is informational only; Sales Invoice computes
		# its own taxes from the mapped items on save.
		target.job_reference = source.name

	doc = get_mapped_doc(
		"Job Master",
		source_name,
		{
			"Job Master": {
				"doctype": "Sales Invoice",
				"field_map": {"name": "job_reference"},
			},
			"Job Item": {
				"doctype": "Sales Invoice Item",
				"field_map": {"item_no": "item_code"},
			},
		},
		target_doc,
		set_missing_values,
	)

	return doc


@frappe.whitelist()
def create_job_invoice(docname):
	"""Create + submit a Sales Invoice from Job Master. Returns invoice name."""
	if not frappe.has_permission("Job Master", "read", docname):
		frappe.throw("Not permitted to access this Job Master.", frappe.PermissionError)
	if not frappe.has_permission("Sales Invoice", "create"):
		frappe.throw("Not permitted to create a Sales Invoice.", frappe.PermissionError)

	doc = frappe.get_doc("Job Master", docname)

	if not doc.items:
		frappe.throw("Cannot create an invoice without items.")

	customer_name = frappe.db.get_value("Customer History Master", doc.history_no, "customer_name")
	customer = get_or_create_customer(customer_name)
	company = get_company()
	if not company:
		frappe.throw("Please set a default Company before creating invoices.")

	si = frappe.get_doc(
		{
			"doctype": "Sales Invoice",
			"customer": customer,
			"company": company,
			"due_date": doc.date,
			"job_reference": doc.name,
			"items": [
				{
					"item_code": item.item_no,
					"item_name": item.item_name,
					"qty": item.qty,
					"rate": item.rate,
				}
				for item in doc.items
			],
		}
	)
	si.insert()
	si.submit()
	return si.name
