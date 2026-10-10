"""Workshop PWA backend — whitelisted APIs for the mobile frontend.

All endpoints require login and enforce Job Master read/write permissions,
so Mechanics see only what their role allows. Used by ``frontend/`` and the
``/workshop`` shell (``www/workshop.py``).
"""

import frappe
from frappe.utils import flt, get_first_day, getdate, today

from ev_workshop.utils import resolve_item_master, sync_customer_contact

from ev_workshop.utils import resolve_item_master

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
	"""Dashboard KPIs mirroring the Laravel dashboard (today, revenue, dues)."""
	_require_read()
	today_rows = frappe.db.sql(
		"select status, count(name) as total from `tabJob Master` where date = %s group by status",
		today(),
		as_dict=True,
	)
	recent = frappe.get_list(
		"Job Master",
		fields=["name", "customer_name", "status"],
		order_by="creation desc",
		limit_page_length=5,
	)
	month_start = get_first_day(today())
	month_revenue = (
		frappe.db.sql(
			"""select coalesce(sum(base_grand_total), 0) from `tabSales Invoice`
			   where docstatus = 1 and posting_date >= %s""",
			month_start,
		)[0][0]
		or 0
	)
	outstanding = (
		frappe.db.sql(
			"""select coalesce(sum(case when outstanding_amount > 0 then outstanding_amount else 0 end), 0)
			   from `tabSales Invoice` where docstatus = 1"""
		)[0][0]
		or 0
	)
	statuses = {r.status for r in frappe.get_all("Job Master", fields=["status"], limit=10000)}
	by_status = {}
	for st in statuses:
		by_status[st] = frappe.db.count("Job Master", {"status": st})
	# Low-stock card (Laravel dashboard parity)
	company = frappe.db.get_default("company")
	abbr = frappe.db.get_value("Company", company, "abbr") if company else None
	warehouse = f"Stores - {abbr}" if abbr else None
	low_stock = []
	if warehouse:
		low_stock = frappe.db.sql(
			"""select item_code, actual_qty from `tabBin`
			   where warehouse = %s and actual_qty <= 5 order by actual_qty limit 10""",
			warehouse,
			as_dict=True,
		)
	return {
		"today_count": sum(r.total for r in today_rows),
		"today_by_status": {r.status: r.total for r in today_rows},
		"recent": recent,
		"month_revenue": flt(month_revenue),
		"outstanding_dues": flt(outstanding),
		"by_status": by_status,
		"low_stock": low_stock,
		"low_stock_count": len(low_stock),
		"month_completed_revenue": flt(month_revenue),
		"open_count": sum(v for k, v in by_status.items() if k not in ("Completed", "Cancelled")),
	}


@frappe.whitelist()
def get_jobs(status=None, search=None, limit=20, offset=0, from_date=None, to_date=None,
             technician=None, service_type=None, payment_status=None, page=1, per_page=None,
             exclude_delivered=False, sort="date", direction="desc"):
	"""Paginated job list with payment summary (Laravel job-cards index)."""
	_require_read()
	try:
		per_page = min(max(int(per_page or limit or 20), 1), 100)
		page = max(int(page or 1), 1)
	except (TypeError, ValueError):
		per_page, page = 20, 1
	offset = (page - 1) * per_page

	filters = []
	if status:
		filters.append(["Job Master", "status", "=", status])
	elif exclude_delivered in (True, "1", 1, "true"):
		filters.append(["Job Master", "status", "!=", "Completed"])
	if from_date and to_date:
		filters.append(["Job Master", "date", "between", [from_date, to_date]])
	elif from_date:
		filters.append(["Job Master", "date", ">=", from_date])
	elif to_date:
		filters.append(["Job Master", "date", "<=", to_date])
	if technician:
		filters.append(["Job Master", "mechanic", "=", technician])
	if service_type:
		filters.append(["Job Master", "service_type", "=", service_type])
	if search:
		safe = str(search).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
		like = f"%{safe}%"
		filters += [
			["Job Master", "name", "like", like],
			"or",
			["Job Master", "customer_name", "like", like],
			"or",
			["Job Master", "mobile_no", "like", like],
		]

	jobs = frappe.get_list(
		"Job Master",
		fields=[*JOB_LIST_FIELDS, "vehicle_ownership"],
		filters=filters or {},
		order_by=f"{ {'name': 'name', 'date': 'date', 'status': 'status', 'grand_total': 'grand_total'}.get(sort, 'date')} {'asc' if direction == 'asc' else 'desc'}, creation desc",
		limit_page_length=per_page,
		limit_start=offset,
	)
	# Payment summary per job from linked Sales Invoices (Laravel payment badges)
	for j in jobs:
		inv = frappe.db.sql(
			"""select coalesce(sum(grand_total), 0), coalesce(sum(outstanding_amount), 0)
			   from `tabSales Invoice` where docstatus = 1 and job_reference = %s""",
			j.name,
		)
		billed, due = (inv[0] if inv else (0, 0))
		j["amount_billed"] = flt(billed)
		j["amount_paid"] = flt(billed) - flt(due)
		j["outstanding"] = max(flt(due), 0)
		j["pay_status"] = (
			"unbilled" if not flt(billed) else ("paid" if flt(due) <= 0 else ("partially_paid" if flt(due) < flt(billed) else "unpaid"))
		)
	if payment_status:
		jobs = [j for j in jobs if j["pay_status"] == payment_status]

	count_filters = {}
	if status:
		count_filters["status"] = status
	elif exclude_delivered in (True, "1", 1, "true"):
		count_filters["status"] = ["!=", "Completed"]
	if technician:
		count_filters["mechanic"] = technician
	if service_type:
		count_filters["service_type"] = service_type
	if from_date and to_date:
		count_filters["date"] = ["between", [from_date, to_date]]
	elif from_date:
		count_filters["date"] = [">=", from_date]
	elif to_date:
		count_filters["date"] = ["<=", to_date]
	total = frappe.db.count("Job Master", count_filters) if not search else len(jobs) + offset
	pages = max((total + per_page - 1) // per_page, 1)
	return {"jobs": jobs, "has_more": page < pages, "page": page, "per_page": per_page, "total": total, "pages": pages}


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
def get_analytics(period="monthly", from_date=None, to_date=None):
	"""Revenue trend, job split, payments by mode, top customers, stock.

	`period` mirrors the Laravel revenue filter: daily (last 30 days),
	weekly (last 12 weeks) or monthly (last 6 months). `from_date/to_date`
	override the window (Laravel date-range filter, default: current month).
	"""
	_require_read()
	analytics = {}

	if from_date and to_date:
		where, params, group = "posting_date between %s and %s", [from_date, to_date], "date(posting_date)"
	elif from_date:
		where, params, group = "posting_date >= %s", [from_date], "date(posting_date)"
	elif to_date:
		where, params, group = "posting_date <= %s", [to_date], "date(posting_date)"
	elif period == "daily":
		where, params, group = "posting_date >= date_sub(curdate(), interval 30 day)", [], "date(posting_date)"
	elif period == "weekly":
		where, params, group = "posting_date >= date_sub(curdate(), interval 12 week)", [], "yearweek(posting_date)"
	else:
		month_start = get_first_day(today())
		where, params, group = "posting_date >= %s", [month_start], "date_format(posting_date, '%Y-%m')"

	analytics["revenue_trend"] = frappe.db.sql(
		f"""select {group} as month, sum(base_grand_total) as revenue,
		          count(name) as invoices
		   from `tabSales Invoice` where docstatus = 1 and {where}
		   group by {group} order by {group}""",
		params,
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

	# Technician performance (Laravel analytics parity): jobs handled +
	# labour value per mechanic/supervisor.
	tech_rows = frappe.db.sql(
		"""select e.employee_name as technician, count(j.name) as jobs,
		          coalesce(sum(j.grand_total), 0) as billed
		   from `tabJob Master` j left join `tabEmployee` e on e.name = j.mechanic
		   where j.mechanic is not null and j.mechanic != ''
		   group by j.mechanic order by jobs desc limit 10""",
		as_dict=True,
	)
	analytics["technician_performance"] = [
		{"technician": r.technician or "Unassigned", "jobs": r.jobs, "billed": flt(r.billed)} for r in tech_rows
	]

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
	"customers": ("Customer", ["name", "customer_name", "mobile_no", "email_id", "customer_type"]),
	"jobs": ("Job Master", ["name", "date", "customer_name", "status", "service_type", "grand_total"]),
	"counter_invoices": ("Counter Invoice", ["name", "invoice_date", "customer", "walkin_name", "grand_total"]),
	"labour_masters": ("Labour Master", ["name", "service_name", "category", "standard_rate", "gst_rate"]),
	"payments": ("Payment Entry", ["name", "posting_date", "party", "paid_amount", "mode_of_payment", "status"]),
	"items": ("Item Master", ["item_no", "item_name", "item_class", "standard_rate", "hsn_code"]),
}


@frappe.whitelist()
def export_csv(entity, search=None, status=None, technician=None, service_type=None, from_date=None, to_date=None):
	"""Download a CSV export for an entity (Laravel bulk-export parity)."""
	if entity not in EXPORT_ENTITIES:
		frappe.throw(f"Unknown export entity: {entity}")
	doctype, fields = EXPORT_ENTITIES[entity]
	if not frappe.has_permission(doctype, "export"):
		frappe.throw(f"Not permitted to export {doctype}.", frappe.PermissionError)

	import csv
	import io

	filters = {}
	if entity == "jobs":
		if status:
			filters["status"] = status
		if technician:
			filters["mechanic"] = technician
		if service_type:
			filters["service_type"] = service_type
		if from_date and to_date:
			filters["date"] = ["between", [from_date, to_date]]
		elif from_date:
			filters["date"] = [">=", from_date]
		elif to_date:
			filters["date"] = ["<=", to_date]
	elif entity == "customers" and search:
		safe = str(search).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
		filters["customer_name"] = ["like", f"%{safe}%"]
	elif entity == "counter_invoices" and search:
		safe = str(search).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
		filters["walkin_name"] = ["like", f"%{safe}%"]

	rows = frappe.get_all(doctype, fields=fields, filters=filters, limit_page_length=5000, order_by="modified desc")
	if search and entity == "jobs":
		safe = str(search).lower()
		rows = [r for r in rows if safe in str(r.get("name") or "").lower() or safe in str(r.get("customer_name") or "").lower()]
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
def get_customers(search=None, limit=20, outstanding=None, sort="customer_name", direction="asc"):
	"""Customer list with outstanding + visits (Laravel customers.index)."""
	_require_read()
	filters = {}
	if search:
		safe = str(search).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
		filters["customer_name"] = ["like", f"%{safe}%"]
	try:
		limit = min(max(int(limit or 20), 1), 100)
	except (TypeError, ValueError):
		limit = 20
	allowed_sort = {"customer_name": "customer_name", "outstanding": "customer_name", "visits": "customer_name"}
	order_by = allowed_sort.get(sort, "customer_name")
	if direction not in ("asc", "desc"):
		direction = "asc"
	rows = frappe.get_list(
		"Customer",
		fields=["name", "customer_name", "mobile_no", "email_id", "customer_type"],
		filters=filters,
		order_by=f"{order_by} {direction}",
		limit_page_length=limit,
	)
	for r in rows:
		agg = frappe.db.sql(
			"""select coalesce(sum(grand_total), 0), coalesce(sum(outstanding_amount), 0)
			   from `tabSales Invoice` where docstatus = 1 and customer = %s""",
			r.name,
		)
		billed, due = (agg[0] if agg else (0, 0))
		r["outstanding"] = max(flt(due), 0)
		r["visits"] = frappe.db.count("Sales Invoice", {"customer": r.name, "docstatus": 1})
	if outstanding == "has_outstanding":
		rows = [r for r in rows if r["outstanding"] > 0]
	elif outstanding == "no_outstanding":
		rows = [r for r in rows if r["outstanding"] <= 0]
	return rows


@frappe.whitelist()
def get_counter_invoices(status=None, search=None, limit=20, offset=0, sort="invoice_date", direction="desc"):
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
	allowed_sort = {"invoice_date": "invoice_date", "invoice_no": "name", "grand_total": "grand_total"}
	order_by = allowed_sort.get(sort, "invoice_date")
	if direction not in ("asc", "desc"):
		direction = "desc"
	rows = frappe.get_list(
		"Counter Invoice",
		fields=["name", "invoice_date", "customer", "walkin_name", "grand_total", "sales_invoice", "docstatus"],
		filters=filters,
		order_by=f"{order_by} {direction}",
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
def get_payments(limit=20, offset=0, sort="posting_date", direction="desc"):
	"""Recent payments with mode split (Laravel payments index parity)."""
	if not frappe.has_permission("Payment Entry", "read"):
		frappe.throw("Not permitted to view Payment Entry.", frappe.PermissionError)
	try:
		limit = min(max(int(limit or 20), 1), 100)
		offset = max(int(offset or 0), 0)
	except (TypeError, ValueError):
		limit, offset = 20, 0
	allowed_sort = {"posting_date": "posting_date", "amount": "paid_amount", "payment_mode": "mode_of_payment"}
	order_by = allowed_sort.get(sort, "posting_date")
	if direction not in ("asc", "desc"):
		direction = "desc"
	rows = frappe.get_list(
		"Payment Entry",
		fields=["name", "posting_date", "party", "paid_amount", "mode_of_payment", "status", "remarks", "docstatus"],
		filters={"docstatus": ["!=", 2]},
		order_by=f"{order_by} {direction}",
		limit_page_length=limit,
		limit_start=offset,
	)
	for r in rows:
		refs = frappe.get_all("Payment Entry Reference", filters={"parent": r.name},
		                      fields=["reference_doctype", "reference_name"], limit=1)
		r["ref_doctype"] = refs[0].reference_doctype if refs else None
		r["ref_name"] = refs[0].reference_name if refs else None
		r["job_reference"] = None
		if r["ref_doctype"] == "Sales Invoice" and r["ref_name"]:
			r["job_reference"] = frappe.db.get_value("Sales Invoice", r["ref_name"], "job_reference")
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


# ============================================================================
# Employees + parts (Laravel employees / inventory parity)
# ============================================================================

@frappe.whitelist()
def get_employees(search=None, role=None, active=None, limit=50):
	"""Employee list with role/active filters."""
	if not frappe.has_permission("Employee", "read"):
		frappe.throw("Not permitted to view Employee.", frappe.PermissionError)
	filters = {}
	if role:
		filters["status"] = role  # placeholder replaced below
		del filters["status"]
		filters["designation"] = role
	if active == "active_only":
		filters["status"] = "Active"
	elif active == "inactive_only":
		filters["status"] = ["!=", "Active"]
	if search:
		safe = str(search).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
		filters["employee_name"] = ["like", f"%{safe}%"]
	return frappe.get_list(
		"Employee",
		fields=["name", "employee_name", "designation", "department", "cell_number", "status"],
		filters=filters,
		order_by="employee_name",
		limit_page_length=50,
	)


@frappe.whitelist()
def get_parts(search=None, category=None, low_stock=False, limit=50):
	"""Spare parts = Item Master + live ERPNext balance (Laravel inventory)."""
	if not frappe.has_permission("Item Master", "read"):
		frappe.throw("Not permitted to view Item Master.", frappe.PermissionError)
	filters = {}
	if category:
		filters["item_class"] = category
	if search:
		safe = str(search).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
		filters["item_name"] = ["like", f"%{safe}%"]
	masters = frappe.get_list(
		"Item Master",
		fields=["name", "item_no", "item_name", "item_class", "uom", "standard_rate", "labor_charge", "min_qty", "hsn_code"],
		filters=filters,
		order_by="item_name",
		limit_page_length=limit,
	)
	company = frappe.db.get_default("company")
	abbr = frappe.db.get_value("Company", company, "abbr") if company else None
	warehouse = f"Stores - {abbr}" if abbr else None
	out = []
	for m in masters:
		bal = 0
		if frappe.db.exists("Item", m.item_no) and warehouse:
			bal = frappe.db.get_value("Bin", {"item_code": m.item_no, "warehouse": warehouse}, "actual_qty") or 0
		m["balance"] = flt(bal)
		m["low"] = flt(bal) <= flt(m.min_qty or 0)
		if low_stock and not m["low"]:
			continue
		out.append(m)
	return out


# ============================================================================
# Create flows (Laravel create/store parity)
# ============================================================================

@frappe.whitelist()
def get_job_create_options():
	"""Dropdown data for the job create form."""
	_require_read()
	ownerships = frappe.get_list(
		"Vehicle Ownership",
		fields=["name", "vehicle", "owner_name", "customer_name", "registration_no", "model"],
		order_by="customer_name",
		limit_page_length=200,
	)
	technicians = frappe.get_list(
		"Employee", fields=["name", "employee_name"], filters={"status": "Active"}, order_by="employee_name", limit_page_length=200
	)
	parts = frappe.get_list(
		"Item Master", fields=["item_no", "item_name", "standard_rate"], order_by="item_name", limit_page_length=500
	)
	labours = frappe.get_list(
		"Labour Master", fields=["name", "service_name", "standard_rate"], order_by="service_name", limit_page_length=200
	)
	return {"ownerships": ownerships, "technicians": technicians, "parts": parts, "labours": labours}


@frappe.whitelist()
def create_job(data):
	"""Create a Job Master (Admitted) with items + labour lines."""
	_require_write()
	if isinstance(data, str):
		data = frappe.parse_json(data)
	ownership = data.get("vehicle_ownership")
	if not ownership and data.get("customer") and data.get("vehicle"):
		ownership = frappe.db.get_value(
			"Vehicle Ownership", {"vehicle": data["vehicle"], "owner_name": data["customer"]}, "name"
		)
		if not ownership:
			ownership = frappe.get_doc(
				{"doctype": "Vehicle Ownership", "vehicle": data["vehicle"],
				 "owner_name": data["customer"], "is_primary": 1}
			).insert().name
	if not ownership:
		frappe.throw("Select a customer and vehicle (or an ownership record).")
	doc = frappe.get_doc(
		{
			"doctype": "Job Master",
			"date": data.get("date") or today(),
			"vehicle_ownership": ownership,
			"customer_type": data.get("customer_type") or "Customer",
			"service_type": data.get("service_type") or "Paid",
			"km_reading": data.get("km_reading") or 0,
			"status": "Admitted",
			"complaints": data.get("complaints"),
			"supervisor": data.get("supervisor"),
			"mechanic": data.get("mechanic"),
			"company": data.get("company"),
			"items": [
				{
					"item_no": resolve_item_master(r.get("item_no")),
					"qty": r.get("qty") or 1,
					"rate": r.get("rate") or 0,
				}
				for r in (data.get("items") or [])
				if r.get("item_no")
			],
			"job_labours": [
				{
					"labour_master": r.get("labour_master"),
					"technician": r.get("technician"),
					"qty": r.get("qty") or 1,
					"rate": r.get("rate") or 0,
				}
				for r in (data.get("labours") or [])
				if r.get("labour_master")
			],
		}
	)
	doc.insert()
	return {"name": doc.name}


@frappe.whitelist()
def create_customer(data):
	"""Create ERPNext Customer + optional Vehicle Ownership + EV Vehicle."""
	if not frappe.has_permission("Customer", "create"):
		frappe.throw("Not permitted to create Customer.", frappe.PermissionError)
	if isinstance(data, str):
		data = frappe.parse_json(data)
	customer = frappe.get_doc(
		{
			"doctype": "Customer",
			"customer_name": data.get("customer_name"),
			"customer_type": data.get("customer_type") or "Individual",
		}
	).insert()
	sync_customer_contact(customer.name, data.get("mobile_no"), data.get("email"))
	# Re-save so Customer.mobile_no/email_id fetch in from the new contact.
	customer.reload()
	customer.save()
	ownership = None
	if data.get("registration_no"):
		vehicle = frappe.db.exists("EV Vehicle", data["registration_no"])
		if not vehicle:
			vehicle = (
				frappe.get_doc(
					{
						"doctype": "EV Vehicle",
						"registration_no": data["registration_no"],
						"model": data.get("model"),
						"chassis_no": data.get("chassis_no") or data["registration_no"],
						"motor_no": data.get("motor_no") or data["registration_no"],
						"battery_no": data.get("battery_no"),
					}
				)
				.insert()
				.name
			)
		ownership = (
			frappe.get_doc(
				{
					"doctype": "Vehicle Ownership",
					"vehicle": vehicle,
					"owner_name": customer.name,
					"is_primary": 1,
				}
			)
			.insert()
			.name
		)
	return {"customer": customer.name, "ownership": ownership}


@frappe.whitelist()
def create_counter(data):
	"""Create a draft Counter Invoice with item lines."""
	if not frappe.has_permission("Counter Invoice", "create"):
		frappe.throw("Not permitted to create Counter Invoice.", frappe.PermissionError)
	if isinstance(data, str):
		data = frappe.parse_json(data)
	doc = frappe.get_doc(
		{
			"doctype": "Counter Invoice",
			"company": data.get("company"),
			"invoice_date": data.get("invoice_date") or today(),
			"customer": data.get("customer"),
			"walkin_name": data.get("walkin_name"),
			"walkin_mobile": data.get("walkin_mobile"),
			"gst_applicable": data.get("gst_applicable", 1),
			"discount_percent": data.get("discount_percent") or 0,
			"items": [
				{
					"item_master": resolve_item_master(r.get("item_master")),
					"qty": r.get("qty") or 1,
					"mrp": r.get("mrp") or 0,
					"discount_percent": r.get("discount_percent") or 0,
				}
				for r in (data.get("items") or [])
				if r.get("item_master")
			],
		}
	)
	doc.insert()
	return {"name": doc.name, "grand_total": doc.grand_total}


@frappe.whitelist()
def submit_counter(name):
	"""Submit a draft Counter Invoice (stock + Sales Invoice)."""
	if not frappe.has_permission("Counter Invoice", "submit", name):
		frappe.throw("Not permitted to submit Counter Invoice.", frappe.PermissionError)
	doc = frappe.get_doc("Counter Invoice", name)
	doc.submit()
	return {"name": doc.name, "sales_invoice": doc.sales_invoice, "grand_total": doc.grand_total}


@frappe.whitelist()
def record_payment(data):
	"""Record a Payment Entry against a Sales Invoice (Laravel payments.store)."""
	if not frappe.has_permission("Payment Entry", "create"):
		frappe.throw("Not permitted to create Payment Entry.", frappe.PermissionError)
	if isinstance(data, str):
		data = frappe.parse_json(data)
	si = frappe.get_doc("Sales Invoice", data.get("sales_invoice"))
	if si.docstatus != 1:
		frappe.throw("Sales Invoice must be submitted before recording payment.")
	outstanding = flt(si.outstanding_amount)
	amount = flt(data.get("amount"))
	if amount <= 0:
		frappe.throw("Amount must be greater than zero.")
	if amount - outstanding > 0.01:
		frappe.throw(f"Amount exceeds outstanding ({outstanding}).")
	pe = frappe.get_doc(
		{
			"doctype": "Payment Entry",
			"payment_type": "Receive",
			"party_type": "Customer",
			"party": si.customer,
			"company": si.company,
			"posting_date": data.get("payment_date") or today(),
			"mode_of_payment": data.get("mode_of_payment") or "Cash",
			"paid_from": frappe.db.get_value("Company", si.company, "default_receivable_account"),
			"paid_to": frappe.db.get_value(
				"Account", {"company": si.company, "account_type": "Cash", "is_group": 0}, "name"
			)
			or frappe.db.get_value(
				"Account", {"company": si.company, "account_type": "Bank", "is_group": 0}, "name"
			),
			"paid_amount": amount,
			"received_amount": amount,
			"source_exchange_rate": 1,
			"target_exchange_rate": 1,
			"reference_no": data.get("reference_no"),
			"remarks": data.get("notes"),
			"references": [
				{
					"reference_doctype": "Sales Invoice",
					"reference_name": si.name,
					"allocated_amount": amount,
				}
			],
		}
	)
	pe.insert()
	pe.submit()
	return {"name": pe.name}


# ============================================================================
# Company profile (Laravel company-profile parity)
# ============================================================================

@frappe.whitelist()
def get_company_profile():
	"""Current company record for the Company Profile screen."""
	_require_read()
	company = frappe.db.get_default("company")
	if not company:
		companies = frappe.get_all("Company", pluck="name", limit=1)
		company = companies[0] if companies else None
	if not company:
		frappe.throw("No Company found on site.")
	return frappe.get_doc("Company", company).as_dict()


@frappe.whitelist()
def update_company_profile(data):
	"""Update allowed Company fields (name/address/tax/phone)."""
	if not frappe.has_permission("Company", "write"):
		frappe.throw("Not permitted to update Company.", frappe.PermissionError)
	if isinstance(data, str):
		data = frappe.parse_json(data)
	company = data.get("name") or frappe.db.get_default("company")
	doc = frappe.get_doc("Company", company)
	for f in ("company_name", "address", "city", "state", "pincode", "phone_no", "email", "gstin", "pan", "company_logo"):
		if f in data:
			doc.set(f, data[f])
	doc.save()
	return {"name": doc.name, "company_logo": doc.get("company_logo")}


# ============================================================================
# Vehicle update (Laravel vehicles update parity)
# ============================================================================

@frappe.whitelist()
def update_vehicle(name, data):
	"""Update EV Vehicle fields (model link, identifiers, odometer...)."""
	if not frappe.has_permission("EV Vehicle", "write", name):
		frappe.throw("Not permitted to update EV Vehicle.", frappe.PermissionError)
	if isinstance(data, str):
		data = frappe.parse_json(data)
	doc = frappe.get_doc("EV Vehicle", name)
	for f in ("vehicle_model", "model", "chassis_no", "motor_no", "battery_no", "controller_no", "converter_no", "date_of_sale"):
		if f in data:
			doc.set(f, data[f])
	doc.save()
	return {"name": doc.name}


# ============================================================================
# Job update: items/labours append + field edits (Laravel assign parity)
# ============================================================================

@frappe.whitelist()
def update_job(name, data):
	"""Append items/labours or edit header fields on a Job Master."""
	_require_write(name)
	if isinstance(data, str):
		data = frappe.parse_json(data)
	doc = frappe.get_doc("Job Master", name)
	if doc.status in ("Completed", "Cancelled"):
		frappe.throw(f"Cannot edit a {doc.status} job.")
	for f in ("date", "status", "customer_type", "service_type", "km_reading", "supervisor", "mechanic", "complaints", "company"):
		if f in data:
			doc.set(f, data[f] or None if f in ("supervisor", "mechanic") else data[f])
	for r in (data.get("items") or []):
		if r.get("item_no"):
			doc.append("items", {"item_no": resolve_item_master(r["item_no"]), "qty": r.get("qty") or 1, "rate": r.get("rate") or 0})
	for r in (data.get("labours") or []):
		if r.get("labour_master"):
			doc.append(
				"job_labours",
				{
					"labour_master": r["labour_master"],
					"technician": r.get("technician"),
					"qty": r.get("qty") or 1,
					"rate": r.get("rate") or 0,
				},
			)
	for row_id in data.get("remove_items") or []:
		for row in list(doc.items):
			if row.name == row_id:
				doc.remove(row)
				break
	doc.save()
	return {"name": doc.name, "grand_total": doc.grand_total}


# ============================================================================
# Bulk delete (Laravel bulk-delete parity)
# ============================================================================

BULK_DELETABLE = {"Job Master", "Counter Invoice", "Customer", "Item Master", "Labour Master", "Vehicle Brand", "Vehicle Model", "EV Vehicle"}


@frappe.whitelist()
def bulk_delete(doctype, names):
	"""Delete many records, skipping ones blocked by links/permissions."""
	if doctype not in BULK_DELETABLE:
		frappe.throw(f"Bulk delete not allowed for {doctype}.")
	if isinstance(names, str):
		names = frappe.parse_json(names)
	deleted, skipped = [], []
	for name in names or []:
		try:
			if not frappe.has_permission(doctype, "delete", name):
				raise frappe.PermissionError(f"No delete permission for {name}.")
			frappe.delete_doc(doctype, name, ignore_permissions=False)
			deleted.append(name)
		except Exception as e:
			skipped.append({"name": name, "reason": str(e)[:120]})
	return {"deleted": deleted, "skipped": skipped, "message": f"Deleted {len(deleted)}, skipped {len(skipped)}."}


# ============================================================================
# CSV import (Laravel import preview/confirm parity, simplified)
# ============================================================================

IMPORTABLE = {
	"customers": ("Customer", ["customer_name", "mobile_no", "email_id"]),
	"parts": ("Item Master", ["item_no", "item_name", "item_class", "uom", "standard_rate", "hsn_code"]),
	"labour": ("Labour Master", ["service_name", "category", "standard_rate", "gst_rate"]),
	"brands": ("Vehicle Brand", ["brand_name"]),
}


@frappe.whitelist()
def import_csv(entity, rows, dry_run=False):
	"""Insert rows from a parsed CSV (header must match field list).

	With dry_run=1, validates every row without writing (preview parity).
	"""
	if entity not in IMPORTABLE:
		frappe.throw(f"Unknown import entity: {entity}")
	doctype, fields = IMPORTABLE[entity]
	if not frappe.has_permission(doctype, "create"):
		frappe.throw(f"Not permitted to create {doctype}.", frappe.PermissionError)
	if isinstance(rows, str):
		rows = frappe.parse_json(rows)
	created, errors = [], []
	for i, row in enumerate(rows or []):
		try:
			if isinstance(row, list):
				row = dict(zip(fields, row))
			data = {f: row.get(f) for f in fields if row.get(f) not in (None, "")}
			if dry_run:
				doc = frappe.get_doc({"doctype": doctype, **data})
				doc.validate()
				created.append(f"row {i + 1}: OK")
			else:
				doc = frappe.get_doc({"doctype": doctype, **data})
				doc.insert()
				created.append(doc.name)
		except Exception as e:
			errors.append({"row": i + 1, "error": str(e)[:150]})
	return {"created": created, "errors": errors, "message": f"{'Would import' if dry_run else 'Imported'} {len(created)}, failed {len(errors)}."}


# ============================================================================
# Gap closures: customer edit, payment void, richer lists, employee create
# ============================================================================

@frappe.whitelist()
def update_customer(name, data):
	"""Edit Customer master fields (Laravel customers.update parity)."""
	if not frappe.has_permission("Customer", "write", name):
		frappe.throw("Not permitted to update Customer.", frappe.PermissionError)
	if isinstance(data, str):
		data = frappe.parse_json(data)
	doc = frappe.get_doc("Customer", name)
	for f in ("customer_name", "customer_type"):
		if f in data:
			doc.set(f, data[f])
	doc.save()
	# Mobile/email live on the Primary Contact (fetched onto Customer).
	# Sync first, then re-save so fetch_from pulls the values in.
	if "mobile_no" in data or "email_id" in data:
		sync_customer_contact(name, data.get("mobile_no"), data.get("email_id"))
		doc.reload()
		doc.save()
	return {"name": doc.name}


@frappe.whitelist()
def void_payment(name):
	"""Cancel (void) a submitted Payment Entry (Laravel payments.destroy)."""
	if not frappe.has_permission("Payment Entry", "cancel", name):
		frappe.throw("Not permitted to void Payment Entry.", frappe.PermissionError)
	doc = frappe.get_doc("Payment Entry", name)
	if doc.docstatus != 1:
		frappe.throw("Only submitted payments can be voided.")
	doc.cancel()
	return {"name": doc.name, "status": doc.status}


@frappe.whitelist()
def create_employee(data):
	"""Create an HRMS Employee (Laravel employees.store parity)."""
	if not frappe.has_permission("Employee", "create"):
		frappe.throw("Not permitted to create Employee.", frappe.PermissionError)
	if isinstance(data, str):
		data = frappe.parse_json(data)
	doc = frappe.get_doc(
		{
			"doctype": "Employee",
			"first_name": data.get("first_name"),
			"last_name": data.get("last_name"),
			"gender": data.get("gender") or "Male",
			"date_of_birth": data.get("date_of_birth") or "1990-01-01",
			"date_of_joining": data.get("date_of_joining"),
			"company": data.get("company") or frappe.db.get_default("company"),
			"status": "Active",
			"cell_number": data.get("mobile_no"),
			"designation": data.get("designation") or "Technician",
			"department": data.get("department"),
		}
	)
	doc.insert()
	return {"name": doc.name}


@frappe.whitelist()
def create_labour_master(data):
	"""Create a Labour Master rate (Laravel labour-masters.store parity)."""
	if not frappe.has_permission("Labour Master", "create"):
		frappe.throw("Not permitted to create Labour Master.", frappe.PermissionError)
	if isinstance(data, str):
		data = frappe.parse_json(data)
	doc = frappe.get_doc(
		{
			"doctype": "Labour Master",
			"service_name": data.get("service_name"),
			"category": data.get("category") or "General",
			"standard_rate": data.get("standard_rate") or 0,
			"taxable": data.get("taxable", 1),
			"gst_rate": data.get("gst_rate") or 18,
			"hsn_sac_code": data.get("hsn_sac_code"),
		}
	).insert()
	return {"name": doc.name}


@frappe.whitelist()
def create_brand_model(data):
	"""Create a Vehicle Brand and/or Model (Laravel catalog parity)."""
	if isinstance(data, str):
		data = frappe.parse_json(data)
	out = {}
	if data.get("brand_name"):
		if not frappe.has_permission("Vehicle Brand", "create"):
			frappe.throw("Not permitted to create Vehicle Brand.", frappe.PermissionError)
		brand = frappe.db.exists("Vehicle Brand", {"brand_name": data["brand_name"]})
		if not brand:
			brand = frappe.get_doc({"doctype": "Vehicle Brand", "brand_name": data["brand_name"]}).insert().name
		out["brand"] = brand
	if data.get("model_name"):
		if not frappe.has_permission("Vehicle Model", "create"):
			frappe.throw("Not permitted to create Vehicle Model.", frappe.PermissionError)
		brand = out.get("brand") or data.get("vehicle_brand")
		if not brand:
			frappe.throw("Brand is required to create a model.")
		out["model"] = frappe.get_doc(
			{
				"doctype": "Vehicle Model",
				"vehicle_brand": brand,
				"model_name": data["model_name"],
				"battery_type": data.get("battery_type") or "Lithium-ion",
			}
		).insert().name
	return out


@frappe.whitelist()
def update_vehicle(name, data):
	"""Edit EV Vehicle fields (Laravel vehicles.update parity)."""
	if not frappe.has_permission("EV Vehicle", "write", name):
		frappe.throw("Not permitted to update EV Vehicle.", frappe.PermissionError)
	if isinstance(data, str):
		data = frappe.parse_json(data)
	doc = frappe.get_doc("EV Vehicle", name)
	for f in ("vehicle_model", "model", "chassis_no", "motor_no", "battery_no", "controller_no", "converter_no", "date_of_sale"):
		if f in data:
			doc.set(f, data[f])
	doc.save()
	return {"name": doc.name}


# ============================================================================
# Master search (Laravel dashboard search parity)
# ============================================================================

@frappe.whitelist()
def master_search(q, limit=8):
	"""One box across customers, vehicles, jobs and counter invoices."""
	_require_read()
	if not q or len(str(q).strip()) < 2:
		return {"customers": [], "vehicles": [], "jobs": [], "counters": []}
	try:
		limit = min(max(int(limit or 8), 1), 25)
	except (TypeError, ValueError):
		limit = 8
	safe = str(q).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
	like = f"%{safe}%"
	return {
		"customers": frappe.get_list(
			"Customer", fields=["name", "customer_name", "mobile_no"],
			filters=[["customer_name", "like", like]], order_by="customer_name", limit_page_length=limit),
		"vehicles": frappe.get_list(
			"EV Vehicle", fields=["name", "registration_no", "model"],
			filters=[["registration_no", "like", like]], order_by="registration_no", limit_page_length=limit),
		"jobs": frappe.get_list(
			"Job Master", fields=["name", "customer_name", "status"],
			filters=[["name", "like", like]], order_by="creation desc", limit_page_length=limit),
		"counters": frappe.get_list(
			"Counter Invoice", fields=["name", "walkin_name", "grand_total"],
			filters=[["name", "like", like]], order_by="creation desc", limit_page_length=limit),
	}


# ============================================================================
# Statement running-balance ledger (Laravel statement parity)
# ============================================================================

@frappe.whitelist()
def get_customer_ledger(customer, from_date=None, to_date=None):
	"""Combined jobs/invoices/payments ledger with running balance."""
	if not frappe.has_permission("Customer", "read", customer):
		frappe.throw("Not permitted to view this Customer.", frappe.PermissionError)
	date_filter = ""
	params = [customer]
	if from_date and to_date:
		date_filter = "and posting_date between %s and %s"
		params += [from_date, to_date]
	elif from_date:
		date_filter = "and posting_date >= %s"
		params.append(from_date)
	elif to_date:
		date_filter = "and posting_date <= %s"
		params.append(to_date)

	invoices = frappe.db.sql(
		f"""select name, posting_date, grand_total as billed, paid_amount as paid
		    from `tabSales Invoice` where docstatus = 1 and customer = %s {date_filter}
		    order by posting_date, creation""",
		params,
		as_dict=True,
	)
	lines, balance = [], 0.0
	for inv in invoices:
		balance += flt(inv.billed) - flt(inv.paid)
		lines.append(
			{
				"date": str(inv.posting_date),
				"document": inv.name,
				"billed": flt(inv.billed),
				"paid": flt(inv.paid),
				"balance": flt(balance),
			}
		)
	return {"lines": lines, "closing_balance": flt(balance)}


@frappe.whitelist()
def template_csv(entity):
	"""Header-only CSV template (Laravel template parity; export cols as fallback)."""
	if entity in IMPORTABLE:
		fields = IMPORTABLE[entity][1]
	elif entity in EXPORT_ENTITIES:
		fields = EXPORT_ENTITIES[entity][1]
	else:
		frappe.throw(f"Unknown template entity: {entity}")
	import csv
	import io

	buf = io.StringIO()
	writer = csv.writer(buf)
	writer.writerow(fields)
	frappe.response["result"] = buf.getvalue()
	frappe.response["doctype"] = f"{entity}_template.csv"
	frappe.response["type"] = "csv"


@frappe.whitelist()
def export_selected(entity, names):
	"""CSV export for explicitly selected records (Laravel bulk-export)."""
	if entity not in EXPORT_ENTITIES:
		frappe.throw(f"Unknown export entity: {entity}")
	if isinstance(names, str):
		names = frappe.parse_json(names)
	doctype, fields = EXPORT_ENTITIES[entity]
	if not frappe.has_permission(doctype, "export"):
		frappe.throw(f"Not permitted to export {doctype}.", frappe.PermissionError)

	import csv
	import io

	rows = []
	for name in names or []:
		if frappe.has_permission(doctype, "export", name):
			doc = frappe.get_doc(doctype, name)
			rows.append({f: doc.get(f) for f in fields})
	buf = io.StringIO()
	writer = csv.DictWriter(buf, fieldnames=fields)
	writer.writeheader()
	writer.writerows(rows)
	frappe.response["result"] = buf.getvalue()
	frappe.response["doctype"] = f"{entity}_selected.csv"
	frappe.response["type"] = "csv"


# ============================================================================
# Combobox + dependent lookups (Laravel searchable-combobox parity)
# ============================================================================

@frappe.whitelist()
def search_customers(q, limit=10):
	"""Lightweight customer lookup for comboboxes."""
	_require_read()
	q = (q or "").strip()
	if len(q) < 1:
		return []
	safe = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
	rows = frappe.get_list(
		"Customer",
		fields=["name", "customer_name", "mobile_no"],
		filters=[["customer_name", "like", f"%{safe}%"]],
		or_filters=[["mobile_no", "like", f"%{safe}%"]],
		order_by="customer_name",
		limit_page_length=limit,
	)
	return [{"id": r.name, "label": f"{r.customer_name} — {r.mobile_no or ''}"} for r in rows]


@frappe.whitelist()
def search_parts(q, limit=20):
	"""Spare-part lookup for line-item comboboxes (MRP/labor/GST included)."""
	if not frappe.has_permission("Item Master", "read"):
		frappe.throw("Not permitted to view Item Master.", frappe.PermissionError)
	q = (q or "").strip()
	if len(q) < 1:
		return []
	safe = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
	rows = frappe.get_list(
		"Item Master",
		fields=["item_no", "item_name", "standard_rate", "labor_charge", "sgst_percent", "cgst_percent", "igst_percent"],
		filters=[["item_name", "like", f"%{safe}%"]],
		or_filters=[["item_no", "like", f"%{safe}%"]],
		order_by="item_name",
		limit_page_length=limit,
	)
	return [
		{"id": r.item_no, "label": f"{r.item_name} ({r.item_no})",
		 "mrp": r.standard_rate, "labor": r.labor_charge,
		 "sgst": r.sgst_percent, "cgst": r.cgst_percent, "igst": r.igst_percent}
		for r in rows
	]


@frappe.whitelist()
def customer_vehicles(customer):
	"""Vehicles of one customer for dependent dropdowns."""
	_require_read()
	owns = frappe.get_all(
		"Vehicle Ownership",
		filters={"owner_name": customer},
		fields=["vehicle", "registration_no", "model", "is_primary"],
		order_by="is_primary desc",
	)
	out = []
	for o in owns:
		label = f"{o.registration_no or o.vehicle} — {o.model or ''}".strip(" —")
		out.append({"id": o.vehicle, "registration_no": o.registration_no, "model": o.model, "label": label})
	return out


# ============================================================================
# Full updates (Laravel edit/update parity)
# ============================================================================

@frappe.whitelist()
def update_employee(name, data):
	"""Edit HRMS Employee (Laravel employees.update parity)."""
	if not frappe.has_permission("Employee", "write", name):
		frappe.throw("Not permitted to update Employee.", frappe.PermissionError)
	if isinstance(data, str):
		data = frappe.parse_json(data)
	doc = frappe.get_doc("Employee", name)
	for f in ("first_name", "cell_number", "department", "designation", "date_of_joining", "status"):
		if f in data:
			doc.set(f, data[f])
	if "active" in data:
		doc.status = "Active" if str(data["active"]) in ("1", "true", "Active") else "Inactive"
	doc.save()
	return {"name": doc.name}


@frappe.whitelist()
def update_labour(name, data):
	"""Edit Labour Master (Laravel labour-masters.update parity)."""
	if not frappe.has_permission("Labour Master", "write", name):
		frappe.throw("Not permitted to update Labour Master.", frappe.PermissionError)
	if isinstance(data, str):
		data = frappe.parse_json(data)
	doc = frappe.get_doc("Labour Master", name)
	for f in ("service_name", "category", "standard_rate", "hsn_sac_code", "gst_rate"):
		if f in data:
			doc.set(f, data[f])
	if "taxable" in data:
		doc.taxable = 1 if str(data["taxable"]) in ("1", "true") else 0
	if not doc.taxable:
		doc.gst_rate = 0
	doc.save()
	return {"name": doc.name}


@frappe.whitelist()
def update_part(item_no, data):
	"""Edit Item Master (Laravel spare-parts.update parity)."""
	if not frappe.has_permission("Item Master", "write"):
		frappe.throw("Not permitted to update Item Master.", frappe.PermissionError)
	if isinstance(data, str):
		data = frappe.parse_json(data)
	name = frappe.db.get_value("Item Master", {"item_no": item_no}, "name") or item_no
	doc = frappe.get_doc("Item Master", name)
	for f in ("item_name", "category", "uom", "purchase_price", "standard_rate", "labor_charge",
	          "hsn_code", "gst_rate", "min_qty"):
		if f in data:
			doc.set(f, data[f])
	doc.save()
	return {"name": doc.name}


@frappe.whitelist()
def update_brand_model(kind, name, data):
	"""Edit Vehicle Brand / Model (Laravel catalog parity)."""
	doctype = "Vehicle Brand" if kind == "brand" else "Vehicle Model"
	if not frappe.has_permission(doctype, "write", name):
		frappe.throw(f"Not permitted to update {doctype}.", frappe.PermissionError)
	if isinstance(data, str):
		data = frappe.parse_json(data)
	doc = frappe.get_doc(doctype, name)
	if kind == "brand":
		if "brand_name" in data:
			doc.brand_name = data["brand_name"]
	else:
		for f in ("vehicle_brand", "model_name", "battery_type"):
			if f in data:
				doc.set(f, data[f])
	doc.save()
	return {"name": doc.name}


@frappe.whitelist()
def update_payment(name, data):
	"""Edit a draft Payment Entry (Laravel payments.update parity)."""
	if not frappe.has_permission("Payment Entry", "write", name):
		frappe.throw("Not permitted to update Payment Entry.", frappe.PermissionError)
	if isinstance(data, str):
		data = frappe.parse_json(data)
	doc = frappe.get_doc("Payment Entry", name)
	if doc.docstatus != 0:
		frappe.throw("Only draft payments can be edited. Void and re-record instead.")
	for f in ("paid_amount", "received_amount", "mode_of_payment", "posting_date", "reference_no", "remarks"):
		if f in data:
			doc.set(f, data[f])
	doc.save()
	return {"name": doc.name}


@frappe.whitelist()
def update_counter(name, data):
	"""Edit a draft Counter Invoice (Laravel counter-invoices.update parity)."""
	if not frappe.has_permission("Counter Invoice", "write", name):
		frappe.throw("Not permitted to update Counter Invoice.", frappe.PermissionError)
	if isinstance(data, str):
		data = frappe.parse_json(data)
	doc = frappe.get_doc("Counter Invoice", name)
	if doc.docstatus != 0:
		frappe.throw("Only draft counter invoices can be edited.")
	for f in ("company", "invoice_date", "customer", "walkin_name", "walkin_mobile",
	          "gst_applicable", "discount_percent", "discount_amount"):
		if f in data:
			doc.set(f, data[f])
	if "items" in data:
		doc.set("items", [])
		for r in data["items"] or []:
			if r.get("item_master"):
				doc.append("items", {
					"item_master": resolve_item_master(r["item_master"]),
					"qty": r.get("qty") or 1,
					"mrp": r.get("mrp") or 0,
					"discount_percent": r.get("discount_percent") or 0,
				})
	doc.save()
	return {"name": doc.name, "grand_total": doc.grand_total}


@frappe.whitelist()
def create_vehicle(data):
	"""Create EV Vehicle + ownership (Laravel vehicles.store parity)."""
	if not frappe.has_permission("EV Vehicle", "create"):
		frappe.throw("Not permitted to create EV Vehicle.", frappe.PermissionError)
	if isinstance(data, str):
		data = frappe.parse_json(data)
	if data.get("vehicle_model"):
		model = frappe.db.get_value("Vehicle Model", data["vehicle_model"], ["model_name", "vehicle_brand"], as_dict=True)
	else:
		model = None
	doc = frappe.get_doc(
		{
			"doctype": "EV Vehicle",
			"registration_no": (data.get("registration_no") or "").upper() or None,
			"is_non_rto": data.get("is_non_rto") or 0,
			"vehicle_model": data.get("vehicle_model"),
			"model": (model.model_name if model else None) or data.get("model"),
			"chassis_no": data.get("chassis_no"),
			"motor_no": data.get("motor_no") or data.get("motor_battery_serial_no"),
			"battery_no": data.get("battery_no"),
			"date_of_sale": data.get("date_of_sale"),
			"color": data.get("color"),
		}
	).insert()
	ownership = None
	if data.get("customer"):
		ownership = frappe.get_doc(
			{"doctype": "Vehicle Ownership", "vehicle": doc.name, "owner_name": data["customer"], "is_primary": 1}
		).insert().name
	return {"vehicle": doc.name, "ownership": ownership}


@frappe.whitelist()
def outstanding_documents(customer):
	"""Docs with dues for the receive-payment picker (Laravel outstandingDocuments)."""
	if not frappe.has_permission("Customer", "read", customer):
		frappe.throw("Not permitted to view this Customer.", frappe.PermissionError)
	docs = []
	for si in frappe.get_list(
		"Sales Invoice",
		fields=["name", "posting_date", "grand_total", "outstanding_amount", "job_reference"],
		filters={"customer": customer, "docstatus": 1},
		order_by="posting_date desc",
		limit_page_length=100,
	):
		due = max(flt(si.outstanding_amount), 0)
		if due > 0:
			docs.append({"doctype": "Sales Invoice", "name": si.name, "date": str(si.posting_date),
			             "label": si.job_reference or si.name, "outstanding": due})
	return docs


@frappe.whitelist()
def get_analytics_detail(kind, from_date=None, to_date=None):
	"""Sub-page datasets (Laravel analytics/revenue|job-cards|inventory|payments|customers)."""
	_require_read()
	if not from_date or not to_date:
		from_date, to_date = get_first_day(today()), today()
	out = {"from_date": from_date, "to_date": to_date}

	if kind == "revenue":
		out["by_day"] = frappe.db.sql(
			"""select date(posting_date) as day, sum(base_grand_total) as total
			   from `tabSales Invoice` where docstatus = 1 and posting_date between %s and %s
			   group by date(posting_date) order by date(posting_date)""",
			[from_date, to_date], as_dict=True)
		out["by_type"] = frappe.db.sql(
			"""select coalesce(j.service_type, 'Counter') as job_type, sum(si.base_grand_total) as total,
			          count(distinct si.name) as invoices
			   from `tabSales Invoice` si left join `tabJob Master` j on j.name = si.job_reference
			   where si.docstatus = 1 and si.posting_date between %s and %s
			   group by job_type order by total desc""",
			[from_date, to_date], as_dict=True)

	elif kind == "job_cards":
		out["by_status"] = frappe.db.sql(
			"""select status, count(name) as total from `tabJob Master`
			   where date between %s and %s group by status""",
			[from_date, to_date], as_dict=True)

	elif kind == "inventory":
		rows = frappe.db.sql(
			"""select ji.item_no as code, sum(ji.qty) as used
			   from `tabJob Item` ji join `tabJob Master` j on j.name = ji.parent
			   where j.date between %s and %s group by ji.item_no""",
			[from_date, to_date], as_dict=True)
		used = {r.code: flt(r.used) for r in rows}
		parts = frappe.get_all("Item Master",
			fields=["item_no", "item_name", "item_class", "standard_rate", "purchase_price", "min_qty"])
		company = frappe.db.get_default("company")
		abbr = frappe.db.get_value("Company", company, "abbr") if company else None
		warehouse = f"Stores - {abbr}" if abbr else None
		lines = []
		for p in parts:
			bal = 0
			if frappe.db.exists("Item", p.item_no) and warehouse:
				bal = frappe.db.get_value("Bin", {"item_code": p.item_no, "warehouse": warehouse}, "actual_qty") or 0
			u = used.get(p.item_no, 0) or used.get(frappe.db.get_value("Item Master", p.item_no, "name"), 0)
			lines.append({"code": p.item_no, "name": p.item_name, "category": p.item_class,
			              "stock": flt(bal), "reorder": flt(p.min_qty), "cost": flt(p.purchase_price),
			              "value": flt(bal) * flt(p.purchase_price), "used": flt(u)})
		lines.sort(key=lambda r: r["used"], reverse=True)
		out["lines"] = lines
		out["total_value"] = sum(r["value"] for r in lines)

	elif kind == "payments":
		out["ledger"] = frappe.get_list(
			"Payment Entry",
			fields=["name", "posting_date", "party", "paid_amount", "mode_of_payment", "reference_no", "remarks"],
			filters={"docstatus": 1, "posting_date": ["between", [from_date, to_date]]},
			order_by="posting_date desc", limit_page_length=500)

	elif kind == "customers":
		rows = frappe.db.sql(
			"""select customer, count(name) as visits, sum(base_grand_total - outstanding_amount) as paid
			   from `tabSales Invoice` where docstatus = 1 and posting_date between %s and %s
			   group by customer order by paid desc limit 50""",
			[from_date, to_date], as_dict=True)
		out["rows"] = [{"customer": r.customer, "visits": r.visits, "paid": flt(r.paid)} for r in rows]

	elif kind == "aging":
		buckets = {"0-7": 0, "8-30": 0, "30+": 0}
		today_d = getdate(today())
		for si in frappe.get_all("Sales Invoice", filters={"docstatus": 1},
		                         fields=["posting_date", "outstanding_amount"], limit_page_length=2000):
			due = max(flt(si.outstanding_amount), 0)
			if due <= 0.005:
				continue
			age = (today_d - getdate(si.posting_date)).days if si.posting_date else 0
			buckets["0-7" if age <= 7 else ("8-30" if age <= 30 else "30+")] += due
		out["buckets"] = buckets

	return out


@frappe.whitelist()
def assign_bill(name, data):
	"""Assign technician + replace parts/labours + bill (Laravel assign-update)."""
	_require_write(name)
	if isinstance(data, str):
		data = frappe.parse_json(data)
	doc = frappe.get_doc("Job Master", name)
	if doc.status in ("Completed", "Cancelled"):
		frappe.throw(f"Cannot bill a {doc.status} job.")
	for f in ("mechanic", "supervisor"):
		if f in data:
			doc.set(f, data[f] or None)
	doc.discount_percent = data.get("discount_percent") or 0
	doc.discount_amount = data.get("discount_amount") or 0
	if "gst_applicable" in data:
		doc.gst_applicable = 1 if str(data["gst_applicable"]) in ("1", "true") else 0
	doc.set("items", [])
	for r in data.get("items") or []:
		if r.get("item_no"):
			doc.append("items", {
				"item_no": resolve_item_master(r["item_no"]),
				"qty": r.get("qty") or 0,
				"rate": r.get("rate") or 0,
				"labor_cost": r.get("labor_cost") or 0,
			})
	doc.set("job_labours", [])
	for r in data.get("labours") or []:
		if r.get("labour_master"):
			doc.append("job_labours", {
				"labour_master": r["labour_master"],
				"technician": r.get("technician"),
				"qty": r.get("qty") or 0,
				"rate": r.get("rate") or 0,
			})
	doc.save()
	return {"name": doc.name, "grand_total": doc.grand_total}


@frappe.whitelist()
def get_vehicle(name):
	"""Single EV Vehicle for the edit form."""
	if not frappe.has_permission("EV Vehicle", "read", name):
		frappe.throw("Not permitted to view EV Vehicle.", frappe.PermissionError)
	return {"vehicle": frappe.get_doc("EV Vehicle", name).as_dict()}


@frappe.whitelist()
def create_part(data):
	"""Create an Item Master part (Laravel spare-parts.store parity)."""
	if not frappe.has_permission("Item Master", "create"):
		frappe.throw("Not permitted to create Item Master.", frappe.PermissionError)
	if isinstance(data, str):
		data = frappe.parse_json(data)
	doc = frappe.get_doc(
		{
			"doctype": "Item Master",
			"item_name": data.get("item_name"),
			"category": data.get("category"),
			"uom": data.get("uom") or "Nos",
			"purchase_price": data.get("purchase_price") or 0,
			"standard_rate": data.get("standard_rate") or 0,
			"labor_charge": data.get("labor_charge") or 0,
			"hsn_code": data.get("hsn_code"),
			"gst_rate": data.get("gst_rate") or 0,
			"min_qty": data.get("min_qty") or data.get("reorder_level") or 0,
		}
	).insert()
	return {"name": doc.name, "item_no": doc.item_no}
