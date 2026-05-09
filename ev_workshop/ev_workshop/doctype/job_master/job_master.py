import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime

class JobMaster(Document):
	def validate(self):
		self.calculate_grand_total()
	
	def calculate_grand_total(self):
		# Calculate grand total from all job items
		total = 0
		if self.items:
			for item in self.items:
				# Calculate amount if not set
				if not item.amount and item.qty and item.rate:
					item.amount = float(item.qty) * float(item.rate)
				
				# Calculate tax
				tax_amount = 0
				if item.amount:
					if item.sgst_percent:
						tax_amount += float(item.amount) * float(item.sgst_percent) / 100
					if item.cgst_percent:
						tax_amount += float(item.amount) * float(item.cgst_percent) / 100
					if item.igst_percent:
						tax_amount += float(item.amount) * float(item.igst_percent) / 100
					
					item.tax_amount = tax_amount
					item.total_amount = float(item.amount) + tax_amount
					total += item.total_amount
		
		self.grand_total = total
	
	def before_save(self):
		# Auto-calculate before saving
		self.calculate_grand_total()
	
	def on_update(self):
		# WORKFLOW VALIDATION
		# Step 1: Details Tab - Customer details (history_no, customer_name required)
		if not self.history_no:
			frappe.throw("Please select a Customer History No. in Details tab first!")
		
		# Step 2: Allocation - Require mechanic OR supervisor before proceeding
		if self.status not in ["Admitted", "Cancelled", "Completed"]:
			if not self.supervisor and not self.mechanic:
				frappe.throw("Please assign a Supervisor or Mechanic in Allocation tab before proceeding!")
		
		# Step 3: Inspection - Require at least one checkbox before Parts & Labour
		if self.status == "Inspection":
			# Check if any inspection checkbox is checked
			inspection_done = (
    				self.mirror_rh or
    				self.mirror_lh or
    				self.charger or
    				self.toolkit or
    				self.service_book or
    				self.battery or
    				self.horn or
    				self.hl_bulb or
    				self.il_bulb or
    				self.tl_bulb or
    				self.tyres_front or
    				self.tyres_rear or
    				self.scratch_damages or
    				self.spare_vehicle
			)
			if not inspection_done:
				frappe.throw("Please complete inspection by checking at least one item in Inspection tab!")
		
		# Step 4: Parts & Labour - Prevent adding parts if not in Inspection/Quoted/Approved status
		if self.status == "Admitted":
			if self.items and len(self.items) > 0:
				frappe.throw("Please complete inspection first before adding parts/labour.")
		
		# Step 5: Send Quote - Require at least one item
		if self.status == "Quoted" and self.items:
			pass  # Items added, can proceed
		elif self.status == "Quoted" and not self.items:
			frappe.throw("Please add at least one item in Parts and Labour tab before proceeding!")
		
		# Step 6: Prevent approval without items
		if self.status == "Approved" and (not self.items or len(self.items) == 0):
			frappe.throw("Cannot approve without items! Please add parts/labour first.")
		
		# Set approval date when customer approves (manual approval)
		if self.customer_approval and not self.approval_date:
			self.approval_date = now_datetime()

	def send_quote_to_customer(self):
		"""Send quote via WhatsApp to customer"""
		# Validate items exist
		if not self.items:
			frappe.throw("Please add at least one item in the Parts and Labour table before sending quote.")
		
		# Get customer mobile number
		mobile = self.mobile_no
		if not mobile:
			frappe.throw("Customer mobile number is not available. Please update the customer details.")
		
		# Clean mobile number (remove spaces, plus, etc.)
		mobile = ''.join(filter(str.isdigit, mobile))
		if mobile.startswith("0"):
			mobile = mobile[1:]
		if not mobile.startswith("91"):
			mobile = "91" + mobile
		
		# Build WhatsApp message
		message = f"*QUOTE - {self.name}*\n\n"
		message += f"*Customer:* {self.customer_name}\n"
		message += f"*Service Type:* {self.service_type}\n\n"
		message += "*ITEMS:*\n"
		message += "```\n"
		
		for item in self.items:
			item_name = item.item_name or item.item_no
			message += f"{item_name}\n"
			message += f"   Qty: {item.qty} x Rs. {item.rate}\n"
			message += f"   Total: Rs. {item.total_amount}\n\n"
		
		message += "```\n"
		message += f"*GRAND TOTAL: Rs. {self.grand_total}*\n\n"
		message += "Please approve to proceed with repair."
		
		# URL encode the message
		import urllib.parse
		encoded_message = urllib.parse.quote(message)
		
		# Generate WhatsApp Web URL
		whatsapp_url = f"https://web.whatsapp.com/send?phone={mobile}&text={encoded_message}"
		
		return {
			"url": whatsapp_url,
			"message": message
		}
	
	def on_submit(self):
		# Check if supervisor or mechanic is assigned
		if not self.supervisor and not self.mechanic:
			frappe.throw("Please assign a Supervisor or Mechanic in Allocation tab before proceeding!")
		
		# Prevent submission if status is still Admitted
		if self.status == "Admitted":
			frappe.throw("Please use the 'Complete Inspection' button to proceed. Cannot submit in Admitted status.")
		
		# Check if payment is received before submission
		if not self.payment_rcd:
			frappe.throw("Cannot Submit Job Card until Payment is Received.")
		
		# Stock Entry creation disabled for now
		# self.create_stock_entry()
		
		frappe.msgprint(__("Job Master submitted successfully. Invoice will be created manually if needed."))
		
	
	def create_stock_entry(self):
		"""Create Stock Entry for spare parts when job is submitted"""
		if not self.items:
			return
		
		# Get company
		company = frappe.defaults.get_user_default("company")
		if not company:
			company = frappe.db.get_default("company")
		
		# Build items list for spare parts only
		stock_items = []
		for item in self.items:
			# Check if item is a Spare Part
			item_class = frappe.db.get_value("Item Master", item.item_no, "item_class")
			if item_class == "Spare Part":
				stock_items.append({
					"item_code": item.item_no,
					"qty": item.qty,
					"s_warehouse": "Work in Progress - " + company.split()[0] if company else "Stores - EI",
					"t_warehouse": None
				})
		
		if stock_items:
			try:
				se = frappe.get_doc({
					"doctype": "Stock Entry",
					"stock_entry_type": "Material Issue",
					"company": company,
					"items": stock_items
				})
				se.insert()
				se.submit()
				frappe.msgprint(f"Stock Entry {se.name} created for spare parts.")
			except Exception as e:
				frappe.log_error(f"Stock Entry Creation Failed: {str(e)}", "Job Master Stock Entry")
				frappe.msgprint(f"Note: Could not create Stock Entry. Error: {str(e)}")
	
	def create_invoice(self):
		"""Create Sales Invoice from Job Master"""
		try:
			customer_name = frappe.db.get_value("Customer History Master", self.history_no, "customer_name")
			
			# Find or create customer
			customer = frappe.db.exists("Customer", {"customer_name": customer_name})
			if not customer:
				new_customer = frappe.get_doc({
					"doctype": "Customer",
					"customer_name": customer_name,
					"customer_type": "Individual",
					"naming_series": "CUST-.YYYY.-"
				})
				new_customer.insert()
				customer = new_customer.name
			
			# Get company
			company = frappe.defaults.get_user_default("company") or frappe.db.get_default("company")
			
			# Create Sales Invoice
			si = frappe.get_doc({
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
						"amount": item.amount,
						"income_account": "Sales - EI",
						"cost_center": "Main - EI"
					} for item in self.items
				]
			})
			si.insert()
			si.submit()
			return si.name
		except Exception as e:
			frappe.log_error(f"Invoice Creation Failed: {str(e)}", "Job Master Invoice")
			frappe.msgprint(f"Note: Could not create Invoice. Error: {str(e)}")
			return None
