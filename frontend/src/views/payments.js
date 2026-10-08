// payments/index parity (summary + table + export).
import { api } from "../api.js";
import { icon } from "../icons.js";
import { badge, button, card, dataTable, th, td, fieldLabel, money, fmtDate, escapeHtml } from "../ui.js";

export async function PaymentsView() {
  const header = `<h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("banknotes", "w-6 h-6 text-primary")}Payments</h2>`;
  const content = `<div class="py-6"><div class="max-w-full sm:px-6 lg:px-8 space-y-4">
    ${card(`<p class="text-sm text-gray-600">Payments received against job-card and counter invoices (ERPNext Payment Entries).</p>`)}
    <div class="flex justify-end">${button(`${icon("arrow-up-tray", "w-4 h-4")}Export`, { variant: "secondary", attrs: `data-action="export"` })}</div>
    <div id="pay-table"></div><div id="pay-summary"></div>
  </div></div>`;
  return { header, content };
}

PaymentsView.mounted = async (view) => {
  const table = view.querySelector("#pay-table");
  const summary = view.querySelector("#pay-summary");
  let r;
  try {
    r = await api.payments({ limit: 50 });
  } catch (e) {
    table.innerHTML = `<p class="text-sm text-red-600">${e.message}</p>`;
    return;
  }
  const rows = r.payments.map((p) => `<tr class="group hover:bg-muted/50">
    ${td(fmtDate(p.posting_date))}
    ${td(escapeHtml(p.party || "-"), "max-w-[180px] truncate")}
    ${td(`<span class="capitalize">${escapeHtml(p.mode_of_payment || "-")}</span>`)}
    ${td(escapeHtml((p.remarks || "").slice(0, 30)))}
    ${td(money(p.paid_amount), "text-right font-medium text-gray-900")}
    ${td(`<button class="text-red-600 hover:text-red-800 text-sm" data-void="${p.name}">Void</button>`, "text-right")}
  </tr>`).join("");
  table.innerHTML = dataTable(`${th("Payment Date")}${th("Customer")}${th("Payment Mode")}${th("Notes")}${th("Amount", "text-right")}${th("", "text-right")}`, rows, "banknotes", "No payments yet.");
  table.querySelectorAll("[data-void]").forEach((b) => b.addEventListener("click", async () => {
    if (!confirm(`Void payment ${b.dataset.void}?`)) return;
    try {
      await api.voidPayment(b.dataset.void);
      window.location.reload();
    } catch (e) { alert(e.message); }
  }));
  const total = r.payments.reduce((s, p) => s + Number(p.paid_amount || 0), 0);
  summary.innerHTML = `<div class="mt-6 bg-white rounded-xl border border-border shadow-sm p-6">
    <h3 class="font-semibold text-gray-900 mb-4">Current Page Summary</h3>
    <div class="text-center p-4 bg-green-50 rounded-lg"><div class="text-gray-600 mb-1 text-sm">Total Received</div><div class="text-xl font-bold text-green-700">${money(total)}</div></div>
  </div>`;
  view.querySelector('[data-action="export"]').addEventListener("click", () => {
    window.open(`/api/method/ev_workshop.workshop_api.export_csv?entity=payments`, "_blank");
  });
};
