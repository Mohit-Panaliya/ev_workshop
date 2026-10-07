// company-profile parity (view + edit Company).
import { api } from "../api.js";
import { icon } from "../icons.js";
import { button, card, fieldLabel, textInput, escapeHtml } from "../ui.js";

const FIELDS = ["company_name", "address", "city", "state", "pincode", "phone_no", "email", "gstin", "pan"];

export async function CompanyView() {
  const header = `<h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon("building-office-2", "w-6 h-6 text-primary")}Company Profile</h2>`;
  let c;
  try {
    c = await api.company();
  } catch (e) {
    return { header, content: `<p class="text-sm text-red-600">${e.message}</p>` };
  }
  const content = `<div class="py-6"><div class="max-w-3xl mx-auto sm:px-6 lg:px-8 space-y-4">
    <div id="co-flash"></div>
    ${card(`<form id="co-form" class="grid grid-cols-2 gap-4">
      <input type="hidden" name="name" value="${escapeHtml(c.name)}">
      ${FIELDS.map((f) => `<div>${fieldLabel(f.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase()))}${textInput(f, c[f] || "", f === "email" ? "email" : "text", f === "company_name" ? "readonly" : "")}</div>`).join("")}
      <div class="col-span-2 flex justify-end">${button("Save", { variant: "primary", type: "submit" })}</div>
    </form>`)}
  </div></div>`;
  return { header, content };
}

CompanyView.mounted = async (view) => {
  const form = view.querySelector("#co-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    try {
      await api.saveCompany(data);
      view.querySelector("#co-flash").innerHTML = `<p class="bg-green-100 border border-green-300 text-green-800 px-4 py-3 rounded-md text-sm">Saved.</p>`;
    } catch (ex) {
      view.querySelector("#co-flash").innerHTML = `<p class="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-md text-sm">${escapeHtml(ex.message)}</p>`;
    }
  });
};
