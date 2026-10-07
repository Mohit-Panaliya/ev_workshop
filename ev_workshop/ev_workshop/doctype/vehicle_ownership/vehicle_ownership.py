"""Vehicle Ownership - Links customers to their vehicles.

This doctype represents the relationship between a customer and an EV Vehicle.
Multiple ownership records can exist per vehicle (e.g., co-owners), but only
one can be marked as the primary owner. Insurance, GST, and remarks data are
stored here (not on EV Vehicle).

Naming: VEH-OWN-.##### (auto-incremented)
"""

import frappe
from frappe.model.document import Document


class VehicleOwnership(Document):
	"""
	Vehicle Ownership DocType.
	Links customers to vehicles and manages ownership details,
	insurance information, and GST details.

	Key fields:
		- vehicle: Link to EV Vehicle (required)
		- owner_name: Link to Customer (required)
		- is_primary: Check - marks the primary owner for this vehicle
		- insurance_policy_no / policy_expiry: Insurance details
		- gst_no: GST registration number
	"""

	def validate(self):
		"""Run all validations before save."""
		self.fetch_vehicle_details()
		self.fetch_customer_details()
		self.validate_primary_owner()

	def fetch_vehicle_details(self):
		"""Auto-fetch registration number and model from the linked EV Vehicle.

		Populates read-only fields so the user sees vehicle info without
		having to navigate to the vehicle record.
		"""
		if not self.vehicle:
			return

		vehicle = frappe.db.get_value(
			"EV Vehicle",
			self.vehicle,
			["registration_no", "model"],
			as_dict=True
		)

		if vehicle:
			self.registration_no = vehicle.registration_no or ""
			self.model = vehicle.model or ""

	def fetch_customer_details(self):
		"""Auto-fetch customer name and mobile number from the linked Customer.

		Populates read-only fields for display purposes.
		"""
		if not self.owner_name:
			return

		customer = frappe.db.get_value(
			"Customer",
			self.owner_name,
			["customer_name", "mobile_no"],
			as_dict=True
		)

		if customer:
			self.customer_name = customer.customer_name or self.owner_name
			self.mobile_no = customer.mobile_no or ""

	def validate_primary_owner(self):
		"""Ensure only one primary owner per vehicle.

		When a record is marked as primary, any other ownership record
		for the same vehicle that was previously primary gets unmarked.
		This prevents ambiguity in which owner to bill/contact.
		"""
		if not self.is_primary or not self.vehicle:
			return

		# Find other primary ownership records for the same vehicle
		existing = frappe.get_all(
			"Vehicle Ownership",
			filters={
				"vehicle": self.vehicle,
				"is_primary": 1,
				"name": ["!=", self.name],  # exclude self
			},
			pluck="name"
		)

		# Unmark previous primary owners
		for record_name in existing:
			frappe.db.set_value("Vehicle Ownership", record_name, "is_primary", 0)

		if existing:
			frappe.msgprint(
				__("Previous primary owner(s) have been unmarked for this vehicle."),
				alert=True
			)
