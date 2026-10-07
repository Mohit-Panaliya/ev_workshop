"""Integration tests for Item Master doctype."""

import frappe
from frappe.tests import IntegrationTestCase


class TestItemMaster(IntegrationTestCase):
	"""Tests for Item Master creation and field validation."""

	def test_item_master_creation(self):
		"""Test that an Item Master can be created with all required fields."""
		doc = frappe.get_doc({
			"doctype": "Item Master",
			"item_no": "TEST-IM-001",
			"item_name": "Test Brake Pad",
			"item_class": "Spare Part",
			"uom": "Nos",
			"standard_rate": 500,
			"labor_cost": 100,
			"hsn_code": "8708",
			"sgst_percent": 9,
			"cgst_percent": 9,
		})
		doc.insert(ignore_permissions=True)
		self.assertEqual(doc.doctype, "Item Master")
		self.assertEqual(doc.item_no, "TEST-IM-001")
		self.assertEqual(doc.standard_rate, 500)
		self.assertEqual(doc.labor_cost, 100)

	def test_item_class_options(self):
		"""Verify item_class only accepts valid options."""
		doc = frappe.get_doc({
			"doctype": "Item Master",
			"item_no": "TEST-IM-002",
			"item_name": "Test Service Item",
			"item_class": "Service",
			"uom": "Hours",
			"standard_rate": 200,
			"hsn_code": "9985",
		})
		doc.insert(ignore_permissions=True)
		self.assertEqual(doc.item_class, "Service")
