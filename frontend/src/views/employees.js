// employees/index parity.
import { api } from "../api.js";
import { icon } from "../icons.js";
import { badge, dataTable, th, td, fieldLabel, escapeHtml } from "../ui.js";

const ROLE_BADGES = { technician: "primary", supervisor: "purple", front_desk: "purple", admin: "red", default: "gray" };

export async function EmployeesView() {
  const header = `<h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("user-group", "w-6 h-6 text-primary")}Employees</h2>`;
  const content = `<div class="py-6"><div class="max-w-full sm:px-6 lg:px-8 space-y-4">
    <form id="emp-filter" class="bg-white rounded-lg border border-gray-200 p-4"><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div>${fieldLabel("Status")}<select name="active" class="w-full border-gray-300 rounded-lg"><option value="">All</option><option value="active_only">Active only</option><option value="inactive_only">Inactive only</option></select></div>
      <div>${fieldLabel("Search")}<input type="text" name="search" class="w-full border-gray-300 rounded-lg"></div>
    </div></form>
    <div id="emp-table"></div>
    <p class="text-xs text-gray-500">Employee records are managed in HRMS (Desk). This view is read-only.</p>
  </div></div>`;
  return { header, content };
}

EmployeesView.mounted = async (view) => {
  const table = view.querySelector("#emp-table");
  const form = view.querySelector("#emp-filter");
  async function load() {
    const fd = new FormData(form);
    let rows = [];
    try {
      rows = await api.employees({ search: fd.get("search") || undefined, active: fd.get("active") || undefined });
    } catch (e) {
      table.innerHTML = `<p class="text-sm text-red-600">${e.message}</p>`;
      return;
    }
    const html = rows.map((e) => `<tr class="group hover:bg-muted/50">
      ${td(`<span class="font-medium text-gray-900">${escapeHtml(e.employee_name)}</span>`)}
      ${td(badge("primary", escapeHtml(e.designation || "-")))}
      ${td(escapeHtml(e.department || "-"))}
      ${td(escapeHtml(e.cell_number || "-"))}
      ${td(e.status === "Active" ? badge("green", "Active") : badge("gray", "Inactive"))}
    </tr>`).join("");
    table.innerHTML = dataTable(`${th("Name")}${th("Role")}${th("Department")}${th("Mobile")}${th("Active")}`, html, "user-group", "No employees found.");
  }
  form.addEventListener("change", load);
  await load();
};
