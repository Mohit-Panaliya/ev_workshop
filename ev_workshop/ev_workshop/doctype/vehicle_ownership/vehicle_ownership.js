/**
 * Vehicle Ownership - Client-side form controller.
 *
 * Auto-fetches customer and vehicle details when the user selects
 * a linked record. This provides instant feedback without requiring
 * a save-and-reload cycle.
 *
 * Flow:
 *   1. User selects owner_name (Customer Link) -> fetch customer_name + mobile_no
 *   2. User selects vehicle (EV Vehicle Link)  -> fetch registration_no + model
 *
 * These same fields are also populated server-side in vehicle_ownership.py
 * validate() as a safety net for API/bulk operations.
 */

frappe.ui.form.on("Vehicle Ownership", {
	/** When Customer is selected, fetch their name and mobile number. */
	owner_name(frm) {
		if (!frm.doc.owner_name) return;

		frappe.db.get_doc("Customer", frm.doc.owner_name)
			.then(doc => {
				frm.set_value("customer_name", doc.customer_name || "");
				frm.set_value("mobile_no", doc.mobile_no || "");
				frm.refresh_fields();
			});
	},

	/** When Vehicle is selected, fetch its registration number and model. */
	vehicle(frm) {
		if (!frm.doc.vehicle) return;

		frappe.db.get_doc("EV Vehicle", frm.doc.vehicle)
			.then(doc => {
				frm.set_value("registration_no", doc.registration_no || "");
				frm.set_value("model", doc.model || "");
				frm.refresh_fields();
			});
	}
});
