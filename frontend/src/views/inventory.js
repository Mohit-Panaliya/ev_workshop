// inventory/index parity (parts + labour tabs, low-stock, export).
import { api } from "../api.js";
import { icon } from "../icons.js";
import { badge, button, card, dataTable, th, td, fieldLabel, textInput, money, escapeHtml } from "../ui.js";
import { importButton, bindImport, exportDropdown, bindExportDropdown } from "../list.js";

export async function InventoryView() {
  const header = `<h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("cube", "w-6 h-6 text-primary")}Inventory</h2>`;
  const content = `<div class="py-6"><div class="max-w-full sm:px-6 lg:px-8 space-y-4">
    <div class="flex gap-1 border-b border-border" id="inv-tabs">
      <button data-tab="parts" class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px border-primary text-primary">Spare Parts</button>
      <button data-tab="labour" class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px border-transparent text-gray-500 hover:text-gray-700">Labour</button>
    </div>
    <form id="inv-filter" class="flex gap-3 items-end"><div class="flex-1">
      <div class="relative"><input type="text" name="search" placeholder="Search parts..." class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">${icon("magnifying-glass", "h-5 w-5 text-gray-400")}</div></div>
    </div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1">Class</label><select name="category" class="border-gray-300 rounded-lg"><option value="">All</option><option>Spare Part</option><option>Service</option><option>Consumable</option></select></div>
    <label class="flex items-center gap-2 h-10 px-3 border border-gray-300 rounded-lg bg-white text-sm text-gray-700"><input type="checkbox" name="low_only" value="1" class="rounded border-gray-300 text-primary">Low stock only</label>
    ${button(`${icon("magnifying-glass", "w-4 h-4")}Search`, { type: "submit" })}
    ${exportDropdown("items")}
    ${importButton("parts", "item_no,item_name,item_class,uom,standard_rate,hsn_code")}</form>
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
        const rows = await api.parts({ search: fd.get("search") || undefined, category: fd.get("category") || undefined, low_stock: fd.get("low_only") ? true : undefined, limit: 100 });
        const html = rows.map((p) => `<tr class="group hover:bg-muted/50">
          ${td(`<span class="font-medium">${escapeHtml(p.item_name)}</span><br><span class="text-xs text-gray-500">${escapeHtml(p.item_no)}</span>`)}
          ${td(escapeHtml(p.item_class || "-"))}
          ${td(money(p.standard_rate), "text-right")}
          ${td(money(p.labor_charge), "text-right")}
          ${td(money(Number(p.standard_rate || 0) + Number(p.labor_charge || 0)), "text-right font-medium")}
          ${td(p.low ? badge("red", `Low: ${p.balance}`) : `${p.balance}`, "text-right font-medium")}
        </tr>`).join("");
        table.innerHTML = dataTable(`${th("Part")}${th("Class")}${th("MRP", "text-right")}${th("Labor", "text-right")}${th("Total", "text-right")}${th("Stock", "text-right")}`, html, "cube", "No parts found.");
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
  bindImport(view, load);
  const labourBtn = document.createElement("div");
  labourBtn.innerHTML = `<div class="mt-4">${card(`<details><summary class="cursor-pointer font-semibold text-gray-900">Add Labour Rate</summary>
    <form id="labour-form" class="grid grid-cols-2 gap-3 mt-3">
      <div>${fieldLabel("Service Name")}${textInput("service_name", "", "text", "required")}</div>
      <div>${fieldLabel("Category")}<select name="category" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm transition-colors focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shadow-sm"><option>Battery</option><option>Motor</option><option>Brakes</option><option>Electrical</option><option>General</option><option>Other</option></select></div>
      <div>${fieldLabel("Standard Rate")}${textInput("standard_rate", "0", "number")}</div>
      <div>${fieldLabel("GST %")}${textInput("gst_rate", "18", "number")}</div>
      <div class="col-span-2 flex justify-end">${button("Create", { variant: "primary", type: "submit" })}</div>
    </form>`)}</div>`;
  view.appendChild(labourBtn);
  labourBtn.querySelector("#labour-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.createLabour(Object.fromEntries(new FormData(e.target).entries()));
      window.location.reload();
    } catch (ex) { alert(ex.message); }
  });
  view.querySelectorAll("#inv-tabs button").forEach((b) => b.addEventListener("click", () => {
    tab = b.dataset.tab;
    view.querySelectorAll("#inv-tabs button").forEach((x) => {
      x.className = "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 " + (x === b ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700");
    });
    load();
  }));
  bindExportDropdown(view, "items", () => {
    const fd = new FormData(form);
    return { search: fd.get("search") || undefined };
  });
  const partBtn = document.createElement("div");
  partBtn.innerHTML = `<div class="mt-4">${card(`<details><summary class="cursor-pointer font-semibold text-gray-900">Add Spare Part</summary>
    <form id="part-form" class="grid grid-cols-2 gap-3 mt-3">
      <div>${fieldLabel("Part Name")}${textInput("item_name", "", "text", "required")}</div>
      <div>${fieldLabel("Category")}<select name="category" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm" required>
        <option>Spare Part</option><option>Service</option><option>Consumable</option></select></div>
      <div>${fieldLabel("Unit")}<select name="uom" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm"><option>Nos</option><option>Sets</option><option>Hours</option><option>Liters</option></select></div>
      <div>${fieldLabel("Purchase Price")}${textInput("purchase_price", "0", "number")}</div>
      <div>${fieldLabel("MRP")}${textInput("standard_rate", "0", "number")}</div>
      <div>${fieldLabel("Labor Charge")}${textInput("labor_charge", "0", "number")}</div>
      <div>${fieldLabel("HSN Code")}${textInput("hsn_code")}</div>
      <div>${fieldLabel("GST %")}${textInput("gst_rate", "18", "number")}</div>
      <div>${fieldLabel("Reorder Level")}${textInput("min_qty", "0", "number")}</div>
      <div class="col-span-2 flex justify-end">${button("Create", { variant: "primary", type: "submit" })}</div>
    </form>`)}</div>`;
  view.appendChild(partBtn);
  partBtn.querySelector("#part-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.createPart(Object.fromEntries(new FormData(e.target).entries()));
      window.location.reload();
    } catch (ex) { alert(ex.message); }
  });
  await load();
};
