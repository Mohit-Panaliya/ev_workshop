import frappe
import unittest


class TestJobMaster(unittest.TestCase):
	def _make_history(self):
		vehicle = frappe.get_doc(
			{
				"doctype": "EV Vehicle",
				"registration_no": "GJ05EV0001",
				"model": "Test Model",
				"chassis_no": "CHS0001",
				"motor_no": "MTR0001",
			}
		).insert()
		return (
			frappe.get_doc(
				{
					"doctype": "Customer History Master",
					"vehicle": vehicle.name,
					"customer_name": "Test Customer",
					"mobile_no": "9876543210",
				}
			)
			.insert()
			.name
		)

	def test_job_master_totals(self):
		history_no = self._make_history()
		doc = frappe.get_doc(
			{
				"doctype": "Job Master",
				"date": frappe.utils.today(),
				"history_no": history_no,
				"service_type": "Paid",
				"km_reading": 100,
				"status": "Admitted",
				"complaints": "Test complaint",
				"items": [
					{
						"item_no": "TEST-ITEM",
						"item_name": "Test Item",
						"qty": 2,
						"rate": 100,
						"sgst_percent": 9,
						"cgst_percent": 9,
					}
				],
			}
		)
		doc.insert()
		# amount 200 + 18% tax = 236
		self.assertEqual(doc.items[0].total_amount, 236)
		self.assertEqual(doc.grand_total, 236)

	def test_workflow_guards(self):
		history_no = self._make_history()
		doc = frappe.get_doc(
			{
				"doctype": "Job Master",
				"date": frappe.utils.today(),
				"history_no": history_no,
				"service_type": "Paid",
				"km_reading": 100,
				"status": "Quoted",
				"complaints": "No items yet",
			}
		)
		# Quoted without items must fail validation
		self.assertRaises(frappe.ValidationError, doc.insert)
