// vehicle_catalog/index parity (brands + expandable models).
import { api } from "../api.js";
import { icon } from "../icons.js";
import { badge, button, card, dataTable, th, td, fieldLabel, textInput, escapeHtml } from "../ui.js";
import { openModal, closeModal } from "../components.js";

export async function CatalogView() {
  const header = `<div class="flex justify-between items-center">
    <h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("book-open", "w-6 h-6 text-primary")}Vehicle Catalog</h2>
  </div>`;
  const content = `<div class="py-6"><div class="max-w-full sm:px-6 lg:px-8 space-y-4"><div id="cat-table"></div>
  <p class="text-xs text-gray-500">Brands and models are managed in Desk (Vehicle Brand / Vehicle Model).</p></div></div>`;
  return { header, content };
}

CatalogView.mounted = async (view) => {
  const table = view.querySelector("#cat-table");
  let brands = [];
  try {
    brands = await api.catalog();
  } catch (e) {
    table.innerHTML = `<p class="text-sm text-red-600">${e.message}</p>`;
    return;
  }
  const rows = brands.map((b, i) => `<tr class="group hover:bg-muted/50" data-brand="${i}">
      ${td(`<span class="truncate max-w-[200px] block font-medium">${escapeHtml(b.brand_name)}</span>`)}
      ${td(`${b.models.length} model(s)`)}
      ${td(`<button data-expand="${i}" class="inline-flex items-center justify-center rounded-md p-1 text-gray-500 hover:bg-accent">${icon("chevron-down", "w-4 h-4")}</button>`, "text-right")}
    </tr>
    <tr class="hidden bg-muted/60" data-models="${i}"><td colspan="3" class="align-middle px-6 py-2">
      <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Models</div>
      ${b.models.map((m) => `<div class="flex items-center gap-3 py-2 border-b border-border last:border-0">
        <span class="text-sm font-medium">${escapeHtml(m.model_name)}</span>${badge("gray", escapeHtml(m.battery_type || "—"))}
        <span class="ml-auto flex items-center gap-2">
          <button data-edit-model="${m.name}" data-brand="${b.name}" class="text-primary hover:text-primary-700">${icon("pencil-square", "w-4 h-4")}</button>
        </span>
      </div>`).join("") || `<p class="text-sm text-gray-500">No models.</p>`}
      <button data-edit-brand="${b.name}" data-brandname="${escapeHtml(b.brand_name)}" class="text-xs text-primary hover:underline mt-1">Rename brand</button>
    </td></tr>`).join("");
  table.innerHTML = dataTable(`${th("Brand")}${th("Models")}${th("")}`, rows, "book-open", "No brands found.");
  table.querySelectorAll("[data-edit-brand]").forEach((btn) => btn.addEventListener("click", () => {
    const name = prompt("Brand name:", btn.dataset.brandname);
    if (!name || name === btn.dataset.brandname) return;
    api.updateBrandModel("brand", btn.dataset.editBrand, { brand_name: name }).then(() => window.location.reload()).catch((e) => alert(e.message));
  }));
  table.querySelectorAll("[data-edit-model]").forEach((btn) => btn.addEventListener("click", () => {
    const wrap = openModal("Edit Model", `
      <form id="model-edit" class="grid grid-cols-2 gap-3">
        <div>${fieldLabel("Model Name")}${textInput("model_name", "", "text", "required")}</div>
        <div>${fieldLabel("Battery Type")}<select name="battery_type" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm"><option>Lithium-ion</option><option>Lead-acid</option><option>Other</option></select></div>
        <div class="col-span-2 flex justify-end gap-2">
          <button type="button" data-mclose class="inline-flex items-center h-10 px-4 text-sm hover:bg-accent rounded-md">Cancel</button>
          ${button("Update", { variant: "primary", type: "submit" })}
        </div>
      </form>`);
    wrap.querySelector("[data-mclose]").addEventListener("click", closeModal);
    wrap.querySelector("#model-edit").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await api.updateBrandModel("model", btn.dataset.editModel, Object.fromEntries(new FormData(e.target).entries()));
        closeModal();
        window.location.reload();
      } catch (ex) { alert(ex.message); }
    });
  }));
  table.querySelectorAll("[data-expand]").forEach((btn) => btn.addEventListener("click", () => {
    const row = table.querySelector(`[data-models="${btn.dataset.expand}"]`);
    row.classList.toggle("hidden");
  }));
  const add = document.createElement("div");
  add.innerHTML = `<div class="mt-4">${card(`<details><summary class="cursor-pointer font-semibold text-gray-900">Add Brand / Model</summary>
    <form id="cat-form" class="grid grid-cols-2 gap-3 mt-3">
      <div>${fieldLabel("Brand Name")}${textInput("brand_name", "", "text", "required")}</div>
      <div>${fieldLabel("Model Name (optional)")}${textInput("model_name")}</div>
      <div>${fieldLabel("Battery Type")}<select name="battery_type" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm transition-colors focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shadow-sm"><option>Lithium-ion</option><option>Lead-acid</option><option>Other</option></select></div>
      <div class="flex items-end">${button("Create", { variant: "primary", type: "submit" })}</div>
    </form>`)}</div>`;
  view.appendChild(add);
  add.querySelector("#cat-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.createBrandModel(Object.fromEntries(new FormData(e.target).entries()));
      window.location.reload();
    } catch (ex) { alert(ex.message); }
  });
};
