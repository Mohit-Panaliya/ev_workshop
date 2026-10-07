import frappe

no_cache = 1


def get_context(context):
	csrf_token = frappe.sessions.get_csrf_token()
	frappe.db.commit()
	context = frappe._dict()
	context.csrf_token = csrf_token
	context.boot = frappe._dict(site_name=frappe.local.site, lang=frappe.local.lang)
	context.site_name = frappe.local.site
	return context
