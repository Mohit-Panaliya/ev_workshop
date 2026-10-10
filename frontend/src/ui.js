// Design system ported 1:1 from resources/views/components/*.blade.php
import { icon } from "./icons.js"

export const BADGE_COLORS = {
  green: "border-transparent bg-green-100 text-green-800",
  amber: "border-transparent bg-amber-100 text-amber-800",
  red: "border-transparent bg-red-100 text-red-800",
  gray: "border-transparent bg-muted text-muted-foreground",
  primary: "border-transparent bg-primary-100 text-primary-800",
  purple: "border-transparent bg-purple-100 text-purple-800",
}

export function badge(color, inner) {
  const c = BADGE_COLORS[color] || BADGE_COLORS.gray
  return `<span class="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${c}">${inner}</span>`
}

export function button(label, { variant = "primary", href = null, type = "button", cls = "", iconName = null, iconCls = "w-4 h-4", attrs = "" } = {}) {
  const base = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md h-10 px-4 py-2 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-sm",
    danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    success: "bg-green-600 text-white hover:bg-green-600/90",
    ghost: "hover:bg-accent hover:text-accent-foreground",
  }
  const inner = `${iconName ? icon(iconName, iconCls) : ""}${label}`
  if (href) return `<a href="${href}" class="${base} ${variants[variant] || variants.primary} ${cls}" ${attrs}>${inner}</a>`
  return `<button type="${type}" class="${base} ${variants[variant] || variants.primary} ${cls}" ${attrs}>${inner}</button>`
}

export function card(inner, cls = "") {
  return `<div class="rounded-lg border border-border bg-card text-card-foreground shadow-sm p-6 ${cls}">${inner}</div>`
}

export function pageHeader(titleIcon, title, actions = "") {
  return `<div class="flex justify-between items-center">
    <h2 class="flex items-center gap-2 font-semibold text-xl text-gray-800 leading-tight">${icon(titleIcon, "w-6 h-6 text-primary")}${title}</h2>
    <div class="flex items-center gap-2">${actions}</div>
  </div>`
}

export function searchBar(name, value, placeholder) {
  return `<div class="relative">
    <input type="text" name="${name}" value="${escapeHtml(value)}" placeholder="${placeholder}"
      class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      ${icon("magnifying-glass", "h-5 w-5 text-gray-400")}
    </div>
  </div>`
}

export function fieldLabel(text, forId = "") {
  return `<label${forId ? ` for="${forId}"` : ""} class="block font-medium text-sm text-gray-700">${text}</label>`
}

const INPUT_CLS = "block w-full rounded-md border border-gray-300 bg-white h-10 px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shadow-sm"

export function textInput(name, value = "", type = "text", extra = "") {
  return `<input type="${type}" name="${name}" value="${escapeHtml(value)}" class="${INPUT_CLS}" ${extra}>`
}

export function selectInput(name, optionsHtml, extra = "") {
  return `<select name="${name}" id="${name}" class="${INPUT_CLS}" ${extra}>${optionsHtml}</select>`
}

// Filter-panel variants (plain inputs, exact filter-panel/search-bar classes)
export function filterLabel(text, forId) {
  return `<label for="${forId}" class="block text-sm font-medium text-gray-700 mb-1">${text}</label>`
}

export function filterInput(name, value = "", type = "text") {
  return `<input type="${type}" name="${name}" id="${name}" value="${escapeHtml(value)}" class="w-full border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">`
}

export function filterSelect(name, optionsHtml) {
  return `<select name="${name}" id="${name}" class="w-full border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">${optionsHtml}</select>`
}

export function searchBarExact(name, value, placeholder) {
  return `<div class="relative">
    <input type="text" name="${name}" id="${name}" value="${escapeHtml(value)}" placeholder="${placeholder}"
      class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      ${icon("magnifying-glass", "h-5 w-5 text-gray-400")}
    </div>
  </div>`
}

export function dataTable(headers, rowsHtml, emptyIcon, emptyText) {
  const body = rowsHtml
    ? `<div class="overflow-x-auto"><table class="min-w-full divide-y divide-border">
        <thead class="bg-muted/50 border-b border-border"><tr>${headers}</tr></thead>
        <tbody class="bg-card divide-y divide-border">${rowsHtml}</tbody>
      </table></div>`
    : `<div class="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        ${icon(emptyIcon, "w-12 h-12 text-muted-foreground")}
        <p class="text-sm text-muted-foreground">${emptyText}</p>
      </div>`
  return `<div class="rounded-lg border border-border bg-card shadow-sm overflow-hidden">${body}</div>`
}

export function th(text, cls = "") {
  return `<th class="align-middle px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider ${cls}">${text}</th>`
}

export function td(html, cls = "") {
  return `<td class="align-middle px-6 py-2 whitespace-nowrap text-sm text-gray-600 ${cls}">${html}</td>`
}

export function logo(cls = "h-8 w-auto") {
  return `<svg
    viewBox="0 0 59.486824 18.491203"
    role="img"
    aria-label="GMS"
    xmlns="http://www.w3.org/2000/svg"
    CLASSATTR
>
    <g transform="translate(-69.823571,-115.38164)">
        <path
            style="font-style:italic;font-weight:800;font-size:25.4px;font-family:Montserrat;-inkscape-font-specification:'Montserrat Ultra-Bold Italic';stroke-width:0.264583"
            d="m 78.764374,133.87284 q -2.6924,0 -4.7244,-0.9906 -2.0066,-0.9906 -3.1242,-2.7432 -1.0922,-1.778 -1.0922,-4.0894 0,-2.3114 0.8128,-4.2672 0.8128,-1.9558 2.3114,-3.3782 1.4986,-1.4478 3.556,-2.2352 2.0828,-0.7874 4.6228,-0.7874 2.667,0 4.5974,0.8382 1.9558,0.8382 3.1496,2.4384 l -3.6068,2.8448 q -0.889,-1.0922 -1.9304,-1.524 -1.0414,-0.4318 -2.4384,-0.4318 -1.3716,0 -2.4892,0.4572 -1.0922,0.4572 -1.8796,1.2954 -0.7874,0.8382 -1.2192,1.9812 -0.4064,1.1176 -0.4064,2.4384 0,1.1938 0.5334,2.1082 0.5334,0.889 1.5494,1.397 1.016,0.4826 2.4638,0.4826 1.1684,0 2.2352,-0.381 1.0922,-0.381 2.1844,-1.27 l 1.905,3.683 q -1.3716,1.016 -3.175,1.5748 -1.8034,0.5588 -3.8354,0.5588 z m 2.7178,-2.921 1.3462,-6.7056 h 4.445 l -1.4986,7.493 z m 7.137412,2.5654 3.556,-17.78 h 4.0894 l 4.902204,12.1158 h -2.159004 l 9.499604,-12.1158 h 4.2926 l -3.5052,17.78 h -4.6482 l 2.1082,-10.7696 0.8382,-0.0254 -7.0358,9.0424 h -2.209804 l -3.8354,-9.0678 0.889,0.0762 -2.159,10.7442 z m 30.861014,0.3556 q -1.524,0 -2.921,-0.254 -1.397,-0.2286 -2.54,-0.6604 -1.143,-0.4572 -1.9558,-0.9906 l 1.9812,-3.7592 q 0.9144,0.5588 1.8796,0.9652 0.9906,0.381 2.0066,0.5842 1.016,0.2032 2.032,0.2032 0.9652,0 1.651,-0.1778 0.6858,-0.2032 1.0414,-0.5588 0.3556,-0.3556 0.3556,-0.8382 0,-0.5334 -0.4826,-0.8382 -0.4572,-0.3302 -1.2192,-0.5588 -0.762,-0.2286 -1.7018,-0.4572 -0.9144,-0.254 -1.8542,-0.5842 -0.9144,-0.3556 -1.6764,-0.8636 -0.762,-0.5334 -1.2446,-1.3462 -0.4572,-0.8128 -0.4572,-2.0066 0,-1.9304 1.0414,-3.3528 1.0414,-1.4224 2.9464,-2.2098 1.9304,-0.7874 4.5466,-0.7874 1.905,0 3.556,0.4064 1.651,0.381 2.8448,1.1176 l -1.8288,3.7338 q -1.0414,-0.6604 -2.3114,-0.9906 -1.2446,-0.3556 -2.5654,-0.3556 -1.016,0 -1.7526,0.2286 -0.7112,0.2286 -1.0922,0.635 -0.3556,0.381 -0.3556,0.8636 0,0.508 0.4572,0.8382 0.4572,0.3302 1.2192,0.5588 0.7874,0.2286 1.7018,0.4826 0.9398,0.2286 1.8542,0.5588 0.9144,0.3048 1.7018,0.8382 0.7874,0.508 1.2446,1.2954 0.4572,0.7874 0.4572,1.9558 0,1.905 -1.0414,3.3274 -1.0414,1.4224 -2.9718,2.2098 -1.9304,0.7874 -4.5466,0.7874 z"
            id="text1" />
    </g>
</svg>
`.replace("CLASSATTR", `class="${cls}"`);
}

export function escapeHtml(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

export function money(v) {
  return `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtDate(v) {
  if (!v) return "-"
  const d = new Date(v)
  if (isNaN(d)) return v
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
}

export function statusBadge(map, status, iconMap = {}) {
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  const ic = iconMap[status] ? icon(iconMap[status], "w-3.5 h-3.5") : ""
  return badge(map[status] || map.default || "gray", `${ic}${label}`)
}

export const JOB_STATUS_BADGES = {
  delivered: "green", ready_for_delivery: "primary", in_progress: "purple",
  waiting_for_parts: "amber", cancelled: "red", default: "gray",
}
export const JOB_STATUS_ICONS = {
  delivered: "check-circle", ready_for_delivery: "check-badge", in_progress: "clock",
  waiting_for_parts: "pause-circle", cancelled: "x-circle",
}

export function sortTh(label, column, current, right = false) {
  const active = current && current.column === column
  const arrow = active ? (current.direction === "asc" ? " ▲" : " ▼") : ""
  return `<th class="align-middle px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider${right ? " text-right" : ""}"><a href="#" data-sort="${column}" class="hover:text-gray-900">${label}${arrow}</a></th>`
}

export function bindSort(table, current, onChange) {
  table.querySelectorAll("[data-sort]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault()
    const col = a.dataset.sort
    if (current.column === col) current.direction = current.direction === "asc" ? "desc" : "asc"
    else {
      current.column = col
      current.direction = "asc"
    }
    onChange()
  }))
}
