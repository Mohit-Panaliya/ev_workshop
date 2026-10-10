// analytics/index parity (KPIs + Chart.js canvases).
import { api } from "../api.js";
import { icon } from "../icons.js";
import { money, escapeHtml } from "../ui.js";
import Chart from "chart.js/auto";

function kpi(label, value, theme) {
  const themes = {
    emerald: "from-emerald-50 to-white border-emerald-200",
    blue: "from-blue-50 to-white border-blue-200",
    rose: "from-rose-50 to-white border-rose-200",
  };
  return `<div class="bg-gradient-to-br ${themes[theme]} border rounded-2xl p-6 shadow-sm">
    <div class="text-xs font-medium uppercase tracking-wide text-gray-600">${label}</div>
    <div class="text-3xl font-bold mt-2">${value}</div>
  </div>`;
}

function chartCard(title, canvasId, height = "h-[300px]") {
  return `<div class="bg-card border rounded-2xl p-6 shadow-sm">
    <h3 class="text-sm font-semibold tracking-wider uppercase text-muted-foreground mb-4">${title}</h3>
    <div class="relative ${height}"><canvas id="${canvasId}"></canvas></div>
  </div>`;
}

export async function AnalyticsView() {
  const header = `<div class="flex items-center justify-between">
    <h2 class="flex items-center gap-3 font-semibold text-2xl tracking-tight">${icon("chart-bar", "w-7 h-7 text-primary")}Analytics</h2>
    <select id="an-period" class="text-sm border border-input bg-background rounded-lg px-3 py-1.5">
      <option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="daily">Daily</option>
    </select>
    <input type="date" id="an-from" class="text-sm border border-input bg-background rounded-lg px-3 py-1.5">
    <input type="date" id="an-to" class="text-sm border border-input bg-background rounded-lg px-3 py-1.5">
  </div>`;
  const content = `<div class="py-8 bg-gradient-to-b from-muted/30 to-background min-h-screen"><div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
    <div id="an-error"></div>
    <div id="an-kpis" class="grid grid-cols-1 md:grid-cols-3 gap-6"></div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      ${chartCard("Revenue trend", "ch-rev")}
      ${chartCard("Revenue split", "ch-split", "h-[260px]")}
      ${chartCard("Jobs by status", "ch-status", "h-[260px]")}
      ${chartCard("Payments by mode", "ch-pay", "h-[260px]")}
    </div>
    <div id="an-tables" class="grid grid-cols-1 lg:grid-cols-2 gap-6"></div>
  </div></div>`;
  return { header, content };
}

AnalyticsView.mounted = async (view) => {
  let charts = [];
  async function draw(period) {
    charts.forEach((c) => c.destroy());
    charts = [];
    const from = document.querySelector("#an-from").value || undefined;
    const to = document.querySelector("#an-to").value || undefined;
    let a;
    try {
      a = await api.analyticsFull(period, from, to);
    } catch (e) {
      view.querySelector("#an-error").innerHTML = `<p class="text-sm text-red-600">${e.message}</p>`;
      return;
    }
  const monthTotal = (a.revenue_trend || []).reduce((s, r) => s + Number(r.revenue || 0), 0);
  const dueTotal = (a.top_customers || []).reduce((s, c) => s + Number(c.outstanding || 0), 0);
  view.querySelector("#an-kpis").innerHTML =
    kpi("6-month revenue", money(monthTotal), "emerald") +
    kpi("Total outstanding", money(dueTotal), "rose") +
    kpi("Open jobs", Object.entries(a.jobs_by_status || {}).filter(([k]) => !["Completed", "Cancelled"].includes(k)).reduce((s, [, v]) => s + Number(v), 0), "blue");

  const cur = "₹";
  charts.push(new Chart(view.querySelector("#ch-rev"), {
    type: "bar",
    data: { labels: (a.revenue_trend || []).map((r) => r.month), datasets: [{ data: (a.revenue_trend || []).map((r) => Number(r.revenue)), backgroundColor: "#6366f1", borderRadius: 6 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (v) => cur + Number(v).toLocaleString("en-IN") } } } },
  }));
  const split = a.revenue_split || {};
  charts.push(new Chart(view.querySelector("#ch-split"), {
    type: "doughnut",
    data: { labels: Object.keys(split), datasets: [{ data: Object.values(split).map(Number), backgroundColor: ["#6366f1", "#16a34a", "#94a3b8"] }] },
    options: { maintainAspectRatio: false },
  }));
  const st = a.jobs_by_status || {};
  charts.push(new Chart(view.querySelector("#ch-status"), {
    type: "doughnut",
    data: { labels: Object.keys(st).map((s) => s.replace(/_/g, " ")), datasets: [{ data: Object.values(st).map(Number), backgroundColor: ["#e5e7eb", "#c7d2fe", "#fde68a", "#a7f3d0", "#fca5a5", "#ddd6fe", "#bae6fd", "#fed7aa"] }] },
    options: { maintainAspectRatio: false },
  }));
  const pm = a.payments_by_mode || [];
  charts.push(new Chart(view.querySelector("#ch-pay"), {
    type: "doughnut",
    data: { labels: pm.map((p) => p.mode), datasets: [{ data: pm.map((p) => Number(p.total)), backgroundColor: ["#6366f1", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6"] }] },
    options: { maintainAspectRatio: false },
  }));

  view.querySelector("#an-tables").innerHTML = `
    <div class="bg-card border rounded-2xl p-6 shadow-sm"><h3 class="text-sm font-semibold tracking-wider uppercase text-muted-foreground mb-4">Top customers</h3>
    <table class="w-full text-sm"><thead><tr class="text-xs text-muted-foreground uppercase border-b"><th class="text-left py-3 font-semibold">Customer</th><th class="text-right py-3 font-semibold">Billed</th><th class="text-right py-3 font-semibold">Due</th></tr></thead>
    <tbody>${(a.top_customers || []).map((c) => `<tr class="hover:bg-muted/50"><td class="py-2">${escapeHtml(c.customer)}</td><td class="py-2 text-right">${money(c.billed)}</td><td class="py-2 text-right">${money(c.outstanding)}</td></tr>`).join("")}</tbody></table></div>
    <div class="bg-card border rounded-2xl p-6 shadow-sm"><h3 class="text-sm font-semibold tracking-wider uppercase text-muted-foreground mb-4">Technician performance</h3>
    <table class="w-full text-sm"><thead><tr class="text-xs text-muted-foreground uppercase border-b"><th class="text-left py-3 font-semibold">Technician</th><th class="text-right py-3 font-semibold">Jobs</th><th class="text-right py-3 font-semibold">Billed</th></tr></thead>
    <tbody>${(a.technician_performance || []).map((t) => `<tr class="hover:bg-muted/50"><td class="py-2">${escapeHtml(t.technician)}</td><td class="py-2 text-right">${t.jobs}</td><td class="py-2 text-right">${money(t.billed)}</td></tr>`).join("") || `<tr><td colspan="3" class="py-2 text-gray-500">No data.</td></tr>`}</tbody></table></div>
    <div class="bg-card border rounded-2xl p-6 shadow-sm"><h3 class="text-sm font-semibold tracking-wider uppercase text-muted-foreground mb-4">Low stock (₹${Number(a.stock_value || 0).toLocaleString("en-IN")} total)</h3>
    <table class="w-full text-sm"><thead><tr class="text-xs text-muted-foreground uppercase border-b"><th class="text-left py-3 font-semibold">Item</th><th class="text-right py-3 font-semibold">Qty</th></tr></thead>
    <tbody>${(a.low_stock || []).map((s) => `<tr class="hover:bg-muted/50"><td class="py-2">${escapeHtml(s.item_code)}</td><td class="py-2 text-right">${s.actual_qty}</td></tr>`).join("") || `<tr><td colspan="2" class="py-2 text-gray-500">Stock levels OK.</td></tr>`}</tbody></table></div>`;
  }
  document.querySelector("#an-period").addEventListener("change", (e) => draw(e.target.value));
  document.querySelector("#an-from").addEventListener("change", () => draw(document.querySelector("#an-period").value));
  document.querySelector("#an-to").addEventListener("change", () => draw(document.querySelector("#an-period").value));
  await draw("monthly");
};
