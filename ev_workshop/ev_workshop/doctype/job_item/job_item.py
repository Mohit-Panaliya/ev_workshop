"""Job Item - Child table row for Job Master line items.

Each row in the Job Items table represents one part/service used in a
repair job. This doctype handles per-row amount calculations.

Calculation logic (mirrored in job_master.js):
    amount        = qty x rate          (part cost)
    labor_amount  = qty x labor_cost    (only for Customer type, 0 for Retailer)
    tax_amount    = amount x (sgst + cgst + igst) / 100
    total_amount  = amount + labor_amount + tax_amount

The parent Job Master's grand_total is the sum of all child total_amounts.

Note: This is a child table (istable=1) — it cannot be created or queried
standalone. It always exists as a row within a Job Master document.
"""

import frappe
from frappe.model.document import Document
from frappe.utils import flt


class JobItem(Document):
	"""Job Item child table controller.

	Handles server-side calculation of amounts when the row is saved.
	The same logic exists in job_master.js for real-time UI updates.
	"""

	def validate(self):
		"""Validate and calculate all amounts before parent save.

		Frappe calls child validate() before parent validate(), so by the
		time JobMaster.calculate_grand_total() runs, all child amounts
		are already computed.
		"""
		self.calculate_amounts()

	def calculate_amounts(self):
		"""Calculate part amount, labor, tax, and total amount.

		Server-side mirror of calculate_job_item_amounts() in job_master.js.
		"""
		qty = flt(self.qty) or 1
		rate = flt(self.rate) or 0
		labor_cost = flt(self.labor_cost) or 0

		# Part amount = qty x part rate (MRP)
		self.amount = qty * rate

		# Labor amount: only for Customer type, zero for Retailer
		# Retailers get parts-only pricing (no fitting charge)
		customer_type = self._get_customer_type()
		self.labor_amount = 0 if customer_type == "Retailer" else qty * labor_cost

		# Calculate GST on part amount only (labor is taxed separately if needed)
		self.tax_amount = self._calculate_tax(self.amount)

		# Total = part + labor + tax
		self.total_amount = self.amount + self.labor_amount + self.tax_amount

	def _get_customer_type(self):
		"""Get customer type from parent Job Master.

		Attempts multiple strategies to find the parent's customer_type:
		1. Parent document in memory (primary path - works during normal save)
		2. Form data (fast path during form submission from web)
		3. Database lookup (fallback for server-side operations)

		Returns:
			str: "Customer" or "Retailer" (defaults to "Customer")
		"""
		if self.parenttype == "Job Master" and self.parent:
			# Primary path: parent doc in memory (works for both normal save and recompute)
			parent_doc = self.get_parent_doc()
			if parent_doc and hasattr(parent_doc, 'customer_type') and parent_doc.customer_type:
				return parent_doc.customer_type

			# Fast path: form data during web request
			if hasattr(frappe, 'local') and hasattr(frappe.local, 'form_dict'):
				form_customer_type = frappe.local.form_dict.get('customer_type')
				if form_customer_type:
					return form_customer_type

			# Fallback: direct DB lookup (for API/bulk operations)
			customer_type = frappe.db.get_value("Job Master", self.parent, "customer_type")
			if customer_type:
				return customer_type

		return "Customer"  # Safe default: includes labor in calculations

	def _calculate_tax(self, amount):
		"""Calculate total tax amount (SGST + CGST + IGST).

		Tax is calculated on the part amount only, not on labor.
		This matches the Indian GST treatment for spare parts vs services.

		Args:
			amount: The taxable amount (part amount)

		Returns:
			float: Total tax amount across all applicable tax types
		"""
		if not amount:
			return 0

		tax = 0
		if self.sgst_percent:
			tax += amount * flt(self.sgst_percent) / 100
		if self.cgst_percent:
			tax += amount * flt(self.cgst_percent) / 100
		if self.igst_percent:
			tax += amount * flt(self.igst_percent) / 100

		return tax
