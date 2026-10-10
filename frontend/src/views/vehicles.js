// vehicles/create + edit parity (brand→model dynamic, NON-RTO toggle).
import { api } from "../api.js";
import { icon } from "../icons.js";
import { button, card, fieldLabel, textInput, escapeHtml } from "../ui.js";
import { combobox } from "../components.js";

function brandModelFields(brands) {
  return `
      <div>${fieldLabel("Brand", "vbrand")}<select name="brand_id" id="vbrand" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm" required>
      <option value="">Select brand...</option>${brands.map((b) => `<option value="${b.name}">${escapeHtml(b.brand_name)}</option>`).join("")}</select></div>
      <div>${fieldLabel("Model", "vmodel")}<select name="vehicle_model" id="vmodel" class="block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm" required></select></div>
      <div class="col-span-2"><label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" name="is_non_rto" value="1" class="rounded border-gray-300 text-primary"> NON-RTO (no registration)</label></div>
      <div>${fieldLabel("Registration No", "vreg")}${textInput("registration_no")}</div>
      <div>${fieldLabel("Odometer (km)", "vodo")}${textInput("current_odometer_km", 0, "number")}</div>
      <div>${fieldLabel("Chassis No", "vch")}${textInput("chassis_no")}</div>
      <div>${fieldLabel("Motor / Battery Serial", "vmo")}${textInput("motor_no")}</div>
      <div>${fieldLabel("Battery No", "vba")}${textInput("battery_no")}</div>
      <div>${fieldLabel("Color", "vco")}${textInput("color")}</div>`;
}

function bindBrandModel(view, brands, selectedModel = "") {
  const brandSel = view.querySelector("#vbrand");
  const modelSel = view.querySelector("#vmodel");
  const reg = view.querySelector('[name="registration_no"]');
  const nonRto = view.querySelector('[name="is_non_rto"]');
  function fillModels() {
    const b = brands.find((x) => x.name === brandSel.value);
    modelSel.innerHTML = (b?.models || []).map((m) => `<option value="${m.name}"${m.name === selectedModel ? " selected" : ""}>${escapeHtml(m.model_name)}</option>`).join("");
  }
  brandSel.addEventListener("change", fillModels);
  fillModels();
  if (selectedModel) modelSel.value = selectedModel;
  function syncRto() {
    reg.disabled = nonRto.checked;
    if (nonRto.checked) reg.value = "";
  }
  nonRto.addEventListener("change", syncRto);
  syncRto();
}

export async function VehicleCreateView() {
  const header = `<h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("truck", "w-6 h-6 text-primary")}Add Vehicle</h2>`;
  const content = `<div class="py-6"><div class="max-w-3xl mx-auto sm:px-6 lg:px-8">${card(`<div id="vform"><p class="text-sm text-gray-500">Loading…</p></div>`)}</div></div>`;
  return { header, content };
}

VehicleCreateView.mounted = async (view) => {
  let brands = [];
  try {
    brands = await api.catalog();
  } catch (e) {
    view.querySelector("#vform").innerHTML = `<p class="text-sm text-red-600">${e.message}</p>`;
    return;
  }
  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const presetCustomer = params.get("customer_id") || "";
  view.querySelector("#vform").innerHTML = `
    <form id="vehicle-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="col-span-2">${fieldLabel("Customer", "vcust")}<div id="vcust-slot"></div></div>
      ${brandModelFields(brands)}
      <div class="col-span-2 flex justify-end gap-2">
        ${button("Cancel", { variant: "ghost", href: "#/customers" })}
        ${button("Save", { variant: "primary", type: "submit" })}
      </div>
    </form>`;
  view.querySelector("#vcust-slot").innerHTML = combobox({
    name: "customer", endpoint: "ev_workshop.workshop_api.search_customers",
    placeholder: "Search customer...", initialId: presetCustomer, required: true,
  });
  bindBrandModel(view, brands);
  view.querySelector("#vehicle-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target).entries());
    fd.is_non_rto = fd.is_non_rto ? 1 : 0;
    try {
      await api.createVehicle(fd);
      window.location.hash = "#/customers";
    } catch (ex) { alert(ex.message); }
  });
};

export async function VehicleEditView(name) {
  const header = `<h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("truck", "w-6 h-6 text-primary")}Edit Vehicle</h2>`;
  const content = `<div class="py-6"><div class="max-w-3xl mx-auto sm:px-6 lg:px-8">${card(`<div id="vform"><p class="text-sm text-gray-500">Loading…</p></div>`)}</div></div>`;
  return { header, content };
}

VehicleEditView.mounted = async (view, m) => {
  const vname = decodeURIComponent(m[1]);
  let v = null, brands = [];
  try {
    const r = await api.vehicle(vname);
    v = r.vehicle;
    brands = await api.catalog();
  } catch (e) {
    view.querySelector("#vform").innerHTML = `<p class="text-sm text-red-600">${e.message}</p>`;
    return;
  }
  view.querySelector("#vform").innerHTML = `
    <form id="vehicle-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="col-span-2"><p class="text-sm text-gray-600">Owner cannot be changed (preserves history).</p></div>
      ${brandModelFields(brands)}
      <div class="col-span-2 flex justify-end gap-2">
        ${button("Cancel", { variant: "ghost", href: "#/customers" })}
        ${button("Update", { variant: "primary", type: "submit" })}
      </div>
    </form>`;
  const form = view.querySelector("#vehicle-form");
  form.registration_no.value = v.registration_no || "";
  form.current_odometer_km.value = v.current_odometer_km || 0;
  form.chassis_no.value = v.chassis_no || "";
  form.motor_no.value = v.motor_no || "";
  form.battery_no.value = v.battery_no || "";
  form.color.value = v.color || "";
  // preselect brand via model
  const modelRec = brands.flatMap((b) => b.models.map((mm) => ({ ...mm, brand: b.name }))).find((x) => x.name === v.vehicle_model);
  if (modelRec) form.brand_id.value = modelRec.brand;
  bindBrandModel(view, brands, v.vehicle_model || "");
  if (v.is_non_rto) {
    form.is_non_rto.checked = true;
    form.registration_no.disabled = true;
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(form).entries());
    fd.is_non_rto = fd.is_non_rto ? 1 : 0;
    delete fd.brand_id;
    try {
      await api.updateVehicle(vname, fd);
      window.location.hash = "#/customers";
    } catch (ex) { alert(ex.message); }
  });
};
