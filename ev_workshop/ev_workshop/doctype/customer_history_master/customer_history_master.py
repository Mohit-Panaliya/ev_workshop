import frappe
from frappe.model.document import Document

class CustomerHistoryMaster(Document):
    def before_insert(self):
        # Generate the ID in format CHM-0001, CHM-0002, etc.
        if not self.customer_history_master_id:
            # Get the last created document to generate next number
            last_doc = frappe.get_all(
                "Customer History Master",
                fields=["customer_history_master_id"],
                order_by="creation desc",
                limit=1
            )
            
            if last_doc and last_doc[0].customer_history_master_id:
                # Extract the number from the last ID and increment
                try:
                    last_num = int(last_doc[0].customer_history_master_id.split("-")[1])
                    new_num = last_num + 1
                except:
                    new_num = 1
            else:
                new_num = 1
            
            self.customer_history_master_id = f"CHM-{new_num:04d}"
