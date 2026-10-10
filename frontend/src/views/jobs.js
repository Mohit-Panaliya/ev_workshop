// job_cards parity: index (filters/sort/select/export/import), create,
// edit, assign (billing screen), show.
import { api } from "../api.js";
import { icon } from "../icons.js";
import { badge, button, card, dataTable, th, td, searchBarExact, filterLabel, filterInput, filterSelect, fieldLabel, textInput, money, fmtDate, escapeHtml, statusBadge, JOB_STATUS_BADGES, JOB_STATUS_ICONS } from "../ui.js";
import { toast, flashBulkResult, rowActions, combobox, openModal, closeModal, activeFiltersBar } from "../components.js";

const PAY_BADGES = { paid: "green", partially_paid: "amber", unbilled: "gray", default: "red" };
const STATUSES = ["Admitted", "Inspection", "Quoted", "Approved", "Repairing", "Ready", "Completed", "Cancelled"];

function payStatus(j) {
  if (j.pay_status) return j.pay_status;
  const billed = Number(j.amount_billed ?? j.grand_total ?? 0);
  if (!billed) return "unbilled";
  const due = Number(j.outstanding ?? (billed - Number(j.amount_paid || 0)));
  if (due <= 0) return "paid";
  if (due < billed) return "partially_paid";
  return "unpaid";
}

function payLabel(s) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function JobsView() {
  let techs = [];
  try {
    techs = (await api.jobOptions()).technicians || [];
  } catch { /* filter still renders */ }
  const header = `<div class="flex flex-wrap gap-2 justify-between items-center">
    <h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("wrench-screwdriver", "w-6 h-6 text-primary")}Job Cards</h2>
    <div class="flex items-center gap-2">
      <button type="button" data-action="import-jobs" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md h-10 px-4 py-2 text-sm font-medium shadow-sm transition-colors border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-sm">${icon("arrow-up-tray", "w-4 h-4")}Import CSV</button>
      <div class="relative" data-dropdown-root="export">
        <div><button type="button" data-dropdown="export" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md h-10 px-4 py-2 text-sm font-medium shadow-sm transition-colors border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-sm">${icon("arrow-down-tray", "w-4 h-4")}Export ${icon("chevron-down", "w-4 h-4")}</button></div>
        <div data-dropdown-menu="export" style="display:none;" class="absolute z-50 mt-2 64 rounded-md shadow-lg ltr:origin-top-left rtl:origin-top-right start-0">
          <div class="rounded-md ring-1 ring-black ring-opacity-5 py-1 bg-card">
            <a href="#" data-export="all" class="block w-full px-4 py-2 text-start text-sm leading-5 text-gray-700 hover:bg-accent hover:text-accent-foreground">Export All (CSV)</a>
            <a href="#" data-export="filtered" class="block w-full px-4 py-2 text-start text-sm leading-5 text-gray-700 hover:bg-accent hover:text-accent-foreground">Export Filtered Results (CSV)</a>
            <a href="#" data-export="template" class="block w-full px-4 py-2 text-start text-sm leading-5 text-gray-700 hover:bg-accent hover:text-accent-foreground">Download Import Template (CSV)</a>
          </div>
        </div>
      </div>
    </div></div>`;
  const content = `<div class="py-6"><div class="max-w-full sm:px-6 lg:px-8 space-y-4">
    <form id="jobs-filter" method="GET" class="mb-6"><div class="space-y-4">
      <div class="flex gap-3"><div class="flex-1">${searchBarExact("search", "", "Search by job card no, customer name, or vehicle registration...")}</div>
      ${button(`${icon("magnifying-glass", "w-4 h-4")}Search`, { type: "submit" })}</div>
      <div class="bg-white rounded-lg border border-gray-200 p-4"><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>${filterLabel("From Date", "from_date")}${filterInput("from_date", "", "date")}</div>
        <div>${filterLabel("To Date", "to_date")}${filterInput("to_date", "", "date")}</div>
        <div>${filterLabel("Technician", "technician")}${filterSelect("technician", `<option value="">All Technicians</option>${techs.map((t) => `<option value="${t.name}">${escapeHtml(t.employee_name)}</option>`).join("")}`)}</div>
        <div>${filterLabel("Status", "status")}${filterSelect("status", `<option value="">All Statuses</option>${STATUSES.map((s) => `<option>${s}</option>`).join("")}`)}</div>
        <div>${filterLabel("Payment Status", "payment_status")}${filterSelect("payment_status", `<option value="all">All</option><option value="paid">Paid</option><option value="partially_paid">Partially Paid</option><option value="unbilled">Unbilled</option><option value="unpaid">Unpaid</option>`)}</div>
        <div>${filterLabel("Job Type", "service_type")}${filterSelect("service_type", `<option value="">All Types</option><option>Free</option><option>Paid</option>`)}</div>
        <div>${filterLabel("Items Per Page", "per_page")}${filterSelect("per_page", `<option value="15" selected>15</option><option value="25">25</option><option value="50">50</option><option value="100">100</option>`)}</div>
        <div>${filterLabel("Filter Options", "exclude_delivered")}<label class="flex items-center gap-2 h-10 px-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 cursor-pointer"><input type="checkbox" name="exclude_delivered" value="1" class="rounded border-gray-300 text-primary focus:ring-primary"><span class="text-sm text-gray-700">Hide Delivered Jobs</span></label></div>
      </div></div>
    </div></form>
    <div id="jobs-active"></div>
    <div id="jobs-selection"></div>
    <div id="jobs-table"></div>
  </div></div>`;
  return { header, content };
}

JobsView.mounted = async (view) => {
  flashBulkResult();
  const table = view.querySelector("#jobs-table");
  const form = view.querySelector("#jobs-filter");
  const activeBox = view.querySelector("#jobs-active");
  let page = 1;
  let sort = null, direction = "desc";
  const pager = document.createElement("div");
  table.after(pager);

  function sortTh(label, column, current) {
    const active = current.column === column;
    const arrow = active ? (current.direction === "asc" ? " ▲" : " ▼") : "";
    return `<th class="align-middle px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"><a href="#" data-sort="${column}" class="hover:text-gray-900">${label}${arrow}</a></th>`;
  }

  async function load() {
    const fd = new FormData(form);
    const f = Object.fromEntries([...fd.entries()].filter(([, v]) => v !== "" && v != null));
    if (f.payment_status === "all") delete f.payment_status;
    const params = {
      search: f.search || undefined, status: f.status || undefined, technician: f.technician || undefined,
      payment_status: f.payment_status || undefined, service_type: f.service_type || undefined,
      per_page: Number(f.per_page) || 15, page, from_date: f.from_date || undefined, to_date: f.to_date || undefined,
      exclude_delivered: fd.get("exclude_delivered") ? 1 : undefined,
      sort: sort?.column, direction: sort?.direction,
    };
    activeBox.innerHTML = activeFiltersBar({ search: f.search, status: f.status, technician: f.technician, payment_status: f.payment_status, service_type: f.service_type, from_date: f.from_date, to_date: f.to_date }, "#/jobs");
    let jobs = [], meta = { page: 1, pages: 1, total: 0 };
    try {
      const r = await api.jobs(params);
      jobs = r.jobs;
      meta = { page: r.page || 1, pages: r.pages || 1, total: r.total || 0 };
    } catch (e) {
      table.innerHTML = `<p class="text-sm text-red-600">${e.message}</p>`;
      return;
    }
    const rows = jobs.map((j) => {
      const ps = payStatus(j);
      return `<tr class="group hover:bg-muted/50">
        ${td(`<input type="checkbox" data-row-id data-name="${escapeHtml(j.name)}" class="rounded border-gray-300 text-primary">`, "w-10")}
        ${td(`<a class="text-primary hover:text-primary-700 transition-colors duration-150" href="#/jobs/${encodeURIComponent(j.name)}">${j.name}</a>`)}
        ${td(fmtDate(j.date))}
        ${td(`<span class="max-w-[180px] truncate block">${escapeHtml(j.customer_name || "-")}</span>`)}
        ${td(escapeHtml(j.vehicle || "-"))}
        ${td(statusBadge(JOB_STATUS_BADGES, j.status, JOB_STATUS_ICONS))}
        ${td(money(j.grand_total), "text-right font-medium text-gray-900")}
        ${td(statusBadge(PAY_BADGES, ps))}
        ${td(`<span class="inline-flex items-center gap-3">
          <a href="#/jobs/${encodeURIComponent(j.name)}" title="View" class="text-primary hover:text-primary-700">${icon("eye", "w-5 h-5")}</a>
          <a href="#/jobs/${encodeURIComponent(j.name)}/edit" title="Edit" class="text-primary hover:text-primary-700">${icon("pencil-square", "w-5 h-5")}</a>
          <button type="button" data-del="${escapeHtml(j.name)}" title="Delete" class="text-red-600 hover:text-red-800">${icon("trash", "w-5 h-5")}</button>
        </span>`, "text-right")}
      </tr>`;
    }).join("");
    const cur = { column: sort?.column, direction: sort?.direction };
    table.innerHTML = dataTable(
      `${th("")}${sortTh("Job No.", "name", cur)}${sortTh("Date", "date", cur)}${th("Customer")}${th("Vehicle")}${th("Status")}${sortTh("Grand Total", "grand_total", cur)}${th("Payment")}${th("Actions", "text-right")}`,
      rows, "wrench-screwdriver", "No job cards found."
    );
    table.querySelectorAll("[data-sort]").forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      const col = a.dataset.sort;
      if (sort?.column === col) sort.direction = sort.direction === "asc" ? "desc" : "asc";
      else sort = { column: col, direction: "asc" };
      load();
    }));
    table.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm(`Delete job ${b.dataset.del}? Parts stock will be returned.`)) return;
      try {
        const r = await api.bulkDelete("Job Master", [b.dataset.del]);
        sessionStorage.setItem("gms.bulkResult", JSON.stringify({ message: r.message, skipped_count: r.skipped.length }));
        window.location.reload();
      } catch (e) { alert(e.message); }
    }));
    table.querySelectorAll("input[type=checkbox][data-name]").forEach((c) => c.addEventListener("change", renderSelection));
    // select-all header checkbox
    const headCell = table.querySelector("thead th");
    if (headCell && !headCell.querySelector("input")) {
      headCell.innerHTML = `<input type="checkbox" data-select-all class="rounded border-gray-300 text-primary">`;
      headCell.querySelector("[data-select-all]").addEventListener("change", (e) => {
        table.querySelectorAll("tbody input[type=checkbox][data-name]").forEach((c) => { c.checked = e.target.checked; });
        renderSelection();
      });
    }
    renderSelection();
    pager.innerHTML = `<div class="border-t border-border px-6 py-3 flex items-center justify-between text-sm text-gray-600">
      <span>Total ${meta.total} record(s)</span>
      <span class="flex items-center gap-1">
        ${Array.from({ length: Math.min(meta.pages, 11) }, (_, i) => {
          const p = i + 1;
          return `<button data-page="${p}" class="min-w-8 h-8 px-2 rounded-md ${p === meta.page ? "bg-primary text-white font-semibold" : "hover:bg-accent"}">${p}</button>`;
        }).join("")}
        ${meta.pages > 11 ? `<span>… ${meta.pages}</span>` : ""}
      </span>
    </div>`;
    pager.querySelectorAll("[data-page]").forEach((b) => b.addEventListener("click", () => {
      page = Number(b.dataset.page);
      load();
    }));
  }

  function selectedNames() {
    return [...table.querySelectorAll("tbody input[type=checkbox][data-name]:checked")].map((c) => c.dataset.name);
  }
  function renderSelection() {
    const box = view.querySelector("#jobs-selection");
    const names = selectedNames();
    if (!names.length) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = `<div class="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 shadow-sm">
      <span class="mr-auto text-sm font-medium text-primary-800"><span class="font-semibold">${names.length}</span> selected</span>
      ${names.length === 1 ? `<span class="text-sm font-medium text-primary-800">Selected: <span class="font-semibold">${escapeHtml(names[0])}</span></span>
      <a href="#/jobs/${encodeURIComponent(names[0])}/assign" class="inline-flex items-center justify-center gap-2 rounded-md h-10 px-4 py-2 text-sm font-medium shadow-sm bg-primary text-primary-foreground hover:bg-primary/90">Assign / Add Items</a>` : ""}
      <button data-sel-export class="inline-flex items-center justify-center gap-2 rounded-md h-10 px-4 py-2 text-sm font-medium shadow-sm border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Export selected</button>
      <button data-sel-delete class="inline-flex items-center justify-center gap-2 rounded-md h-10 px-4 py-2 text-sm font-medium shadow-sm bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete selected</button>
    </div>`;
    box.querySelector("[data-sel-delete]").addEventListener("click", async () => {
      if (!confirm(`Delete ${names.length} job card(s)? Parts stock will be returned.`)) return;
      try {
        const r = await api.bulkDelete("Job Master", names);
        sessionStorage.setItem("gms.bulkResult", JSON.stringify({ message: r.message, skipped_count: r.skipped.length }));
        window.location.reload();
      } catch (e) { alert(e.message); }
    });
    box.querySelector("[data-sel-export]").addEventListener("click", () => {
      window.open(`/api/method/ev_workshop.workshop_api.export_selected?entity=jobs&names=${encodeURIComponent(JSON.stringify(names))}`, "_blank");
    });
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); page = 1; load(); });
  view.querySelectorAll("[data-export]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    const kind = a.dataset.export;
    if (kind === "all") window.open(`/api/method/ev_workshop.workshop_api.export_csv?entity=jobs`, "_blank");
    else if (kind === "template") window.open(`/api/method/ev_workshop.workshop_api.template_csv?entity=jobs`, "_blank");
    else {
      const fd = new FormData(form);
      const q = new URLSearchParams();
      ["search", "status", "technician", "service_type", "from_date", "to_date"].forEach((k) => {
        const v = fd.get(k);
        if (v) q.append(k, v);
      });
      window.open(`/api/method/ev_workshop.workshop_api.export_csv?entity=jobs&${q.toString()}`, "_blank");
    }
  }));
  const impBtn = view.querySelector('[data-action="import-jobs"]');
  if (impBtn) impBtn.addEventListener("click", () => {
    openModal("Import Job Cards", `<p class="text-sm text-gray-600 mb-4">Job imports run from Desk (Data Import Tool). Use the customers/parts import below for master data.</p>`);
  });
  await load();
}

export async function JobDetailView(name) {
  const [docname, query] = String(name).split("?");
  const preset = Object.fromEntries(new URLSearchParams(query || "").entries());
  if (docname === "new") return JobCreateView(preset);
  let data;
  try {
    data = await api.job(docname);
  } catch (e) {
    return { header: pageHeader("wrench-screwdriver", "Job Card"), content: `<div class="py-6"><div class="max-w-5xl mx-auto sm:px-6 lg:px-8"><p class="text-sm text-red-600">${e.message}</p></div></div>` };
  }
  const j = data.job;
  const allowed = data.allowed_next || [];
  const invoices = data.invoices || [];
  const header = `<div class="flex flex-wrap justify-between items-center gap-3">
    <h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("wrench-screwdriver", "w-6 h-6 text-primary")}Job Card ${escapeHtml(j.name)}</h2>
    <div class="flex flex-wrap items-center gap-3" id="job-actions"></div>
  </div>`;

  const partsRows = (j.items || []).map((p) => `<tr class="border-t hover:bg-muted/50">
      <td class="align-middle px-4 py-2 text-sm">${escapeHtml(p.item_name || p.item_no)}</td>
      <td class="align-middle px-4 py-2 text-sm text-center">${p.qty}</td>
      <td class="align-middle px-4 py-2 text-sm text-right">${money(p.rate)}</td>
      <td class="align-middle px-4 py-2 text-sm text-right">${money(p.total_amount)}</td>
    </tr>`).join("");
  const labourRows = (j.job_labours || []).map((l) => `<tr class="border-t hover:bg-muted/50">
      <td class="align-middle px-4 py-2 text-sm">${escapeHtml(l.labour_master)}</td>
      <td class="align-middle px-4 py-2 text-sm text-center">${l.qty}</td>
      <td class="align-middle px-4 py-2 text-sm text-right">${money(l.rate)}</td>
      <td class="align-middle px-4 py-2 text-sm text-right font-medium">${money(l.line_total)}</td>
    </tr>`).join("");

  const paid = invoices.reduce((s, i) => s + Number(i.grand_total - i.outstanding_amount), 0);
  const billed = invoices.reduce((s, i) => s + Number(i.grand_total), 0);
  const due = Math.max(billed - paid, 0);
  const payRows = invoices.map((i) => `<tr class="border-t hover:bg-muted/50">
      <td class="align-middle px-4 py-2 text-sm">${fmtDate(i.posting_date)}</td>
      <td class="align-middle px-4 py-2 text-sm">${i.name}</td>
      <td class="align-middle px-4 py-2 text-sm text-right font-medium">${money(i.grand_total)}</td>
      <td class="align-middle px-4 py-2 text-sm text-right">${money(i.outstanding_amount)}</td>
    </tr>`).join("");

  const content = `<div class="py-6"><div class="max-w-5xl mx-auto sm:px-6 lg:px-8 space-y-6">
    <div id="job-flash"></div>
    ${card(`<details>
      <summary class="cursor-pointer font-semibold text-gray-900">Add Parts / Labour</summary>
      <form id="add-form" class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 items-end">
        <div>${fieldLabel("Item code (blank for labour)")}${textInput("item_no")}</div>
        <div>${fieldLabel("Labour (blank for part)")}${textInput("labour_master")}</div>
        <div>${fieldLabel("Qty")}${textInput("qty", "1", "number")}</div>
        <div>${fieldLabel("Rate")}${textInput("rate", "0", "number")}</div>
        <div class="col-span-4 flex justify-end">${button("Add to Job", { variant: "secondary", type: "submit" })}</div>
      </form>
      <p class="text-xs text-gray-500 mt-1">Use the Item Master code (e.g. 002) or Labour Master name (e.g. LAB-0001).</p>
    </details>`)}
    ${card(`<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div><h3 class="font-semibold text-gray-900 mb-3">Job Details</h3><dl class="space-y-2 text-sm">
        <div><dt class="inline font-medium">No: </dt><dd class="inline">${escapeHtml(j.name)}</dd></div>
        <div><dt class="inline font-medium">Date: </dt><dd class="inline">${fmtDate(j.date)}</dd></div>
        <div><dt class="inline font-medium">Type: </dt><dd class="inline">${escapeHtml(j.service_type || "")}</dd></div>
        <div><dt class="inline font-medium">Status: </dt><dd class="inline">${statusBadge(JOB_STATUS_BADGES, j.status, JOB_STATUS_ICONS)}</dd></div>
      </dl></div>
      <div><h3 class="font-semibold text-gray-900 mb-3">Customer &amp; Vehicle</h3><dl class="space-y-2 text-sm">
        <div><dt class="inline font-medium">Customer: </dt><dd class="inline">${escapeHtml(j.customer_name || "-")}</dd></div>
        <div><dt class="inline font-medium">Mobile: </dt><dd class="inline">${escapeHtml(j.mobile_no || "-")}</dd></div>
        <div><dt class="inline font-medium">Vehicle: </dt><dd class="inline">${escapeHtml(j.vehicle || "-")}</dd></div>
      </dl></div>
      <div><h3 class="font-semibold text-gray-900 mb-3">Totals</h3><dl class="space-y-2 text-sm">
        <div><dt class="inline font-medium">Billed: </dt><dd class="inline">${money(billed)}</dd></div>
        <div><dt class="inline font-medium">Paid: </dt><dd class="inline">${money(paid)}</dd></div>
        <div><dt class="inline font-medium">Due: </dt><dd class="inline">${money(due)}</dd></div>
      </dl></div>
    </div>`)}
    ${j.complaints ? card(`<h3 class="font-semibold text-gray-900 mb-2">Complaints</h3><p class="mb-2 text-sm">${escapeHtml(j.complaints)}</p>`) : ""}
    ${card(`<h3 class="font-semibold text-gray-900 mb-3">Parts Used</h3>
      <table class="min-w-full text-xs"><thead class="bg-muted/50"><tr>
      <th class="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Part</th>
      <th class="px-4 py-2 text-center text-xs font-medium text-muted-foreground uppercase">Qty</th>
      <th class="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">MRP</th>
      <th class="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Line Total</th>
      </tr></thead><tbody>${partsRows || `<tr><td colspan="4" class="px-4 py-3 text-sm text-gray-500">No parts yet.</td></tr>`}</tbody></table>`)}
    ${(j.job_labours || []).length ? card(`<h3 class="font-semibold text-gray-900 mb-3">Labour</h3>
      <table class="min-w-full text-xs"><thead class="bg-muted/50"><tr>
      <th class="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Service</th>
      <th class="px-4 py-2 text-center text-xs font-medium text-muted-foreground uppercase">Qty</th>
      <th class="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Rate</th>
      <th class="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Line Total</th>
      </tr></thead><tbody>${labourRows}</tbody></table>`) : ""}
    ${card(`<h3 class="font-semibold text-gray-900 mb-4">Payments</h3>
      <div class="mb-6 p-4 bg-muted rounded-lg"><div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div class="flex flex-wrap items-baseline gap-2"><span class="text-gray-600">Billed</span><span class="font-semibold text-lg">${money(billed)}</span></div>
        <div class="flex flex-wrap items-baseline gap-2"><span class="text-gray-600">Paid</span><span class="font-semibold text-lg text-green-600">${money(paid)}</span></div>
        <div class="flex flex-wrap items-baseline gap-2"><span class="text-gray-600">Due</span><span class="font-semibold text-lg ${due > 0 ? "text-red-600" : "text-gray-600"}">${money(due)}</span></div>
      </div></div>
      ${payRows ? `<table class="min-w-full text-xs"><thead class="bg-muted/50"><tr>
        <th class="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
        <th class="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Invoice</th>
        <th class="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Billed</th>
        <th class="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Due</th>
      </tr></thead><tbody>${payRows}</tbody></table>` : `<p class="text-sm text-gray-500">No invoices yet.</p>`}
      ${invoices.length && due > 0 ? `<div class="border-t pt-6 mt-4"><h4 class="font-medium text-gray-900 mb-3">Record Payment</h4>
        <form id="pay-form" class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>${fieldLabel("Amount")}${textInput("amount", due.toFixed(2), "number")}</div>
          <div>${fieldLabel("Mode")}<select name="mode_of_payment" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm transition-colors focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shadow-sm"><option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Cheque</option></select></div>
          <div>${fieldLabel("Date")}${textInput("payment_date", new Date().toISOString().slice(0, 10), "date")}</div>
          <div>${fieldLabel("Reference")}${textInput("reference_no", "")}</div>
        </form>
        <div class="flex justify-end mt-3">${button("Record Payment", { variant: "success", attrs: `data-pay-invoice="${invoices[0].name}"` })}</div>
      </div>` : ""}
    `)}
  </div></div>`;
  return { header, content, job: j, allowed, invoices };
}

JobDetailView.mounted = async (view, m) => {
  const [raw] = String(decodeURIComponent(m[1])).split("?");
  const name = raw;
  if (name === "new") {
    bindJobCreate(view);
    return;
  }
  const actions = view.parentElement?.parentElement?.querySelector("#job-actions") || document.querySelector("#job-actions");
  actions.innerHTML = button("Edit Job", { variant: "secondary", attrs: `data-edit-job=""` }) + actions.innerHTML;
  actions.querySelector("[data-edit-job]").addEventListener("click", async () => {
    const f = document.createElement("div");
    f.innerHTML = card(`<form id="job-edit" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>${fieldLabel("Service Type")}<select name="service_type" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm transition-colors focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shadow-sm"><option>Free</option><option>Paid</option></select></div>
      <div>${fieldLabel("KM Reading")}${textInput("km_reading", data.job.km_reading || 0, "number")}</div>
      <div>${fieldLabel("Supervisor (Employee ID)")}${textInput("supervisor", data.job.supervisor || "")}</div>
      <div>${fieldLabel("Mechanic (Employee ID)")}${textInput("mechanic", data.job.mechanic || "")}</div>
      <div class="col-span-2">${fieldLabel("Complaints")}<textarea name="complaints" rows="2" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm transition-colors focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shadow-sm">${escapeHtml(data.job.complaints || "")}</textarea></div>
      <div class="col-span-2 flex justify-end">${button("Save", { variant: "primary", type: "submit" })}</div>
    </form>`);
    view.querySelector("#job-flash").appendChild(f);
    f.querySelector("#job-edit").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await api.updateJob(name, Object.fromEntries(new FormData(e.target).entries()));
        window.location.reload();
      } catch (ex) { alert(ex.message); }
    });
  });
  let data;
  try {
    data = await api.job(name);
  } catch { return; }
  const allowed = data.allowed_next || [];
  actions.innerHTML = allowed.map((s) => button(`Move to ${s.replace(/_/g, " ")}`, { variant: "primary", attrs: `data-advance="${s}"` })).join("")
    + button(`${icon("chat-bubble-left-ellipsis", "w-4 h-4")}WhatsApp`, { variant: "success", attrs: `data-wa="quote"` })
    + button(`Estimate`, { variant: "secondary", attrs: `data-print="EV Job Estimate" data-doctype="Job Master"` })
    + button(`Invoice`, { variant: "secondary", attrs: `data-print-invoice=""` });
  actions.querySelectorAll("[data-advance]").forEach((b) => b.addEventListener("click", async () => {
    b.disabled = true;
    try {
      await api.advance(name, b.dataset.advance);
      window.location.reload();
    } catch (e) {
      alert(e.message);
      b.disabled = false;
    }
  }));
  actions.querySelector('[data-wa]').addEventListener("click", async () => {
    try {
      const r = await api.quoteUrl(name);
      window.open(r.url, "_blank");
    } catch (e) { alert(e.message); }
  });
  actions.querySelector('[data-print]').addEventListener("click", () => {
    window.open(`/printview?doctype=Job%20Master&name=${encodeURIComponent(name)}&format=EV%20Job%20Estimate`, "_blank");
  });
  actions.querySelector('[data-print-invoice]').addEventListener("click", async () => {
    try {
      const r = await api.job(name);
      const inv = (r.invoices || [])[0];
      if (inv) window.open(`/printview?doctype=Sales%20Invoice&name=${inv.name}&format=EV%20Job%20Invoice`, "_blank");
      else window.open(`/printview?doctype=Job%20Master&name=${encodeURIComponent(name)}&format=EV%20Job%20Estimate`, "_blank");
    } catch (e) { alert(e.message); }
  });
  const payBtn = view.querySelector("[data-pay-invoice]");
  const addForm = view.querySelector("#add-form");
  if (addForm) addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(addForm);
    const payload = { items: [], labours: [] };
    if ((fd.get("item_no") || "").trim()) {
      payload.items.push({ item_no: fd.get("item_no").trim(), qty: Number(fd.get("qty")) || 1, rate: Number(fd.get("rate")) || 0 });
    } else if ((fd.get("labour_master") || "").trim()) {
      payload.labours.push({ labour_master: fd.get("labour_master").trim(), qty: Number(fd.get("qty")) || 1, rate: Number(fd.get("rate")) || 0 });
    } else {
      alert("Enter an item code or a labour master.");
      return;
    }
    try {
      await api.updateJob(name, payload);
      window.location.reload();
    } catch (ex) { alert(ex.message); }
  });
  if (payBtn) payBtn.addEventListener("click", async () => {
    const form = view.querySelector("#pay-form");
    const fd = new FormData(form);
    payBtn.disabled = true;
    try {
      await api.recordPayment({
        sales_invoice: payBtn.dataset.payInvoice,
        amount: Number(fd.get("amount")),
        mode_of_payment: fd.get("mode_of_payment"),
        payment_date: fd.get("payment_date"),
        reference_no: fd.get("reference_no"),
      });
      window.location.reload();
    } catch (e) {
      alert(e.message);
      payBtn.disabled = false;
    }
  });
};

async function JobCreateView(preset = {}) {
  const header = `<h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("wrench-screwdriver", "w-6 h-6 text-primary")}New Job Card</h2>`;
  const today = new Date().toISOString().slice(0, 10);
  const content = `<div class="py-6"><div class="max-w-5xl mx-auto sm:px-6 lg:px-8 space-y-6">
    <div id="job-flash"></div>
    ${card(`<form id="job-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>${fieldLabel("Job Date", "jd")}${textInput("date", today, "date")}</div>
      <div>${fieldLabel("KM Reading", "km")}${textInput("km_reading", "0", "number")}</div>
      <div class="col-span-2">${fieldLabel("Customer", "cc")}<div id="jc-cust"></div></div>
      <div>${fieldLabel("Vehicle", "vv")}<select name="vehicle" id="vv" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm" required><option value="">Select customer first...</option></select></div>
      <div>${fieldLabel("Service Type", "st")}<select name="service_type" id="st" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm"><option>Paid</option><option>Free</option></select></div>
      <div>${fieldLabel("Customer Type", "ct")}<select name="customer_type" id="ct" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm"><option>Customer</option><option>Retailer</option></select></div>
      <div>${fieldLabel("Supervisor", "sup")}<select name="supervisor" id="sup" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm"><option value="">—</option></select></div>
      <div class="col-span-2">${fieldLabel("Complaints")}<div id="jc-complaints" class="space-y-2"></div>
      ${button(`${icon("plus", "w-4 h-4")}Add Complaint`, { variant: "secondary", attrs: `type="button" data-add-c=""` })}</div>
      <div class="col-span-2 flex justify-end gap-2">
        ${button("Cancel", { variant: "ghost", href: "#/jobs" })}
        ${button("Save & Continue to Assign", { variant: "primary", type: "submit" })}
      </div>
    </form>`)}
  </div></div>`;
  return { header, content };
}

async function bindJobCreate(view) {
  const form = view.querySelector("#job-form");
  if (!form) return;
  let techs = [];
  try {
    techs = (await api.jobOptions()).technicians || [];
  } catch { /* ignore */ }
  view.querySelector("#sup").innerHTML = `<option value="">—</option>` + techs.map((t) => `<option value="${t.name}">${escapeHtml(t.employee_name)}</option>`).join("");
  view.querySelector("#jc-cust").innerHTML = combobox({
    name: "customer", endpoint: "ev_workshop.workshop_api.search_customers",
    placeholder: "Search customer...",
    initialId: new URLSearchParams(window.location.hash.split("?")[1] || "").get("customer") || "",
    initialLabel: new URLSearchParams(window.location.hash.split("?")[1] || "").get("label") || "",
    required: true,
    onSelected: async (rec) => {
      await loadVehicles(rec.id);
    },
  });
  async function loadVehicles(customerId) {
    const sel = view.querySelector("#vv");
    sel.innerHTML = `<option>Loading…</option>`;
    try {
      const vs = await api.customerVehicles(customerId);
      sel.innerHTML = vs.map((v) => `<option value="${v.id}">${escapeHtml(v.label)}</option>`).join("") || `<option value="">No vehicles — add one on the customer page</option>`;
    } catch {
      sel.innerHTML = `<option value="">Failed to load</option>`;
    }
  }
  const presetId = new URLSearchParams(window.location.hash.split("?")[1] || "").get("customer");
  if (presetId) loadVehicles(presetId);
  const box = view.querySelector("#jc-complaints");
  function addComplaint(value = "") {
    const div = document.createElement("div");
    div.className = "flex gap-2";
    div.innerHTML = `<input type="text" name="complaint" value="${escapeHtml(value)}" placeholder="Describe the complaint…" required
      class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm flex-1">
      ${button("Remove", { variant: "danger", attrs: `type="button" data-rm=""` })}`;
    div.querySelector("[data-rm]").addEventListener("click", () => div.remove());
    box.appendChild(div);
  }
  view.querySelector("[data-add-c]").addEventListener("click", () => addComplaint());
  addComplaint();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const complaints = [...box.querySelectorAll('[name="complaint"]')].map((i) => i.value.trim()).filter(Boolean).join("\n");
      const r = await api.createJob({
        date: fd.get("date"), km_reading: Number(fd.get("km_reading")) || 0,
        customer: fd.get("customer"), vehicle: fd.get("vehicle"),
        customer_type: fd.get("customer_type"), service_type: fd.get("service_type"),
        supervisor: fd.get("supervisor") || undefined, complaints,
      });
      window.location.hash = `#/jobs/${encodeURIComponent(r.name)}/assign`;
    } catch (ex) {
      view.querySelector("#job-flash").innerHTML = `<p class="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-md text-sm">${ex.message}</p>`;
      btn.disabled = false;
    }
  });
}

export async function JobEditView(name) {
  const [docname] = String(name).split("?");
  let d;
  try {
    d = await api.job(docname);
  } catch (e) {
    return { header: "Edit Job Card", content: `<p class="text-sm text-red-600">${e.message}</p>` };
  }
  const j = d.job;
  const header = `<h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("wrench-screwdriver", "w-6 h-6 text-primary")}Edit Job Card ${escapeHtml(j.name)}</h2>`;
  const content = `<div class="py-6"><div class="max-w-5xl mx-auto sm:px-6 lg:px-8">${card(`
    <form id="job-edit-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>${fieldLabel("Job Date", "job_date")}${textInput("job_date", (j.date || "").slice(0, 10), "date")}</div>
      <div>${fieldLabel("Odometer (km)", "km")}${textInput("km_reading", j.km_reading || 0, "number")}</div>
      <div>${fieldLabel("Status", "status")}<select name="status" id="status" class="${"block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm"}">${["Admitted", "Inspection", "Quoted", "Approved", "Repairing", "Ready", "Completed", "Cancelled"].map((s) => `<option${s === j.status ? " selected" : ""}>${s}</option>`).join("")}</select></div>
      <div>${fieldLabel("Supervisor (Employee ID)", "sup")}${textInput("supervisor", j.supervisor || "", "text")}</div>
      <div>${fieldLabel("Mechanic (Employee ID)", "mech")}${textInput("mechanic", j.mechanic || "", "text")}</div>
      <div>${fieldLabel("Customer Type", "ctype")}<select name="customer_type" id="ctype" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm"><option${j.customer_type === "Customer" ? " selected" : ""}>Customer</option><option${j.customer_type === "Retailer" ? " selected" : ""}>Retailer</option></select></div>
      <div class="col-span-2">${fieldLabel("Complaints", "comp")}<textarea name="complaints" id="comp" rows="3" class="block w-full rounded-md border border-gray-300 bg-white shadow-sm text-sm">${escapeHtml(j.complaints || "")}</textarea></div>
      <div class="col-span-2 flex justify-end gap-2">
        ${button("Cancel", { variant: "ghost", href: `#/jobs/${encodeURIComponent(j.name)}` })}
        ${button("Update", { variant: "primary", type: "submit" })}
      </div>
    </form>`)}
  </div></div>`;
  return { header, content };
}

JobEditView.mounted = async (view, m) => {
  const [docname] = String(decodeURIComponent(m[1])).split("?");
  const form = view.querySelector("#job-edit-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.updateJob(docname, Object.fromEntries(new FormData(form).entries()));
      window.location.hash = `#/jobs/${encodeURIComponent(docname)}`;
    } catch (ex) { alert(ex.message); }
  });
};

export async function JobAssignView(name) {
  const [docname] = String(name).split("?");
  let d, opts;
  try {
    d = await api.job(docname);
    opts = await api.jobOptions();
  } catch (e) {
    return { header: "Assign & Bill", content: `<p class="text-sm text-red-600">${e.message}</p>` };
  }
  const j = d.job;
  const header = `<h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("wrench-screwdriver", "w-6 h-6 text-primary")}Assign &amp; Bill ${escapeHtml(j.name)}</h2>`;
  const content = `<div class="py-6"><div class="max-w-5xl mx-auto sm:px-6 lg:px-8 space-y-6">${card(`
    <p class="text-sm text-gray-600 mb-4"><b>${escapeHtml(j.customer_name || "")}</b> · ${escapeHtml(j.vehicle || "")} · ${fmtDate(j.date)} · ${escapeHtml(j.status)}</p>
    <form id="assign-form" class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>${fieldLabel("Technician", "tech")}<select name="mechanic" id="tech" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm"><option value="">—</option>${opts.technicians.map((t) => `<option value="${t.name}"${j.mechanic === t.name ? " selected" : ""}>${escapeHtml(t.employee_name)}</option>`).join("")}</select></div>
        <div>${fieldLabel("Supervisor", "sup")}<select name="supervisor" id="sup" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm"><option value="">—</option>${opts.technicians.map((t) => `<option value="${t.name}"${j.supervisor === t.name ? " selected" : ""}>${escapeHtml(t.employee_name)}</option>`).join("")}</select></div>
      </div>
      <h4 class="font-medium text-gray-900">Parts</h4>
      <div id="as-parts" class="space-y-2"></div>
      ${button("Add Part", { variant: "secondary", attrs: `type="button" data-add-part=""` })}
      <h4 class="font-medium text-gray-900">Labour</h4>
      <div id="as-labours" class="space-y-2"></div>
      ${button("Add Labour", { variant: "secondary", attrs: `type="button" data-add-labour=""` })}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>${fieldLabel("Discount %", "dp")}${textInput("discount_percent", j.discount_percent || 0, "number")}</div>
        <div>${fieldLabel("GST Applicable", "gst")}<select name="gst_applicable" id="gst" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm"><option value="1">Yes</option><option value="0">No</option></select></div>
      </div>
      <div class="max-w-md ml-auto text-sm space-y-1" id="as-totals"></div>
      <div class="flex justify-end gap-2">
        ${button("Cancel", { variant: "ghost", href: `#/jobs/${encodeURIComponent(j.name)}` })}
        ${button("Save & Bill", { variant: "primary", type: "submit" })}
      </div>
    </form>`)}
  </div></div>`;
  return { header, content, _opts: opts, _job: j };
}

JobAssignView.mounted = async (view, m) => {
  const [docname] = String(decodeURIComponent(m[1])).split("?");
  const form = view.querySelector("#assign-form");
  if (!form) return;
  let opts;
  try {
    opts = await api.jobOptions();
  } catch (e) { alert(e.message); return; }
  const partsBox = view.querySelector("#as-parts");
  const labBox = view.querySelector("#as-labours");
  const totals = view.querySelector("#as-totals");

  function calc() {
    let sub = 0;
    partsBox.querySelectorAll("[data-prow]").forEach((r) => {
      const q = Number(r.querySelector('[name="p_qty"]').value) || 0;
      const mrp = Number(r.querySelector('[name="p_mrp"]').value) || 0;
      const lb = Number(r.querySelector('[name="p_labor"]').value) || 0;
      const w = r.querySelector('[name="p_warranty"]').checked;
      const line = w ? 0 : q * (mrp + lb);
      r.querySelector("[data-line]").textContent = "₹" + line.toFixed(2);
      sub += line;
    });
    labBox.querySelectorAll("[data-lrow]").forEach((r) => {
      const q = Number(r.querySelector('[name="l_qty"]').value) || 0;
      const rate = Number(r.querySelector('[name="l_rate"]').value) || 0;
      const line = q * rate;
      r.querySelector("[data-line]").textContent = "₹" + line.toFixed(2);
      sub += line;
    });
    const dp = Number(form.discount_percent.value) || 0;
    const disc = sub * dp / 100;
    const grand = Math.round(sub - disc);
    totals.innerHTML = `<div class="flex justify-between"><span>Subtotal</span><span>₹${sub.toFixed(2)}</span></div>
      <div class="flex justify-between"><span>Discount</span><span>₹${disc.toFixed(2)}</span></div>
      <div class="flex justify-between font-bold text-lg border-t pt-2"><span>Grand Total</span><span>₹${grand.toFixed(2)}</span></div>`;
  }

  function partRow() {
    const div = document.createElement("div");
    div.setAttribute("data-prow", "");
    div.className = "grid grid-cols-2 md:grid-cols-6 gap-2 items-end border border-border rounded-md p-2";
    div.innerHTML = `
      <div class="col-span-2">${fieldLabel("Part code")}${textInput("p_code", "", "text", "list='as-parts-list'")}</div>
      <div>${fieldLabel("Qty")}${textInput("p_qty", "1", "number")}</div>
      <div>${fieldLabel("MRP")}${textInput("p_mrp", "0", "number")}</div>
      <div>${fieldLabel("Labor")}${textInput("p_labor", "0", "number")}</div>
      <div class="flex items-center gap-2"><label class="text-xs"><input type="checkbox" name="p_warranty"> Warranty</label><span data-line class="text-sm font-medium ml-auto">₹0.00</span></div>`;
    partsBox.appendChild(div);
    const code = div.querySelector('[name="p_code"]');
    code.addEventListener("change", async () => {
      try {
        const found = await api.searchParts(code.value.trim());
        const hit = (found || []).find((x) => x.id === code.value.trim()) || found[0];
        if (hit) {
          div.querySelector('[name="p_mrp"]').value = hit.mrp || 0;
          div.querySelector('[name="p_labor"]').value = hit.labor || 0;
          calc();
        }
      } catch { /* ignore */ }
    });
    div.addEventListener("input", calc);
    div.addEventListener("change", calc);
  }

  function labourRow() {
    const div = document.createElement("div");
    div.setAttribute("data-lrow", "");
    div.className = "grid grid-cols-2 md:grid-cols-5 gap-2 items-end border border-border rounded-md p-2";
    div.innerHTML = `
      <div class="col-span-2">${fieldLabel("Service")}<select name="l_master" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm"><option value="">Select...</option></select></div>
      <div>${fieldLabel("Qty")}${textInput("l_qty", "1", "number")}</div>
      <div>${fieldLabel("Rate")}${textInput("l_rate", "0", "number")}</div>
      <div><span data-line class="text-sm font-medium">₹0.00</span></div>`;
    labBox.appendChild(div);
    const sel = div.querySelector('[name="l_master"]');
    api.labour({}).then((rows) => {
      sel.innerHTML = `<option value="">Select...</option>` + rows.map((l) => `<option value="${l.name}" data-rate="${l.standard_rate}">${escapeHtml(l.service_name)} (₹${l.standard_rate})</option>`).join("");
    }).catch(() => {});
    sel.addEventListener("change", () => {
      const opt = sel.selectedOptions[0];
      if (opt?.dataset.rate) div.querySelector('[name="l_rate"]').value = opt.dataset.rate;
      calc();
    });
    div.addEventListener("input", calc);
  }

  view.querySelector("[data-add-part]").addEventListener("click", partRow);
  view.querySelector("[data-add-labour]").addEventListener("click", labourRow);
  partRow();
  form.addEventListener("input", calc);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const items = [...partsBox.querySelectorAll("[data-prow]")].map((r) => ({
      item_no: r.querySelector('[name="p_code"]').value.trim(),
      qty: Number(r.querySelector('[name="p_qty"]').value) || 0,
      rate: Number(r.querySelector('[name="p_mrp"]').value) || 0,
      labor_cost: Number(r.querySelector('[name="p_labor"]').value) || 0,
    })).filter((x) => x.item_no && x.qty > 0);
    const labours = [...labBox.querySelectorAll("[data-lrow]")].map((r) => ({
      labour_master: r.querySelector('[name="l_master"]').value,
      qty: Number(r.querySelector('[name="l_qty"]').value) || 0,
      rate: Number(r.querySelector('[name="l_rate"]').value) || 0,
    })).filter((x) => x.labour_master && x.qty > 0);
    const fd = new FormData(form);
    try {
      await api.assignBill(docname, {
        mechanic: fd.get("mechanic") || undefined,
        supervisor: fd.get("supervisor") || undefined,
        discount_percent: Number(fd.get("discount_percent")) || 0,
        gst_applicable: fd.get("gst_applicable") === "1",
        items, labours,
      });
      window.location.hash = `#/jobs/${encodeURIComponent(docname)}`;
    } catch (ex) { alert(ex.message); }
  });
  calc();
};
