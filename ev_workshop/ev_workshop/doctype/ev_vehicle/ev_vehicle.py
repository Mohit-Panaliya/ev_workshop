"""EV Vehicle - Electric Vehicle master data management.

RTO vehicles are named by registration_no; NON-RTO vehicles (no
registration) get a VEH-.#### series name. Registration is mandatory
unless the NON-RTO toggle is set (PHP locked rule).
"""

import frappe
from frappe.model.document import Document
from frappe.model.naming import make_autoname


class EVVehicle(Document):
	def autoname(self):
		if self.registration_no:
			self.name = self.registration_no.strip().upper()
		else:
			self.name = make_autoname("VEH-.####")

	def validate(self):
		if not self.is_non_rto and not self.registration_no:
			frappe.throw("Registration No is mandatory unless the vehicle is marked NON-RTO.")
