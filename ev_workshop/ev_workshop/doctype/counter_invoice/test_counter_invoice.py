import frappe
from frappe.tests import IntegrationTestCase


class TestCounterInvoice(IntegrationTestCase):
	def test_doctype_exists(self):
		self.assertTrue(frappe.db.exists("DocType", "CounterInvoice"))
