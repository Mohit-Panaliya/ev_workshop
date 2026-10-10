// job_cards/index + show + create parity.
import { api } from "../api.js";
import { icon } from "../icons.js";
import { badge, button, card, dataTable, th, td, searchBar, searchBarExact, fieldLabel, filterLabel, filterInput, filterSelect, textInput, money, fmtDate, escapeHtml, pageHeader, statusBadge, JOB_STATUS_BADGES, JOB_STATUS_ICONS } from "../ui.js";
import { bindBulkDelete } from "../list.js";

const PAY_BADGES = { paid: "green", partially_paid: "amber", unbilled: "gray", default: "red" };

function payStatus(j) {
  if (j.pay_status) return j.pay_status;
  const billed = Number(j.amount_billed ?? j.grand_total ?? 0);
  if (!billed) return "unbilled";
  const due = Number(j.outstanding ?? (billed - Number(j.amount_paid || 0)));
  if (due <= 0) return "paid";
  if (due < billed) return "partially_paid";
  return "unpaid";
}

export async function JobsView() {
  let techs = [];
  try {
    techs = (await api.jobOptions()).technicians || [];
  } catch { /* filter still renders */ }
  const header = `<div class="flex justify-between items-center">
    <h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("wrench-screwdriver", "w-6 h-6 text-primary")}Job Cards</h2>
    <div class="flex items-center gap-2">
      ${button(`${icon("arrow-up-tray", "w-4 h-4")}Import CSV`, { variant: "secondary", attrs: `data-action="import-jobs"` })}
      <div class="relative" data-dropdown-root="export">
        <div><button type="button" data-dropdown="export" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md h-10 px-4 py-2 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-sm">${icon("arrow-down-tray", "w-4 h-4")}Export ${icon("chevron-down", "w-4 h-4")}</button></div>
        <div data-dropdown-menu="export" style="display:none;" class="absolute z-50 mt-2 64 rounded-md shadow-lg ltr:origin-top-left rtl:origin-top-right start-0">
          <div class="rounded-md ring-1 ring-black ring-opacity-5 py-1 bg-card">
            <a href="#" data-export="all" class="block w-full px-4 py-2 text-start text-sm leading-5 text-gray-700 hover:bg-accent hover:text-accent-foreground">Export All (CSV)</a>
            <a href="#" data-export="filtered" class="block w-full px-4 py-2 text-start text-sm leading-5 text-gray-700 hover:bg-accent hover:text-accent-foreground">Export Filtered Results (CSV)</a>
          </div>
        </div>
      </div>
    </div></div>`;
  const content = `<div class="py-6"><div class="max-w-full sm:px-6 lg:px-8 space-y-4">
    <div id="jobs-flash"></div>
    <form id="jobs-filter" method="GET" class="mb-6"><div class="space-y-4">
      <div class="flex gap-3"><div class="flex-1">${searchBarExact("search", "", "Search by job card no, customer name, or vehicle registration...")}</div>
      ${button(`${icon("magnifying-glass", "w-4 h-4")}Search`, { type: "submit" })}</div>
      <div class="bg-white rounded-lg border border-gray-200 p-4"><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>${filterLabel("From Date", "from_date")}${filterInput("from_date", "", "date")}</div>
        <div>${filterLabel("To Date", "to_date")}${filterInput("to_date", "", "date")}</div>
        <div>${filterLabel("Technician", "technician")}${filterSelect("technician", `<option value="">All Technicians</option>${techs.map((t) => `<option value="${t.name}">${escapeHtml(t.employee_name)}</option>`).join("")}`)}</div>
        <div>${filterLabel("Status", "status")}${filterSelect("status", `<option value="">All Statuses</option>${["Admitted", "Inspection", "Quoted", "Approved", "Repairing", "Ready", "Completed", "Cancelled"].map((s) => `<option>${s}</option>`).join("")}`)}</div>
        <div>${filterLabel("Payment Status", "payment_status")}${filterSelect("payment_status", `<option value="all">All</option><option value="paid">Paid</option><option value="partially_paid">Partially Paid</option><option value="unbilled">Unbilled</option><option value="unpaid">Unpaid</option>`)}</div>
        <div>${filterLabel("Job Type", "service_type")}${filterSelect("service_type", `<option value="">All Types</option><option>Free</option><option>Paid</option>`)}</div>
        <div>${filterLabel("Items Per Page", "per_page")}${filterSelect("per_page", `<option value="15" selected>15</option><option value="25">25</option><option value="50">50</option><option value="100">100</option>`)}</div>
        <div>${filterLabel("Filter Options", "exclude_delivered")}<label class="flex items-center gap-2 h-10 px-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 cursor-pointer"><input type="checkbox" name="exclude_delivered" value="1" class="rounded border-gray-300 text-primary focus:ring-primary"><span class="text-sm text-gray-700">Hide Delivered Jobs</span></label></div>
      </div></div>
    </div></form>
    <div id="jobs-selection"></div>
    <div id="jobs-table"></div>
  </div></div>`;
  return { header, content };
}

JobsView.mounted = async (view) => {
  const table = view.querySelector("#jobs-table");
  const form = view.querySelector("#jobs-filter");
  let page = 1;
  let pager = document.createElement("div");
  pager.id = "jobs-pager";
  table.after(pager);
  async function load() {
    const fd = new FormData(form);
    const params = {
      search: fd.get("search") || undefined,
      status: fd.get("status") || undefined,
      technician: fd.get("technician") || undefined,
      payment_status: fd.get("payment_status") !== "all" ? fd.get("payment_status") || undefined : undefined,
      service_type: fd.get("service_type") || undefined,
      per_page: Number(fd.get("per_page")) || 15,
      page,
      from_date: fd.get("from_date") || undefined,
      to_date: fd.get("to_date") || undefined,
      exclude_delivered: fd.get("exclude_delivered") ? 1 : undefined,
    };
    let jobs = [];
    let meta = { page: 1, pages: 1, total: 0 };
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
        ${td(`<input type="checkbox" data-name="${escapeHtml(j.name)}" class="rounded border-gray-300 text-primary">`, "w-10")}
        ${td(`<a class="text-primary hover:text-primary-700" href="#/jobs/${encodeURIComponent(j.name)}">${j.name}</a>`)}
        ${td(fmtDate(j.date))}
        ${td(`<span class="max-w-[180px] truncate block">${escapeHtml(j.customer_name || "-")}</span>`)}
        ${td(escapeHtml(j.vehicle || "-"))}
        ${td(statusBadge(JOB_STATUS_BADGES, j.status, JOB_STATUS_ICONS))}
        ${td(money(j.grand_total), "text-right font-medium text-gray-900")}
        ${td(statusBadge(PAY_BADGES, ps))}
      </tr>`;
    }).join("");
    table.innerHTML = dataTable(
      `${th("")}${th("Job No.")}${th("Date")}${th("Customer")}${th("Vehicle")}${th("Status")}${th("Grand Total", "text-right")}${th("Payment")}`,
      rows, "wrench-screwdriver", "No job cards found."
    );
    bindBulkDelete(view, table);
    table.querySelectorAll("input[type=checkbox][data-name]").forEach((c) => c.addEventListener("change", renderSelection));
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
    return [...table.querySelectorAll("input[type=checkbox][data-name]:checked")].map((c) => c.dataset.name);
  }
  function renderSelection() {
    const box = view.querySelector("#jobs-selection");
    if (!box) return;
    const names = selectedNames();
    if (!names.length) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = `<div class="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 shadow-sm">
      <span class="mr-auto text-sm font-medium text-primary-800"><span class="font-semibold">${names.length}</span> selected</span>
      <button data-sel-export class="inline-flex items-center justify-center gap-2 rounded-md h-10 px-4 py-2 text-sm font-medium shadow-sm border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Export selected</button>
      <button data-sel-delete class="inline-flex items-center justify-center gap-2 rounded-md h-10 px-4 py-2 text-sm font-medium shadow-sm bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete selected</button>
    </div>`;
    box.querySelector("[data-sel-delete]").addEventListener("click", async () => {
      if (!confirm(`Delete ${names.length} job card(s)? Parts stock will be returned.`)) return;
      try {
        const r = await api.bulkDelete("Job Master", names);
        alert(r.message);
        load();
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
  if (impBtn) impBtn.addEventListener("click", () => alert("Job import runs from Desk: Data Import Tool with the Job Master template."));
  await load();
};

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
      <form id="add-form" class="grid grid-cols-4 gap-2 mt-3 items-end">
        <div>${fieldLabel("Item code (blank for labour)")}${textInput("item_no")}</div>
        <div>${fieldLabel("Labour (blank for part)")}${textInput("labour_master")}</div>
        <div>${fieldLabel("Qty")}${textInput("qty", "1", "number")}</div>
        <div>${fieldLabel("Rate")}${textInput("rate", "0", "number")}</div>
        <div class="col-span-4 flex justify-end">${button("Add to Job", { variant: "secondary", type: "submit" })}</div>
      </form>
      <p class="text-xs text-gray-500 mt-1">Use the Item Master code (e.g. 002) or Labour Master name (e.g. LAB-0001).</p>
    </details>`)}
    ${card(`<div class="grid grid-cols-3 gap-6">
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
        <form id="pay-form" class="grid grid-cols-4 gap-4">
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
    f.innerHTML = card(`<form id="job-edit" class="grid grid-cols-2 gap-4">
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
  let opts = { ownerships: [], technicians: [], parts: [], labours: [] };
  try {
    opts = await api.jobOptions();
  } catch (e) {
    return { header: pageHeader("wrench-screwdriver", "New Job Card"), content: `<p class="text-sm text-red-600">${e.message}</p>` };
  }
  const header = `<h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("wrench-screwdriver", "w-6 h-6 text-primary")}New Job Card</h2>`;
  const content = `<div class="py-6"><div class="max-w-5xl mx-auto sm:px-6 lg:px-8 space-y-6">
    <div id="job-flash"></div>
    ${card(`<form id="job-form" class="grid grid-cols-2 gap-4">
      <div>${fieldLabel("Vehicle Ownership")}<select name="vehicle_ownership" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm transition-colors focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shadow-sm" required>
        <option value="">Select...</option>${opts.ownerships.map((o) => `<option value="${o.name}"${preset.ownership === o.name ? " selected" : ""}>${escapeHtml(o.customer_name || o.name)} — ${escapeHtml(o.registration_no || "")}</option>`).join("")}</select></div>
      <div>${fieldLabel("Customer Type")}<select name="customer_type" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm transition-colors focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shadow-sm"><option>Customer</option><option>Retailer</option></select></div>
      <div>${fieldLabel("Service Type")}<select name="service_type" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm transition-colors focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shadow-sm"><option>Paid</option><option>Free</option></select></div>
      <div>${fieldLabel("KM Reading")}${textInput("km_reading", "0", "number")}</div>
      <div>${fieldLabel("Supervisor")}<select name="supervisor" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm transition-colors focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shadow-sm"><option value="">—</option>${opts.technicians.map((t) => `<option value="${t.name}">${escapeHtml(t.employee_name)}</option>`).join("")}</select></div>
      <div>${fieldLabel("Mechanic")}<select name="mechanic" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm transition-colors focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shadow-sm"><option value="">—</option>${opts.technicians.map((t) => `<option value="${t.name}">${escapeHtml(t.employee_name)}</option>`).join("")}</select></div>
      <div class="col-span-2">${fieldLabel("Complaints")}<textarea name="complaints" rows="3" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm transition-colors focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shadow-sm" required></textarea></div>
      <div class="col-span-2 flex justify-end">${button("Create Job Card", { variant: "primary", type: "submit" })}</div>
    </form>`)}
  </div></div>`;
  return { header, content };
}

async function bindJobCreate(view) {
  const form = view.querySelector("#job-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const r = await api.createJob(Object.fromEntries(fd.entries()));
      window.location.hash = `#/jobs/${encodeURIComponent(r.name)}`;
    } catch (ex) {
      const f = view.querySelector("#job-flash");
      f.innerHTML = `<p class="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-md text-sm">${ex.message}</p>`;
      btn.disabled = false;
    }
  });
}
