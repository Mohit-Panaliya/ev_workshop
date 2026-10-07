"""Workshop PWA backend — whitelisted APIs for the mobile frontend.

All endpoints require login and enforce Job Master read/write permissions,
so Mechanics see only what their role allows. Used by ``frontend/`` and the
``/workshop`` shell (``www/workshop.py``).
"""

import frappe
from frappe.utils import flt, get_first_day, getdate, today

#: Allowed status transitions for the PWA "advance" action.
TRANSITIONS = {
	"Admitted": ("Inspection", "Cancelled"),
	"Inspection": ("Quoted", "Cancelled"),
	"Quoted": ("Approved", "Cancelled"),
	"Approved": ("Repairing", "Cancelled"),
	"Repairing": ("Ready", "Cancelled"),
	"Ready": ("Completed",),
	"Completed": (),
	"Cancelled": (),
}

JOB_LIST_FIELDS = [
	"name",
	"status",
	"customer_name",
	"mobile_no",
	"vehicle",
	"service_type",
	"date",
	"grand_total",
]


def _require_read(name=None):
	if not frappe.has_permission("Job Master", "read", name):
		frappe.throw("Not permitted to view Job Master.", frappe.PermissionError)


def _require_write(name=None):
	if not frappe.has_permission("Job Master", "write", name):
		frappe.throw("Not permitted to update Job Master.", frappe.PermissionError)


@frappe.whitelist()
def get_dashboard():
	"""Counts by status + today's admissions + month completed revenue."""
	_require_read()
	statuses = {r.status for r in frappe.get_all("Job Master", fields=["status"], limit=10000)}
	by_status = {}
	for st in statuses:
		by_status[st] = frappe.db.count("Job Master", {"status": st})
	month_start = get_first_day(today())
	revenue = (
		frappe.db.sql(
			"""select coalesce(sum(grand_total), 0) from `tabJob Master`
			   where status='Completed' and date >= %s""",
			month_start,
		)[0][0]
		or 0
	)
	today_count = frappe.db.count("Job Master", {"date": today()})
	return {
		"by_status": by_status,
		"today_count": today_count,
		"month_completed_revenue": flt(revenue),
		"open_count": sum(v for k, v in by_status.items() if k not in ("Completed", "Cancelled")),
	}


@frappe.whitelist()
def get_jobs(status=None, search=None, limit=20, offset=0):
	"""Paginated job list for the PWA. `search` matches job/customer/mobile."""
	_require_read()
	try:
		limit = min(max(int(limit or 20), 1), 100)
		offset = max(int(offset or 0), 0)
	except (TypeError, ValueError):
		limit, offset = 20, 0

	filters = {}
	if status:
		filters["status"] = status

	jobs = frappe.get_list(
		"Job Master",
		fields=JOB_LIST_FIELDS,
		filters=filters,
		order_by="date desc, creation desc",
		limit_page_length=limit,
		limit_start=offset,
	)
	if search:
		safe = str(search).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_").lower()
		jobs = [
			j
			for j in jobs
			if safe in str(j.name or "").lower()
			or safe in str(j.get("customer_name") or "").lower()
			or safe in str(j.get("mobile_no") or "")
		]
	return {"jobs": jobs, "has_more": len(jobs) == limit}


@frappe.whitelist()
def get_job_detail(name):
	"""Full job document (with items) + linked ownership snapshot."""
	_require_read(name)
	doc = frappe.get_doc("Job Master", name).as_dict()
	linked_invoices = frappe.get_list(
		"Sales Invoice",
		fields=["name", "grand_total", "outstanding_amount", "status"],
		filters={"job_reference": name, "docstatus": 1},
		order_by="posting_date desc",
	)
	ownership = {}
	if doc.get("vehicle_ownership") and frappe.db.exists("Vehicle Ownership", doc.vehicle_ownership):
		own = frappe.get_doc("Vehicle Ownership", doc.vehicle_ownership)
		ownership = {
			"vehicle": own.vehicle,
			"owner_name": own.owner_name,
			"customer_name": own.customer_name,
			"mobile_no": own.mobile_no,
			"registration_no": own.registration_no,
			"model": own.model,
			"policy_no": getattr(own, "policy_no", None) or getattr(own, "insurance_policy_no", None),
			"policy_expiry": getattr(own, "policy_expiry", None),
		}
	return {"job": doc, "ownership": ownership, "allowed_next": list(TRANSITIONS.get(doc.status, ())), "invoices": linked_invoices}


@frappe.whitelist()
def advance_status(name, to_status):
	"""Move a job to `to_status` if the transition is allowed."""
	_require_write(name)
	doc = frappe.get_doc("Job Master", name)
	allowed = TRANSITIONS.get(doc.status, ())
	if to_status not in allowed:
		frappe.throw(f"Cannot move job from {doc.status} to {to_status}. Allowed: {', '.join(allowed) or 'none'}.")
	doc.status = to_status
	doc.save()
	return {"name": doc.name, "status": doc.status}


# ============================================================================
# Customer 360 (Laravel customers/{id} 360 parity)
# ============================================================================

CUSTOMER_STATEMENT_FIELDS = ["name", "posting_date", "grand_total", "paid_amount", "outstanding_amount", "status"]


@frappe.whitelist()
def get_customer_profile(customer):
	"""360 view: profile + vehicles + jobs + invoice aggregates."""
	if not frappe.has_permission("Customer", "read", customer):
		frappe.throw("Not permitted to view this Customer.", frappe.PermissionError)
	_require_read()

	profile = frappe.get_doc("Customer", customer).as_dict()

	ownerships = frappe.get_all(
		"Vehicle Ownership",
		filters={"owner_name": customer},
		fields=["name", "vehicle", "registration_no", "model", "is_primary", "policy_expiry"],
	)
	vehicles = []
	for own in ownerships:
		vehicles.append(own)
		if own.vehicle and frappe.db.exists("EV Vehicle", own.vehicle):
			vehicles[-1]["ev_vehicle"] = frappe.get_doc("EV Vehicle", own.vehicle).as_dict()

	ownership_names = [o.name for o in ownerships]
	jobs = []
	if ownership_names:
		jobs = frappe.get_list(
			"Job Master",
			fields=[*JOB_LIST_FIELDS, "vehicle_ownership"],
			filters={"vehicle_ownership": ["in", ownership_names]},
			order_by="date desc",
			limit_page_length=100,
		)

	invoices = frappe.get_list(
		"Sales Invoice",
		fields=CUSTOMER_STATEMENT_FIELDS,
		filters={"customer": customer, "docstatus": 1},
		order_by="posting_date desc",
		limit_page_length=100,
	)
	billed = sum(flt(i.grand_total) for i in invoices)
	outstanding = sum(max(flt(i.outstanding_amount), 0) for i in invoices)
	return {
		"profile": profile,
		"vehicles": vehicles,
		"jobs": jobs,
		"invoices": invoices,
		"aggregates": {"billed": billed, "paid": billed - outstanding, "outstanding": outstanding},
	}


@frappe.whitelist()
def get_customer_statement(customer, from_date=None, to_date=None):
	"""Invoice statement lines for a date range (Laravel statement parity)."""
	if not frappe.has_permission("Customer", "read", customer):
		frappe.throw("Not permitted to view this Customer.", frappe.PermissionError)
	filters = {"customer": customer, "docstatus": 1}
	if from_date and to_date:
		filters["posting_date"] = ["between", [from_date, to_date]]
	elif from_date:
		filters["posting_date"] = [">=", from_date]
	elif to_date:
		filters["posting_date"] = ["<=", to_date]
	return frappe.get_list(
		"Sales Invoice",
		fields=CUSTOMER_STATEMENT_FIELDS,
		filters=filters,
		order_by="posting_date desc",
		limit_page_length=500,
	)


# ============================================================================
# Analytics (Laravel analytics/* parity)
# ============================================================================

@frappe.whitelist()
def get_analytics():
	"""Revenue trend, job split, payments by mode, top customers, stock."""
	_require_read()
	analytics = {}

	analytics["revenue_trend"] = frappe.db.sql(
		"""select date_format(posting_date, '%Y-%m') as month,
		          sum(base_grand_total) as revenue, count(name) as invoices
		   from `tabSales Invoice` where docstatus = 1
		   and posting_date >= date_sub(curdate(), interval 6 month)
		   group by month order by month""",
		as_dict=True,
	)

	status_rows = frappe.db.sql(
		"select status, count(name) as total from `tabJob Master` group by status", as_dict=True
	)
	analytics["jobs_by_status"] = {r.status: r.total for r in status_rows}
	type_rows = frappe.db.sql(
		"select service_type, count(name) as total from `tabJob Master` group by service_type",
		as_dict=True,
	)
	analytics["jobs_by_type"] = {r.service_type: r.total for r in type_rows}

	pay_rows = frappe.db.sql(
		"""select mode_of_payment, sum(base_paid_amount) as total, count(name) as count
		   from `tabPayment Entry` where docstatus = 1 group by mode_of_payment""",
		as_dict=True,
	)
	analytics["payments_by_mode"] = [
		{"mode": r.mode_of_payment or "Unspecified", "total": flt(r.total), "count": r.count}
		for r in pay_rows
	]

	analytics["top_customers"] = frappe.db.sql(
		"""select customer, sum(base_grand_total) as billed, sum(outstanding_amount) as outstanding
		   from `tabSales Invoice` where docstatus = 1
		   group by customer order by billed desc limit 10""",
		as_dict=True,
	)

	split_rows = frappe.db.sql(
		"""select case when job_reference like 'JOB-%' then 'regular'
		               when job_reference like 'CI-%' then 'counter'
		               else 'other' end as source,
		          sum(base_grand_total) as revenue
		   from `tabSales Invoice` where docstatus = 1 group by source""",
		as_dict=True,
	)
	analytics["revenue_split"] = {r.source: flt(r.revenue) for r in split_rows}

	company = frappe.db.get_default("company")
	abbr = frappe.db.get_value("Company", company, "abbr") if company else None
	warehouse = f"Stores - {abbr}" if abbr else None
	stock_filter = {"warehouse": warehouse} if warehouse else {}
	analytics["stock_value"] = flt(
		sum(b.stock_value for b in frappe.get_all("Bin", fields=["stock_value"], filters=stock_filter))
	)
	low = []
	if warehouse:
		low = frappe.db.sql(
			"""select item_code, actual_qty from `tabBin`
			   where warehouse = %s and actual_qty <= 5 order by actual_qty""",
			warehouse,
			as_dict=True,
		)
	analytics["low_stock"] = low
	return analytics


# ============================================================================
# CSV exports (Laravel bulk-export parity)
# ============================================================================

EXPORT_ENTITIES = {
	"customers": ("Customer", ["name", "customer_name", "mobile_no", "email_id", "city"]),
	"jobs": ("Job Master", ["name", "date", "customer_name", "status", "service_type", "grand_total"]),
	"counter_invoices": ("Counter Invoice", ["name", "invoice_date", "customer", "walkin_name", "grand_total"]),
	"labour_masters": ("Labour Master", ["name", "service_name", "category", "standard_rate", "gst_rate"]),
	"payments": ("Payment Entry", ["name", "posting_date", "party", "paid_amount", "mode_of_payment", "status"]),
	"items": ("Item Master", ["item_no", "item_name", "item_class", "standard_rate", "hsn_code"]),
}


@frappe.whitelist()
def export_csv(entity):
	"""Download a CSV export for an entity (Laravel bulk-export parity)."""
	if entity not in EXPORT_ENTITIES:
		frappe.throw(f"Unknown export entity: {entity}")
	doctype, fields = EXPORT_ENTITIES[entity]
	if not frappe.has_permission(doctype, "export"):
		frappe.throw(f"Not permitted to export {doctype}.", frappe.PermissionError)

	import csv
	import io

	rows = frappe.get_all(doctype, fields=fields, limit_page_length=5000, order_by="modified desc")
	buf = io.StringIO()
	writer = csv.DictWriter(buf, fieldnames=fields)
	writer.writeheader()
	for r in rows:
		writer.writerow({f: r.get(f) for f in fields})
	frappe.response["result"] = buf.getvalue()
	frappe.response["doctype"] = f"{entity}.csv"
	frappe.response["type"] = "csv"


# ============================================================================
# Module lists for the PWA (Laravel index pages parity)
# ============================================================================

@frappe.whitelist()
def get_customers(search=None, limit=20):
	"""Searchable customer combobox (Laravel customers/search parity)."""
	_require_read()
	filters = {}
	if search:
		safe = str(search).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
		filters["customer_name"] = ["like", f"%{safe}%"]
	try:
		limit = min(max(int(limit or 20), 1), 100)
	except (TypeError, ValueError):
		limit = 20
	return frappe.get_list(
		"Customer",
		fields=["name", "customer_name", "mobile_no", "email_id", "city"],
		filters=filters,
		order_by="customer_name",
		limit_page_length=limit,
	)


@frappe.whitelist()
def get_counter_invoices(status=None, search=None, limit=20, offset=0):
	"""Counter invoice list (Laravel counter-invoices index parity)."""
	if not frappe.has_permission("Counter Invoice", "read"):
		frappe.throw("Not permitted to view Counter Invoice.", frappe.PermissionError)
	filters = {}
	if status:
		filters["status"] = status
	try:
		limit = min(max(int(limit or 20), 1), 100)
		offset = max(int(offset or 0), 0)
	except (TypeError, ValueError):
		limit, offset = 20, 0
	rows = frappe.get_list(
		"Counter Invoice",
		fields=["name", "invoice_date", "customer", "walkin_name", "grand_total", "sales_invoice", "docstatus"],
		filters=filters,
		order_by="invoice_date desc",
		limit_page_length=limit,
		limit_start=offset,
	)
	if search:
		safe = str(search).lower()
		rows = [r for r in rows if safe in str(r.name).lower() or safe in str(r.get("walkin_name") or "").lower()]
	outstanding = {}
	for r in rows:
		if r.get("sales_invoice"):
			outstanding[r.name] = flt(frappe.db.get_value("Sales Invoice", r.sales_invoice, "outstanding_amount"))
	return {"invoices": rows, "outstanding": outstanding, "has_more": len(rows) == limit}


@frappe.whitelist()
def get_labour_masters(search=None, limit=50):
	"""Labour master list (Laravel labour-masters index parity)."""
	if not frappe.has_permission("Labour Master", "read"):
		frappe.throw("Not permitted to view Labour Master.", frappe.PermissionError)
	filters = {}
	if search:
		safe = str(search).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
		filters["service_name"] = ["like", f"%{safe}%"]
	return frappe.get_list(
		"Labour Master",
		fields=["name", "service_name", "category", "standard_rate", "gst_rate"],
		filters=filters,
		order_by="service_name",
		limit_page_length=50,
	)


@frappe.whitelist()
def get_catalog():
	"""Vehicle Brand -> Models catalog (Laravel vehicle-catalog parity)."""
	if not frappe.has_permission("Vehicle Brand", "read"):
		frappe.throw("Not permitted to view Vehicle Brand.", frappe.PermissionError)
	brands = frappe.get_list("Vehicle Brand", fields=["name", "brand_name"], order_by="brand_name", limit_page_length=100)
	for b in brands:
		b["models"] = frappe.get_list(
			"Vehicle Model",
			fields=["name", "model_name", "battery_type"],
			filters={"vehicle_brand": b.name},
			order_by="model_name",
			limit_page_length=200,
		)
	return brands


@frappe.whitelist()
def get_payments(limit=20, offset=0):
	"""Recent payments with mode split (Laravel payments index parity)."""
	if not frappe.has_permission("Payment Entry", "read"):
		frappe.throw("Not permitted to view Payment Entry.", frappe.PermissionError)
	try:
		limit = min(max(int(limit or 20), 1), 100)
		offset = max(int(offset or 0), 0)
	except (TypeError, ValueError):
		limit, offset = 20, 0
	rows = frappe.get_list(
		"Payment Entry",
		fields=["name", "posting_date", "party", "paid_amount", "mode_of_payment", "status", "remarks"],
		filters={"docstatus": 1},
		order_by="posting_date desc",
		limit_page_length=limit,
		limit_start=offset,
	)
	return {"payments": rows, "has_more": len(rows) == limit}


@frappe.whitelist()
def get_counter_invoice(name):
	"""Counter invoice with items + linked Sales Invoice outstanding."""
	if not frappe.has_permission("Counter Invoice", "read", name):
		frappe.throw("Not permitted to view Counter Invoice.", frappe.PermissionError)
	doc = frappe.get_doc("Counter Invoice", name).as_dict()
	outstanding = None
	if doc.get("sales_invoice"):
		outstanding = flt(frappe.db.get_value("Sales Invoice", doc.sales_invoice, "outstanding_amount"))
	return {"invoice": doc, "outstanding": outstanding}
