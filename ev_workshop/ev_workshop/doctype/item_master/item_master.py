"""Item Master - Workshop-specific item catalog for EV Workshop.

This doctype is separate from ERPNext's standard Item doctype. It stores
workshop-specific item data including:
    - item_no: Unique item code (used as document name)
    - item_class: Classification (Spare Part / Service / Consumable)
    - standard_rate: MRP / part price visible to ERPNext Stock module
    - labor_cost: Fitting/labor charge (used only in custom app, not in ERPNext)
    - Tax rates: SGST, CGST, IGST percentages

Dual Pricing Logic:
    - Customer type = "Customer": Invoice includes part + labor
    - Customer type = "Retailer": Invoice includes part only (no labor)

ERPNext Stock module only sees the standard_rate (MRP). Labor cost
is a custom-app-only concept managed by the Job Master workflow.
"""

from frappe.model.document import Document


class ItemMaster(Document):
	"""Item Master controller.

	Minimal logic — this is primarily a data store. Item Master records
	are referenced by Job Item (child table of Job Master) via the
	item_no Link field.
	"""
	pass
