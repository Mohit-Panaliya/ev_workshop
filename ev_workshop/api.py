import frappe
from frappe.model.mapper import get_mapped_doc

@frappe.whitelist()
def get_erpnext_items(item_class=None, search_text=None, limit=50):
	"""
	Fetch items from ERPNext Item doctype for invoicing
	Usage: frappe.call('ev_workshop.api.get_erpnext_items', {'item_class': 'Spare Part'})
	"""
	filters = {"disabled": 0}
	
	# Filter by item class if provided (custom field)
	if item_class:
		filters["ev_item_class"] = item_class
	
	# Search by item code or name
	if search_text:
		filters["item_code"] = ["like", f"%{search_text}%"]
	
	items = frappe.get_all(
		"Item",
		fields=[
			"name",
			"item_code",
			"item_name",
			"item_group",
			"stock_uom",
			"standard_rate",
			"ev_item_class",
			"ev_hsn_code",
			"ev_sgst_percent",
			"ev_cgst_percent",
			"ev_igst_percent"
		],
		filters=filters,
		order_by="item_name",
		limit=limit
	)
	
	return items

@frappe.whitelist()
def send_quote_whatsapp(docname):
	"""Send quote via WhatsApp to customer"""
	doc = frappe.get_doc("Job Master", docname)
	
	# Validate items exist
	if not doc.items:
		frappe.throw("Please add at least one item in the Parts and Labour table before sending quote.")
	
	# Get customer mobile number
	mobile = doc.mobile_no
	if not mobile:
		frappe.throw("Customer mobile number is not available. Please update the customer details.")
	
	# Clean mobile number (remove spaces, plus, etc.)
	mobile = ''.join(filter(str.isdigit, mobile))
	if mobile.startswith("0"):
		mobile = mobile[1:]
	if not mobile.startswith("91"):
		mobile = "91" + mobile
	
	# Build WhatsApp message
	message = f"*QUOTE - {doc.name}*\n\n"
	message += f"*Customer:* {doc.customer_name}\n"
	message += f"*Service Type:* {doc.service_type}\n\n"
	message += "*ITEMS:*\n"
	message += "```\n"
	
	for item in doc.items:
		item_name = item.item_name or item.item_no
		message += f"{item_name}\n"
		message += f"   Qty: {item.qty} x Rs. {item.rate}\n"
		message += f"   Total: Rs. {item.total_amount}\n\n"
	
	message += "```\n"
	message += f"*GRAND TOTAL: Rs. {doc.grand_total}*\n\n"
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

@frappe.whitelist()
def send_ready_notification(docname):
	"""Send vehicle ready notification via WhatsApp"""
	doc = frappe.get_doc("Job Master", docname)
	
	# Get customer mobile number
	mobile = doc.mobile_no
	if not mobile:
		frappe.throw("Customer mobile number is not available.")
	
	# Clean mobile number
	mobile = ''.join(filter(str.isdigit, mobile))
	if mobile.startswith("0"):
		mobile = mobile[1:]
	if not mobile.startswith("91"):
		mobile = "91" + mobile
	
	# Build WhatsApp message
	message = f"*Vehicle Ready - {doc.name}*\n\n"
	message += f"*Customer:* {doc.customer_name}\n"
	message += f"*Service Type:* {doc.service_type}\n\n"
	message += "*Work Completed:*\n"
	message += "```\n"
	
	for item in doc.items:
		item_name = item.item_name or item.item_no
		message += f"{item_name} - Rs. {item.total_amount}\n"
	
	message += "```\n"
	message += f"*Total Amount: Rs. {doc.grand_total}*\n\n"
	message += "Please visit to collect your vehicle. Payment pending."
	
	# URL encode the message
	import urllib.parse
	encoded_message = urllib.parse.quote(message)
	
	# Generate WhatsApp Web URL
	whatsapp_url = f"https://web.whatsapp.com/send?phone={mobile}&text={encoded_message}"
	
	return {
		"url": whatsapp_url,
		"message": message
	}

@frappe.whitelist()
def make_invoice(source_name, target_doc=None):
	"""
	Create a Sales Invoice from Job Master
	This is called from the "Create Invoice" button in Job Master
	"""
	def set_missing_values(source, target):
		target.customer = frappe.db.get_value("Customer History Master", source.history_no, "customer_name")
		target.company = frappe.defaults.get_user_default("company") or frappe.db.get_default("company")
		
		# Get customer details from history
		customer_name = frappe.db.get_value("Customer History Master", source.history_no, "customer_name")
		if customer_name:
			# Try to find existing customer
			customer = frappe.db.exists("Customer", {"customer_name": customer_name})
			if customer:
				target.customer = customer
			else:
				# Create new customer if not exists
				new_customer = frappe.get_doc({
					"doctype": "Customer",
					"customer_name": customer_name,
					"customer_type": "Individual",
					"naming_series": "CUST-.YYYY.-"
				})
				try:
					new_customer.insert()
					target.customer = new_customer.name
				except:
					pass
		
		# Calculate total
		target.total = source.grand_total
	
	doc = get_mapped_doc("Job Master", source_name, {
		"Job Master": {
			"doctype": "Sales Invoice",
			"field_map": {
				"name": "job_reference",
				"grand_total": "total"
			}
		}
	}, target_doc, set_missing_values)
	
	return doc

@frappe.whitelist()
def create_job_invoice(docname):
    """Create Sales Invoice from Job Master"""
    doc = frappe.get_doc("Job Master", docname)
    
    if not doc.items:
        return None
    
    try:
        customer_name = frappe.db.get_value("Customer History Master", doc.history_no, "customer_name")
        
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
        
        company = frappe.defaults.get_user_default("company") or frappe.db.get_default("company")
        
        # Create Sales Invoice
        si = frappe.get_doc({
            "doctype": "Sales Invoice",
            "customer": customer,
            "company": company,
            "due_date": doc.date,
            "job_reference": doc.name,
            "items": [
                {
                    "item_code": item.item_no,
                    "item_name": item.item_name,
                    "qty": item.qty,
                    "rate": item.rate,
                    "amount": item.amount,
                    "income_account": "Sales - EI",
                    "cost_center": "Main - EI"
                } for item in doc.items
            ]
        })
        si.insert()
        si.submit()
        return si.name
    except Exception as e:
        frappe.log_error(f"Invoice Creation Failed: {str(e)}", "Job Master Invoice")
        return None
