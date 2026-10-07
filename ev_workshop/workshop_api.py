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
	statuses = [s for s, in frappe.db.get_values("Job Master", {}, "distinct status")]
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
	return {"job": doc, "ownership": ownership, "allowed_next": list(TRANSITIONS.get(doc.status, ()))}


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
