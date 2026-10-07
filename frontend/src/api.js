/** Minimal Frappe API client for the workshop PWA. */
const CSRF = () => window.csrf_token || "";
export const BASE = window.location.pathname.startsWith("/evhub") ? "/evhub" : "/workshop";

async function call(method, params = {}, opts = {}) {
  const url = new URL(`/api/method/${method}`, window.location.origin);
  const isGet = (opts.httpMethod || "GET").toUpperCase() === "GET" && opts.useGet !== false && method.includes(".get_");
  let res;
  if (isGet) {
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
    const msg = parseExc(data.exc) || data.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data.message;
}

function parseExc(exc) {
  try {
    const parsed = JSON.parse(exc);
    const last = Array.isArray(parsed) ? parsed[parsed.length - 1] : parsed;
    return (last || "").split("\n").filter((l) => l.includes(":")).pop()?.split(":").slice(-1)[0]?.trim();
  } catch {
    return null;
  }
}

export const workshop = {
  dashboard: () => call("ev_workshop.workshop_api.get_dashboard"),
  jobs: (p) => call("ev_workshop.workshop_api.get_jobs", p || {}),
  job: (name) => call("ev_workshop.workshop_api.get_job_detail", { name }),
  advance: (name, to_status) =>
    call("ev_workshop.workshop_api.advance_status", { name, to_status }, { httpMethod: "POST", useGet: false }),
  counters: (p) => call("ev_workshop.workshop_api.get_counter_invoices", p || {}),
  counter: (name) => call("ev_workshop.workshop_api.get_counter_invoice", { name }),
  labour: (p) => call("ev_workshop.workshop_api.get_labour_masters", p || {}),
  catalog: () => call("ev_workshop.workshop_api.get_catalog"),
  payments: (p) => call("ev_workshop.workshop_api.get_payments", p || {}),
  customers: (p) => call("ev_workshop.workshop_api.get_customers", p || {}),
  customer: (customer) => call("ev_workshop.workshop_api.get_customer_profile", { customer }),
  statement: (customer, from_date, to_date) =>
    call("ev_workshop.workshop_api.get_customer_statement", { customer, from_date, to_date }),
  analytics: () => call("ev_workshop.workshop_api.get_analytics"),
  quoteUrl: (docname) => call("ev_workshop.api.send_quote_whatsapp", { docname }, { httpMethod: "POST", useGet: false }),
  readyUrl: (docname) => call("ev_workshop.api.send_ready_notification", { docname }, { httpMethod: "POST", useGet: false }),
};

export async function login(usr, pwd) {
  const res = await fetch("/api/method/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ usr, pwd }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.exc) throw new Error("Invalid username or password.");
  // Reload so the www shell re-renders with a fresh CSRF token.
  window.location.href = BASE;
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
  window.location.href = `${BASE}/login`;
}
