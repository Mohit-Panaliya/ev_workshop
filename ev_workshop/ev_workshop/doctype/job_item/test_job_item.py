"""Integration tests for Job Item child table.

Job Item is a child table (istable=1) and cannot be created standalone.
These calculations are tested indirectly through Job Master tests.
See test_job_master.py for end-to-end testing of item calculations.
"""

import frappe
from frappe.tests import IntegrationTestCase
from frappe.utils import flt


class TestJobItem(IntegrationTestCase):
	"""Tests verifying Job Item amount calculations via Job Master."""

	def test_item_calculation_via_parent(self):
		"""Verify that creating a Job Master with items correctly calculates amounts.

		This is an integration test because Job Item is a child table and
		cannot be inserted independently. We create a Job Master with a
		child item row and verify the server-side calculation.
		"""
		# Prerequisites: EV Vehicle, Customer, Vehicle Ownership, and Item Master
		# must exist. These are typically created by test_job_master.setUp().

		if not frappe.db.exists("EV Vehicle", "TEST-JE-CALC-001"):
			frappe.get_doc({
				"doctype": "EV Vehicle",
				"registration_no": "TEST-JE-CALC-001",
				"model": "Calc Test Model",
				"chassis_no": "CHASSIS-CALC-001",
				"motor_no": "MOTOR-CALC-001",
			}).insert(ignore_permissions=True)

		if not frappe.db.exists("Customer", "Calc Test Customer"):
			frappe.get_doc({
				"doctype": "Customer",
				"customer_name": "Calc Test Customer",
				"customer_type": "Individual",
				"customer_group": frappe.db.get_single_value("Selling Settings", "customer_group") or "All Customer Groups",
				"territory": frappe.db.get_single_value("Selling Settings", "territory") or "All Territories",
			}).insert(ignore_permissions=True)

		if not frappe.db.exists("Vehicle Ownership", {"vehicle": "TEST-JE-CALC-001"}):
			frappe.get_doc({
				"doctype": "Vehicle Ownership",
				"vehicle": "TEST-JE-CALC-001",
				"owner_name": "Calc Test Customer",
				"is_primary": 1,
			}).insert(ignore_permissions=True)

		ownership = frappe.get_doc("Vehicle Ownership", {"vehicle": "TEST-JE-CALC-001"})

		# Ensure test item exists
		if not frappe.db.exists("Item Master", "TEST-ITEM-CALC"):
			frappe.get_doc({
				"doctype": "Item Master",
				"item_no": "TEST-ITEM-CALC",
				"item_name": "Test Calculation Item",
				"item_class": "Spare Part",
				"uom": "Nos",
				"standard_rate": 1000,
				"labor_cost": 200,
				"hsn_code": "8708",
				"sgst_percent": 9,
				"cgst_percent": 9,
			}).insert(ignore_permissions=True)

		# Create Job Master with one item
		doc = frappe.get_doc({
			"doctype": "Job Master",
			"date": frappe.utils.today(),
			"vehicle_ownership": ownership.name,
			"customer_type": "Customer",
			"service_type": "Paid",
			"km_reading": 500,
			"status": "Admitted",
			"complaints": "Calculation test",
			"items": [{
				"item_no": "TEST-ITEM-CALC",
				"qty": 2,
				"rate": 1000,
				"labor_cost": 200,
				"sgst_percent": 9,
				"cgst_percent": 9,
			}],
		})
		doc.insert(ignore_permissions=True)

		# Verify child item calculations
		item = doc.items[0]
		expected_amount = flt(2) * flt(1000)       # 2000 (part amount)
		expected_labor = flt(2) * flt(200)          # 400  (labor amount)
		expected_tax = expected_amount * 0.18        # 360  (18% GST)
		expected_total = expected_amount + expected_labor + expected_tax  # 2760

		self.assertEqual(item.amount, expected_amount)
		self.assertEqual(item.labor_amount, expected_labor)
		self.assertAlmostEqual(item.tax_amount, expected_tax, places=2)
		self.assertAlmostEqual(item.total_amount, expected_total, places=2)
		self.assertAlmostEqual(doc.grand_total, expected_total, places=2)

	def test_retailer_no_labor(self):
		"""Verify Retailer customer type gets zero labor_amount."""
		# Prerequisites same as above - using existing test data
		if not frappe.db.exists("EV Vehicle", "TEST-JE-RTL-001"):
			frappe.get_doc({
				"doctype": "EV Vehicle",
				"registration_no": "TEST-JE-RTL-001",
				"model": "Retailer Test Model",
				"chassis_no": "CHASSIS-RTL-001",
				"motor_no": "MOTOR-RTL-001",
			}).insert(ignore_permissions=True)

		if not frappe.db.exists("Customer", "Retailer Test Customer"):
			frappe.get_doc({
				"doctype": "Customer",
				"customer_name": "Retailer Test Customer",
				"customer_type": "Individual",
				"customer_group": frappe.db.get_single_value("Selling Settings", "customer_group") or "All Customer Groups",
				"territory": frappe.db.get_single_value("Selling Settings", "territory") or "All Territories",
			}).insert(ignore_permissions=True)

		if not frappe.db.exists("Vehicle Ownership", {"vehicle": "TEST-JE-RTL-001"}):
			frappe.get_doc({
				"doctype": "Vehicle Ownership",
				"vehicle": "TEST-JE-RTL-001",
				"owner_name": "Retailer Test Customer",
				"is_primary": 1,
			}).insert(ignore_permissions=True)

		ownership = frappe.get_doc("Vehicle Ownership", {"vehicle": "TEST-JE-RTL-001"})

		doc = frappe.get_doc({
			"doctype": "Job Master",
			"date": frappe.utils.today(),
			"vehicle_ownership": ownership.name,
			"customer_type": "Retailer",
			"service_type": "Paid",
			"km_reading": 100,
			"status": "Admitted",
			"complaints": "Retailer test",
			"items": [{
				"item_no": "TEST-ITEM-CALC",
				"qty": 1,
				"rate": 1000,
				"labor_cost": 200,
				"sgst_percent": 9,
				"cgst_percent": 9,
			}],
		})
		doc.insert(ignore_permissions=True)

		item = doc.items[0]
		self.assertEqual(item.labor_amount, 0)
		self.assertEqual(item.amount, 1000)
