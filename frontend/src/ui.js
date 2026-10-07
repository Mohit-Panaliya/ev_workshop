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

export function fieldLabel(text) {
  return `<label class="block text-sm font-medium text-gray-700 mb-1">${text}</label>`
}

export function textInput(name, value = "", type = "text", extra = "") {
  return `<input type="${type}" name="${name}" value="${escapeHtml(value)}" class="block w-full rounded-md border border-gray-300 bg-white shadow-sm text-sm" ${extra}>`
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
  // GMS wordmark placeholder mirroring application-logo (svg text mark)
  return `<svg viewBox="0 0 120 24" class="${cls}" role="img" aria-label="EV Workshop">
    <text x="0" y="18" font-family="Inter, sans-serif" font-weight="800" font-style="italic" font-size="18" fill="#6366f1">EVW</text>
  </svg>`
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
