"""Job Master - Main DocType for EV Workshop job card management.

This is the central document that tracks a vehicle repair job from admission
through completion. It manages the full lifecycle:

	Admitted -> Inspection -> Quoted -> Approved -> Repairing -> Ready -> Completed

Key concepts:
	- Vehicle Ownership: Links the job to a specific customer + vehicle pair
	- Customer Type: Drives pricing logic (Customer = part+labor, Retailer = part only)
	- Items: Child table of Job Item rows (parts, labor, taxes)
	- Grand Total: Sum of all item total_amounts (recalculated on every save)

Workflow buttons are defined in job_master.js. Server-side validation in
validate() enforces status-specific rules (e.g., can't add items before inspection).
"""

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime, flt


class JobMaster(Document):
	"""Handles job card workflow, validations, and calculations."""

	def validate(self):
		"""Validate document before saving.

		Order matters: company default first (invoice/stock need it), then
		child amounts (in case customer_type changed), workflow rules,
		approval stamp, grand total.
		"""
		self.set_company_default()
		self.recompute_child_amounts()
		self.validate_vehicle_ownership()
		self.validate_workflow_status()
		self.set_approval_date()
		self.calculate_grand_total()

	def set_company_default(self):
		"""Default company from user/global defaults (ERPNext linkage)."""
		if not self.company:
			self.company = frappe.defaults.get_user_default("company") or frappe.db.get_default("company")

	def recompute_child_amounts(self):
		"""Recompute amounts on part rows and labour rows.

		Part rows delegate to their own calculate_amounts(); labour rows are
		rate x qty plus the master's GST when taxable. Needed when the
		parent's customer_type changes server-side (e.g., via bulk update
		or API), because child validate may not fire again.
		"""
		for item in self.items or []:
			item.calculate_amounts(customer_type=self.customer_type or "Customer")
		for labour in self.job_labours or []:
			self.calculate_labour_line(labour)

	def calculate_labour_line(self, labour):
		"""line_total = rate x qty (+ GST when the master is taxable)."""
		base = flt(labour.rate) * flt(labour.qty)
		gst = 0.0
		if labour.labour_master:
			master = frappe.db.get_value(
				"Labour Master", labour.labour_master, ["taxable", "gst_rate"], as_dict=True
			)
			if master and master.taxable:
				gst = base * flt(master.gst_rate) / 100
		labour.line_total = base + gst

	def validate_vehicle_ownership(self):
		"""Ensure vehicle ownership is selected before saving."""
		if not self.vehicle_ownership:
			frappe.throw("Please select a Vehicle Ownership in Details tab first!")

	def validate_workflow_status(self):
		"""Validate status-specific requirements.

		Enforces the business rules at each workflow stage:
		- Cancelled/Completed: No further validation (terminal states)
		- Admitted: No items allowed yet (inspection needed first)
		- All other active states: Require allocation (supervisor or mechanic)
		- Inspection: At least one inspection checkbox must be checked
		- Quoted/Approved: Must have at least one item
		"""
		# Skip validation for terminal states
		if self.status in ["Cancelled", "Completed"]:
			return

		# Require allocation for all active statuses except Admitted
		if self.status != "Admitted":
			if not self.supervisor and not self.mechanic:
				frappe.throw(
					"Please assign a Supervisor or Mechanic in Allocation tab before proceeding!"
				)

		# Prevent adding parts/labour before inspection is complete
		if self.status == "Admitted" and (self.items or self.job_labours):
			frappe.throw("Please complete inspection first before adding parts/labour.")

		# Inspection: must check at least one item
		if self.status == "Inspection":
			self._validate_inspection_completed()

		# Quoted and Approved both require items
		if self.status in ["Quoted", "Approved"] and not self.items:
			frappe.throw(
				"Please add at least one item in Parts and Labour tab before proceeding!"
			)

	def _validate_inspection_completed(self):
		"""Check if at least one inspection item is checked.

		These 14 fields represent the physical checklist items the mechanic
		must inspect when the vehicle is admitted.
		"""
		inspection_fields = [
			"mirror_rh", "mirror_lh", "charger", "toolkit", "service_book",
			"battery", "horn", "hl_bulb", "il_bulb", "tl_bulb",
			"tyres_front", "tyres_rear", "scratch_damages", "spare_vehicle",
		]
		if not any(self.get(field) for field in inspection_fields):
			frappe.throw(
				"Please complete inspection by checking at least one item in Inspection tab!"
			)

	def set_approval_date(self):
		"""Auto-set approval datetime when customer approves the quote.

		This timestamp is used for reporting and audit trails.
		"""
		if self.customer_approval and not self.approval_date:
			self.approval_date = now_datetime()

	def calculate_grand_total(self):
		"""Grand total = parts total + labour total.

		Part-line math lives in recompute_child_amounts(); labour lines are
		added here so the header always reflects both.
		"""
		total = flt(0)

		for item in self.items or []:
			total += flt(item.total_amount)

		for labour in self.job_labours or []:
			total += flt(labour.line_total)

		self.grand_total = total

	def create_invoice(self):
		"""Delegate invoice creation to the API layer.

		This method is called from the JS frontend to create a Sales Invoice
		linked to this job card.
		"""
		return frappe.get_attr("ev_workshop.api.create_job_invoice")(self.name)
