// Shared list helpers: bulk delete + CSV import (Laravel bulk/import parity).
import { api } from "./api.js";
import { button } from "./ui.js";
import { toast, openModal, closeModal } from "./components.js";
import { escapeHtml } from "./ui.js";

export function bindBulkDelete(view, table) {
  const btn = view.querySelector('[data-action="bulk-delete"]');
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const names = [...table.querySelectorAll("input[type=checkbox][data-name]:checked")].map((c) => c.dataset.name);
    if (!names.length) {
      alert("Select at least one row.");
      return;
    }
    if (!confirm(`Delete ${names.length} record(s)? This cannot be undone.`)) return;
    try {
      const r = await api.bulkDelete(btn.dataset.doctype, names);
      alert(r.message + (r.skipped.length ? `\nSkipped: ${r.skipped.map((s) => s.name).join(", ")}` : ""));
      window.location.reload();
    } catch (e) {
      alert(e.message);
    }
  });
}

export function exportDropdown(entity, filteredQuery) {
  return `<div class="relative" data-dropdown-root="exp-${entity}">
    <div><button type="button" data-dropdown="exp-${entity}" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md h-10 px-4 py-2 text-sm font-medium shadow-sm transition-colors border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-sm">Export</button></div>
    <div data-dropdown-menu="exp-${entity}" style="display:none;" class="absolute z-50 mt-2 64 rounded-md shadow-lg ltr:origin-top-left rtl:origin-top-right end-0">
      <div class="rounded-md ring-1 ring-black ring-opacity-5 py-1 bg-card">
        <a href="#" data-exp="all" class="block w-full px-4 py-2 text-start text-sm leading-5 text-gray-700 hover:bg-accent">Export All (CSV)</a>
        <a href="#" data-exp="filtered" class="block w-full px-4 py-2 text-start text-sm leading-5 text-gray-700 hover:bg-accent">Export Filtered (CSV)</a>
        <a href="#" data-exp="template" class="block w-full px-4 py-2 text-start text-sm leading-5 text-gray-700 hover:bg-accent">Download Template (CSV)</a>
      </div>
    </div>
  </div>`;
}

export function bindExportDropdown(view, entity, getFilters) {
  view.querySelectorAll(`[data-dropdown-root="exp-${entity}"] [data-exp]`).forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    const kind = a.dataset.exp;
    if (kind === "all") window.open(`/api/method/ev_workshop.workshop_api.export_csv?entity=${entity}`, "_blank");
    else if (kind === "template") window.open(`/api/method/ev_workshop.workshop_api.template_csv?entity=${entity}`, "_blank");
    else {
      const q = new URLSearchParams();
      Object.entries(getFilters()).forEach(([k, v]) => { if (v) q.append(k, v); });
      window.open(`/api/method/ev_workshop.workshop_api.export_csv?entity=${entity}&${q.toString()}`, "_blank");
    }
  }));
}
export function importButton(entity, acceptHint) {
  return `<button type="button" data-import-modal="${entity}" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md h-10 px-4 py-2 text-sm font-medium shadow-sm border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-sm">Import CSV</button><span class="text-xs text-gray-500">${acceptHint}</span>`;
}

export function bindImport(view, onDone) {
  view.querySelectorAll("[data-import-modal]").forEach((btn) => btn.addEventListener("click", () => {
    openImportModal(btn.dataset.importModal, onDone);
  }));
}

export function openImportModal(entity, onDone) {
  const titles = { customers: "Import Customers", parts: "Import Spare Parts", labour: "Import Labour", brands: "Import Brands" };
  const hints = {
    customers: "customer_name,mobile_no,email_id",
    parts: "item_no,item_name,item_class,uom,standard_rate,hsn_code",
    labour: "service_name,category,standard_rate,gst_rate",
    brands: "brand_name",
  };
  const wrap = openModal(titles[entity] || `Import ${entity}`, `
    <p class="text-sm text-gray-600 mb-4">Columns: <code>${hints[entity] || ""}</code> (first row is the header and is skipped).</p>
    <input type="file" id="imp-file" accept=".csv" class="block w-full text-sm">
    <div id="imp-preview" class="mt-4"></div>
    <div class="flex justify-end gap-2 mt-4">
      <button type="button" data-imp-cancel class="inline-flex items-center justify-center gap-2 rounded-md h-10 px-4 py-2 text-sm font-medium hover:bg-accent">Cancel</button>
      <button type="button" data-imp-confirm disabled class="inline-flex items-center justify-center gap-2 rounded-md h-10 px-4 py-2 text-sm font-medium shadow-sm bg-primary text-primary-foreground opacity-50">Confirm Import</button>
    </div>`);
  let parsed = [];
  wrap.querySelector("[data-imp-cancel]").addEventListener("click", closeModal);
  wrap.querySelector("#imp-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const lines = String(reader.result).split(/\r?\n/).filter((l) => l.trim());
      parsed = lines.slice(1).map((l) => l.split(",").map((c) => c.trim()));
      const box = wrap.querySelector("#imp-preview");
      box.innerHTML = `<p class="text-sm text-gray-500">Validating ${parsed.length} rows…</p>`;
      try {
        const r = await api.importCsv(entity, parsed, true);
        box.innerHTML = `<p class="text-sm font-medium ${r.errors.length ? "text-amber-700" : "text-green-700"}">${r.message}</p>` +
          (r.errors.length ? `<ul class="text-xs text-red-600 mt-2 max-h-40 overflow-y-auto">${r.errors.map((x) => `<li>Row ${x.row}: ${escapeHtml(x.error)}</li>`).join("")}</ul>` : "");
        const btn = wrap.querySelector("[data-imp-confirm]");
        btn.disabled = false;
        btn.classList.remove("opacity-50");
      } catch (ex) {
        box.innerHTML = `<p class="text-sm text-red-600">${ex.message}</p>`;
      }
    };
    reader.readAsText(file);
  });
  wrap.querySelector("[data-imp-confirm]").addEventListener("click", async () => {
    try {
      const r = await api.importCsv(entity, parsed, false);
      closeModal();
      toast(r.errors.length ? "warning" : "success", r.message);
      if (onDone) onDone();
    } catch (e) {
      alert(e.message);
    }
  });
}

export { button };
