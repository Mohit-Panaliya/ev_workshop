app_name = "ev_workshop"
app_title = "EV Workshop"
app_publisher = "Mohit"
app_description = "Ev workshop job cards app"
app_email = "mohitpanaliya0@gmail.com"
app_license = "mit"

# Apps
# ------------------

required_apps = ["hrms", "erpnext", "frappe"]

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "ev_workshop",
# 		"logo": "/assets/ev_workshop/logo.png",
# 		"title": "EV Workshop",
# 		"route": "/ev_workshop",
# 		"has_permission": "ev_workshop.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/ev_workshop/css/ev_workshop.css"
# app_include_js = "/assets/ev_workshop/js/ev_workshop.js"

# include js, css files in header of web template
# web_include_css = "/assets/ev_workshop/css/ev_workshop.css"
# web_include_js = "/assets/ev_workshop/js/ev_workshop.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "ev_workshop/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "ev_workshop/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# automatically load and sync documents of this doctype from downstream apps
# importable_doctypes = [doctype_1]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "ev_workshop.utils.jinja_methods",
# 	"filters": "ev_workshop.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "ev_workshop.install.before_install"
# after_install = "ev_workshop.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "ev_workshop.uninstall.before_uninstall"
# after_uninstall = "ev_workshop.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "ev_workshop.utils.before_app_install"
# after_app_install = "ev_workshop.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "ev_workshop.utils.before_app_uninstall"
# after_app_uninstall = "ev_workshop.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "ev_workshop.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events
# NOTE: Job Master is not submittable, so there are no submit hooks.
# Workflow guards live in JobMaster.validate(); stock/invoice actions are
# explicit whitelisted calls (api.create_job_invoice, JobMaster.create_stock_entry).
#
# doc_events = {
# 	"Job Master": {
# 		"validate": "ev_workshop.ev_workshop.doctype.job_master.job_master.on_job_master_validate"
# 	}
# }

# Fixtures — synced to every site on install/migrate. Custom fields the app
# depends on (Item EV fields, Sales Invoice job_reference) must live here so
# fresh installs work without manual Customize Form steps. Filtered to this
# app's module so other apps' fields are never exported.
fixtures = [
	{"dt": "Custom Field", "filters": [["module", "=", "EV Workshop"]]},
]

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"ev_workshop.tasks.all"
# 	],
# 	"daily": [
# 		"ev_workshop.tasks.daily"
# 	],
# 	"hourly": [
# 		"ev_workshop.tasks.hourly"
# 	],
# 	"weekly": [
# 		"ev_workshop.tasks.weekly"
# 	],
# 	"monthly": [
# 		"ev_workshop.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "ev_workshop.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
# extend_doctype_class = {
# 	"Task": "ev_workshop.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "ev_workshop.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "ev_workshop.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["ev_workshop.utils.before_request"]
# after_request = ["ev_workshop.utils.after_request"]

# Job Events
# ----------
# before_job = ["ev_workshop.utils.before_job"]
# after_job = ["ev_workshop.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"ev_workshop.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []

