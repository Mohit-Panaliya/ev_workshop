// customers/index + show + create parity.
import { api } from "../api.js";
import { icon } from "../icons.js";
import { button, card, dataTable, th, td, searchBar, fieldLabel, textInput, money, fmtDate, escapeHtml, pageHeader, statusBadge, sortTh, bindSort, JOB_STATUS_BADGES, JOB_STATUS_ICONS } from "../ui.js";
import { bindBulkDelete, importButton, bindImport, exportDropdown, bindExportDropdown } from "../list.js";
import { openModal, closeModal } from "../components.js";

export async function CustomersView() {
  const header = `<div class="flex flex-wrap gap-2 justify-between items-center">
    <h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("users", "w-6 h-6 text-primary")}Customers</h2>
    <div class="flex items-center gap-2">
      ${button(`${icon("arrow-up-tray", "w-4 h-4")}Export`, { variant: "secondary", attrs: `data-action="export"` })}
      ${button(`${icon("plus", "w-4 h-4")}Add Customer`, { variant: "primary", href: "#/customers/new" })}
    </div></div>`;
  const content = `<div class="py-6"><div class="max-w-full sm:px-6 lg:px-8 space-y-4">
    <form id="c-filter" class="flex gap-3 items-end"><div class="flex-1">${searchBar("search", "", "Search by name or mobile...")}</div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1" for="outstanding">Outstanding</label><select name="outstanding" id="outstanding" class="w-full border-gray-300 rounded-lg"><option value="">All</option><option value="has_outstanding">Has outstanding</option><option value="no_outstanding">No outstanding</option></select></div>
    <div><label class="block text-sm font-medium text-gray-700 mb-1" for="per_page">Per page</label><select name="per_page" id="per_page" class="w-full border-gray-300 rounded-lg"><option>15</option><option>25</option><option>50</option><option>100</option></select></div>
    ${button(`${icon("magnifying-glass", "w-4 h-4")}Search`, { type: "submit" })}</form>
    <div class="flex justify-end gap-2 items-center">
      ${importButton("customers", "customer_name,mobile_no,email_id")}
      ${exportDropdown("customers")}
      ${button("Delete selected", { variant: "danger", attrs: `data-action="bulk-delete" data-doctype="Customer"` })}
    </div>
    <div id="c-table"></div>
  </div></div>`;
  return { header, content };
}

CustomersView.mounted = async (view) => {
  const table = view.querySelector("#c-table");
  const form = view.querySelector("#c-filter");
  const sortState = { column: "customer_name", direction: "asc" };
  async function load() {
    const fd = new FormData(form);
    let rows = [];
    try {
      rows = await api.customers({ search: fd.get("search") || undefined, limit: Number(fd.get("per_page")) || 20, outstanding: fd.get("outstanding") || undefined, sort: sortState.column, direction: sortState.direction });
    } catch (e) {
      table.innerHTML = `<p class="text-sm text-red-600">${e.message}</p>`;
      return;
    }
    const html = rows.map((c, i) => `<tr class="group hover:bg-muted/50">
      ${td(`<input type="checkbox" data-name="${escapeHtml(c.name)}" class="rounded border-gray-300 text-primary">`, "w-10")}
      ${td(`<a class="text-primary hover:text-primary-700 font-medium" href="#/customers/${encodeURIComponent(c.name)}">${escapeHtml(c.customer_name)}</a>`)}
      ${td(escapeHtml(c.mobile_no || "-"))}
      ${td(`<span class="${c.outstanding > 0 ? "font-medium text-red-600" : "text-gray-600"}">${money(c.outstanding)}</span>`)}
      ${td(c.visits)}
      ${td(`<span class="inline-flex items-center gap-2"><button data-expand="${i}" class="inline-flex items-center justify-center rounded-md p-1 text-gray-500 hover:bg-accent">${icon("chevron-down", "w-4 h-4")}</button><button data-del-c="${escapeHtml(c.name)}" class="text-red-600 hover:text-red-800">${icon("trash", "w-4 h-4")}</button></span>`, "text-right")}
    </tr>
    <tr class="hidden bg-muted/60" data-vehicles="${i}"><td colspan="6" class="align-middle px-6 py-2">
      <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Vehicles</div>
      <div data-vlist>Loading…</div>
    </td></tr>`).join("");
    table.innerHTML = dataTable(`${th("")}${sortTh("Display Name", "customer_name", sortState)}${th("Mobile")}${th("Outstanding")}${th("Visits")}${th("", "text-right")}`, html, "users", "No customers found.");
    bindSort(table, sortState, load);
    bindBulkDelete(view, table);
    bindImport(view, () => form.dispatchEvent(new Event("submit")));
    bindExportDropdown(view, "customers", () => {
      const fd = new FormData(form);
      return { search: fd.get("search") || undefined };
    });
    // row actions: view/edit/delete per row
    table._rows = rows;
    table.querySelectorAll("[data-del-c]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm(`Delete customer ${b.dataset.delC}?`)) return;
      try {
        await api.bulkDelete("Customer", [b.dataset.delC]);
        load();
      } catch (e) { alert(e.message); }
    }));
    table.querySelectorAll("[data-expand]").forEach((b) => b.addEventListener("click", async () => {
      const row = table.querySelector(`[data-vehicles="${b.dataset.expand}"]`);
      const open = row.classList.toggle("hidden");
      if (!open && !row.dataset.loaded) {
        row.dataset.loaded = "1";
        try {
          const d = await api.customer(table._rows[Number(b.dataset.expand)].name);
          row.querySelector("[data-vlist]").innerHTML = (d.vehicles || []).map((v) =>
            `<div class="flex items-center gap-3 py-2 border-b border-border last:border-0"><span class="text-sm">${escapeHtml(v.registration_no || "-")}</span><span class="text-sm text-gray-500">${escapeHtml(v.model || "")}</span></div>`
          ).join("") || `<p class="text-sm text-gray-500">No vehicles.</p>`;
        } catch (e) {
          row.querySelector("[data-vlist]").innerHTML = `<p class="text-sm text-red-600">${e.message}</p>`;
        }
      }
    }));
  }
  form.addEventListener("submit", (e) => { e.preventDefault(); load(); });
  view.querySelector('[data-action="export"]').addEventListener("click", () => {
    window.open(`/api/method/ev_workshop.workshop_api.export_csv?entity=customers`, "_blank");
  });
  await load();
};

export async function CustomerDetailView(name) {
  if (name === "new") return CustomerCreateView();
  let d;
  try {
    d = await api.customer(name);
  } catch (e) {
    return { header: pageHeader("users", "Customer"), content: `<p class="text-sm text-red-600">${e.message}</p>` };
  }
  const p = d.profile;
  const agg = d.aggregates;
  const initials = (p.customer_name || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  const header = `<div class="flex flex-wrap justify-between items-center gap-3">
    <div class="flex items-center gap-3">
      <span class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">${icon("user", "w-5 h-5 text-primary")}</span>
      <div><h2 class="font-semibold text-xl text-gray-800 leading-tight">${escapeHtml(p.customer_name)}</h2>
      <p class="text-sm text-gray-600">${initials} · ${escapeHtml(p.mobile_no || "")}</p></div>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      ${d.vehicles.length ? button("Create Job Card", { variant: "primary", href: `#/jobs/new?customer=${encodeURIComponent(d.profile.name)}&label=${encodeURIComponent(d.profile.customer_name)}` }) : ""}
      ${button("Add Vehicle", { variant: "secondary", href: `#/vehicles/new?customer_id=${encodeURIComponent(d.profile.name)}` })}
      ${button("Receive Payment", { variant: "secondary", attrs: `data-action="receive-payment"${agg.outstanding <= 0 ? " disabled" : ""}` })}
      ${button("Edit", { variant: "secondary", attrs: `data-action="edit-customer"` })}
      ${button("Statement", { variant: "secondary", attrs: `data-action="statement"` })}
      ${button("Print Statement", { variant: "secondary", attrs: `data-action="print-statement"` })}
      ${button("Back", { variant: "ghost", href: "#/customers" })}
    </div></div>`;
  const content = `<div class="py-6"><div class="max-w-full sm:px-6 lg:px-8 space-y-6">
    <div id="c-edit"></div>
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
      ${card(`<div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Billed</div><div class="mt-1 text-lg font-semibold">${money(agg.billed)}</div>`, "!p-5")}
      ${card(`<div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Paid</div><div class="mt-1 text-lg font-semibold text-green-600">${money(agg.paid)}</div>`, "!p-5")}
      ${card(`<div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Outstanding</div><div class="mt-1 text-lg font-semibold ${agg.outstanding > 0 ? "text-red-600" : ""}">${money(agg.outstanding)}</div>`, "!p-5")}
      ${card(`<div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vehicles</div><div class="mt-1 text-lg font-semibold">${d.vehicles.length}</div>`, "!p-5")}
      ${card(`<div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Jobs</div><div class="mt-1 text-lg font-semibold">${d.jobs.length}</div>`, "!p-5")}
    </div>
    <div class="flex gap-1 border-b border-border mb-4" id="c-tabs">
      ${["vehicles", "job_cards", "financial"].map((t, i) => `<button data-tab="${t}" class="px-4 py-2 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px ${i === 0 ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}">${t.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</button>`).join("")}
    </div>
    <div id="c-tab-vehicles">${card(`
      <table class="min-w-full divide-y divide-border"><thead><tr>
      <th class="text-left text-xs text-muted-foreground uppercase py-2">Registration</th>
      <th class="text-left text-xs text-muted-foreground uppercase py-2">Model</th>
      <th class="text-left text-xs text-muted-foreground uppercase py-2">Owner</th>
      <th class="text-right text-xs text-muted-foreground uppercase py-2"></th>
      </tr></thead><tbody>
      ${d.vehicles.map((v) => `<tr class="border-t"><td class="py-2 text-sm">${escapeHtml(v.registration_no || "-")}</td><td class="py-2 text-sm">${escapeHtml(v.model || "-")}</td><td class="py-2 text-sm">${v.is_primary ? "Primary" : "Co-owner"}</td><td class="py-2 text-right">${v.vehicle ? `<a class="text-primary hover:underline text-sm" href="#/vehicles/${encodeURIComponent(v.vehicle)}/edit">Edit</a>` : ""}</td></tr>`).join("") || `<tr><td colspan="4" class="py-2 text-sm text-gray-500">No vehicles.</td></tr>`}
      </tbody></table>`)}
      <div id="v-edit"></div>
    <div id="c-tab-job_cards" class="hidden">${card(`
      <table class="min-w-full divide-y divide-border"><thead><tr>
      <th class="text-left text-xs text-muted-foreground uppercase py-2">Job Card</th>
      <th class="text-left text-xs text-muted-foreground uppercase py-2">Date</th>
      <th class="text-left text-xs text-muted-foreground uppercase py-2">Status</th>
      <th class="text-right text-xs text-muted-foreground uppercase py-2">Total</th>
      </tr></thead><tbody>
      ${d.jobs.map((j) => `<tr class="border-t"><td class="py-2 text-sm"><a class="text-primary hover:underline" href="#/jobs/${encodeURIComponent(j.name)}">${j.name}</a></td><td class="py-2 text-sm">${fmtDate(j.date)}</td><td class="py-2">${statusBadge(JOB_STATUS_BADGES, j.status, JOB_STATUS_ICONS)}</td><td class="py-2 text-sm text-right">${money(j.grand_total)}</td></tr>`).join("") || `<tr><td colspan="4" class="py-2 text-sm text-gray-500">No jobs.</td></tr>`}
      </tbody></table>`)}</div>
    <div id="c-tab-financial" class="hidden">${card(`
      <table class="min-w-full divide-y divide-border"><thead><tr>
      <th class="text-left text-xs text-muted-foreground uppercase py-2">Invoice</th>
      <th class="text-left text-xs text-muted-foreground uppercase py-2">Date</th>
      <th class="text-right text-xs text-muted-foreground uppercase py-2">Billed</th>
      <th class="text-right text-xs text-muted-foreground uppercase py-2">Due</th>
      </tr></thead><tbody>
      ${d.invoices.map((i) => `<tr class="border-t"><td class="py-2 text-sm">${i.name}</td><td class="py-2 text-sm">${fmtDate(i.posting_date)}</td><td class="py-2 text-sm text-right">${money(i.grand_total)}</td><td class="py-2 text-sm text-right ${i.outstanding_amount > 0 ? "text-red-600" : ""}">${money(i.outstanding_amount)}</td></tr>`).join("") || `<tr><td colspan="4" class="py-2 text-sm text-gray-500">No invoices.</td></tr>`}
      </tbody></table>`)}
      <div id="c-statement" class="mt-4"></div>
    </div>
  </div></div>`;
  return { header, content };
}

CustomerDetailView.mounted = async (view, m) => {
  const name = decodeURIComponent(m[1]);
  if (name === "new") {
    view.querySelector("#customer-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const r = await api.createCustomer(Object.fromEntries(fd.entries()));
        window.location.hash = `#/customers/${encodeURIComponent(r.customer)}`;
      } catch (ex) { alert(ex.message); }
    });
    return;
  }
  view.querySelectorAll("#c-tabs button").forEach((b) => b.addEventListener("click", () => {
    view.querySelectorAll("#c-tabs button").forEach((x) => {
      x.className = "px-4 py-2 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px border-transparent text-gray-500 hover:text-gray-700";
    });
    b.className = "px-4 py-2 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px border-primary text-primary";
    ["vehicles", "job_cards", "financial"].forEach((t) => {
      view.querySelector(`#c-tab-${t}`).classList.toggle("hidden", t !== b.dataset.tab);
    });
  }));
  view.querySelector('[data-action="edit-customer"]').addEventListener("click", async () => {
    const box = view.querySelector("#c-edit");
    let p;
    try {
      const r = await api.customer(name);
      p = r.profile;
    } catch (e) { alert(e.message); return; }
    box.innerHTML = card(`<form id="c-edit-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>${fieldLabel("Customer Name")}${textInput("customer_name", p.customer_name || "")}</div>
      <div>${fieldLabel("Mobile")}${textInput("mobile_no", p.mobile_no || "")}</div>
      <div>${fieldLabel("Email")}${textInput("email_id", p.email_id || "", "email")}</div>
      <div class="col-span-2 flex justify-end gap-2">
        ${button("Cancel", { variant: "ghost", attrs: `type="button" data-cancel-edit=""` })}
        ${button("Save", { variant: "primary", type: "submit" })}
      </div></form>`);
    box.querySelector("[data-cancel-edit]").addEventListener("click", () => { box.innerHTML = ""; });
    box.querySelector("#c-edit-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await api.updateCustomer(name, Object.fromEntries(new FormData(e.target).entries()));
        window.location.reload();
      } catch (ex) { alert(ex.message); }
    });
  });
  view.querySelector('[data-action="print-statement"]').addEventListener("click", () => {
    window.open(`/printview?doctype=Customer&name=${encodeURIComponent(name)}&format=EV%20Customer%20Statement`, "_blank");
  });
  const recvBtn = view.querySelector('[data-action="receive-payment"]');
  if (recvBtn && !recvBtn.disabled) recvBtn.addEventListener("click", async () => {
    let docs = [];
    try {
      docs = await api.outstandingDocs(name);
    } catch (e) { alert(e.message); return; }
    if (!docs.length) {
      alert("No outstanding documents.");
      return;
    }
    const wrap = openModal("Receive Payment", `
      <form id="recv-form" class="space-y-4">
        <div>${fieldLabel("Document")}<select name="sales_invoice" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm">
          ${docs.map((x) => `<option value="${escapeHtml(x.name)}" data-due="${x.outstanding}">${escapeHtml(x.label)} — due ${money(x.outstanding)}</option>`).join("")}</select></div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>${fieldLabel("Amount")}${textInput("amount", docs[0].outstanding, "number")}</div>
          <div>${fieldLabel("Mode")}<select name="mode_of_payment" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm"><option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Cheque</option></select></div>
          <div>${fieldLabel("Date")}${textInput("payment_date", new Date().toISOString().slice(0, 10), "date")}</div>
          <div>${fieldLabel("Reference")}${textInput("reference_no")}</div>
        </div>
        <div>${fieldLabel("Notes")}<textarea name="notes" rows="2" class="block w-full rounded-md border border-gray-300 bg-white shadow-sm text-sm"></textarea></div>
        <div class="flex justify-end gap-2">
          <button type="button" data-mclose class="inline-flex items-center h-10 px-4 text-sm hover:bg-accent rounded-md">Cancel</button>
          ${button("Record Payment", { variant: "success", type: "submit" })}
        </div>
      </form>`);
    wrap.querySelector("[data-mclose]").addEventListener("click", closeModal);
    wrap.querySelector("#recv-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target).entries());
      try {
        await api.recordPayment({ sales_invoice: fd.sales_invoice, amount: Number(fd.amount), mode_of_payment: fd.mode_of_payment, payment_date: fd.payment_date, reference_no: fd.reference_no, notes: fd.notes });
        closeModal();
        window.location.reload();
      } catch (ex) { alert(ex.message); }
    });
  });
  view.querySelectorAll("[data-vehicle]").forEach((b) => b.addEventListener("click", async () => {
    const box = view.querySelector("#v-edit");
    const vname = b.dataset.vehicle;
    box.innerHTML = card(`<form id="v-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <input type="hidden" name="__name" value="${escapeHtml(vname)}">
      <div>${fieldLabel("Model")}${textInput("model", "")}</div>
      <div>${fieldLabel("Chassis No")}${textInput("chassis_no", "")}</div>
      <div>${fieldLabel("Motor No")}${textInput("motor_no", "")}</div>
      <div>${fieldLabel("Battery No")}${textInput("battery_no", "")}</div>
      <div class="col-span-2 flex justify-end">${button("Save Vehicle", { variant: "primary", type: "submit" })}</div>
    </form>`);
    box.querySelector("#v-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target).entries());
      const vname2 = fd.__name;
      delete fd.__name;
      try {
        await api.updateVehicle(vname2, fd);
        window.location.reload();
      } catch (ex) { alert(ex.message); }
    });
  }));
  view.querySelector('[data-action="statement"]').addEventListener("click", async () => {
    const box = view.querySelector("#c-statement");
    try {
      const r = await api.ledger(name);
      box.innerHTML = `<h4 class="font-medium text-gray-900 mb-2">Statement (${r.lines.length} lines)</h4>
        <table class="min-w-full text-sm"><thead><tr class="text-xs text-muted-foreground uppercase border-b">
        <th class="text-left py-2">Date</th><th class="text-left py-2">Document</th><th class="text-right py-2">Billed</th><th class="text-right py-2">Paid</th><th class="text-right py-2">Balance</th></tr></thead><tbody>
        ${r.lines.map((l) => `<tr class="border-t"><td class="py-2">${fmtDate(l.date)}</td><td class="py-2">${l.document}</td><td class="py-2 text-right">${money(l.billed)}</td><td class="py-2 text-right">${money(l.paid)}</td><td class="py-2 text-right font-medium">${money(l.balance)}</td></tr>`).join("")}
        </tbody></table>
        <p class="text-right font-bold mt-2">Closing Balance: ${money(r.closing_balance)}</p>`;
    } catch (e) { box.innerHTML = `<p class="text-sm text-red-600">${e.message}</p>`; }
  });
};

async function CustomerCreateView() {
  const header = `<h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("users", "w-6 h-6 text-primary")}Add Customer</h2>`;
  const content = `<div class="py-6"><div class="max-w-3xl mx-auto sm:px-6 lg:px-8">${card(`
    <form id="customer-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>${fieldLabel("Customer Name")}${textInput("customer_name", "", "text", "required")}</div>
      <div>${fieldLabel("Mobile")}${textInput("mobile_no")}</div>
      <div>${fieldLabel("Email")}${textInput("email", "", "email")}</div>
      <div>${fieldLabel("Customer Type")}<select name="customer_type" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm"><option>Individual</option><option>Company</option></select></div>
      <div>${fieldLabel("Vehicle Registration")}${textInput("registration_no")}</div>
      <div>${fieldLabel("Model")}${textInput("model")}</div>
      <div>${fieldLabel("Chassis No")}${textInput("chassis_no")}</div>
      <div>${fieldLabel("Motor No")}${textInput("motor_no")}</div>
      <div class="col-span-2 flex justify-end gap-2">
        ${button("Cancel", { variant: "ghost", href: "#/customers" })}
        ${button("Create Customer", { variant: "primary", type: "submit" })}
      </div>
    </form>`)}</div></div>`;
  return { header, content };
}
