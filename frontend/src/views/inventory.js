// inventory/index parity (parts + labour tabs, low-stock, export).
import { api } from "../api.js";
import { icon } from "../icons.js";
import { badge, button, card, dataTable, th, td, fieldLabel, money, escapeHtml } from "../ui.js";

export async function InventoryView() {
  const header = `<h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("cube", "w-6 h-6 text-primary")}Inventory</h2>`;
  const content = `<div class="py-6"><div class="max-w-full sm:px-6 lg:px-8 space-y-4">
    <div class="flex gap-1 border-b border-border" id="inv-tabs">
      <button data-tab="parts" class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px border-primary text-primary">Spare Parts</button>
      <button data-tab="labour" class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px border-transparent text-gray-500 hover:text-gray-700">Labour</button>
    </div>
    <form id="inv-filter" class="flex gap-3"><div class="flex-1">
      <div class="relative"><input type="text" name="search" placeholder="Search parts..." class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">${icon("magnifying-glass", "h-5 w-5 text-gray-400")}</div></div>
    </div>${button(`${icon("magnifying-glass", "w-4 h-4")}Search`, { type: "submit" })}
    ${button("Export", { variant: "secondary", attrs: `data-action="export"` })}</form>
    <div id="inv-table"></div>
  </div></div>`;
  return { header, content };
}

InventoryView.mounted = async (view) => {
  const table = view.querySelector("#inv-table");
  const form = view.querySelector("#inv-filter");
  let tab = "parts";
  async function load() {
    const fd = new FormData(form);
    try {
      if (tab === "parts") {
        const rows = await api.parts({ search: fd.get("search") || undefined, limit: 100 });
        const html = rows.map((p) => `<tr class="group hover:bg-muted/50">
          ${td(`<span class="font-medium">${escapeHtml(p.item_name)}</span><br><span class="text-xs text-gray-500">${escapeHtml(p.item_no)}</span>`)}
          ${td(escapeHtml(p.item_class || "-"))}
          ${td(money(p.standard_rate), "text-right")}
          ${td(p.low ? badge("red", `Low: ${p.balance}`) : `${p.balance}`, "text-right font-medium")}
        </tr>`).join("");
        table.innerHTML = dataTable(`${th("Part")}${th("Class")}${th("MRP", "text-right")}${th("Stock", "text-right")}`, html, "cube", "No parts found.");
      } else {
        const rows = await api.labour({});
        const html = rows.map((l) => `<tr class="group hover:bg-muted/50">
          ${td(`<span class="font-medium">${escapeHtml(l.service_name)}</span>`)}
          ${td(`<span class="capitalize">${escapeHtml(l.category || "-")}</span>`)}
          ${td(money(l.standard_rate), "text-right")}
          ${td(`${l.gst_rate || 0}%`, "text-right")}
        </tr>`).join("");
        table.innerHTML = dataTable(`${th("Service")}${th("Category")}${th("Rate", "text-right")}${th("GST", "text-right")}`, html, "cube", "No labour rates found.");
      }
    } catch (e) {
      table.innerHTML = `<p class="text-sm text-red-600">${e.message}</p>`;
    }
  }
  form.addEventListener("submit", (e) => { e.preventDefault(); load(); });
  view.querySelectorAll("#inv-tabs button").forEach((b) => b.addEventListener("click", () => {
    tab = b.dataset.tab;
    view.querySelectorAll("#inv-tabs button").forEach((x) => {
      x.className = "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 " + (x === b ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700");
    });
    load();
  }));
  view.querySelector('[data-action="export"]').addEventListener("click", () => {
    window.open(`/api/method/ev_workshop.workshop_api.export_csv?entity=items`, "_blank");
  });
  await load();
};
