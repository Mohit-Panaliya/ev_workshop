"""EV Vehicle - Electric Vehicle master data management.

This doctype stores core EV vehicle information. Each vehicle is uniquely
identified by its registration number (used as the document name).

Fields:
    - registration_no: RTO registration number (unique, required, document name)
    - model: Vehicle model name (required)
    - chassis_no: Chassis number from manufacturer (unique, required)
    - motor_no: Electric motor serial number (unique, required)
    - battery_no: Battery pack serial number
    - controller_no: Motor controller serial number
    - converter_no: DC-DC converter serial number
    - date_of_sale: Original sale date of the vehicle

Ownership of this vehicle is tracked via Vehicle Ownership doctype,
NOT as a child table on this document.
"""

from frappe.model.document import Document


class EVVehicle(Document):
	"""EV Vehicle DocType controller.

	Minimal logic — validation is handled by Frappe's unique/required
	field constraints on the JSON definition. This class exists as an
	extension point for future business logic.
	"""
	pass
