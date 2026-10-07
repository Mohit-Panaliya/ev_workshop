// customers/index + show + create parity.
import { api } from "../api.js";
import { icon } from "../icons.js";
import { button, card, dataTable, th, td, searchBar, fieldLabel, textInput, money, fmtDate, escapeHtml, pageHeader, statusBadge, JOB_STATUS_BADGES, JOB_STATUS_ICONS } from "../ui.js";
import { bindBulkDelete, importButton, bindImport } from "../list.js";

export async function CustomersView() {
  const header = `<div class="flex justify-between items-center">
    <h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("users", "w-6 h-6 text-primary")}Customers</h2>
    <div class="flex items-center gap-2">
      ${button(`${icon("arrow-up-tray", "w-4 h-4")}Export`, { variant: "secondary", attrs: `data-action="export"` })}
      ${button(`${icon("plus", "w-4 h-4")}Add Customer`, { variant: "primary", href: "#/customers/new" })}
    </div></div>`;
  const content = `<div class="py-6"><div class="max-w-full sm:px-6 lg:px-8 space-y-4">
    <form id="c-filter" class="flex gap-3"><div class="flex-1">${searchBar("search", "", "Search by name or mobile...")}</div>
    ${button(`${icon("magnifying-glass", "w-4 h-4")}Search`, { type: "submit" })}</form>
    <div class="flex justify-end gap-2 items-center">
      ${importButton("customers", "customer_name,mobile_no,email_id,city")}
      ${button("Delete selected", { variant: "danger", attrs: `data-action="bulk-delete" data-doctype="Customer"` })}
    </div>
    <div id="c-table"></div>
  </div></div>`;
  return { header, content };
}

CustomersView.mounted = async (view) => {
  const table = view.querySelector("#c-table");
  const form = view.querySelector("#c-filter");
  async function load() {
    const fd = new FormData(form);
    let rows = [];
    try {
      rows = await api.customers({ search: fd.get("search") || undefined });
    } catch (e) {
      table.innerHTML = `<p class="text-sm text-red-600">${e.message}</p>`;
      return;
    }
    const html = rows.map((c) => `<tr class="group hover:bg-muted/50">
      ${td(`<input type="checkbox" data-name="${escapeHtml(c.name)}" class="rounded border-gray-300 text-primary">`, "w-10")}
      ${td(`<a class="text-primary hover:text-primary-700 font-medium" href="#/customers/${encodeURIComponent(c.name)}">${escapeHtml(c.customer_name)}</a>`)}
      ${td(escapeHtml(c.mobile_no || "-"))}
      ${td(escapeHtml(c.city || "-"))}
    </tr>`).join("");
    table.innerHTML = dataTable(`${th("")}${th("Display Name")}${th("Mobile")}${th("City")}`, html, "users", "No customers found.");
    bindBulkDelete(view, table);
    bindImport(view, () => form.dispatchEvent(new Event("submit")));
  }
  form.addEventListener("submit", (e) => { e.preventDefault(); load(); });
  view.querySelector('[data-action="export"]').addEventListener("click", () => {
    window.open(`/api/method/ev_workshop.workshop_api.export_csv?entity=customers`, "_blank");
  });
  await load();
};

export async function CustomerDetailView(name) {
  if (name === "new") return CustomerCreateView();
  let d;
  try {
    d = await api.customer(name);
  } catch (e) {
    return { header: pageHeader("users", "Customer"), content: `<p class="text-sm text-red-600">${e.message}</p>` };
  }
  const p = d.profile;
  const agg = d.aggregates;
  const initials = (p.customer_name || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  const header = `<div class="flex flex-wrap justify-between items-center gap-3">
    <div class="flex items-center gap-3">
      <span class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">${icon("user", "w-5 h-5 text-primary")}</span>
      <div><h2 class="font-semibold text-xl text-gray-800 leading-tight">${escapeHtml(p.customer_name)}</h2>
      <p class="text-sm text-gray-600">${initials} · ${escapeHtml(p.mobile_no || "")} · ${escapeHtml(p.city || "")}</p></div>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      ${button("Statement", { variant: "secondary", attrs: `data-action="statement"` })}
      ${button("Back", { variant: "ghost", href: "#/customers" })}
    </div></div>`;
  const content = `<div class="py-6"><div class="max-w-full sm:px-6 lg:px-8 space-y-6">
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
      ${card(`<div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Billed</div><div class="mt-1 text-lg font-semibold">${money(agg.billed)}</div>`, "!p-5")}
      ${card(`<div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Paid</div><div class="mt-1 text-lg font-semibold text-green-600">${money(agg.paid)}</div>`, "!p-5")}
      ${card(`<div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Outstanding</div><div class="mt-1 text-lg font-semibold ${agg.outstanding > 0 ? "text-red-600" : ""}">${money(agg.outstanding)}</div>`, "!p-5")}
      ${card(`<div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vehicles</div><div class="mt-1 text-lg font-semibold">${d.vehicles.length}</div>`, "!p-5")}
      ${card(`<div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Jobs</div><div class="mt-1 text-lg font-semibold">${d.jobs.length}</div>`, "!p-5")}
    </div>
    <div class="flex gap-1 border-b border-border mb-4" id="c-tabs">
      ${["vehicles", "job_cards", "financial"].map((t, i) => `<button data-tab="${t}" class="px-4 py-2 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px ${i === 0 ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}">${t.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</button>`).join("")}
    </div>
    <div id="c-tab-vehicles">${card(`
      <table class="min-w-full divide-y divide-border"><thead><tr>
      <th class="text-left text-xs text-muted-foreground uppercase py-2">Registration</th>
      <th class="text-left text-xs text-muted-foreground uppercase py-2">Model</th>
      <th class="text-left text-xs text-muted-foreground uppercase py-2">Owner</th>
      </tr></thead><tbody>
      ${d.vehicles.map((v) => `<tr class="border-t"><td class="py-2 text-sm">${escapeHtml(v.registration_no || "-")}</td><td class="py-2 text-sm">${escapeHtml(v.model || "-")}</td><td class="py-2 text-sm">${v.is_primary ? "Primary" : "Co-owner"}</td></tr>`).join("") || `<tr><td colspan="3" class="py-2 text-sm text-gray-500">No vehicles.</td></tr>`}
      </tbody></table>`)}</div>
    <div id="c-tab-job_cards" class="hidden">${card(`
      <table class="min-w-full divide-y divide-border"><thead><tr>
      <th class="text-left text-xs text-muted-foreground uppercase py-2">Job Card</th>
      <th class="text-left text-xs text-muted-foreground uppercase py-2">Date</th>
      <th class="text-left text-xs text-muted-foreground uppercase py-2">Status</th>
      <th class="text-right text-xs text-muted-foreground uppercase py-2">Total</th>
      </tr></thead><tbody>
      ${d.jobs.map((j) => `<tr class="border-t"><td class="py-2 text-sm"><a class="text-primary hover:underline" href="#/jobs/${encodeURIComponent(j.name)}">${j.name}</a></td><td class="py-2 text-sm">${fmtDate(j.date)}</td><td class="py-2">${statusBadge(JOB_STATUS_BADGES, j.status, JOB_STATUS_ICONS)}</td><td class="py-2 text-sm text-right">${money(j.grand_total)}</td></tr>`).join("") || `<tr><td colspan="4" class="py-2 text-sm text-gray-500">No jobs.</td></tr>`}
      </tbody></table>`)}</div>
    <div id="c-tab-financial" class="hidden">${card(`
      <table class="min-w-full divide-y divide-border"><thead><tr>
      <th class="text-left text-xs text-muted-foreground uppercase py-2">Invoice</th>
      <th class="text-left text-xs text-muted-foreground uppercase py-2">Date</th>
      <th class="text-right text-xs text-muted-foreground uppercase py-2">Billed</th>
      <th class="text-right text-xs text-muted-foreground uppercase py-2">Due</th>
      </tr></thead><tbody>
      ${d.invoices.map((i) => `<tr class="border-t"><td class="py-2 text-sm">${i.name}</td><td class="py-2 text-sm">${fmtDate(i.posting_date)}</td><td class="py-2 text-sm text-right">${money(i.grand_total)}</td><td class="py-2 text-sm text-right ${i.outstanding_amount > 0 ? "text-red-600" : ""}">${money(i.outstanding_amount)}</td></tr>`).join("") || `<tr><td colspan="4" class="py-2 text-sm text-gray-500">No invoices.</td></tr>`}
      </tbody></table>`)}
      <div id="c-statement" class="mt-4"></div>
    </div>
  </div></div>`;
  return { header, content };
}

CustomerDetailView.mounted = async (view, m) => {
  const name = decodeURIComponent(m[1]);
  if (name === "new") {
    view.querySelector("#customer-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const r = await api.createCustomer(Object.fromEntries(fd.entries()));
        window.location.hash = `#/customers/${encodeURIComponent(r.customer)}`;
      } catch (ex) { alert(ex.message); }
    });
    return;
  }
  view.querySelectorAll("#c-tabs button").forEach((b) => b.addEventListener("click", () => {
    view.querySelectorAll("#c-tabs button").forEach((x) => {
      x.className = "px-4 py-2 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px border-transparent text-gray-500 hover:text-gray-700";
    });
    b.className = "px-4 py-2 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px border-primary text-primary";
    ["vehicles", "job_cards", "financial"].forEach((t) => {
      view.querySelector(`#c-tab-${t}`).classList.toggle("hidden", t !== b.dataset.tab);
    });
  }));
  view.querySelector('[data-action="statement"]').addEventListener("click", async () => {
    const box = view.querySelector("#c-statement");
    try {
      const rows = await api.statement(name);
      box.innerHTML = `<h4 class="font-medium text-gray-900 mb-2">Statement (${rows.length} invoices)</h4>
        <table class="min-w-full text-sm"><tbody>
        ${rows.map((r) => `<tr class="border-t"><td class="py-2">${r.name}</td><td class="py-2">${fmtDate(r.posting_date)}</td><td class="py-2 text-right">${money(r.grand_total)}</td><td class="py-2 text-right">${money(r.outstanding_amount)}</td></tr>`).join("")}
        </tbody></table>`;
    } catch (e) { box.innerHTML = `<p class="text-sm text-red-600">${e.message}</p>`; }
  });
};

async function CustomerCreateView() {
  const header = `<h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("users", "w-6 h-6 text-primary")}Add Customer</h2>`;
  const content = `<div class="py-6"><div class="max-w-3xl mx-auto sm:px-6 lg:px-8">${card(`
    <form id="customer-form" class="grid grid-cols-2 gap-4">
      <div>${fieldLabel("Customer Name")}${textInput("customer_name", "", "text", "required")}</div>
      <div>${fieldLabel("Mobile")}${textInput("mobile_no")}</div>
      <div>${fieldLabel("Email")}${textInput("email", "", "email")}</div>
      <div>${fieldLabel("City")}${textInput("city")}</div>
      <div>${fieldLabel("Vehicle Registration")}${textInput("registration_no")}</div>
      <div>${fieldLabel("Model")}${textInput("model")}</div>
      <div class="col-span-2 flex justify-end">${button("Create Customer", { variant: "primary", type: "submit" })}</div>
    </form>`)}</div></div>`;
  return { header, content };
}
