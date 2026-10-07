/**
 * Job Master - Client-side form controller.
 *
 * This is the main UI file for the EV Workshop job card. It handles:
 *   1. Workflow button rendering (status-dependent custom buttons)
 *   2. Real-time amount calculations (mirrors server-side Python logic)
 *   3. Vehicle Ownership auto-fill (customer, vehicle, mobile)
 *   4. Dashboard allocation status display
 *   5. WhatsApp integration (quote + ready notifications)
 *
 * Workflow: Admitted -> Inspection -> Quoted -> Approved -> Repairing -> Ready -> Completed
 *
 * Calculation logic:
 *   Each Job Item row calculates:
 *     amount       = qty x rate           (part MRP)
 *     labor_amount = qty x labor_cost     (Customer only, 0 for Retailer)
 *     tax_amount   = amount x GST%        (on part amount only)
 *     total_amount = amount + labor + tax
 *   Grand total = sum of all total_amounts across all rows
 *
 * IMPORTANT: This JS logic is mirrored in job_master.py recompute_child_amounts()
 * and job_item.py calculate_amounts(). Any change here must be reflected in both
 * Python files.
 */


// ============================================================================
// HELPER FUNCTIONS (called from both Job Master and Job Item event handlers)
// ============================================================================

/**
 * Check if supervisor or mechanic is allocated.
 * Called before every workflow transition to enforce allocation.
 *
 * @param {Object} frm - Frappe form object
 * @returns {boolean} true if allocation exists
 */
function check_allocation(frm) {
	if (!frm.doc.supervisor && !frm.doc.mechanic) {
		frappe.msgprint(__('Please assign a Supervisor or Mechanic in Allocation tab before proceeding!'));
		return false;
	}
	return true;
}

/**
 * Check if inspection is completed (at least one checkbox checked).
 * Called before transitioning from Admitted to Inspection status.
 *
 * @param {Object} frm - Frappe form object
 * @returns {boolean} true if at least one inspection item is checked
 */
function check_inspection(frm) {
	const inspection_fields = [
		'mirror_rh', 'mirror_lh', 'charger', 'toolkit', 'service_book',
		'battery', 'horn', 'hl_bulb', 'il_bulb', 'tl_bulb',
		'tyres_front', 'tyres_rear', 'scratch_damages', 'spare_vehicle'
	];

	const inspection_done = inspection_fields.some(field => frm.doc[field]);

	if (!inspection_done) {
		frappe.msgprint(__('Please check at least one item in the Inspection section before proceeding!'));
		return false;
	}
	return true;
}

/**
 * Calculate grand total from all job items.
 * Sums total_amount across all child rows and sets grand_total on parent.
 *
 * This runs on: form load, after save, status change, and after any
 * child row calculation completes (with a 100ms delay to let
 * frappe.model.set_value propagate).
 *
 * @param {Object} frm - Frappe form object
 */
function calculate_grand_total(frm) {
	let total = 0;

	if (frm.doc.items && frm.doc.items.length > 0) {
		frm.doc.items.forEach(item => {
			// Use flt() to safely handle undefined/null/NaN values
			total += flt(item.total_amount) || 0;
		});
	}

	frm.set_value("grand_total", total);
	frm.refresh_field("grand_total");
}

/**
 * Calculate amounts for a single job item row.
 *
 * This is the client-side mirror of:
 *   - job_item.py calculate_amounts() (server-side)
 *   - job_master.py recompute_child_amounts() (server-side bulk)
 *
 * Called whenever qty, rate, labor_cost, or any tax % field changes on a row.
 * After setting values, triggers grand_total recalculation with a 100ms delay.
 *
 * @param {Object} frm  - Frappe form object
 * @param {string} cdt  - Child DocType name ("Job Item")
 * @param {string} cdn  - Child Document name (row ID)
 */
function calculate_job_item_amounts(frm, cdt, cdn) {
	const child = locals[cdt][cdn];
	const qty = flt(child.qty) || 1;
	const rate = flt(child.rate) || 0;
	const labor_cost = flt(child.labor_cost) || 0;
	const customer_type = frm.doc.customer_type || "Customer";

	// Part amount = qty x part rate (MRP)
	const amount = qty * rate;

	// Labor amount: Customer gets labor charge, Retailer pays part only
	const labor_amount = (customer_type === "Retailer") ? 0 : qty * labor_cost;

	// GST calculation on part amount only (labor is taxed separately if needed)
	let tax_amount = 0;
	if (child.sgst_percent) tax_amount += amount * flt(child.sgst_percent) / 100;
	if (child.cgst_percent) tax_amount += amount * flt(child.cgst_percent) / 100;
	if (child.igst_percent) tax_amount += amount * flt(child.igst_percent) / 100;

	const total_amount = amount + labor_amount + tax_amount;

	// Set all computed fields (triggers UI refresh)
	frappe.model.set_value(cdt, cdn, "amount", amount);
	frappe.model.set_value(cdt, cdn, "labor_amount", labor_amount);
	frappe.model.set_value(cdt, cdn, "tax_amount", tax_amount);
	frappe.model.set_value(cdt, cdn, "total_amount", total_amount);

	// Delay grand total recalc to let the above set_value calls propagate
	setTimeout(() => calculate_grand_total(frm), 100);
}

/**
 * Show allocation status in the form dashboard headline.
 * Displays "Supervisor: Name, Mechanic: Name" or a warning if unallocated.
 *
 * @param {Object} frm - Frappe form object
 */
function show_allocation_status(frm) {
	if (!frm.doc.supervisor && !frm.doc.mechanic) {
		frm.dashboard.set_headline(__("Not allocated - Please assign Supervisor or Mechanic"));
		return;
	}

	const promises = [];

	if (frm.doc.supervisor) {
		promises.push(
			frappe.db.get_value('Employee', frm.doc.supervisor, 'employee_name')
				.then(r => r.message.employee_name
					? `Supervisor: ${r.message.employee_name}`
					: `Supervisor: ${frm.doc.supervisor}`)
		);
	}

	if (frm.doc.mechanic) {
		promises.push(
			frappe.db.get_value('Employee', frm.doc.mechanic, 'employee_name')
				.then(r => r.message.employee_name
					? `Mechanic: ${r.message.employee_name}`
					: `Mechanic: ${frm.doc.mechanic}`)
		);
	}

	Promise.all(promises).then(results => {
		frm.dashboard.set_headline(__("Allocated to: ") + results.join(", "));
	});
}


// ============================================================================
// JOB MASTER PARENT FORM EVENT HANDLERS
// ============================================================================

frappe.ui.form.on("Job Master", {
	/** Set default date to today on new document load. */
	onload(frm) {
		if (!frm.doc.date) {
			frm.set_value("date", frappe.datetime.get_today());
		}
	},

	/**
	 * When Vehicle Ownership is selected, auto-fill:
	 *   - customer_name (read-only, from Customer doctype)
	 *   - mobile_no (read-only, from Customer doctype)
	 *   - vehicle (read-only, from EV Vehicle doctype)
	 */
	vehicle_ownership(frm) {
		if (!frm.doc.vehicle_ownership) return;

		frappe.db.get_doc("Vehicle Ownership", frm.doc.vehicle_ownership)
			.then(doc => {
				frm.set_value("customer_name", doc.customer_name || "");
				frm.set_value("mobile_no", doc.mobile_no || "");
				frm.set_value("vehicle", doc.vehicle || "");
				frm.refresh_fields();
			});
	},

	/**
	 * When customer type changes (Customer <-> Retailer), recalculate
	 * all existing item rows because labor cost rules change.
	 *
	 * Customer: part + labor
	 * Retailer: part only (labor_amount becomes 0)
	 */
	customer_type(frm) {
		if (frm.doc.items && frm.doc.items.length > 0) {
			frm.doc.items.forEach(row => {
				calculate_job_item_amounts(frm, row.doctype, row.name);
			});
			calculate_grand_total(frm);
		}
	},

	/**
	 * Main refresh handler — runs every time the form renders.
	 * Recalculates grand total, shows allocation status, and adds
	 * workflow buttons based on current status.
	 */
	refresh(frm) {
		calculate_grand_total(frm);
		show_allocation_status(frm);
		add_workflow_buttons(frm);
	},

	/** Recalculate when status field changes (defensive — shouldn't affect amounts). */
	status(frm) {
		calculate_grand_total(frm);
	},

	/** Recalculate after save to ensure displayed totals match DB. */
	after_save(frm) {
		calculate_grand_total(frm);
	}
});


// ============================================================================
// WORKFLOW BUTTON RENDERING
// ============================================================================

/**
 * Add workflow buttons based on the current job status.
 *
 * Each button:
 *   1. Validates prerequisites (allocation, inspection, items)
 *   2. Sets the new status
 *   3. Saves the document
 *   4. Optionally triggers side effects (WhatsApp, invoice, stock entry)
 *
 * Button color classes:
 *   btn-primary  = main action (blue)
 *   btn-success  = positive/confirmation action (green)
 *   btn-danger   = destructive action (red)
 *
 * @param {Object} frm - Frappe form object
 */
function add_workflow_buttons(frm) {
	const status = frm.doc.status;

	// --- Admitted -> Inspection ---
	// Requires: allocation + at least one inspection checkbox
	if (status === 'Admitted') {
		frm.add_custom_button(__('Complete Inspection'), () => {
			if (!check_allocation(frm) || !check_inspection(frm)) return;
			frm.set_value('status', 'Inspection');
			frm.save();
		}).addClass('btn-primary');
	}

	// --- Inspection -> Quoted (Send WhatsApp Quote) ---
	// Requires: allocation + at least one item in Parts & Labour
	// Side effects: Opens WhatsApp Web with pre-filled quote message
	if (status === 'Inspection') {
		frm.add_custom_button(__('Send Quote to Customer'), () => {
			if (!check_allocation(frm)) return;

			// Save first to persist any unsaved items
			frm.save();
			frm.refresh_field('items');

			if (!frm.doc.items || frm.doc.items.length === 0) {
				frappe.msgprint(__('Please add at least one item in Parts and Labour before sending quote.'));
				return;
			}

			// Call API to build WhatsApp URL, then open it
			frappe.call({
				method: 'ev_workshop.api.send_quote_whatsapp',
				args: { docname: frm.doc.name },
				callback: (r) => {
					if (r.message && r.message.url) {
						window.open(r.message.url, '_blank');
						frm.set_value('status', 'Quoted');
						frm.save();
						frappe.msgprint(__('Quote sent via WhatsApp! Status updated to Quoted.'));
					}
				}
			});
		}).addClass('btn-primary');
	}

	// --- Quoted -> Approved ---
	// Requires: allocation
	// Sets customer_approval flag and approval_date (auto-set in Python validate)
	if (status === 'Quoted') {
		frm.add_custom_button(__('Approve Quote'), () => {
			if (!check_allocation(frm)) return;
			frm.set_value('status', 'Approved');
			frm.set_value('customer_approval', 1);
			frm.save();
			frappe.msgprint(__('Quote approved! Ready for repair.'));
		}).addClass('btn-success');
	}

	// --- Approved -> Repairing ---
	// Requires: allocation
	if (status === 'Approved') {
		frm.add_custom_button(__('Start Repair'), () => {
			if (!check_allocation(frm)) return;
			frm.set_value('status', 'Repairing');
			frm.save();
		}).addClass('btn-primary');
	}

	// --- Repairing -> Ready ---
	// Requires: allocation
	// Side effects (all fire after save completes):
	//   1. WhatsApp "Vehicle Ready" notification
	//   2. Stock Entry for spare parts (Material Issue)
	//   3. Sales Invoice creation (auto-submitted)
	if (status === 'Repairing') {
		frm.add_custom_button(__('Mark as Ready'), () => {
			if (!check_allocation(frm)) return;
			frm.set_value('status', 'Ready');

			// Chain: save first, then fire side effects in parallel
			frm.save().then(() => {
				// 1. WhatsApp notification
				frappe.call({
					method: 'ev_workshop.api.send_ready_notification',
					args: { docname: frm.doc.name },
					callback: (r) => {
						if (r.message && r.message.url) {
							window.open(r.message.url, '_blank');
						}
					}
				});

				// 2. Stock Entry for spare parts
				frappe.call({
					method: 'ev_workshop.api.create_stock_entry_for_job',
					args: { docname: frm.doc.name },
					callback: (r) => {
						if (r.message) {
							frappe.msgprint(__('Stock Entry: ') + r.message);
						}
					}
				});

				// 3. Auto-create and submit Sales Invoice
				frappe.call({
					method: 'ev_workshop.api.create_job_invoice',
					args: { docname: frm.doc.name },
					callback: (r) => {
						if (r.message) {
							frappe.msgprint(__('Invoice created: ') + r.message);
						}
					}
				});

				frappe.msgprint(__('Vehicle is ready for delivery!'));
			});
		}).addClass('btn-success');
	}

	// --- Ready -> Completed ---
	// Requires: allocation
	// Prompts for payment confirmation before marking complete
	if (status === 'Ready' && !frm.doc.payment_rcd) {
		frm.add_custom_button(__('Confirm Payment Received'), () => {
			if (!check_allocation(frm)) return;
			frappe.confirm('Are you sure you received the full payment?', () => {
				frm.set_value('payment_rcd', 1);
				frm.set_value('status', 'Completed');
				frm.save();
			});
		}).addClass('btn-success');
	}

	// --- Cancel Job (available at any stage except Cancelled/Completed) ---
	if (status !== 'Cancelled' && status !== 'Completed') {
		frm.add_custom_button(__('Cancel Job'), () => {
			frappe.confirm('Are you sure you want to cancel this job?', () => {
				frm.set_value('status', 'Cancelled');
				frm.save();
			});
		}).addClass('btn-danger');
	}
}


// ============================================================================
// JOB ITEM CHILD TABLE EVENT HANDLERS
//
// These fire when the user interacts with rows in the Items table.
// The item_no handler also fetches item data from Item Master.
// ============================================================================

frappe.ui.form.on("Job Item", {
	/** Recalculate grand total when a row is added. */
	items_add(frm) {
		calculate_grand_total(frm);
	},

	/** Recalculate grand total when a row is removed. */
	items_remove(frm) {
		calculate_grand_total(frm);
	},

	/** Recalculate row amounts when quantity changes. */
	qty(frm, cdt, cdn) {
		calculate_job_item_amounts(frm, cdt, cdn);
	},

	/** Recalculate row amounts when part rate changes. */
	rate(frm, cdt, cdn) {
		calculate_job_item_amounts(frm, cdt, cdn);
	},

	/** Recalculate row amounts when labor cost changes. */
	labor_cost(frm, cdt, cdn) {
		calculate_job_item_amounts(frm, cdt, cdn);
	},

	/** Recalculate row amounts when SGST % changes. */
	sgst_percent(frm, cdt, cdn) {
		calculate_job_item_amounts(frm, cdt, cdn);
	},

	/** Recalculate row amounts when CGST % changes. */
	cgst_percent(frm, cdt, cdn) {
		calculate_job_item_amounts(frm, cdt, cdn);
	},

	/** Recalculate row amounts when IGST % changes. */
	igst_percent(frm, cdt, cdn) {
		calculate_job_item_amounts(frm, cdt, cdn);
	},

	/**
	 * When an item is selected from Item Master, fetch its details:
	 *   - item_name, standard_rate (MRP), labor_cost
	 *   - sgst_percent, cgst_percent, igst_percent
	 *
	 * Then recalculate row amounts after a 200ms delay to let values settle.
	 *
	 * Note: item_name and rate also have fetch_from in the JSON definition,
	 * so they get populated automatically by Frappe. This handler additionally
	 * fetches labor_cost and tax rates which don't have fetch_from.
	 */
	item_no(frm, cdt, cdn) {
		const row = locals[cdt][cdn];

		if (!row.item_no) return;

		frappe.db.get_value('Item Master', row.item_no, [
			'item_name', 'standard_rate', 'labor_cost',
			'sgst_percent', 'cgst_percent', 'igst_percent'
		]).then(r => {
			if (!r.message) return;

			frappe.model.set_value(cdt, cdn, 'item_name', r.message.item_name || '');
			frappe.model.set_value(cdt, cdn, 'rate', r.message.standard_rate || 0);
			frappe.model.set_value(cdt, cdn, 'labor_cost', r.message.labor_cost || 0);
			frappe.model.set_value(cdt, cdn, 'sgst_percent', r.message.sgst_percent || 0);
			frappe.model.set_value(cdt, cdn, 'cgst_percent', r.message.cgst_percent || 0);
			frappe.model.set_value(cdt, cdn, 'igst_percent', r.message.igst_percent || 0);

			// Delay to let all set_value calls propagate before recalculating
			setTimeout(() => {
				calculate_job_item_amounts(frm, cdt, cdn);
				calculate_grand_total(frm);
			}, 200);
		});
	}
});
