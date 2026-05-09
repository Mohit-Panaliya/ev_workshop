import frappe
from frappe.model.document import Document

class JobItem(Document):
	def validate(self):
		self.calculate_amounts()
	
	def calculate_amounts(self):
		# Calculate amount = qty * rate
		if self.qty and self.rate:
			self.amount = flt(self.qty) * flt(self.rate)
		else:
			self.amount = 0
		
		# Calculate tax amount (SGST + CGST + IGST)
		tax_amount = 0
		if self.amount:
			if self.sgst_percent:
				tax_amount += flt(self.amount) * flt(self.sgst_percent) / 100
			if self.cgst_percent:
				tax_amount += flt(self.amount) * flt(self.cgst_percent) / 100
			if self.igst_percent:
				tax_amount += flt(self.amount) * flt(self.igst_percent) / 100
		
		self.tax_amount = tax_amount
		
		# Calculate total amount = amount + tax amount
		self.total_amount = flt(self.amount) + flt(self.tax_amount)

def flt(value):
	"""Helper function to convert value to float"""
	try:
		return float(value or 0)
	except:
		return 0
