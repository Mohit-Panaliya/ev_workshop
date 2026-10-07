// dashboard.blade.php parity.
import { api } from "../api.js";
import { icon } from "../icons.js";
import { badge, button, card, money, pageHeader, statusBadge, JOB_STATUS_BADGES, JOB_STATUS_ICONS } from "../ui.js";

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
          ${button(`${icon("plus", "w-4 h-4")}New Counter Invoice`, { variant: "success", href: "#/counters/new", cls: "w-full" })}
          ${button(`${icon("plus", "w-4 h-4")}New Job Card`, { variant: "primary", href: "#/jobs/new", cls: "w-full" })}
        </div>`)}
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
