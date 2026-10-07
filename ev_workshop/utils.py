"""Shared helpers for the EV Workshop app.

Single source of truth for mobile-number normalization, WhatsApp share
links, customer provisioning and company resolution. Used by both the
Job Master controller and the whitelisted ``api.py`` functions so the
same logic is not triplicated.
"""

import urllib.parse

import frappe
from frappe.utils import flt

#: Hard cap for item lookups so a crafted `limit` cannot dump the table.
MAX_ITEM_LOOKUP_LIMIT = 100

#: Country code prefixed when a 10-digit Indian mobile is given.
DEFAULT_COUNTRY_CODE = "91"

#: Universal share link (works on mobile + desktop). Do not use
#: web.whatsapp.com — it fails inside in-app browsers.
WHATSAPP_SHARE_BASE = "https://wa.me"


def normalize_mobile(mobile, country_code=DEFAULT_COUNTRY_CODE):
	"""Return digits-only mobile with country code, e.g. ``919876543210``.

	Raises ``frappe.ValidationError`` (via ``frappe.throw``) when empty.
	"""
	if not mobile:
		frappe.throw("Customer mobile number is not available. Please update the customer details.")

	digits = "".join(filter(str.isdigit, str(mobile)))
	digits = digits.lstrip("0")
	if not digits.startswith(country_code):
		digits = country_code + digits
	return digits


def whatsapp_share_url(mobile, message):
	"""Return a ``wa.me`` share URL for ``message`` to ``mobile``."""
	return f"{WHATSAPP_SHARE_BASE}/{normalize_mobile(mobile)}?text={urllib.parse.quote(message)}"


def _is_retailer(doc):
	return (getattr(doc, "customer_type", None) or "Customer") == "Retailer"


def _labor_amount(item):
	return flt(getattr(item, "labor_amount", 0))


def build_quote_message(doc):
	"""Markdown quote text for a Job Master doc.

	Retailers see part-only lines; regular customers see part + labor.
	"""
	retailer = _is_retailer(doc)
	lines = [
		f"*QUOTE - {doc.name}*",
		"",
		f"*Customer:* {doc.customer_name}",
		f"*Service Type:* {doc.service_type}",
		"",
		"*ITEMS:*",
		"```",
	]
	for item in doc.items or []:
		item_name = item.item_name or item.item_no
		labor = _labor_amount(item)
		lines.append(f"{item_name}")
		if not retailer and labor > 0:
			lines.append(f"   Part: {flt(item.qty)} x Rs. {flt(item.rate)} = Rs. {flt(item.amount)}")
			lines.append(
				f"   Labor: {flt(item.qty)} x Rs. {flt(getattr(item, 'labor_cost', 0))} = Rs. {labor}"
			)
		else:
			lines.append(f"   Qty: {flt(item.qty)} x Rs. {flt(item.rate)}")
		lines.append(f"   Total: Rs. {flt(item.total_amount)}")
		lines.append("")
	if getattr(doc, "job_labours", None):
		lines.append("*LABOUR:*")
		for lb in doc.job_labours:
			lines.append(f"{lb.labour_master} x {flt(lb.qty)} = Rs. {flt(lb.line_total)}")
		lines.append("")
	lines += [
		"```",
		f"*GRAND TOTAL: Rs. {flt(doc.grand_total)}*",
		"",
		"Please approve to proceed with repair.",
	]
	return "\n".join(lines)


def build_ready_message(doc):
	"""Markdown vehicle-ready text for a Job Master doc."""
	retailer = _is_retailer(doc)
	lines = [
		f"*Vehicle Ready - {doc.name}*",
		"",
		f"*Customer:* {doc.customer_name}",
		f"*Service Type:* {doc.service_type}",
		"",
		"*Work Completed:*",
		"```",
	]
	for item in doc.items or []:
		item_name = item.item_name or item.item_no
		labor = _labor_amount(item)
		if not retailer and labor > 0:
			lines.append(f"{item_name}: Rs. {flt(item.total_amount)} (Part: {flt(item.amount)} + Labor: {labor})")
		else:
			lines.append(f"{item_name}: Rs. {flt(item.total_amount)}")
	lines += [
		"```",
		f"*Total Amount: Rs. {flt(doc.grand_total)}*",
		"",
		"Please visit to collect your vehicle. Payment pending.",
	]
	return "\n".join(lines)


def get_company():
	"""Company for invoices/stock: user default, else global default."""
	return frappe.defaults.get_user_default("company") or frappe.db.get_default("company")


def get_company_abbr(company=None):
	"""Company abbreviation for account/warehouse names. Never hardcoded."""
	company = company or get_company()
	if not company:
		return None
	return frappe.db.get_value("Company", company, "abbr") or None


def ensure_service_item(labour_master_no):
	"""Return ERPNext ``Item`` code for a Labour Master, creating it.

	Service items are non-stock; rate/HSN/GST carried from the master so
	Sales Invoice lines for labour post correctly.
	"""
	code = f"LABOUR-{labour_master_no}"
	if frappe.db.exists("Item", code):
		return code

	master = frappe.db.get_value(
		"Labour Master",
		labour_master_no,
		["service_name", "standard_rate", "hsn_sac_code", "gst_rate", "taxable"],
		as_dict=True,
	)
	if not master:
		frappe.throw(f"Labour Master {labour_master_no} not found.")

	hsn = None
	if master.hsn_sac_code and frappe.db.exists("GST HSN Code", master.hsn_sac_code):
		hsn = master.hsn_sac_code
	if not hsn:
		hsn = frappe.db.sql(
			"""select gst_hsn_code from `tabItem` where ifnull(gst_hsn_code, '') != ''
			   group by gst_hsn_code order by count(*) desc limit 1"""
		)
		hsn = hsn[0][0] if hsn else None
	if not hsn:
		frappe.throw(
			f"Labour Master {labour_master_no} needs a valid HSN/SAC code, "
			"and no fallback HSN exists on site."
		)

	item = frappe.get_doc(
		{
			"doctype": "Item",
			"item_code": code,
			"item_name": master.service_name or labour_master_no,
			"item_group": frappe.db.get_single_value("Stock Settings", "item_group")
			or "All Item Groups",
			"stock_uom": "Nos",
			"is_stock_item": 0,
			"standard_rate": flt(master.standard_rate),
			"gst_hsn_code": hsn,
			"ev_item_class": "Service",
		}
	)
	item.insert(ignore_permissions=False)
	return item.name


def resolve_job_customer(doc):
	"""ERPNext Customer for a Job Master, across old and new data.

	Prefers Vehicle Ownership (current model), falls back to the legacy
	Customer History link, then to the denormalized customer_name
	(pre-ownership records like JOB-2026-0001).
	"""
	if getattr(doc, "vehicle_ownership", None) and frappe.db.exists(
		"Vehicle Ownership", doc.vehicle_ownership
	):
		owner = frappe.db.get_value("Vehicle Ownership", doc.vehicle_ownership, "owner_name")
		if owner:
			return owner
	if getattr(doc, "history_no", None):
		legacy = frappe.db.get_value("Customer History Master", doc.history_no, "customer_name")
		if legacy:
			return legacy
	if getattr(doc, "customer_name", None):
		return doc.customer_name
	frappe.throw("Cannot resolve a customer for this job. Please link Vehicle Ownership.")


def get_or_create_customer(customer_name):
	"""Return ERPNext ``Customer`` name for ``customer_name``, creating it."""
	if not customer_name:
		frappe.throw("Customer name is missing. Please select a Customer History first.")

	existing = frappe.db.exists("Customer", {"customer_name": customer_name})
	if existing:
		return existing

	new_customer = frappe.get_doc(
		{
			"doctype": "Customer",
			"customer_name": customer_name,
			"customer_type": "Individual",
		}
	)
	new_customer.insert(ignore_permissions=False)
	return new_customer.name


def ensure_erpnext_item(item_master_no):
	"""Return ERPNext ``Item`` code for an Item Master row, creating it.

	Workshop job lines point at Item Master, but Sales Invoices and Stock
	Entries need real ERPNext Items. Missing Items are created on the fly
	(stock item for Spare Parts, non-stock otherwise) carrying over rate,
	HSN and GST from the master.
	"""
	if frappe.db.exists("Item", item_master_no):
		return item_master_no

	# Look up by the item_no business key: older records carry random
	# document names, so resolve the name before reading fields.
	master_name = frappe.db.get_value("Item Master", {"item_no": item_master_no}, "name")
	if not master_name and frappe.db.exists("Item Master", item_master_no):
		master_name = item_master_no
	if not master_name:
		frappe.throw(f"Item Master {item_master_no} not found.")

	master = frappe.db.get_value(
		"Item Master",
		master_name,
		["item_name", "item_class", "uom", "standard_rate", "hsn_code", "sgst_percent", "cgst_percent", "igst_percent"],
		as_dict=True,
	)
	if not master:
		frappe.throw(f"Item Master {item_master_no} not found.")

	uom = master.uom or "Nos"
	# HSN must exist in the GST HSN/SAC master (India Compliance enforces
	# it as mandatory). Fall back to the site's most-used HSN so auto
	# provisioned items never fail validation.
	hsn = None
	if master.hsn_code and frappe.db.exists("GST HSN Code", master.hsn_code):
		hsn = master.hsn_code
	if not hsn:
		hsn = frappe.db.sql(
			"""select gst_hsn_code from `tabItem` where ifnull(gst_hsn_code, '') != ''
			   group by gst_hsn_code order by count(*) desc limit 1"""
		)
		hsn = hsn[0][0] if hsn else None
	if not hsn:
		frappe.throw(
			f"Item Master {item_master_no} has HSN '{master.hsn_code or ''}' which is not a valid "
			"HSN/SAC Code, and no fallback HSN exists. Please fix the HSN on the Item Master."
		)
	item = frappe.get_doc(
		{
			"doctype": "Item",
			"item_code": item_master_no,
			"item_name": master.item_name or item_master_no,
			"item_group": frappe.db.get_single_value("Stock Settings", "item_group")
			or "All Item Groups",
			"stock_uom": uom,
			"is_stock_item": 1 if (master.item_class == "Spare Part") else 0,
			"standard_rate": flt(master.standard_rate),
			"gst_hsn_code": hsn,
			"ev_item_class": master.item_class,
			"ev_hsn_code": master.hsn_code,
			"ev_sgst_percent": flt(master.sgst_percent),
			"ev_cgst_percent": flt(master.cgst_percent),
			"ev_igst_percent": flt(master.igst_percent),
		}
	)
	item.insert(ignore_permissions=False)
	return item.name
