import frappe
from frappe.model.document import Document
from frappe.utils import flt
from erpnext.stock.utils import get_stock_balance

from ev_workshop.utils import ensure_erpnext_item, get_company, get_company_abbr, get_or_create_customer


class CounterInvoice(Document):
	def validate(self):
		if not self.company:
			self.company = get_company()
		if not self.customer and not self.walkin_name:
			frappe.throw("Select a Customer or enter a Walk-in Name.")
		self.calculate_totals()

	def calculate_totals(self):
		subtotal = 0.0
		cgst = sgst = igst = 0.0
		for row in self.items or []:
			row.calculate_line()
			subtotal += flt(row.line_total)
			cgst += flt(row.line_total) * flt(row.cgst_percent) / 100
			sgst += flt(row.line_total) * flt(row.sgst_percent) / 100
			igst += flt(row.line_total) * flt(row.igst_percent) / 100

		discount = flt(self.discount_percent) * subtotal / 100 + flt(self.discount_amount)
		taxable = max(subtotal - discount, 0)
		factor = taxable / subtotal if subtotal else 0
		if self.gst_applicable:
			self.cgst_amount = cgst * factor
			self.sgst_amount = sgst * factor
			self.igst_amount = igst * factor
		else:
			self.cgst_amount = self.sgst_amount = self.igst_amount = 0

		before_round = taxable + self.cgst_amount + self.sgst_amount + self.igst_amount
		self.grand_total = round(before_round)
		self.round_off = flt(self.grand_total) - before_round

	def before_submit(self):
		self.validate_stock()

	def validate_stock(self):
		"""Block submit when any stocked part is short (Laravel stock guard)."""
		company = self.company or get_company()
		abbr = get_company_abbr(company)
		warehouse = f"Stores - {abbr}" if abbr else None
		short = []
		for row in self.items or []:
			code = ensure_erpnext_item(row.item_master)
			if not frappe.db.get_value("Item", code, "is_stock_item"):
				continue
			bal = get_stock_balance(code, warehouse) if warehouse else 0
			if flt(bal) < flt(row.qty):
				short.append(f"{code} (need {flt(row.qty)}, have {flt(bal)})")
		if short:
			frappe.throw("Insufficient stock: " + ", ".join(short))

	def on_submit(self):
		company = self.company or get_company()
		if not company:
			frappe.throw("Please set a Company before submitting.")
		abbr = get_company_abbr(company)
		warehouse = f"Stores - {abbr}" if abbr else None

		# 1. Deduct stocked parts
		stock_lines = []
		for row in self.items:
			code = ensure_erpnext_item(row.item_master)
			if frappe.db.get_value("Item", code, "is_stock_item"):
				stock_lines.append({"item_code": code, "qty": flt(row.qty), "s_warehouse": warehouse})
		if stock_lines:
			se = frappe.get_doc(
				{
					"doctype": "Stock Entry",
					"stock_entry_type": "Material Issue",
					"company": company,
					"items": stock_lines,
				}
			)
			se.insert()
			se.submit()
			self.db_set("stock_entry", se.name)

		# 2. Book the sale as a submitted Sales Invoice (payments/outstanding
		# live on the invoice, like the job-card flow).
		customer = self.customer or get_or_create_customer(
			self.walkin_name + (f" ({self.walkin_mobile})" if self.walkin_mobile else "")
		)
		template = frappe.db.get_value(
			"Sales Taxes and Charges Template", {"company": company, "is_default": 1}
		)
		taxes_and_charges = template if self.gst_applicable else None
		si = frappe.get_doc(
			{
				"doctype": "Sales Invoice",
				"customer": customer,
				"company": company,
				"posting_date": self.invoice_date,
				"due_date": self.invoice_date,
				"taxes_and_charges": taxes_and_charges,
				"items": [
					{
						"item_code": ensure_erpnext_item(row.item_master),
						"item_name": row.item_name,
						"qty": row.qty,
						"rate": row.mrp,
						"discount_percentage": row.discount_percent,
					}
					for row in self.items
				],
				"taxes": [],
			}
		)
		si.insert()
		si.submit()
		self.db_set("sales_invoice", si.name)
		frappe.msgprint(f"Sales Invoice {si.name} created.")

	def on_cancel(self):
		# Roll back what on_submit booked, in reverse order.
		if self.sales_invoice and frappe.db.exists("Sales Invoice", self.sales_invoice):
			si = frappe.get_doc("Sales Invoice", self.sales_invoice)
			if si.docstatus == 1:
				si.cancel()
		if getattr(self, "stock_entry", None) and frappe.db.exists("Stock Entry", self.stock_entry):
			se = frappe.get_doc("Stock Entry", self.stock_entry)
			if se.docstatus == 1:
				se.cancel()
