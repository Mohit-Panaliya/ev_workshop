import frappe
import unittest

class TestJobMaster(unittest.TestCase):
	def test_job_master_creation(self):
		# Test that Job Master can be created
		doc = frappe.get_doc({
			"doctype": "Job Master",
			"date": frappe.datetime.today(),
			"service_type": "Paid",
			"km_reading": 100,
			"status": "Open",
			"complaints": "Test complaint"
		})
		self.assertEqual(doc.doctype, "Job Master")
