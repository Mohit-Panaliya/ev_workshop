import frappe
from frappe.tests import IntegrationTestCase


class TestVehicleBrand(IntegrationTestCase):
	def test_doctype_exists(self):
		self.assertTrue(frappe.db.exists("DocType", "VehicleBrand"))
