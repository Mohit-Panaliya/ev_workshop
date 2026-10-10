// Frappe API client (session auth, same-origin).
const CSRF = () => window.csrf_token || "";

async function call(method, params = {}, opts = {}) {
  const url = new URL(`/api/method/${method}`, window.location.origin);
  const useGet = opts.httpMethod !== "POST" && method.includes(".get_");
  let res;
  if (useGet) {
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && url.searchParams.append(k, v));
    res = await fetch(url, { credentials: "same-origin" });
  } else {
    res = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Frappe-CSRF-Token": CSRF() },
      body: JSON.stringify(params),
    });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.exc) {
    throw new Error(parseExc(data.exc) || data.message || `Request failed (${res.status})`);
  }
  return data.message;
}

function parseExc(exc) {
  try {
    const parsed = JSON.parse(exc);
    const last = Array.isArray(parsed) ? parsed[parsed.length - 1] : String(parsed);
    const lines = String(last).split("\n").filter((l) => l.includes(":"));
    const tail = lines.pop() || "";
    return tail.split(":").slice(-1)[0].trim() || tail.trim();
  } catch {
    return null;
  }
}

const M = "ev_workshop.workshop_api";

export const api = {
  dashboard: () => call(`${M}.get_dashboard`),
  jobs: (p) => call(`${M}.get_jobs`, p || {}),
  job: (name) => call(`${M}.get_job_detail`, { name }),
  advance: (name, to_status) => call(`${M}.advance_status`, { name, to_status }, { httpMethod: "POST" }),
  counters: (p) => call(`${M}.get_counter_invoices`, p || {}),
  counter: (name) => call(`${M}.get_counter_invoice`, { name }),
  labour: (p) => call(`${M}.get_labour_masters`, p || {}),
  catalog: () => call(`${M}.get_catalog`),
  payments: (p) => call(`${M}.get_payments`, p || {}),
  customers: (p) => call(`${M}.get_customers`, p || {}),
  customer: (customer) => call(`${M}.get_customer_profile`, { customer }),
  statement: (customer, from_date, to_date) => call(`${M}.get_customer_statement`, { customer, from_date, to_date }),
  analytics: (period) => call(`${M}.get_analytics`, period ? { period } : {}),
  analyticsFull: (period, from_date, to_date) => call(`${M}.get_analytics`, { period, from_date, to_date }),
  analyticsDetail: (kind, from_date, to_date) => call(`${M}.get_analytics_detail`, { kind, from_date, to_date }),
  masterSearch: (q) => call(`${M}.master_search`, { q }),
  ledger: (customer, from_date, to_date) => call(`${M}.get_customer_ledger`, { customer, from_date, to_date }),
  employees: (p) => call(`${M}.get_employees`, p || {}),
  parts: (p) => call(`${M}.get_parts`, p || {}),
  jobOptions: () => call(`${M}.get_job_create_options`),
  searchCustomers: (q) => call(`${M}.search_customers`, { q }),
  searchParts: (q) => call(`${M}.search_parts`, { q }),
  customerVehicles: (customer) => call(`${M}.customer_vehicles`, { customer }),
  combobox: (endpoint, q) => call(endpoint, { q }),
  createJob: (data) => call(`${M}.create_job`, { data }, { httpMethod: "POST" }),
  createCustomer: (data) => call(`${M}.create_customer`, { data }, { httpMethod: "POST" }),
  createVehicle: (data) => call(`${M}.create_vehicle`, { data }, { httpMethod: "POST" }),
  vehicle: (name) => call(`${M}.get_vehicle`, { name }),
  createCounter: (data) => call(`${M}.create_counter`, { data }, { httpMethod: "POST" }),
  submitCounter: (name) => call(`${M}.submit_counter`, { name }, { httpMethod: "POST" }),
  recordPayment: (data) => call(`${M}.record_payment`, { data }, { httpMethod: "POST" }),
  outstandingDocs: (customer) => call(`${M}.outstanding_documents`, { customer }),
  company: () => call(`${M}.get_company_profile`),
  saveCompany: (data) => call(`${M}.update_company_profile`, { data }, { httpMethod: "POST" }),
  updateJob: (name, data) => call(`${M}.update_job`, { name, data }, { httpMethod: "POST" }),
  assignBill: (name, data) => call(`${M}.assign_bill`, { name, data }, { httpMethod: "POST" }),
  updateCustomer: (name, data) => call(`${M}.update_customer`, { name, data }, { httpMethod: "POST" }),
  updateVehicle: (name, data) => call(`${M}.update_vehicle`, { name, data }, { httpMethod: "POST" }),
  voidPayment: (name) => call(`${M}.void_payment`, { name }, { httpMethod: "POST" }),
  createEmployee: (data) => call(`${M}.create_employee`, { data }, { httpMethod: "POST" }),
  createLabour: (data) => call(`${M}.create_labour_master`, { data }, { httpMethod: "POST" }),
  updateLabour: (name, data) => call(`${M}.update_labour`, { name, data }, { httpMethod: "POST" }),
  createPart: (data) => call(`${M}.create_part`, { data }, { httpMethod: "POST" }),
  updatePart: (item_no, data) => call(`${M}.update_part`, { item_no, data }, { httpMethod: "POST" }),
  updateEmployee: (name, data) => call(`${M}.update_employee`, { name, data }, { httpMethod: "POST" }),
  updateBrandModel: (kind, name, data) => call(`${M}.update_brand_model`, { kind, name, data }, { httpMethod: "POST" }),
  updatePayment: (name, data) => call(`${M}.update_payment`, { name, data }, { httpMethod: "POST" }),
  updateCounter: (name, data) => call(`${M}.update_counter`, { name, data }, { httpMethod: "POST" }),
  createBrandModel: (data) => call(`${M}.create_brand_model`, { data }, { httpMethod: "POST" }),
  bulkDelete: (doctype, names) => call(`${M}.bulk_delete`, { doctype, names }, { httpMethod: "POST" }),
  importCsv: (entity, rows, dry_run) => call(`${M}.import_csv`, { entity, rows, dry_run: dry_run ? 1 : 0 }, { httpMethod: "POST" }),
  quoteUrl: (docname) => call("ev_workshop.api.send_quote_whatsapp", { docname }, { httpMethod: "POST" }),
  readyUrl: (docname) => call("ev_workshop.api.send_ready_notification", { docname }, { httpMethod: "POST" }),
};

export async function login(usr, pwd) {
  const res = await fetch("/api/method/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ usr, pwd }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.exc) throw new Error("These credentials do not match our records.");
  window.location.hash = "#/dashboard";
  window.location.reload();
  return data;
}

export async function loggedUser() {
  try {
    const r = await fetch("/api/method/frappe.auth.get_logged_user", { credentials: "same-origin" });
    const d = await r.json();
    return d.message && d.message !== "Guest" ? d.message : null;
  } catch {
    return null;
  }
}

export async function logout() {
  await fetch("/api/method/logout", { credentials: "same-origin" });
  window.location.hash = "#/login";
  window.location.reload();
}
