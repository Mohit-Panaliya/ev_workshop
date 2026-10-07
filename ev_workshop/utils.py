"""Shared helpers for the EV Workshop app.

Single source of truth for mobile-number normalization, WhatsApp share
links, customer provisioning and company resolution. Used by both the
Job Master controller and the whitelisted ``api.py`` functions so the
same logic is not triplicated.
"""

import urllib.parse

import frappe
from frappe.utils import flt

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


def build_quote_message(doc):
	"""Markdown quote text for a Job Master doc."""
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
		lines.append(f"{item_name}")
		lines.append(f"   Qty: {flt(item.qty)} x Rs. {flt(item.rate)}")
		lines.append(f"   Total: Rs. {flt(item.total_amount)}")
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
		lines.append(f"{item_name} - Rs. {flt(item.total_amount)}")
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
