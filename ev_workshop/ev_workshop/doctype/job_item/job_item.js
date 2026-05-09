// Copyright (c) 2026, EV Workshop and contributors
// For license information, please see license.txt

frappe.ui.form.on("Job Item", {
	// Auto-fetch item details when item is selected
	item_no: function(frm, cdt, cdn) {
		var child = locals[cdt][cdn];
		if (child.item_no) {
			frappe.call({
				method: "frappe.client.get",
				args: {
					doctype: "Item Master",
					name: child.item_no
				},
				callback: function(r) {
					if (r.message) {
						var item = r.message;
						frappe.model.set_value(cdt, cdn, "item_name", item.item_name || "");
						frappe.model.set_value(cdt, cdn, "rate", item.standard_rate || 0);
						frappe.model.set_value(cdt, cdn, "sgst_percent", item.sgst_percent || 0);
						frappe.model.set_value(cdt, cdn, "cgst_percent", item.cgst_percent || 0);
						frappe.model.set_value(cdt, cdn, "igst_percent", item.igst_percent || 0);
						frappe.ui.form.refresh();
					}
				}
			});
		}
	},
	// Recalculate amounts when qty or rate changes
	qty: function(frm, cdt, cdn) {
		calculate_job_item_amounts(frm, cdt, cdn);
	},
	rate: function(frm, cdt, cdn) {
		calculate_job_item_amounts(frm, cdt, cdn);
	},
	sgst_percent: function(frm, cdt, cdn) {
		calculate_job_item_amounts(frm, cdt, cdn);
	},
	cgst_percent: function(frm, cdt, cdn) {
		calculate_job_item_amounts(frm, cdt, cdn);
	},
	igst_percent: function(frm, cdt, cdn) {
		calculate_job_item_amounts(frm, cdt, cdn);
	}
});

function calculate_job_item_amounts(frm, cdt, cdn) {
	var child = locals[cdt][cdn];
	var qty = child.qty || 1;
	var rate = child.rate || 0;
	var amount = qty * rate;
	
	var tax_amount = 0;
	if (child.sgst_percent) {
		tax_amount += amount * child.sgst_percent / 100;
	}
	if (child.cgst_percent) {
		tax_amount += amount * child.cgst_percent / 100;
	}
	if (child.igst_percent) {
		tax_amount += amount * child.igst_percent / 100;
	}
	
	var total_amount = amount + tax_amount;
	
	frappe.model.set_value(cdt, cdn, "amount", amount);
	frappe.model.set_value(cdt, cdn, "tax_amount", tax_amount);
	frappe.model.set_value(cdt, cdn, "total_amount", total_amount);
}
