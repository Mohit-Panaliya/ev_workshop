import frappe
from frappe.model.document import Document
from frappe.utils import flt


class JobItem(Document):
	def validate(self):
		self.calculate_amounts()

	def calculate_amounts(self):
		# Amount = qty * rate
		self.amount = flt(self.qty) * flt(self.rate) if (self.qty and self.rate) else 0

		# Tax = SGST + CGST + IGST on amount
		self.tax_amount = flt(self.amount) * (
			flt(self.sgst_percent) + flt(self.cgst_percent) + flt(self.igst_percent)
		) / 100

		# Total = amount + tax
		self.total_amount = flt(self.amount) + flt(self.tax_amount)
