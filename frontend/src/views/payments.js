// payments/index parity (summary + table + export).
import { api } from "../api.js";
import { icon } from "../icons.js";
import { badge, button, card, dataTable, th, td, fieldLabel, textInput, money, fmtDate, escapeHtml, sortTh, bindSort } from "../ui.js";
import { openModal, closeModal } from "../components.js";
import { exportDropdown, bindExportDropdown } from "../list.js";

export async function PaymentsView() {
  const header = `<h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("banknotes", "w-6 h-6 text-primary")}Payments</h2>`;
  const content = `<div class="py-6"><div class="max-w-full sm:px-6 lg:px-8 space-y-4">
    ${card(`<p class="text-sm text-gray-600">Payments received against job-card and counter invoices (ERPNext Payment Entries).</p>`)}
    <div class="flex justify-end gap-2 items-end">
      <div><label class="block text-sm font-medium text-gray-700 mb-1">Per page</label><select id="pay-per" class="border-gray-300 rounded-lg"><option>15</option><option>25</option><option>50</option><option>100</option></select></div>
      ${exportDropdown("payments")}</div>
    <div id="pay-table"></div><div id="pay-summary"></div>
  </div></div>`;
  return { header, content };
}

PaymentsView.mounted = async (view) => {
  const table = view.querySelector("#pay-table");
  const summary = view.querySelector("#pay-summary");
  const sortState = { column: "posting_date", direction: "desc" };
  async function load() {
    const perPage = Number(view.querySelector("#pay-per")?.value) || 50;
    let r;
    try {
      r = await api.payments({ limit: perPage, sort: sortState.column, direction: sortState.direction });
    } catch (e) {
      table.innerHTML = `<p class="text-sm text-red-600">${e.message}</p>`;
      return;
    }
  const rows = r.payments.map((p) => {
    const isJob = p.job_reference && String(p.job_reference).startsWith("JOB-");
    const docBadge = isJob
      ? `<span class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold border-transparent bg-primary-100 text-primary-800">Job Card</span>`
      : `<span class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold border-transparent bg-green-100 text-green-800">Counter</span>`;
    const docLink = p.job_reference
      ? `<a class="inline-flex items-center gap-1 text-sm text-primary hover:underline" href="${isJob ? `#/jobs/${encodeURIComponent(p.job_reference)}` : `#/counters/${encodeURIComponent(p.job_reference)}`}">View Document</a>`
      : `<span class="text-gray-400">—</span>`;
    return `<tr class="group hover:bg-muted/50">
    ${td(fmtDate(p.posting_date))}
    ${td(docBadge)}
    ${td(escapeHtml(p.ref_name || p.name), "font-medium")}
    ${td(escapeHtml(p.party || "-"), "max-w-[180px] truncate")}
    ${td(`<span class="capitalize">${escapeHtml(p.mode_of_payment || "-")}</span>`)}
    ${td(escapeHtml(p.reference_no || "-"))}
    ${td(money(p.paid_amount), "text-right font-medium text-gray-900")}
    ${td(escapeHtml((p.remarks || "").slice(0, 30)), "max-w-[200px] truncate")}
    ${td(`${docLink} ${p.docstatus === 0 ? `<button class="text-primary hover:text-primary-700 text-sm ml-2" data-edit-p="${p.name}">Edit</button>` : ""}<button class="text-red-600 hover:text-red-800 text-sm ml-2" data-void="${p.name}">Void</button>`, "text-right")}
  </tr>`;
  }).join("");
  table.innerHTML = dataTable(`${sortTh("Payment Date", "posting_date", sortState)}${th("Document Type")}${th("Document No")}${th("Customer")}${sortTh("Payment Mode", "payment_mode", sortState)}${th("Reference")}${sortTh("Amount", "amount", sortState)}${th("Notes")}${th("Actions", "text-right")}`, rows, "banknotes", "No payments yet.");
  bindSort(table, sortState, load);
  table.querySelectorAll("[data-edit-p]").forEach((b) => b.addEventListener("click", () => {
    const wrap = openModal("Edit Draft Payment", `
      <form id="pe-edit" class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>${fieldLabel("Amount")}${textInput("paid_amount", "", "number")}</div>
        <div>${fieldLabel("Mode")}<select name="mode_of_payment" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm"><option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Cheque</option></select></div>
        <div>${fieldLabel("Date")}${textInput("posting_date", new Date().toISOString().slice(0, 10), "date")}</div>
        <div>${fieldLabel("Reference")}${textInput("reference_no")}</div>
        <div class="col-span-2 flex justify-end gap-2">
          <button type="button" data-mclose class="inline-flex items-center h-10 px-4 text-sm hover:bg-accent rounded-md">Cancel</button>
          ${button("Update", { variant: "primary", type: "submit" })}
        </div>
      </form>`);
    wrap.querySelector("[data-mclose]").addEventListener("click", closeModal);
    wrap.querySelector("#pe-edit").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const fd = Object.fromEntries(new FormData(e.target).entries());
        fd.received_amount = fd.paid_amount;
        await api.updatePayment(b.dataset.editP, fd);
        closeModal();
        window.location.reload();
      } catch (ex) { alert(ex.message); }
    });
  }));
  table.querySelectorAll("[data-void]").forEach((b) => b.addEventListener("click", async () => {
    if (!confirm(`Void payment ${b.dataset.void}?`)) return;
    try {
      await api.voidPayment(b.dataset.void);
      window.location.reload();
    } catch (e) { alert(e.message); }
  }));
  const total = r.payments.reduce((s, p) => s + Number(p.paid_amount || 0), 0);
  const byMode = (mode) => r.payments.filter((p) => (p.mode_of_payment || "").toLowerCase() === mode).reduce((s, p) => s + Number(p.paid_amount || 0), 0);
  const other = total - byMode("cash") - byMode("upi") - byMode("card");
  const cell = (label, val, bg) => `<div class="text-center p-4 ${bg} rounded-lg"><div class="text-gray-600 mb-1 text-sm">${label}</div><div class="text-xl font-bold">${money(val)}</div></div>`;
  summary.innerHTML = `<div class="mt-6 bg-white rounded-xl border border-border shadow-sm p-6">
    <h3 class="font-semibold text-gray-900 mb-4">Current Page Summary</h3>
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
      ${cell("Total", total, "bg-muted")}
      ${cell("Cash", byMode("cash"), "bg-green-50")}
      ${cell("UPI", byMode("upi"), "bg-primary-50")}
      ${cell("Card", byMode("card"), "bg-purple-50")}
      ${cell("Other", other, "bg-amber-50")}
    </div>
  </div>`;
  } // end load()
  view.querySelector("#pay-per").addEventListener("change", () => load());
  bindExportDropdown(view, "payments", () => ({}));
  await load();
};
