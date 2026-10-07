import frappe
from frappe.model.document import Document
from frappe.utils import flt, now_datetime

from ev_workshop.utils import (
	build_quote_message,
	get_company,
	get_or_create_customer,
	whatsapp_share_url,
)


class JobMaster(Document):
	def validate(self):
		self.validate_workflow()
		self.calculate_grand_total()

	def validate_workflow(self):
		# Step 1: Details tab — customer history is mandatory.
		if not self.history_no:
			frappe.throw("Please select a Customer History No. in Details tab first!")

		# Step 2: Allocation — mechanic or supervisor once work starts.
		if self.status not in ("Admitted", "Cancelled", "Completed"):
			if not self.supervisor and not self.mechanic:
				frappe.throw("Please assign a Supervisor or Mechanic in Allocation tab before proceeding!")

		# Step 3: Inspection — at least one checkpoint.
		if self.status == "Inspection" and not self._inspection_done():
			frappe.throw("Please complete inspection by checking at least one item in Inspection tab!")

		# Step 4: Parts & Labour only after inspection starts.
		if self.status == "Admitted" and self.items:
			frappe.throw("Please complete inspection first before adding parts/labour.")

		# Step 5/6: Quote/Approval require items.
		if self.status in ("Quoted", "Approved") and not self.items:
			frappe.throw("Please add at least one item in Parts and Labour tab before proceeding!")

		# Stamp approval time on manual approval.
		if self.customer_approval and not self.approval_date:
			self.approval_date = now_datetime()

	def _inspection_done(self):
		return any(
			[
				self.mirror_rh,
				self.mirror_lh,
				self.charger,
				self.toolkit,
				self.service_book,
				self.battery,
				self.horn,
				self.hl_bulb,
				self.il_bulb,
				self.tl_bulb,
				self.tyres_front,
				self.tyres_rear,
				self.scratch_damages,
				self.spare_vehicle,
			]
		)

	def calculate_grand_total(self):
		total = 0.0
		for item in self.items or []:
			qty = flt(item.qty)
			rate = flt(item.rate)
			if not item.amount and qty and rate:
				item.amount = qty * rate

			amount = flt(item.amount)
			tax_amount = amount * (flt(item.sgst_percent) + flt(item.cgst_percent) + flt(item.igst_percent)) / 100
			item.tax_amount = tax_amount
			item.total_amount = amount + tax_amount
			total += flt(item.total_amount)

		self.grand_total = total

	def send_quote_to_customer(self):
		"""WhatsApp share payload for the quote (kept for Desk buttons; JS uses api.*)."""
		if not self.items:
			frappe.throw("Please add at least one item in the Parts and Labour table before sending quote.")

		message = build_quote_message(self)
		return {"url": whatsapp_share_url(self.mobile_no, message), "message": message}

	def create_stock_entry(self):
		"""Create a Material Issue Stock Entry for spare-part lines."""
		if not self.items:
			return None

		company = get_company()
		if not company:
			frappe.throw("Please set a default Company before issuing stock.")

		abbr = frappe.db.get_value("Company", company, "abbr") or company
		stock_items = []
		for item in self.items:
			item_class = frappe.db.get_value("Item Master", item.item_no, "item_class")
			if item_class == "Spare Part":
				stock_items.append(
					{
						"item_code": item.item_no,
						"qty": flt(item.qty),
						"s_warehouse": f"Work in Progress - {abbr}",
					}
				)

		if not stock_items:
			return None

		se = frappe.get_doc(
			{
				"doctype": "Stock Entry",
				"stock_entry_type": "Material Issue",
				"company": company,
				"items": stock_items,
			}
		)
		se.insert()
		se.submit()
		frappe.msgprint(f"Stock Entry {se.name} created for spare parts.")
		return se.name

	def create_invoice(self):
		"""Create + submit a Sales Invoice (Desk-button friendly; errors shown, not swallowed)."""
		try:
			customer_name = frappe.db.get_value("Customer History Master", self.history_no, "customer_name")
			customer = get_or_create_customer(customer_name)
			company = get_company()
			if not company:
				frappe.throw("Please set a default Company before creating invoices.")

			si = frappe.get_doc(
				{
					"doctype": "Sales Invoice",
					"customer": customer,
					"company": company,
					"due_date": self.date,
					"job_reference": self.name,
					"items": [
						{
							"item_code": item.item_no,
							"item_name": item.item_name,
							"qty": item.qty,
							"rate": item.rate,
						}
						for item in self.items
					],
				}
			)
			si.insert()
			si.submit()
			return si.name
		except Exception as e:
			frappe.log_error(f"Invoice Creation Failed: {str(e)}", "Job Master Invoice")
			frappe.throw(f"Could not create Invoice: {str(e)}")
