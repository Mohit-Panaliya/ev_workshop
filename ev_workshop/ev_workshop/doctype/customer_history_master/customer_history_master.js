// Copyright (c) 2026, EV Workshop and contributors
// For license information, please see license.txt

frappe.ui.form.on("Customer History Master", {
	// Auto-fetch vehicle details when vehicle is selected
	vehicle: function(frm) {
		if (frm.doc.vehicle) {
			frappe.call({
				method: "frappe.client.get",
				args: {
					doctype: "EV Vehicle",
					name: frm.doc.vehicle
				},
				callback: function(r) {
					if (r.message) {
						const vehicle = r.message;
						frm.set_value("registration_no", vehicle.registration_no || "");
						frm.set_value("model", vehicle.model || "");
						frm.set_value("chassis_no", vehicle.chassis_no || "");
						frm.set_value("motor_no", vehicle.motor_no || "");
						frm.set_value("battery_no", vehicle.battery_no || "");
						frm.set_value("converter_no", vehicle.converter_no || "");
						frm.set_value("controller_no", vehicle.controller_no || "");
						frm.set_value("date_of_sale", vehicle.date_of_sale || "");
						frm.refresh_fields();
					}
				}
			});
		}
	}
});
