import frappe
import unittest

class TestItemMaster(unittest.TestCase):
	def test_item_master_creation(self):
		# Test that Item Master can be created
		doc = frappe.get_doc({
			"doctype": "Item Master",
			"item_no": "TEST-001",
			"item_name": "Test Item",
			"item_class": "Spare Part",
			"uom": "Nos",
			"standard_rate": 100,
			"hsn_code": "1234"
		})
		self.assertEqual(doc.doctype, "Item Master")
		self.assertEqual(doc.item_no, "TEST-001")
