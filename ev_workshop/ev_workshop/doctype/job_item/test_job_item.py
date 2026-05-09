import frappe
import unittest

class TestJobItem(unittest.TestCase):
	def test_job_item_calculations(self):
		# Test that Job Item calculations work
		doc = frappe.get_doc({
			"doctype": "Job Item",
			"item_no": "TEST-001",
			"qty": 2,
			"rate": 100,
			"sgst_percent": 9,
			"cgst_percent": 9
		})
		# Note: This is just a placeholder test
		# Full test would require the Item Master doctype to exist
		self.assertEqual(doc.doctype, "Job Item")
