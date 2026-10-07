// Shared list helpers: bulk delete + CSV import (Laravel bulk/import parity).
import { api } from "./api.js";
import { button } from "./ui.js";

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

export function importButton(entity, acceptHint) {
  return `<label class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md h-10 px-4 py-2 text-sm font-medium shadow-sm border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer">
    Import CSV<input type="file" accept=".csv" data-import="${entity}" class="hidden">
  </label><span class="text-xs text-gray-500">${acceptHint}</span>`;
}

export function bindImport(view, onDone) {
  view.querySelectorAll("[data-import]").forEach((input) => {
    input.addEventListener("change", () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const lines = String(reader.result).split(/\r?\n/).filter((l) => l.trim());
          const rows = lines.slice(1).map((l) => l.split(",").map((c) => c.trim()));
          const r = await api.importCsv(input.dataset.import, rows);
          alert(r.message + (r.errors.length ? `\nRow errors: ${r.errors.map((e) => `${e.row}: ${e.error}`).join("; ")}` : ""));
          if (onDone) onDone();
        } catch (e) {
          alert(e.message);
        }
        input.value = "";
      };
      reader.readAsText(file);
    });
  });
}

export { button };
