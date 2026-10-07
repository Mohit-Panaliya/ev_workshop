import frappe
from frappe.model.document import Document


class CustomerHistoryMaster(Document):
	def validate(self):
		# Mirror the document name (autoname CHM-.####.) into the ID field
		# so list views/reports can use either. No manual counter — the
		# naming rule is the single source of sequence.
		if not self.customer_history_master_id and self.name:
			self.customer_history_master_id = self.name

		if self.email and "@" not in self.email:
			frappe.throw("Please enter a valid email address.")
