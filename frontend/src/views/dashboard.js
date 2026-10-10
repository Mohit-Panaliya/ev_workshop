// dashboard.blade.php parity.
import { api } from "../api.js";
import { icon } from "../icons.js";
import { badge, button, card, money, escapeHtml, pageHeader, statusBadge, JOB_STATUS_BADGES, JOB_STATUS_ICONS } from "../ui.js";

const DUE = "₹";

export async function DashboardView() {
  let d;
  try {
    d = await api.dashboard();
  } catch (e) {
    return { header: pageHeader("squares-2x2", "Dashboard"), content: `<div class="py-6"><div class="max-w-7xl mx-auto sm:px-6 lg:px-8"><p class="text-sm text-red-600">${e.message}</p></div></div>` };
  }
  const header = `<h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("squares-2x2", "w-6 h-6 text-primary")}Dashboard</h2>`;

  const statusChips = Object.entries(d.today_by_status || {})
    .filter(([, c]) => c > 0)
    .map(([s, c]) => {
      const label = s.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase());
      const ic = JOB_STATUS_ICONS[s] ? icon(JOB_STATUS_ICONS[s], "w-3.5 h-3.5") : "";
      const color = JOB_STATUS_BADGES[s] || JOB_STATUS_BADGES.default;
      return badge(color, `${ic}${label}: ${c}`);
    })
    .join("");

  const recent = (d.recent || []).map(
    (j) => `<li class="flex items-center justify-between gap-3 py-3">
      <div class="flex items-center gap-3 min-w-0">
        <span class="font-medium text-sm text-gray-900 shrink-0">${j.name}</span>
        <span class="text-sm text-gray-500 truncate">${j.customer_name || "-"}</span>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        ${statusBadge(JOB_STATUS_BADGES, j.status, JOB_STATUS_ICONS)}
        <a href="#/jobs/${encodeURIComponent(j.name)}" title="View" class="text-primary hover:text-primary-700">${icon("eye", "w-5 h-5")}</a>
      </div>
    </li>`
  ).join("");

  const content = `<div class="py-6"><div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
    <form id="dash-search" class="mb-6"><div class="flex gap-3"><div class="flex-1">
      <div class="relative"><input type="text" name="q" placeholder="Search customers, vehicles, job cards, invoices..." class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">${icon("magnifying-glass", "h-5 w-5 text-gray-400")}</div></div>
    </div>${button(`${icon("magnifying-glass", "w-4 h-4")}Search`, { type: "submit" })}</div></form>
    <div id="dash-results" class="mb-6"></div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      ${card(`<div class="flex items-center justify-between mb-4">
          <h3 class="flex items-center gap-2 text-base font-semibold text-gray-900">${icon("wrench-screwdriver", "w-5 h-5 text-primary")}Today's Job Cards</h3>
          <a href="#/jobs" class="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-700">View all ${icon("arrow-right", "w-4 h-4")}</a>
        </div>
        <div class="flex items-baseline gap-2 mb-4"><span class="text-3xl font-bold text-gray-900">${d.today_count}</span><span class="text-sm text-gray-500">received today</span></div>
        ${d.today_count > 0 ? `<div class="flex flex-wrap gap-2">${statusChips}</div>` : `<p class="text-sm text-gray-500">No job cards received today.</p>`}`, "sm:col-span-2 lg:col-span-2")}
      ${card(`<div class="flex items-center justify-between mb-4">
          <h3 class="flex items-center gap-2 text-sm font-semibold text-gray-900">${icon("banknotes", "w-5 h-5 text-primary")}This Month's Revenue</h3>
          <a href="#/analytics" title="View revenue report" class="text-gray-400 hover:text-primary">${icon("arrow-top-right-on-square", "w-4 h-4")}</a>
        </div>
        <div class="text-3xl font-bold text-gray-900">${DUE}${Number(d.month_revenue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
        <p class="text-sm text-gray-500 mt-2">Delivered job cards + counter invoices</p>`)}
      ${card(`<div class="flex items-center justify-between mb-4">
          <h3 class="flex items-center gap-2 text-sm font-semibold text-gray-900">${icon("exclamation-triangle", "w-5 h-5 text-primary")}Outstanding Dues</h3>
          <a href="#/analytics" title="View payments report" class="text-gray-400 hover:text-primary">${icon("arrow-top-right-on-square", "w-4 h-4")}</a>
        </div>
        <div class="text-3xl font-bold ${(d.outstanding_dues || 0) > 0 ? "text-red-600" : "text-gray-900"}">${money(d.outstanding_dues)}</div>
        <p class="text-sm ${(d.outstanding_dues || 0) > 0 ? "text-red-600" : "text-gray-500"} mt-2">unpaid across job cards &amp; invoices</p>`)}
      ${card(`<h3 class="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">${icon("bolt", "w-5 h-5 text-primary")}Quick Actions</h3>
        <div class="space-y-3">
          <p class="text-xs text-gray-500">Create job cards from a customer page.</p>
          ${button(`${icon("plus", "w-4 h-4")}New Counter Invoice`, { variant: "success", href: "#/counters/new", cls: "w-full" })}
        </div>`)}
      ${card(`<div class="flex items-center justify-between mb-4">
          <h3 class="flex items-center gap-2 text-base font-semibold text-gray-900">${icon("cube", "w-5 h-5 text-primary")}Low Stock</h3>
          <a href="#/inventory" class="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-700">View all ${icon("arrow-right", "w-4 h-4")}</a>
        </div>
        ${(d.low_stock || []).length ? `<ul class="divide-y divide-border">${d.low_stock.map((s) => `<li class="flex items-center justify-between gap-3 py-2"><span class="text-sm text-gray-900 truncate">${s.item_code}</span><span class="text-sm font-medium text-red-600">${s.actual_qty}</span></li>`).join("")}</ul>` : `<p class="text-sm text-gray-500">Stock levels OK.</p>`}`, "sm:col-span-2 lg:col-span-2")}
      ${card(`<div class="flex items-center justify-between mb-4">
          <h3 class="flex items-center gap-2 text-base font-semibold text-gray-900">${icon("clipboard-document-list", "w-5 h-5 text-primary")}Recent Job Cards</h3>
          <a href="#/jobs" class="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-700">View all ${icon("arrow-right", "w-4 h-4")}</a>
        </div>
        ${recent ? `<ul class="divide-y divide-border">${recent}</ul>` : `<p class="text-sm text-gray-500">No job cards yet.</p>`}`, "sm:col-span-2 lg:col-span-2")}
    </div>
  </div></div>`;
  void badge;
  return { header, content };
}

DashboardView.mounted = async (view) => {
  const form = view.querySelector("#dash-search");
  const box = view.querySelector("#dash-results");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = new FormData(form).get("q") || "";
    if (q.trim().length < 2) return;
    try {
      const r = await api.masterSearch(q.trim());
      const sec = (t, items, link) => items.length ? `<h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-3 mb-1">${t}</h4><ul class="divide-y divide-border bg-card border border-border rounded-lg">${items.map((x) => `<li class="px-4 py-2 text-sm"><a class="text-primary hover:underline" href="${link(x)}">${escapeHtml(x.customer_name || x.registration_no || x.name)}${x.status ? ` — ${x.status}` : ""}${x.mobile_no ? ` · ${x.mobile_no}` : ""}</a></li>`).join("")}</ul>` : "";
      box.innerHTML = card(
        sec("Customers", r.customers, (x) => `#/customers/${encodeURIComponent(x.name)}`) +
        sec("Vehicles", r.vehicles, () => `#/catalog`) +
        sec("Job Cards", r.jobs, (x) => `#/jobs/${encodeURIComponent(x.name)}`) +
        sec("Counter Invoices", r.counters, (x) => `#/counters/${encodeURIComponent(x.name)}`) ||
        `<p class="text-sm text-gray-500">No matches.</p>`
      );
    } catch (ex) {
      box.innerHTML = `<p class="text-sm text-red-600">${ex.message}</p>`;
    }
  });
};
