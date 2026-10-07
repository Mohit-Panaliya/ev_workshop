import frappe
from frappe.tests import IntegrationTestCase


class TestCounterInvoiceItem(IntegrationTestCase):
	def test_doctype_exists(self):
		self.assertTrue(frappe.db.exists("DocType", "CounterInvoiceItem"))
