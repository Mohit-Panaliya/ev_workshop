"""EV Workshop App Configuration.

This module defines the app metadata and hooks for the EV Workshop application.
It is loaded by Frappe when the app is installed on a site.

App architecture:
    - DocTypes: EV Vehicle, Vehicle Ownership, Job Master, Job Item, Item Master
    - API layer: api.py (whitelisted endpoints called from JS)
    - Frontend: job_master.js (main workflow controller)
    - Custom fields: ev_workshop_custom_fields.py (extends ERPNext Item + Sales Invoice)

Workflow lifecycle:
    A vehicle enters the workshop as "Admitted", goes through inspection,
    quoting, approval, repair, and finally completion with payment.
    Each stage transition is handled by workflow buttons in job_master.js
    and validated server-side in job_master.py validate().
"""

# ============================================================================
# App Information (displayed in Frappe admin)
# ============================================================================

app_name = "ev_workshop"
app_title = "EV Workshop"
app_publisher = "Mohit"
app_description = "EV workshop job cards app"
app_email = "mohitpanaliya0@gmail.com"
app_license = "GNU General Public License (GPL)"

# ============================================================================
# Required Apps
# ============================================================================

# HRMS is required for Employee doctype (used in Allocation tab)
# ERPNext is required for Sales Invoice, Stock Entry, Item, Customer
required_apps = ["hrms", "erpnext", "frappe"]

# ============================================================================
# Document Events
# ============================================================================
# Hook on document methods and events.
# Currently empty — all logic is handled via class methods on the DocType
# controllers (e.g., JobMaster.validate()) and workflow buttons in JS.
doc_events = {}

# ============================================================================
# Fixtures (installed on every site with install-app / migrate)
# ============================================================================
# Custom fields the app depends on (Item ev_* fields, Sales Invoice
# job_reference). Filtered to this app's module so other apps' fields are
# never exported.
fixtures = [
	{"dt": "Custom Field", "filters": [["module", "=", "EV Workshop"]]},
]

# ============================================================================
# Website routes (workshop PWA shell + SPA fallback)
# ============================================================================
# /workshop renders www/workshop.html (prebuilt SPA + manifest + CSRF boot).
# Sub-paths (/workshop/jobs/...) return the same shell; vue-router resolves
# the view client-side.
website_route_rules = [
	{"from_route": "/workshop/<path:app_path>", "to_route": "workshop"},
	{"from_route": "/evhub/<path:app_path>", "to_route": "workshop"},
]

# ============================================================================
# Includes (CSS/JS bundles loaded on every page)
# ============================================================================
# Uncomment when you create global CSS/JS files:
# app_include_css = "/assets/ev_workshop/css/ev_workshop.css"
# app_include_js = "/assets/ev_workshop/js/ev_workshop.js"
