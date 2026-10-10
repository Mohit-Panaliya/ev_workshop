// Shared frontend pieces mirroring Blade components + Alpine behaviors.
import { api } from "./api.js";
import { icon } from "./icons.js";
import { escapeHtml } from "./ui.js";

// Toast result bar (tableSelection result pattern, sessionStorage-backed).
export function toast(type, message) {
  const host = document.getElementById("toast-host") || document.body;
  const colors = {
    success: "bg-green-100 border-green-300 text-green-800",
    warning: "bg-amber-50 border-amber-300 text-amber-800",
    error: "bg-red-100 border-red-300 text-red-800",
  };
  const el = document.createElement("div");
  el.className = `mb-4 flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm ${colors[type] || colors.success}`;
  el.innerHTML = `<span></span><button type="button" class="shrink-0 text-muted-foreground hover:text-gray-700">${icon("x-mark", "w-4 h-4")}</button>`;
  el.querySelector("span").textContent = message;
  el.querySelector("button").addEventListener("click", () => el.remove());
  host.prepend(el);
  setTimeout(() => el.remove(), 8000);
}

export function flashBulkResult() {
  try {
    const raw = sessionStorage.getItem("gms.bulkResult");
    if (!raw) return;
    sessionStorage.removeItem("gms.bulkResult");
    const data = JSON.parse(raw);
    toast(data.skipped_count > 0 ? "warning" : "success", data.message);
  } catch { /* ignore */ }
}

// Per-row view/edit/delete actions (data-table-actions parity).
export function rowActions(viewHref, editHref, onDelete) {
  const id = `ra-${Math.random().toString(36).slice(2)}`;
  setTimeout(() => {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelector("[data-ra-delete]").addEventListener("click", onDelete);
  });
  return `<span id="${id}" class="inline-flex items-center gap-3">
    <a href="${viewHref}" title="View" class="text-primary hover:text-primary-700">${icon("eye", "w-5 h-5")}</a>
    <a href="${editHref}" title="Edit" class="text-primary hover:text-primary-700">${icon("pencil-square", "w-5 h-5")}</a>
    <button type="button" data-ra-delete title="Delete" class="text-red-600 hover:text-red-800">${icon("trash", "w-5 h-5")}</button>
  </span>`;
}

// Searchable combobox (searchable-combobox parity): text input + hidden id,
// debounced fetch, keyboard nav, clear button, selected/cleared callbacks.
export function combobox({ name, endpoint, placeholder = "-- Search --", initialId = "", initialLabel = "", required = false, onSelected = null, onCleared = null }) {
  const id = `cb-${Math.random().toString(36).slice(2)}`;
  setTimeout(() => {
    const root = document.getElementById(id);
    if (!root) return;
    const input = root.querySelector("input[type=text]");
    const hidden = root.querySelector("input[type=hidden]");
    const list = root.querySelector("ul");
    let results = [];
    let timer = null;
    async function fetchResults(q) {
      try {
        const r = await api.combobox(endpoint, q);
        results = Array.isArray(r) ? r : [];
      } catch {
        results = [];
      }
      list.innerHTML = results.map((r, i) => `<li><button type="button" data-i="${i}" class="w-full text-left px-3 py-2 text-sm hover:bg-accent">${escapeHtml(r.label)}</button></li>`).join("");
      list.parentElement.style.display = results.length ? "" : "none";
      list.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => select(results[Number(b.dataset.i)])));
    }
    function select(rec) {
      hidden.value = rec.id;
      input.value = rec.label;
      list.parentElement.style.display = "none";
      if (onSelected) onSelected(rec);
    }
    input.addEventListener("input", () => {
      hidden.value = "";
      if (onCleared) onCleared();
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) {
        list.parentElement.style.display = "none";
        return;
      }
      timer = setTimeout(() => fetchResults(q), 250);
    });
    input.addEventListener("focus", () => {
      if (input.value.trim().length >= 2) fetchResults(input.value.trim());
    });
    document.addEventListener("mousedown", (e) => {
      if (!root.contains(e.target)) list.parentElement.style.display = "none";
    });
    root.querySelector("[data-clear]").addEventListener("click", () => {
      input.value = "";
      hidden.value = "";
      list.parentElement.style.display = "none";
      if (onCleared) onCleared();
    });
  });
  return `<div id="${id}" class="relative">
    <input type="text" value="${escapeHtml(initialLabel)}" placeholder="${placeholder}" autocomplete="off"
      class="w-full pr-8 h-10 px-3 py-2 border border-gray-300 rounded-md bg-white text-sm">
    <input type="hidden" name="${name}" value="${escapeHtml(initialId)}" ${required ? "required" : ""}>
    <button type="button" data-clear title="Clear" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">${icon("x-mark", "w-4 h-4")}</button>
    <div style="display:none;" class="absolute z-30 mt-1 w-full rounded-md border border-border bg-card shadow-lg max-h-56 overflow-y-auto"><ul></ul></div>
  </div>`;
}

// Simple modal (x-modal parity).
export function openModal(title, bodyHtml, maxWidth = "max-w-lg") {
  closeModal();
  const wrap = document.createElement("div");
  wrap.id = "modal-root";
  wrap.className = "fixed inset-0 z-50 flex items-center justify-center p-4";
  wrap.innerHTML = `<div class="absolute inset-0 bg-gray-900/50" data-close></div>
    <div class="relative bg-card rounded-lg shadow-xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between px-6 py-4 border-b border-border">
        <h3 class="font-semibold text-gray-900">${title}</h3>
        <button type="button" data-close class="text-gray-400 hover:text-gray-600">${icon("x-mark", "w-5 h-5")}</button>
      </div>
      <div class="p-6">${bodyHtml}</div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeModal));
  document.addEventListener("keydown", escClose);
  return wrap;
}

function escClose(e) {
  if (e.key === "Escape") closeModal();
}

export function closeModal() {
  document.getElementById("modal-root")?.remove();
  document.removeEventListener("keydown", escClose);
}

// Active filters bar (pills + clear).
export function activeFiltersBar(filters, baseHash) {
  const pills = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `<a href="${baseHash}?${k}=" class="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-xs font-medium">${escapeHtml(k)}: ${escapeHtml(String(v))} ×</a>`)
    .join("");
  if (!pills) return "";
  return `<div class="flex flex-wrap items-center gap-2">${pills}<a href="${baseHash}" class="text-xs text-primary hover:underline">Clear All</a></div>`;
}

// Global double-submit guard (app.js parity).
document.addEventListener("submit", (e) => {
  const form = e.target;
  if (form.dataset.guarded === "1") {
    e.preventDefault();
    return;
  }
  form.dataset.guarded = "1";
  const btn = e.submitter || form.querySelector('[type="submit"]');
  if (btn) btn.disabled = true;
  setTimeout(() => {
    form.dataset.guarded = "";
    if (btn) btn.disabled = false;
  }, 8000);
});
