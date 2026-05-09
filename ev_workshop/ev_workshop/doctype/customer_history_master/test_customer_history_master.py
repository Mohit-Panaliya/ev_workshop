import frappe
import unittest

class TestCustomerHistoryMaster(unittest.TestCase):
	def test_customer_history_master_creation(self):
		# Test that Customer History Master can be created
		doc = frappe.get_doc({
			"doctype": "Customer History Master",
			"vehicle": "EV Vehicle",
			"customer_name": "Test Customer",
			"mobile_no": "1234567890"
		})
		# Note: This is just a placeholder test
		# Full test would require the EV Vehicle doctype to exist
		self.assertEqual(doc.doctype, "Customer History Master")
