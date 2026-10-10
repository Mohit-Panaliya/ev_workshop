// analytics sub-pages parity (revenue/job-cards/inventory/payments/customers).
import { api } from "../api.js";
import { icon } from "../icons.js";
import { button, money, fmtDate, escapeHtml } from "../ui.js";
import Chart from "chart.js/auto";

function subHeader(title, back = "#/analytics") {
  return `<div class="flex items-center justify-between">
    <h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("chart-bar", "w-6 h-6 text-primary")}${title}</h2>
    ${button("Back", { variant: "ghost", href: back })}
  </div>`;
}

function rangeForm(id) {
  const today = new Date().toISOString().slice(0, 10);
  const first = today.slice(0, 8) + "01";
  return `<form id="${id}" class="bg-white rounded-lg border border-gray-200 p-4"><div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
    <div><label class="block text-sm font-medium text-gray-700 mb-1" for="${id}-from">From Date</label><input type="date" name="from_date" id="${id}-from" value="${first}" class="w-full border-gray-300 rounded-lg"></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1" for="${id}-to">To Date</label><input type="date" name="to_date" id="${id}-to" value="${today}" class="w-full border-gray-300 rounded-lg"></div>
    <div class="flex gap-2">${button("Apply", { type: "submit" })}${button("Reset", { variant: "secondary", attrs: `data-reset="" type="button"` })}</div>
  </div></form>`;
}

function bindRange(view, id, onGo) {
  const form = view.querySelector(`#${id}`);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    onGo(fd.get("from_date"), fd.get("to_date"));
  });
  form.querySelector("[data-reset]").addEventListener("click", () => {
    const today = new Date().toISOString().slice(0, 10);
    form.from_date.value = today.slice(0, 8) + "01";
    form.to_date.value = today;
    onGo(form.from_date.value, form.to_date.value);
  });
}

function tableCard(title, head, rows) {
  return `<div class="bg-card border rounded-2xl p-6 shadow-sm"><h3 class="text-sm font-semibold tracking-wider uppercase text-muted-foreground mb-4">${title}</h3>
  <table class="w-full text-sm"><thead><tr class="text-xs text-muted-foreground uppercase border-b">${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

const TH = (t, r = false) => `<th class="py-3 font-semibold ${r ? "text-right" : "text-left"}">${t}</th>`;

export async function AnalyticsRevenueView() {
  return {
    header: subHeader("Revenue"),
    content: `<div class="py-6"><div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">
      ${rangeForm("rev-f")}
      <div id="rev-body"></div>
    </div></div>`,
  };
}

AnalyticsRevenueView.mounted = async (view) => {
  const box = view.querySelector("#rev-body");
  let charts = [];
  async function go(from, to) {
    charts.forEach((c) => c.destroy());
    charts = [];
    let d;
    try {
      d = await api.analyticsDetail("revenue", from, to);
    } catch (e) {
      box.innerHTML = `<p class="text-sm text-red-600">${e.message}</p>`;
      return;
    }
    const total = (d.by_day || []).reduce((s, r) => s + Number(r.total || 0), 0);
    box.innerHTML = `
      <div class="bg-card border rounded-2xl p-6 shadow-sm"><h3 class="text-sm font-semibold tracking-wider uppercase text-muted-foreground">Total Revenue</h3>
      <div class="text-3xl font-bold mt-2">${money(total)}</div></div>
      <div class="bg-card border rounded-2xl p-6 shadow-sm"><h3 class="text-sm font-semibold tracking-wider uppercase text-muted-foreground mb-4">Daily Revenue</h3>
      <div class="relative h-[300px]"><canvas id="rev-d"></canvas></div></div>
      <div class="bg-card border rounded-2xl p-6 shadow-sm"><h3 class="text-sm font-semibold tracking-wider uppercase text-muted-foreground mb-4">6-Month Trend</h3>
      <div class="relative h-[220px]"><canvas id="rev-t"></canvas></div></div>
      ${tableCard("Revenue by Job Type",
        `${TH("Job Type")}${TH("Revenue", true)}${TH("% of Job Cards", true)}`,
        (d.by_type || []).map((r) => `<tr class="border-t hover:bg-muted/50"><td class="py-2 capitalize">${escapeHtml((r.job_type || "").replace(/_/g, " "))}</td><td class="py-2 text-right">${money(r.total)}</td><td class="py-2 text-right">${r.invoices}</td></tr>`).join(""))}`;
    charts.push(new Chart(box.querySelector("#rev-d"), {
      type: "bar",
      data: { labels: (d.by_day || []).map((r) => r.day), datasets: [{ data: (d.by_day || []).map((r) => Number(r.total)), backgroundColor: "rgba(34,197,94,.7)", borderColor: "rgba(34,197,94,1)" }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } } },
    }));
    const trend = await api.analyticsFull("monthly").catch(() => null);
    if (trend?.revenue_trend) {
      charts.push(new Chart(box.querySelector("#rev-t"), {
        type: "line",
        data: { labels: trend.revenue_trend.map((r) => r.month), datasets: [{ data: trend.revenue_trend.map((r) => Number(r.revenue)), borderColor: "#3b82f6", fill: true, tension: 0.3 }] },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } } },
      }));
    }
  }
  bindRange(view, "rev-f", go);
  const f = view.querySelector("#rev-f");
  go(f.from_date.value, f.to_date.value);
};

export async function AnalyticsJobsView() {
  return {
    header: subHeader("Job Cards"),
    content: `<div class="py-6"><div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">${rangeForm("jc-f")}<div id="jc-body"></div></div></div>`,
  };
}

AnalyticsJobsView.mounted = async (view) => {
  const box = view.querySelector("#jc-body");
  let chart = null;
  async function go(from, to) {
    if (chart) chart.destroy();
    let d;
    try {
      d = await api.analyticsDetail("job_cards", from, to);
    } catch (e) {
      box.innerHTML = `<p class="text-sm text-red-600">${e.message}</p>`;
      return;
    }
    const total = (d.by_status || []).reduce((s, r) => s + Number(r.total), 0);
    box.innerHTML = `
      <div class="bg-card border rounded-2xl p-6 shadow-sm"><h3 class="text-sm font-semibold tracking-wider uppercase text-muted-foreground mb-4">By Status</h3>
      <div class="relative h-[260px]"><canvas id="jc-d"></canvas></div></div>
      ${tableCard("Counts",
        `${TH("Status")}${TH("Count", true)}${TH("%", true)}`,
        (d.by_status || []).map((r) => `<tr class="border-t hover:bg-muted/50"><td class="py-2 capitalize">${escapeHtml((r.status || "").replace(/_/g, " "))}</td><td class="py-2 text-right">${r.total}</td><td class="py-2 text-right">${total ? Math.round((r.total / total) * 100) : 0}%</td></tr>`).join("") +
        `<tr class="border-t font-bold"><td class="py-2">Total</td><td class="py-2 text-right">${total}</td><td class="py-2 text-right">100%</td></tr>`)}`;
    chart = new Chart(box.querySelector("#jc-d"), {
      type: "doughnut",
      data: { labels: (d.by_status || []).map((r) => (r.status || "").replace(/_/g, " ")), datasets: [{ data: (d.by_status || []).map((r) => Number(r.total)), backgroundColor: ["#6366f1", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#94a3b8"] }] },
      options: { maintainAspectRatio: false },
    });
  }
  bindRange(view, "jc-f", go);
  const f = view.querySelector("#jc-f");
  go(f.from_date.value, f.to_date.value);
};

export async function AnalyticsInventoryView() {
  return {
    header: subHeader("Inventory"),
    content: `<div class="py-6"><div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">${rangeForm("inv-f")}<div id="inv-body"></div></div></div>`,
  };
}

AnalyticsInventoryView.mounted = async (view) => {
  const box = view.querySelector("#inv-body");
  async function go(from, to) {
    let d;
    try {
      d = await api.analyticsDetail("inventory", from, to);
    } catch (e) {
      box.innerHTML = `<p class="text-sm text-red-600">${e.message}</p>`;
      return;
    }
    box.innerHTML = tableCard(`Stock (total value ${money(d.total_value || 0)})`,
      `${TH("Part")}${TH("Category")}${TH("In Stock", true)}${TH("Reorder", true)}${TH("Cost", true)}${TH("Stock Value", true)}${TH("Units Used", true)}`,
      (d.lines || []).map((r) => `<tr class="border-t hover:bg-muted/50"><td class="py-2">${escapeHtml(r.name)} (${escapeHtml(r.code)})</td><td class="py-2">${escapeHtml(r.category || "-")}</td><td class="py-2 text-right">${r.stock}</td><td class="py-2 text-right">${r.reorder}</td><td class="py-2 text-right">${money(r.cost)}</td><td class="py-2 text-right">${money(r.value)}</td><td class="py-2 text-right">${r.used}</td></tr>`).join(""));
  }
  bindRange(view, "inv-f", go);
  const f = view.querySelector("#inv-f");
  go(f.from_date.value, f.to_date.value);
};

export async function AnalyticsPaymentsView() {
  return {
    header: subHeader("Payments"),
    content: `<div class="py-6"><div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">${rangeForm("pay-f")}<div id="pay-body"></div></div></div>`,
  };
}

AnalyticsPaymentsView.mounted = async (view) => {
  const box = view.querySelector("#pay-body");
  async function go(from, to) {
    let d;
    try {
      d = await api.analyticsDetail("payments", from, to);
    } catch (e) {
      box.innerHTML = `<p class="text-sm text-red-600">${e.message}</p>`;
      return;
    }
    const total = (d.ledger || []).reduce((s, r) => s + Number(r.paid_amount || 0), 0);
    box.innerHTML = `
      <div class="bg-card border rounded-2xl p-6 shadow-sm"><h3 class="text-sm font-semibold tracking-wider uppercase text-muted-foreground">Total Collected</h3>
      <div class="text-3xl font-bold mt-2">${money(total)}</div></div>
      ${tableCard("Ledger",
        `${TH("Payment Date")}${TH("Document")}${TH("Customer")}${TH("Mode")}${TH("Reference")}${TH("Amount", true)}`,
        (d.ledger || []).map((r) => `<tr class="border-t hover:bg-muted/50"><td class="py-2">${fmtDate(r.posting_date)}</td><td class="py-2">${escapeHtml(r.name)}</td><td class="py-2">${escapeHtml(r.party || "-")}</td><td class="py-2 capitalize">${escapeHtml(r.mode_of_payment || "-")}</td><td class="py-2">${escapeHtml(r.reference_no || "-")}</td><td class="py-2 text-right font-medium">${money(r.paid_amount)}</td></tr>`).join(""))}`;
  }
  bindRange(view, "pay-f", go);
  const f = view.querySelector("#pay-f");
  go(f.from_date.value, f.to_date.value);
};

export async function AnalyticsCustomersView() {
  return {
    header: subHeader("Customers"),
    content: `<div class="py-6"><div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">${rangeForm("cus-f")}<div id="cus-body"></div></div></div>`,
  };
}

AnalyticsCustomersView.mounted = async (view) => {
  const box = view.querySelector("#cus-body");
  async function go(from, to) {
    let d;
    try {
      d = await api.analyticsDetail("customers", from, to);
    } catch (e) {
      box.innerHTML = `<p class="text-sm text-red-600">${e.message}</p>`;
      return;
    }
    box.innerHTML = tableCard("Ranked by Paid",
      `${TH("#")}${TH("Customer")}${TH("Visits", true)}${TH("Amount Paid", true)}`,
      (d.rows || []).map((r, i) => `<tr class="border-t hover:bg-muted/50"><td class="py-2">${i + 1}</td><td class="py-2">${escapeHtml(r.customer)}</td><td class="py-2 text-right">${r.visits}</td><td class="py-2 text-right font-medium">${money(r.paid)}</td></tr>`).join(""));
  }
  bindRange(view, "cus-f", go);
  const f = view.querySelector("#cus-f");
  go(f.from_date.value, f.to_date.value);
};
