// job_cards/index + show + create parity.
import { api } from "../api.js";
import { icon } from "../icons.js";
import { badge, button, card, dataTable, th, td, searchBar, fieldLabel, textInput, money, fmtDate, escapeHtml, pageHeader, statusBadge, JOB_STATUS_BADGES, JOB_STATUS_ICONS } from "../ui.js";

const PAY_BADGES = { paid: "green", partially_paid: "amber", unbilled: "gray", default: "red" };

function payStatus(j) {
  if (j.grand_total == null) return "unbilled";
  const paid = Number(j.amount_paid || 0);
  if (paid <= 0) return "unpaid";
  if (paid >= Number(j.grand_total)) return "paid";
  return "partially_paid";
}

export async function JobsView() {
  const header = `<div class="flex justify-between items-center">
    <h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("wrench-screwdriver", "w-6 h-6 text-primary")}Job Cards</h2>
    <div class="flex items-center gap-2">
      ${button(`${icon("arrow-up-tray", "w-4 h-4")}Export`, { variant: "secondary", attrs: `data-action="export"` })}
      ${button(`${icon("plus", "w-4 h-4")}New Job`, { variant: "primary", href: "#/jobs/new" })}
    </div></div>`;
  const content = `<div class="py-6"><div class="max-w-full sm:px-6 lg:px-8 space-y-4">
    <div id="jobs-flash"></div>
    <form id="jobs-filter" class="space-y-4">
      <div class="flex gap-3"><div class="flex-1">${searchBar("search", "", "Search by job card no, customer name, or vehicle registration...")}</div>
      ${button(`${icon("magnifying-glass", "w-4 h-4")}Search`, { type: "submit" })}</div>
      <div class="bg-white rounded-lg border border-gray-200 p-4"><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>${fieldLabel("Status")}<select name="status" class="w-full border-gray-300 rounded-lg"><option value="">All Statuses</option>${["Admitted", "Inspection", "Quoted", "Approved", "Repairing", "Ready", "Completed", "Cancelled"].map((s) => `<option>${s}</option>`).join("")}</select></div>
        <div>${fieldLabel("Per page")}<select name="per_page" class="w-full border-gray-300 rounded-lg"><option>15</option><option>25</option><option>50</option><option>100</option></select></div>
      </div></div>
    </form>
    <div id="jobs-table"></div>
  </div></div>`;
  return { header, content };
}

JobsView.mounted = async (view) => {
  const table = view.querySelector("#jobs-table");
  const form = view.querySelector("#jobs-filter");
  async function load() {
    const fd = new FormData(form);
    const params = { search: fd.get("search") || undefined, status: fd.get("status") || undefined, limit: Number(fd.get("per_page")) || 15 };
    let jobs = [];
    try {
      const r = await api.jobs(params);
      jobs = r.jobs;
    } catch (e) {
      table.innerHTML = `<p class="text-sm text-red-600">${e.message}</p>`;
      return;
    }
    const rows = jobs.map((j) => {
      const ps = payStatus(j);
      return `<tr class="group hover:bg-muted/50">
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
  }
  form.addEventListener("submit", (e) => { e.preventDefault(); load(); });
  view.querySelector('[data-action="export"]').addEventListener("click", () => {
    window.open(`/api/method/ev_workshop.workshop_api.export_csv?entity=jobs`, "_blank");
  });
  await load();
};

export async function JobDetailView(name) {
  if (name === "new") return JobCreateView();
  let data;
  try {
    data = await api.job(name);
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
          <div>${fieldLabel("Mode")}<select name="mode_of_payment" class="block w-full rounded-md border border-gray-300 bg-white shadow-sm text-sm"><option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Cheque</option></select></div>
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
  const name = decodeURIComponent(m[1]);
  if (name === "new") {
    bindJobCreate(view);
    return;
  }
  const actions = view.parentElement?.parentElement?.querySelector("#job-actions") || document.querySelector("#job-actions");
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

async function JobCreateView() {
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
      <div>${fieldLabel("Vehicle Ownership")}<select name="vehicle_ownership" class="block w-full rounded-md border border-gray-300 bg-white shadow-sm text-sm" required>
        <option value="">Select...</option>${opts.ownerships.map((o) => `<option value="${o.name}">${escapeHtml(o.customer_name || o.name)} — ${escapeHtml(o.registration_no || "")}</option>`).join("")}</select></div>
      <div>${fieldLabel("Customer Type")}<select name="customer_type" class="block w-full rounded-md border border-gray-300 bg-white shadow-sm text-sm"><option>Customer</option><option>Retailer</option></select></div>
      <div>${fieldLabel("Service Type")}<select name="service_type" class="block w-full rounded-md border border-gray-300 bg-white shadow-sm text-sm"><option>Paid Service</option><option>Free Service</option><option>Warranty</option><option>AMC</option><option>Insurance Claim</option><option>Breakdown</option></select></div>
      <div>${fieldLabel("KM Reading")}${textInput("km_reading", "0", "number")}</div>
      <div>${fieldLabel("Supervisor")}<select name="supervisor" class="block w-full rounded-md border border-gray-300 bg-white shadow-sm text-sm"><option value="">—</option>${opts.technicians.map((t) => `<option value="${t.name}">${escapeHtml(t.employee_name)}</option>`).join("")}</select></div>
      <div>${fieldLabel("Mechanic")}<select name="mechanic" class="block w-full rounded-md border border-gray-300 bg-white shadow-sm text-sm"><option value="">—</option>${opts.technicians.map((t) => `<option value="${t.name}">${escapeHtml(t.employee_name)}</option>`).join("")}</select></div>
      <div class="col-span-2">${fieldLabel("Complaints")}<textarea name="complaints" rows="3" class="block w-full rounded-md border border-gray-300 bg-white shadow-sm text-sm" required></textarea></div>
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
