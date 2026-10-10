// counter_invoices/index + show + create parity.
import { api } from "../api.js";
import { icon } from "../icons.js";
import { button, card, dataTable, th, td, fieldLabel, textInput, money, fmtDate, escapeHtml, statusBadge, sortTh, bindSort } from "../ui.js";
import { bindBulkDelete, exportDropdown, bindExportDropdown } from "../list.js";
import { combobox } from "../components.js";

const PAY_BADGES = { paid: "green", partially_paid: "amber", unpaid: "red", default: "red" };

export async function CountersView() {
  const header = `<div class="flex flex-wrap gap-2 justify-between items-center">
    <h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("receipt-percent", "w-6 h-6 text-primary")}Counter Invoices</h2>
    <div class="flex items-center gap-2">${exportDropdown("counter_invoices")}${button(`${icon("plus", "w-4 h-4")}New Counter Invoice`, { variant: "primary", href: "#/counters/new" })}</div>
  </div>`;
  const content = `<div class="py-6"><div class="max-w-full sm:px-6 lg:px-8 space-y-4">
    <form id="ci-filter" class="flex gap-3"><div class="flex-1">
      <div class="relative"><input type="text" name="search" placeholder="Search invoice or walk-in..." class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">${icon("magnifying-glass", "h-5 w-5 text-gray-400")}</div></div>
    </div><div><label class="block text-sm font-medium text-gray-700 mb-1">Per page</label><select name="per_page" class="border-gray-300 rounded-lg"><option>15</option><option>25</option><option>50</option><option>100</option></select></div>${button(`${icon("magnifying-glass", "w-4 h-4")}Search`, { type: "submit" })}</form>
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
  const sortState = { column: "invoice_date", direction: "desc" };
  async function load() {
    const fd = new FormData(form);
    let r;
    try {
      r = await api.counters({ search: fd.get("search") || undefined, sort: sortState.column, direction: sortState.direction });
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
        ${td(`<span class="inline-flex items-center gap-2"><a href="#/counters/${encodeURIComponent(i.name)}" class="text-primary hover:text-primary-700">${icon("eye", "w-4 h-4")}</a>${i.docstatus === 0 ? `<a href="#/counters/${encodeURIComponent(i.name)}/edit" class="text-primary hover:text-primary-700">${icon("pencil-square", "w-4 h-4")}</a>` : ""}<button data-del-i="${escapeHtml(i.name)}" class="text-red-600 hover:text-red-800">${icon("trash", "w-4 h-4")}</button></span>`, "text-right")}
      </tr>`;
    }).join("");
    table.innerHTML = dataTable(`${th("")}${sortTh("Invoice No.", "invoice_no", sortState)}${sortTh("Date", "invoice_date", sortState)}${th("Customer")}${th("Payment")}${sortTh("Grand Total", "grand_total", sortState)}${th("Actions", "text-right")}`, rows, "receipt-percent", "No counter invoices yet.");
    bindSort(table, sortState, load);
    bindBulkDelete(view, table);
    table.querySelectorAll("[data-del-i]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm(`Delete counter invoice ${b.dataset.delI}?`)) return;
      try {
        await api.bulkDelete("Counter Invoice", [b.dataset.delI]);
        load();
      } catch (e) { alert(e.message); }
    }));
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
      ${inv.docstatus === 1 ? button("Print Receipt", { variant: "secondary", attrs: `data-print="${inv.name}"` }) : button("Edit", { variant: "secondary", href: `#/counters/${encodeURIComponent(inv.name)}/edit` }) + button("Submit", { variant: "primary", attrs: `data-submit="${inv.name}"` })}
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
  const header = `<h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("receipt-percent", "w-6 h-6 text-primary")}New Counter Invoice</h2>`;
  const content = `<div class="py-6"><div class="max-w-5xl mx-auto sm:px-6 lg:px-8 space-y-6">${card(`
    <form id="ci-form" class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>${fieldLabel("Invoice Date", "cid")}${textInput("invoice_date", new Date().toISOString().slice(0, 10), "date")}</div>
        <div>${fieldLabel("Payment Mode", "pm")}<select name="payment_mode" id="pm" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm"><option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Cheque</option></select></div>
      </div>
      <div class="flex items-center gap-6">
        <label class="inline-flex items-center gap-2 text-sm"><input type="radio" name="customer_type" value="existing" checked class="text-primary"> Existing customer</label>
        <label class="inline-flex items-center gap-2 text-sm"><input type="radio" name="customer_type" value="walkin" class="text-primary"> Walk-in</label>
      </div>
      <div id="ci-existing">${fieldLabel("Customer", "ccb")}<div id="ccb-slot"></div></div>
      <div id="ci-walkin" class="hidden grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>${fieldLabel("Walk-in Name", "wn")}${textInput("walkin_name")}</div>
        <div>${fieldLabel("Walk-in Mobile", "wm")}${textInput("walkin_mobile")}</div>
      </div>
      <div id="ci-lines" class="space-y-2"></div>
      ${button(`${icon("plus", "w-4 h-4")}Add Item`, { variant: "secondary", attrs: `data-add-line="" type="button"` })}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>${fieldLabel("Discount Type", "dt")}<select name="discount_type" id="dt" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm"><option value="percentage">Percentage</option><option value="amount">Amount</option></select></div>
        <div>${fieldLabel("Discount Value", "dv")}${textInput("discount_value", "0", "number")}</div>
      </div>
      <label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" name="gst_applicable" checked value="1" class="rounded border-gray-300 text-primary"> GST applicable</label>
      <div class="max-w-md ml-auto text-sm space-y-1" id="ci-totals"></div>
      <div class="flex justify-end gap-2">
        ${button("Cancel", { variant: "ghost", href: "#/counters" })}
        ${button("Save Invoice", { variant: "primary", type: "submit" })}
      </div>
    </form>`)}
  </div></div>`;
  return { header, content };
}

function bindCounterCreate(view) {
  const box = view.querySelector("#ci-lines");
  const addBtn = view.querySelector("[data-add-line]");
  const form = view.querySelector("#ci-form");
  const totals = view.querySelector("#ci-totals");
  // customer type toggle
  view.querySelectorAll('input[name="customer_type"]').forEach((r) => r.addEventListener("change", () => {
    const walkin = form.customer_type.value === "walkin";
    view.querySelector("#ci-existing").classList.toggle("hidden", walkin);
    view.querySelector("#ci-walkin").classList.toggle("hidden", !walkin);
    view.querySelector("#ci-walkin").classList.toggle("grid", walkin);
  }));
  // customer combobox
  view.querySelector("#ccb-slot").innerHTML = combobox({
    name: "customer", endpoint: "ev_workshop.workshop_api.search_customers", placeholder: "Search customer...",
  });
  function calc() {
    let sub = 0;
    box.querySelectorAll("[data-crow]").forEach((r) => {
      const q = Number(r.querySelector('[name="c_qty"]').value) || 0;
      const mrp = Number(r.querySelector('[name="c_mrp"]').value) || 0;
      const dp = Number(r.querySelector('[name="c_disc"]').value) || 0;
      const line = q * mrp * (1 - dp / 100);
      r.querySelector("[data-line]").textContent = "₹" + line.toFixed(2);
      sub += line;
    });
    const dtype = form.discount_type.value;
    const dval = Number(form.discount_value.value) || 0;
    const disc = dtype === "percentage" ? sub * dval / 100 : dval;
    const grand = Math.round(Math.max(sub - disc, 0));
    totals.innerHTML = `<div class="flex justify-between"><span>Subtotal</span><span>₹${sub.toFixed(2)}</span></div>
      <div class="flex justify-between"><span>Discount</span><span>₹${disc.toFixed(2)}</span></div>
      <div class="flex justify-between font-bold text-lg border-t pt-2"><span>Grand Total</span><span>₹${grand.toFixed(2)}</span></div>`;
  }
  function addLine() {
    const div = document.createElement("div");
    div.setAttribute("data-crow", "");
    div.className = "grid grid-cols-2 md:grid-cols-5 gap-2 items-end border border-border rounded-md p-2";
    div.innerHTML = `<div class="col-span-2">${fieldLabel("Part")}<div data-cb></div></div>
      <div>${fieldLabel("Qty")}${textInput("c_qty", "1", "number")}</div>
      <div>${fieldLabel("MRP")}${textInput("c_mrp", "0", "number")}</div>
      <div>${fieldLabel("Disc %")}${textInput("c_disc", "0", "number")}</div>
      <div class="col-span-4 flex items-center justify-between"><span data-line class="text-sm font-medium">₹0.00</span>${button("Remove", { variant: "danger", attrs: `data-remove="" type="button"` })}</div>`;
    box.appendChild(div);
    div.querySelector("[data-cb]").innerHTML = combobox({
      name: "c_item", endpoint: "ev_workshop.workshop_api.search_parts", placeholder: "Search part...",
      onSelected: (rec) => {
        div.querySelector('[name="c_mrp"]').value = rec.mrp || 0;
        calc();
      },
    });
    div.querySelector("[data-remove]").addEventListener("click", () => { div.remove(); calc(); });
    div.addEventListener("input", calc);
  }
  addBtn.addEventListener("click", addLine);
  addLine();
  form.addEventListener("input", calc);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const walkin = fd.get("customer_type") === "walkin";
    const lines = [...box.querySelectorAll("[data-crow]")].map((div) => ({
      item_master: div.querySelector('[name="c_item"]').value,
      qty: Number(div.querySelector('[name="c_qty"]').value),
      mrp: Number(div.querySelector('[name="c_mrp"]').value),
      discount_percent: Number(div.querySelector('[name="c_disc"]').value) || 0,
    })).filter((x) => x.item_master && x.qty > 0);
    if (!lines.length) {
      alert("Add at least one item.");
      return;
    }
    const payload = {
      invoice_date: fd.get("invoice_date"),
      gst_applicable: fd.get("gst_applicable") ? 1 : 0,
      discount_percent: fd.get("discount_type") === "percentage" ? Number(fd.get("discount_value")) || 0 : 0,
      discount_amount: fd.get("discount_type") === "amount" ? Number(fd.get("discount_value")) || 0 : 0,
      items: lines,
    };
    if (walkin) {
      payload.walkin_name = fd.get("walkin_name");
      payload.walkin_mobile = fd.get("walkin_mobile");
    } else {
      payload.customer = fd.get("customer");
    }
    try {
      const r = await api.createCounter(payload);
      window.location.hash = `#/counters/${encodeURIComponent(r.name)}`;
    } catch (ex) { alert(ex.message); }
  });
  calc();
}

export async function CounterEditView(name) {
  const [docname] = String(name).split("?");
  let d;
  try {
    d = await api.counter(docname);
  } catch (e) {
    return { header: "Edit Counter Invoice", content: `<p class="text-sm text-red-600">${e.message}</p>` };
  }
  const inv = d.invoice;
  if (inv.docstatus !== 0) {
    return { header: "Edit Counter Invoice", content: `<p class="text-sm text-red-600">Only draft counter invoices can be edited.</p>` };
  }
  const header = `<h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("receipt-percent", "w-6 h-6 text-primary")}Edit Counter Invoice ${escapeHtml(inv.name)}</h2>`;
  const content = `<div class="py-6"><div class="max-w-5xl mx-auto sm:px-6 lg:px-8 space-y-6">${card(`
    <form id="ci-edit" class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>${fieldLabel("Invoice Date", "cid")}${textInput("invoice_date", (inv.invoice_date || "").slice(0, 10), "date")}</div>
        <div>${fieldLabel("Walk-in Name", "wn")}${textInput("walkin_name", inv.walkin_name || "")}</div>
        <div>${fieldLabel("Walk-in Mobile", "wm")}${textInput("walkin_mobile", inv.walkin_mobile || "")}</div>
        <div>${fieldLabel("Discount %", "dp")}${textInput("discount_percent", inv.discount_percent || 0, "number")}</div>
      </div>
      <div id="ci-lines" class="space-y-2"></div>
      ${button(`${icon("plus", "w-4 h-4")}Add Item`, { variant: "secondary", attrs: `data-add-line="" type="button"` })}
      <div class="flex justify-end gap-2">
        ${button("Cancel", { variant: "ghost", href: `#/counters/${encodeURIComponent(inv.name)}` })}
        ${button("Update", { variant: "primary", type: "submit" })}
      </div>
    </form>`)}
  </div></div>`;
  return { header, content };
}

CounterEditView.mounted = async (view, m) => {
  const [docname] = String(decodeURIComponent(m[1])).split("?");
  let d;
  try {
    d = await api.counter(docname);
  } catch {
    return;
  }
  const box = view.querySelector("#ci-lines");
  function addLine(row = {}) {
    const div = document.createElement("div");
    div.setAttribute("data-crow", "");
    div.className = "grid grid-cols-2 md:grid-cols-5 gap-2 items-end border border-border rounded-md p-2";
    div.innerHTML = `<div class="col-span-2">${fieldLabel("Item code")}${textInput("c_item", row.item_master || "")}</div>
      <div>${fieldLabel("Qty")}${textInput("c_qty", row.qty || 1, "number")}</div>
      <div>${fieldLabel("MRP")}${textInput("c_mrp", row.mrp || 0, "number")}</div>
      <div>${fieldLabel("Disc %")}${textInput("c_disc", row.discount_percent || 0, "number")}</div>
      <div class="col-span-4 flex justify-end">${button("Remove", { variant: "danger", attrs: `data-remove="" type="button"` })}</div>`;
    box.appendChild(div);
    div.querySelector("[data-remove]").addEventListener("click", () => div.remove());
  }
  (d.invoice.items || []).forEach((r) => addLine(r));
  view.querySelector("[data-add-line]").addEventListener("click", () => addLine());
  view.querySelector("#ci-edit").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const items = [...box.querySelectorAll("[data-crow]")].map((div) => ({
      item_master: div.querySelector('[name="c_item"]').value.trim(),
      qty: Number(div.querySelector('[name="c_qty"]').value) || 0,
      mrp: Number(div.querySelector('[name="c_mrp"]').value) || 0,
      discount_percent: Number(div.querySelector('[name="c_disc"]').value) || 0,
    })).filter((x) => x.item_master && x.qty > 0);
    try {
      await api.updateCounter(docname, {
        invoice_date: fd.get("invoice_date"), walkin_name: fd.get("walkin_name"),
        walkin_mobile: fd.get("walkin_mobile"), discount_percent: Number(fd.get("discount_percent")) || 0, items,
      });
      window.location.hash = `#/counters/${encodeURIComponent(docname)}`;
    } catch (ex) { alert(ex.message); }
  });
};
