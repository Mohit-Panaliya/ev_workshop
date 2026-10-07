import frappe
from frappe.model.document import Document
from frappe.utils import flt


class JobLabour(Document):
	def validate(self):
		self.calculate_line_total()

	def calculate_line_total(self):
		base = flt(self.rate) * flt(self.qty)
		gst = 0.0
		if self.labour_master:
			master = frappe.db.get_value(
				"Labour Master", self.labour_master, ["taxable", "gst_rate"], as_dict=True
			)
			if master and master.taxable:
				gst = base * flt(master.gst_rate) / 100
		self.line_total = base + gst
