// Hash router + shell state (mirrors layouts/app.blade.php Alpine sidebar()).
import "./app.css";
import { loggedUser, logout } from "./api.js";

// Plain web UI (not a PWA): drop any service worker left from earlier builds.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
}
import { shell } from "./layout.js";
import { LoginView } from "./views/login.js";
import { DashboardView } from "./views/dashboard.js";
import { JobsView, JobDetailView, JobEditView, JobAssignView } from "./views/jobs.js";
import { CustomersView, CustomerDetailView } from "./views/customers.js";
import { CountersView, CounterDetailView, CounterEditView } from "./views/counters.js";
import { PaymentsView } from "./views/payments.js";
import { InventoryView } from "./views/inventory.js";
import { EmployeesView } from "./views/employees.js";
import { CatalogView } from "./views/catalog.js";
import { AnalyticsView } from "./views/analytics.js";
import { CompanyView } from "./views/company.js";
import { VehicleCreateView, VehicleEditView } from "./views/vehicles.js";
import { AnalyticsRevenueView, AnalyticsJobsView, AnalyticsInventoryView, AnalyticsPaymentsView, AnalyticsCustomersView } from "./views/analytics_sub.js";

const routes = [
  { pattern: /^#\/login$/, render: LoginView, guest: true },
  { pattern: /^#\/dashboard$/, render: DashboardView },
  { pattern: /^#\/jobs\/([^/]+)\/edit$/, render: (m) => JobEditView(decodeURIComponent(m[1])) },
  { pattern: /^#\/jobs\/([^/]+)\/assign$/, render: (m) => JobAssignView(decodeURIComponent(m[1])) },
  { pattern: /^#\/jobs\/([^/]+)$/, render: (m) => JobDetailView(decodeURIComponent(m[1])) },
  { pattern: /^#\/jobs$/, render: JobsView },
  { pattern: /^#\/customers\/([^/]+)$/, render: (m) => CustomerDetailView(decodeURIComponent(m[1])) },
  { pattern: /^#\/customers$/, render: CustomersView },
  { pattern: /^#\/counters\/([^/]+)\/edit$/, render: (m) => CounterEditView(decodeURIComponent(m[1])) },
  { pattern: /^#\/counters\/([^/]+)$/, render: (m) => CounterDetailView(decodeURIComponent(m[1])) },
  { pattern: /^#\/counters$/, render: CountersView },
  { pattern: /^#\/payments$/, render: PaymentsView },
  { pattern: /^#\/inventory$/, render: InventoryView },
  { pattern: /^#\/employees$/, render: EmployeesView },
  { pattern: /^#\/catalog$/, render: CatalogView },
  { pattern: /^#\/analytics\/revenue$/, render: AnalyticsRevenueView },
  { pattern: /^#\/analytics\/job-cards$/, render: AnalyticsJobsView },
  { pattern: /^#\/analytics\/inventory$/, render: AnalyticsInventoryView },
  { pattern: /^#\/analytics\/payments$/, render: AnalyticsPaymentsView },
  { pattern: /^#\/analytics\/customers$/, render: AnalyticsCustomersView },
  { pattern: /^#\/analytics$/, render: AnalyticsView },
  { pattern: /^#\/vehicles\/new$/, render: VehicleCreateView },
  { pattern: /^#\/vehicles\/([^/]+)\/edit$/, render: (m) => VehicleEditView(decodeURIComponent(m[1])) },
  { pattern: /^#\/company$/, render: CompanyView },
];

const state = {
  user: null,
  collapsed: localStorage.getItem("sidebar.collapsed") === "1",
  mobileOpen: false,
};

async function render() {
  const app = document.getElementById("app");
  const hash = window.location.hash || "#/dashboard";
  const route = routes.find((r) => r.pattern.test(hash));
  if (!route) {
    window.location.hash = "#/dashboard";
    return;
  }
  const m = hash.match(route.pattern);

  if (route.guest) {
    const out = await route.render(m);
    app.innerHTML = typeof out === "string" ? out : out.content;
    bindGlobal(app);
    if (route.render.mounted) await route.render.mounted(app, m);
    return;
  }

  if (!state.user) {
    const name = await loggedUser();
    if (!name) {
      window.location.hash = "#/login";
      return;
    }
    state.user = { name, email: "" };
  }

  app.innerHTML = shell({ user: state.user, collapsed: state.collapsed, mobileOpen: state.mobileOpen, header: "", content: `<div id="view"></div>`, currentHash: hash });
  const out = await route.render(m);
  document.querySelector("header .flex-1").innerHTML = out.header;
  const view = document.getElementById("view");
  view.innerHTML = out.content;
  bindGlobal(app);
  if (route.render.mounted) await route.render.mounted(view, m);
}

function bindGlobal(app) {
  app.querySelectorAll("[data-dropdown]").forEach((t) => {
    t.onclick = (e) => {
      e.stopPropagation();
      const root = t.closest("[data-dropdown-root]");
      const menu = root ? root.querySelector("[data-dropdown-menu]") : null;
      const willOpen = menu && menu.style.display === "none";
      app.querySelectorAll("[data-dropdown-menu]").forEach((m) => { m.style.display = "none"; });
      if (menu && willOpen) menu.style.display = "";
    };
  });
  document.onclick = () => {
    app.querySelectorAll("[data-dropdown-menu]").forEach((m) => { m.style.display = "none"; });
  };
  app.querySelectorAll("[data-action]").forEach((b) => {
    b.onclick = (e) => {
      e.preventDefault();
      const a = b.dataset.action;
      if (a === "toggle-collapsed") {
        state.collapsed = !state.collapsed;
        localStorage.setItem("sidebar.collapsed", state.collapsed ? "1" : "0");
        render();
      } else if (a === "open-mobile") {
        state.mobileOpen = true;
        render();
      } else if (a === "close-mobile") {
        state.mobileOpen = false;
        render();
      } else if (a === "logout") {
        logout();
      }
    };
  });
  app.querySelectorAll("aside a").forEach((a) => {
    a.addEventListener("click", () => {
      state.mobileOpen = false;
    });
  });
}

window.addEventListener("hashchange", render);
render();
