"""Integration tests for Job Master doctype."""

import frappe
from frappe.tests import IntegrationTestCase


class TestJobMaster(IntegrationTestCase):
	"""Tests for Job Master workflow, validations, and calculations."""

	def setUp(self):
		"""Create prerequisite records before each test."""
		# Create a test EV Vehicle
		if not frappe.db.exists("EV Vehicle", "TEST-JE-001"):
			frappe.get_doc({
				"doctype": "EV Vehicle",
				"registration_no": "TEST-JE-001",
				"model": "Test Model",
				"chassis_no": "CHASSIS-TEST-001",
				"motor_no": "MOTOR-TEST-001",
			}).insert(ignore_permissions=True)

		# Create a test Customer
		if not frappe.db.exists("Customer", "Test EV Customer"):
			frappe.get_doc({
				"doctype": "Customer",
				"customer_name": "Test EV Customer",
				"customer_type": "Individual",
				"customer_group": frappe.db.get_single_value("Selling Settings", "customer_group") or "All Customer Groups",
				"territory": frappe.db.get_single_value("Selling Settings", "territory") or "All Territories",
			}).insert(ignore_permissions=True)

		# Create a test Vehicle Ownership linking vehicle to customer
		if not frappe.db.exists("Vehicle Ownership", {"vehicle": "TEST-JE-001", "owner_name": "Test EV Customer"}):
			self.ownership = frappe.get_doc({
				"doctype": "Vehicle Ownership",
				"vehicle": "TEST-JE-001",
				"owner_name": "Test EV Customer",
				"is_primary": 1,
			}).insert(ignore_permissions=True)
		else:
			self.ownership = frappe.get_doc("Vehicle Ownership", {"vehicle": "TEST-JE-001", "owner_name": "Test EV Customer"})

	def test_job_master_creation(self):
		"""Test that a Job Master can be created with valid required fields."""
		doc = frappe.get_doc({
			"doctype": "Job Master",
			"date": frappe.utils.today(),
			"vehicle_ownership": self.ownership.name,
			"customer_type": "Customer",
			"service_type": "Paid",
			"km_reading": 100,
			"status": "Admitted",
			"complaints": "Test complaint",
		})
		doc.insert(ignore_permissions=True)
		self.assertEqual(doc.doctype, "Job Master")
		self.assertEqual(doc.status, "Admitted")
		self.assertEqual(doc.customer_type, "Customer")

	def test_status_default_is_admitted(self):
		"""Verify new jobs default to Admitted status."""
		doc = frappe.get_doc({
			"doctype": "Job Master",
			"date": frappe.utils.today(),
			"vehicle_ownership": self.ownership.name,
			"customer_type": "Customer",
			"service_type": "Paid",
			"km_reading": 50,
			"complaints": "Default status test",
		})
		doc.insert(ignore_permissions=True)
		self.assertEqual(doc.status, "Admitted")

	def test_totals_include_tax(self):
		"""Part 2x100 + 18% GST must total 236 (row-level math)."""
		row = frappe.get_doc(
			{
				"doctype": "Job Item",
				"item_no": "TEST-ITEM",
				"item_name": "Test Item",
				"qty": 2,
				"rate": 100,
				"sgst_percent": 9,
				"cgst_percent": 9,
			}
		)
		row.calculate_amounts()
		self.assertEqual(row.amount, 200)
		self.assertEqual(row.tax_amount, 36)
		self.assertEqual(row.total_amount, 236)

	def test_quoted_without_items_fails(self):
		"""Quoted status with no items must fail validation."""
		doc = frappe.get_doc({
			"doctype": "Job Master",
			"date": frappe.utils.today(),
			"vehicle_ownership": self.ownership.name,
			"customer_type": "Customer",
			"service_type": "Paid",
			"km_reading": 100,
			"status": "Quoted",
			"complaints": "No items yet",
		})
		self.assertRaises(frappe.ValidationError, doc.insert, ignore_permissions=True)
