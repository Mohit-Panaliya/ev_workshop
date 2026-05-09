// Copyright (c) 2026, EV Workshop and contributors
// For license information, please see license.txt

// Helper function to check allocation
function check_allocation(frm) {
	if (!frm.doc.supervisor && !frm.doc.mechanic) {
		frappe.msgprint(__('Please assign a Supervisor or Mechanic in Allocation tab before proceeding!'));
		return false;
	}
	return true;
}

// Helper function to check inspection checkboxes
function check_inspection(frm) {
	var inspection_fields = [
		'mirror_rh', 'mirror_lh', 'charger', 'toolkit', 'service_book',
		'battery', 'horn', 'hl_bulb', 'il_bulb', 'tl_bulb',
		'tyres_front', 'tyres_rear', 'scratch_damages', 'spare_vehicle'
	];
	
	for (var i = 0; i < inspection_fields.length; i++) {
		// Check if field exists and is checked
		if (frm.doc.hasOwnProperty(inspection_fields[i]) && frm.doc[inspection_fields[i]]) {
			return true;
		}
	}
	
	frappe.msgprint(__('Please check at least one item in the Inspection section before proceeding!'));
	return false;
}

frappe.ui.form.on("Job Master", {
	onload: function(frm) {
		// Set default date to today if not set
		if (!frm.doc.date) {
			frm.set_value("date", frappe.datetime.get_today());
		}
	},
	
	// Auto-fetch customer details when history_no is selected
	history_no: function(frm) {
		if (frm.doc.history_no) {
			frappe.call({
				method: "frappe.client.get",
				args: {
					doctype: "Customer History Master",
					name: frm.doc.history_no
				},
				callback: function(r) {
					if (r.message) {
						frm.set_value("customer_name", r.message.customer_name || "");
						frm.set_value("mobile_no", r.message.mobile_no || "");
						frm.refresh_fields();
					}
				}
			});
		}
	},
	
	refresh: function(frm) {
		// Calculate grand total
		calculate_grand_total(frm);
		
		// Status-based action buttons with allocation check
		// Admitted -> Inspection (requires supervisor OR mechanic AND inspection checkboxes)
		if (frm.doc.status === 'Admitted') {
			frm.add_custom_button(__('Complete Inspection'), function() {
				if (!check_allocation(frm)) return;
				if (!check_inspection(frm)) return;
				frm.set_value('status', 'Inspection');
				frm.save();
			}).addClass('btn-primary');
		}
		
		// Inspection -> Quoted (Send Quote)
		if (frm.doc.status === 'Inspection') {
			frm.add_custom_button(__('Send Quote to Customer'), function() {
				if (!check_allocation(frm)) return;
				
				// Save first to ensure items are saved
				frm.save();
				
				// Refresh to get latest items from grid
				frm.refresh_field('items');
				
				// Check if items exist
				if (!frm.doc.items || frm.doc.items.length === 0) {
					frappe.msgprint(__('Please add at least one item in the Parts and Labour table before sending quote.'));
					return;
				}
				
				// Call server method to generate WhatsApp link
				frappe.call({
					method: 'ev_workshop.api.send_quote_whatsapp',
					args: {
						docname: frm.doc.name
					},
					callback: function(r) {
						if (r.message && r.message.url) {
							// Open WhatsApp Web in new tab
							window.open(r.message.url, '_blank');
							
							// Update status to Quoted
							frm.set_value('status', 'Quoted');
							frm.save();
							
							frappe.msgprint(__('Quote sent via WhatsApp! Status updated to Quoted.'));
						} else if (r.exc) {
							frappe.msgprint(__('Error: ' + r.exc));
						}
					}
				});
			}).addClass('btn-primary');
		}
		
		// Quoted -> Approved (Mark as Approved)
		if (frm.doc.status === 'Quoted') {
			frm.add_custom_button(__('Approve Quote'), function() {
				if (!check_allocation(frm)) return;
				frm.set_value('status', 'Approved');
				frm.set_value('customer_approval', 1);
				frm.save();
				frappe.msgprint(__('Quote approved! Ready for repair.'));
			}).addClass('btn-success');
		}
		
		// Approved -> Repairing (Start Repair)
		if (frm.doc.status === 'Approved') {
			frm.add_custom_button(__('Start Repair'), function() {
				if (!check_allocation(frm)) return;
				frm.set_value('status', 'Repairing');
				frm.save();
			}).addClass('btn-primary');
		}
		
		// Repairing -> Ready (Mark as Ready)
		if (frm.doc.status === 'Repairing') {
			frm.add_custom_button(__('Mark as Ready'), function() {
				if (!check_allocation(frm)) return;
				frm.set_value('status', 'Ready');
			
			// Send WhatsApp notification
			frappe.call({
				method: 'ev_workshop.api.send_ready_notification',
				args: { docname: frm.doc.name },
				callback: function(r) {
					if (r.message && r.message.url) {
						window.open(r.message.url, '_blank');
					}
				}
			});
			
			// Create Invoice
			frappe.call({
				method: 'ev_workshop.api.create_job_invoice',
				args: { docname: frm.doc.name },
				callback: function(r) {
					if (r.message) {
						frappe.msgprint(__('Invoice created: ') + r.message);
					}
				}
			});
				frm.save();
				frappe.msgprint(__('Vehicle is ready for delivery!'));
			}).addClass('btn-success');
		}
		
		// Ready -> Completed (Confirm Payment)
		if (frm.doc.status === 'Ready' && !frm.doc.payment_rcd) {
			frm.add_custom_button(__('Confirm Payment Received'), function() {
				if (!check_allocation(frm)) return;
				frappe.confirm('Are you sure you received the full payment?', function() {
					frm.set_value('payment_rcd', 1);
					frm.set_value('status', 'Completed');
					frm.save();
				});
			}).addClass('btn-success');
		}
		
		// Completed -> Create Invoice
		if (frm.doc.status === 'Completed' && frm.doc.payment_rcd) {
			frm.add_custom_button(__('Create Invoice'), function() {
				frappe.model.open_mapped_doc({
					method: "ev_workshop.api.make_invoice",
					frm: frm
				});
			});
		}
		
		// Any status -> Cancelled
		if (frm.doc.status !== 'Cancelled' && frm.doc.status !== 'Completed') {
			frm.add_custom_button(__('Cancel Job'), function() {
				frappe.confirm('Are you sure you want to cancel this job?', function() {
					frm.set_value('status', 'Cancelled');
					frm.save();
				});
			}).addClass('btn-danger');
		}
		
		// Show allocation status indicator
		show_allocation_status(frm);
	},
	
	status: function(frm) {
		// If status changes, recalculate
		calculate_grand_total(frm);
	},
	
	after_save: function(frm) {
		calculate_grand_total(frm);
	}
});

// Listen to Job Item child table changes
frappe.ui.form.on("Job Item", {
	items_add: function(frm) {
		calculate_grand_total(frm);
	},
	items_remove: function(frm) {
		calculate_grand_total(frm);
	},
	items_update: function(frm) {
		calculate_grand_total(frm);
	},
	qty: function(frm, cdt, cdn) {
		calculate_job_item_amounts(frm, cdt, cdn);
	},
	rate: function(frm, cdt, cdn) {
		calculate_job_item_amounts(frm, cdt, cdn);
	},
	item_no: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		frappe.model.get_value('Item Master', row.item_no, ['item_name', 'standard_rate', 'sgst_percent', 'cgst_percent', 'igst_percent'], function(r) {
			if(r) {
				frappe.model.set_value(cdt, cdn, 'item_name', r.item_name);
				frappe.model.set_value(cdt, cdn, 'rate', r.standard_rate);
				frappe.model.set_value(cdt, cdn, 'sgst_percent', r.sgst_percent || 0);
				frappe.model.set_value(cdt, cdn, 'cgst_percent', r.cgst_percent || 0);
				frappe.model.set_value(cdt, cdn, 'igst_percent', r.igst_percent || 0);
				setTimeout(() => {
					calculate_job_item_amounts(frm, cdt, cdn);
					calculate_grand_total(frm);
				}, 200);
			}
		});
	}
});

function calculate_grand_total(frm) {
	var total = 0;
	
	if (frm.doc.items && frm.doc.items.length > 0) {
		for (var i = 0; i < frm.doc.items.length; i++) {
			var item = frm.doc.items[i];
			if (item.total_amount) {
				total += item.total_amount;
			} else if (item.amount) {
				total += item.amount;
			}
		}
	}
	
	frm.set_value("grand_total", total);
	frm.refresh_field("grand_total");
}

function calculate_job_item_amounts(frm, cdt, cdn) {
	var child = locals[cdt][cdn];
	var qty = parseFloat(child.qty) || 1;
	var rate = parseFloat(child.rate) || 0;
	var amount = qty * rate;
	
	var tax_amount = 0;
	if (child.sgst_percent) {
		tax_amount += amount * parseFloat(child.sgst_percent) / 100;
	}
	if (child.cgst_percent) {
		tax_amount += amount * parseFloat(child.cgst_percent) / 100;
	}
	if (child.igst_percent) {
		tax_amount += amount * parseFloat(child.igst_percent) / 100;
	}
	
	var total_amount = amount + tax_amount;
	
	frappe.model.set_value(cdt, cdn, "amount", amount);
	frappe.model.set_value(cdt, cdn, "tax_amount", tax_amount);
	frappe.model.set_value(cdt, cdn, "total_amount", total_amount);
	
	setTimeout(() => calculate_grand_total(frm), 100);
}

// Show allocation status indicator with employee names
function show_allocation_status(frm) {
	if (frm.doc.supervisor || frm.doc.mechanic) {
		var allocated_to = [];
		var promises = [];
		
		if (frm.doc.supervisor) {
			promises.push(new Promise(function(resolve) {
				frappe.model.get_value('Employee', frm.doc.supervisor, 'employee_name', function(r) {
					if (r && r.employee_name) {
						resolve("Supervisor: " + r.employee_name);
					} else {
						resolve("Supervisor: " + frm.doc.supervisor);
					}
				});
			}));
		}
		
		if (frm.doc.mechanic) {
			promises.push(new Promise(function(resolve) {
				frappe.model.get_value('Employee', frm.doc.mechanic, 'employee_name', function(r) {
					if (r && r.employee_name) {
						resolve("Mechanic: " + r.employee_name);
					} else {
						resolve("Mechanic: " + frm.doc.mechanic);
					}
				});
			}));
		}
		
		Promise.all(promises).then(function(results) {
			frm.dashboard.set_headline(__("Allocated to: ") + results.join(", "));
		});
	} else {
		frm.dashboard.set_headline(__("⚠️ Not allocated - Please assign Supervisor or Mechanic"));
	}
}
