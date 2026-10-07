import frappe
from frappe.model.document import Document
from frappe.utils import flt


class CounterInvoiceItem(Document):
	def validate(self):
		self.calculate_line()

	def calculate_line(self):
		gross = flt(self.qty) * flt(self.mrp)
		self.line_total = gross * (1 - flt(self.discount_percent) / 100)
		self.tax_amount = flt(self.line_total) * (
			flt(self.sgst_percent) + flt(self.cgst_percent) + flt(self.igst_percent)
		) / 100
