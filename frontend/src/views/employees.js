// employees/index parity.
import { api } from "../api.js";
import { icon } from "../icons.js";
import { badge, button, card, dataTable, th, td, fieldLabel, textInput, escapeHtml } from "../ui.js";
import { openModal, closeModal } from "../components.js";

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
      ${td(`<button data-edit="${escapeHtml(e.name)}" class="text-primary hover:text-primary-700">${icon("pencil-square", "w-5 h-5")}</button>`, "text-right")}
    </tr>`).join("");
    table.innerHTML = dataTable(`${th("Name")}${th("Role")}${th("Department")}${th("Mobile")}${th("Active")}${th("", "text-right")}`, html, "user-group", "No employees found.");
    table.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openEmployeeEdit(b.dataset.edit, load)));
  }
  form.addEventListener("change", load);
  await load();
  const add = document.createElement("div");
  add.innerHTML = `<div class="mt-4">${card(`<details><summary class="cursor-pointer font-semibold text-gray-900">Add Employee</summary>
    <form id="emp-form" class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
      <div>${fieldLabel("First Name")}${textInput("first_name", "", "text", "required")}</div>
      <div>${fieldLabel("Last Name")}${textInput("last_name")}</div>
      <div>${fieldLabel("Mobile")}${textInput("mobile_no")}</div>
      <div>${fieldLabel("Role")}<select name="designation" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm transition-colors focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shadow-sm"><option>Technician</option><option>Supervisor</option><option>Helper</option><option>Front Desk</option><option>Admin</option></select></div>
      <div>${fieldLabel("Date of Joining")}${textInput("date_of_joining", new Date().toISOString().slice(0, 10), "date")}</div>
      <div>${fieldLabel("Department")}${textInput("department")}</div>
      <div class="col-span-2 flex justify-end">${button("Create", { variant: "primary", type: "submit" })}</div>
    </form>`)}</div>`;
  view.appendChild(add);
  add.querySelector("#emp-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.createEmployee(Object.fromEntries(new FormData(e.target).entries()));
      window.location.reload();
    } catch (ex) { alert(ex.message); }
  });
};

function openEmployeeEdit(name, reload) {
  const wrap = openModal("Edit Employee", `
    <form id="emp-edit" class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>${fieldLabel("Mobile")}${textInput("cell_number")}</div>
      <div>${fieldLabel("Department")}${textInput("department")}</div>
      <div>${fieldLabel("Role")}<select name="designation" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm"><option>Technician</option><option>Supervisor</option><option>Helper</option><option>Front Desk</option><option>Admin</option></select></div>
      <div>${fieldLabel("Status")}<select name="active" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm"><option value="1">Active</option><option value="0">Inactive</option></select></div>
      <div class="col-span-2 flex justify-end gap-2">
        <button type="button" data-close2 class="inline-flex items-center h-10 px-4 text-sm hover:bg-accent rounded-md">Cancel</button>
        ${button("Update", { variant: "primary", type: "submit" })}
      </div>
    </form>`);
  wrap.querySelector("[data-close2]").addEventListener("click", closeModal);
  wrap.querySelector("#emp-edit").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api.updateEmployee(name, Object.fromEntries(new FormData(e.target).entries()));
      closeModal();
      reload();
    } catch (ex) { alert(ex.message); }
  });
}
