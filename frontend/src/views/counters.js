// counter_invoices/index + show + create parity.
import { api } from "../api.js";
import { icon } from "../icons.js";
import { button, card, dataTable, th, td, fieldLabel, textInput, money, fmtDate, escapeHtml, statusBadge } from "../ui.js";
import { bindBulkDelete } from "../list.js";

const PAY_BADGES = { paid: "green", partially_paid: "amber", unpaid: "red", default: "red" };

export async function CountersView() {
  const header = `<div class="flex justify-between items-center">
    <h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("receipt-percent", "w-6 h-6 text-primary")}Counter Invoices</h2>
    <div class="flex items-center gap-2">${button(`${icon("plus", "w-4 h-4")}New Counter Invoice`, { variant: "primary", href: "#/counters/new" })}</div>
  </div>`;
  const content = `<div class="py-6"><div class="max-w-full sm:px-6 lg:px-8 space-y-4">
    <form id="ci-filter" class="flex gap-3"><div class="flex-1">
      <div class="relative"><input type="text" name="search" placeholder="Search invoice or walk-in..." class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">${icon("magnifying-glass", "h-5 w-5 text-gray-400")}</div></div>
    </div>${button(`${icon("magnifying-glass", "w-4 h-4")}Search`, { type: "submit" })}</form>
    <div class="flex justify-end gap-2">
      ${button("Delete selected", { variant: "danger", attrs: `data-action="bulk-delete" data-doctype="Counter Invoice"` })}
    </div>
    <div id="ci-table"></div>
  </div></div>`;
  return { header, content };
}

CountersView.mounted = async (view) => {
  const table = view.querySelector("#ci-table");
  const form = view.querySelector("#ci-filter");
  async function load() {
    const fd = new FormData(form);
    let r;
    try {
      r = await api.counters({ search: fd.get("search") || undefined });
    } catch (e) {
      table.innerHTML = `<p class="text-sm text-red-600">${e.message}</p>`;
      return;
    }
    const rows = r.invoices.map((i) => {
      const due = r.outstanding[i.name] ?? 0;
      const ps = i.docstatus === 1 ? (due <= 0 ? "paid" : "partially_paid") : "unpaid";
      return `<tr class="group hover:bg-muted/50">
        ${td(`<input type="checkbox" data-name="${escapeHtml(i.name)}" class="rounded border-gray-300 text-primary">`, "w-10")}
        ${td(`<a class="text-primary hover:underline" href="#/counters/${encodeURIComponent(i.name)}">${i.name}</a>`)}
        ${td(fmtDate(i.invoice_date))}
        ${td(`<span class="max-w-[180px] truncate block">${escapeHtml(i.customer || i.walkin_name || "Walk-in")}</span>`)}
        ${td(statusBadge(PAY_BADGES, ps))}
        ${td(money(i.grand_total), "text-right font-medium text-gray-900")}
      </tr>`;
    }).join("");
    table.innerHTML = dataTable(`${th("")}${th("Invoice No.")}${th("Date")}${th("Customer")}${th("Payment")}${th("Grand Total", "text-right")}`, rows, "receipt-percent", "No counter invoices yet.");
    bindBulkDelete(view, table);
  }
  form.addEventListener("submit", (e) => { e.preventDefault(); load(); });
  await load();
};

export async function CounterDetailView(name) {
  if (name === "new") return CounterCreateView();
  let d;
  try {
    d = await api.counter(name);
  } catch (e) {
    return { header: "Counter Invoice", content: `<p class="text-sm text-red-600">${e.message}</p>` };
  }
  const inv = d.invoice;
  const header = `<div class="flex flex-wrap justify-between items-center gap-3">
    <h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("receipt-percent", "w-6 h-6 text-primary")}Counter Invoice ${escapeHtml(inv.name)}</h2>
    <div class="flex flex-wrap items-center gap-3">
      ${inv.docstatus === 1 ? button("Print Receipt", { variant: "secondary", attrs: `data-print="${inv.name}"` }) : button("Submit", { variant: "primary", attrs: `data-submit="${inv.name}"` })}
      ${button("Back", { variant: "ghost", href: "#/counters" })}
    </div></div>`;
  const rows = (inv.items || []).map((it) => `<tr class="border-t hover:bg-muted/50">
    <td class="align-middle px-4 py-2 text-sm">${escapeHtml(it.item_name || it.item_master)}</td>
    <td class="align-middle px-4 py-2 text-sm text-center">${it.qty}</td>
    <td class="align-middle px-4 py-2 text-sm text-right">${money(it.mrp)}</td>
    <td class="align-middle px-4 py-2 text-sm text-right font-medium">${money(it.line_total)}</td>
  </tr>`).join("");
  const content = `<div class="py-6"><div class="max-w-5xl mx-auto sm:px-6 lg:px-8 space-y-6">
    <div id="ci-flash"></div>
    ${card(`<p class="text-sm"><b>Customer:</b> ${escapeHtml(inv.customer || inv.walkin_name || "Walk-in")} ${escapeHtml(inv.walkin_mobile || "")}<br>
    <b>Date:</b> ${fmtDate(inv.invoice_date)}${inv.sales_invoice ? `<br><b>Sales Invoice:</b> ${inv.sales_invoice}` : ""}</p>`)}
    ${card(`<table class="min-w-full text-xs"><thead class="bg-muted/50"><tr>
      <th class="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Item</th>
      <th class="px-4 py-2 text-center text-xs font-medium text-muted-foreground uppercase">Qty</th>
      <th class="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">MRP</th>
      <th class="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Total</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <div class="max-w-md ml-auto space-y-2 text-sm mt-4">
      <div class="flex justify-between"><span>CGST</span><span>${money(inv.cgst_amount)}</span></div>
      <div class="flex justify-between"><span>SGST</span><span>${money(inv.sgst_amount)}</span></div>
      <div class="flex justify-between text-lg font-bold border-t pt-2"><span>Grand Total</span><span>${money(inv.grand_total)}</span></div>
      <div class="flex justify-between"><span>Outstanding</span><span>${money(d.outstanding)}</span></div>
    </div>`)}
  </div></div>`;
  return { header, content };
}

CounterDetailView.mounted = async (view, m) => {
  const name = decodeURIComponent(m[1]);
  if (name === "new") {
    bindCounterCreate(view);
    return;
  }
  const pr = view.querySelector("[data-print]");
  if (pr) pr.addEventListener("click", () => {
    window.open(`/printview?doctype=Counter%20Invoice&name=${encodeURIComponent(name)}&format=EV%20Counter%20Receipt`, "_blank");
  });
  const sub = view.querySelector("[data-submit]");
  if (sub) sub.addEventListener("click", async () => {
    sub.disabled = true;
    try {
      await api.submitCounter(name);
      window.location.reload();
    } catch (e) {
      view.querySelector("#ci-flash").innerHTML = `<p class="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-md text-sm">${e.message}</p>`;
      sub.disabled = false;
    }
  });
};

async function CounterCreateView() {
  let parts = [];
  try {
    parts = await api.parts({ limit: 500 });
  } catch (e) {
    return { header: "New Counter Invoice", content: `<p class="text-sm text-red-600">${e.message}</p>` };
  }
  const header = `<h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("receipt-percent", "w-6 h-6 text-primary")}New Counter Invoice</h2>`;
  const content = `<div class="py-6"><div class="max-w-5xl mx-auto sm:px-6 lg:px-8 space-y-6">${card(`
    <form id="ci-form" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>${fieldLabel("Walk-in Name")}${textInput("walkin_name")}</div>
        <div>${fieldLabel("Walk-in Mobile")}${textInput("walkin_mobile")}</div>
      </div>
      <div id="ci-lines" class="space-y-2"></div>
      ${button(`${icon("plus", "w-4 h-4")}Add line`, { variant: "secondary", attrs: `data-add-line="" type="button"` })}
      <div class="flex justify-end">${button("Create Draft", { variant: "primary", type: "submit" })}</div>
    </form>`)}
  </div></div>`;
  return { header, content, parts };
}

function bindCounterCreate(view) {
  const box = view.querySelector("#ci-lines");
  const addBtn = view.querySelector("[data-add-line]");
  function addLine() {
    const div = document.createElement("div");
    div.className = "grid grid-cols-4 gap-2 items-end";
    div.innerHTML = `<div>${fieldLabel("Item")}<select name="item" class="block w-full rounded-md border border-gray-300 text-sm" data-parts="1"></select></div>
      <div>${fieldLabel("Qty")}${textInput("qty", "1", "number")}</div>
      <div>${fieldLabel("MRP")}${textInput("mrp", "0", "number")}</div>
      <div>${button("Remove", { variant: "danger", attrs: `data-remove="" type="button"` })}</div>`;
    box.appendChild(div);
    fillParts(div.querySelector("[data-parts]"));
    div.querySelector("[data-remove]").addEventListener("click", () => div.remove());
  }
  async function fillParts(sel) {
    try {
      const parts = await api.parts({ limit: 500 });
      sel.innerHTML = parts.map((p) => `<option value="${p.item_no}" data-rate="${p.standard_rate}">${escapeHtml(p.item_name)} (₹${p.standard_rate})</option>`).join("");
      const sync = () => {
        const opt = sel.selectedOptions[0];
        sel.closest("div.grid").querySelector('input[name="mrp"]').value = opt?.dataset.rate || 0;
      };
      sel.addEventListener("change", sync);
      sync();
    } catch { /* ignore */ }
  }
  addBtn.addEventListener("click", addLine);
  addLine();
  view.querySelector("#ci-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const lines = [...box.children].map((div) => ({
      item_master: div.querySelector('[name="item"]').value,
      qty: Number(div.querySelector('[name="qty"]').value),
      mrp: Number(div.querySelector('[name="mrp"]').value),
    }));
    try {
      const r = await api.createCounter({ walkin_name: fd.get("walkin_name"), walkin_mobile: fd.get("walkin_mobile"), items: lines });
      window.location.hash = `#/counters/${encodeURIComponent(r.name)}`;
    } catch (ex) { alert(ex.message); }
  });
}
