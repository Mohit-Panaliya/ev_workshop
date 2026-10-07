// App shell ported from layouts/app.blade.php + layouts/navigation.blade.php
import { icon } from "./icons.js"
import { logo } from "./ui.js"

const NAV = [
  { hash: "#/dashboard", pattern: /^#\/dashboard/, icon: "home", label: "Dashboard" },
  { hash: "#/jobs", pattern: /^#\/jobs/, icon: "wrench-screwdriver", label: "Job Cards" },
  { hash: "#/customers", pattern: /^#\/customers/, icon: "users", label: "Customers" },
  { hash: "#/catalog", pattern: /^#\/catalog/, icon: "book-open", label: "Vehicle Catalog" },
  { hash: "#/counters", pattern: /^#\/counters/, icon: "receipt-percent", label: "Counter Invoice" },
  { hash: "#/payments", pattern: /^#\/payments/, icon: "banknotes", label: "Payments" },
  { hash: "#/inventory", pattern: /^#\/(inventory|labour)/, icon: "cube", label: "Inventory" },
  { hash: "#/employees", pattern: /^#\/employees/, icon: "user-group", label: "Employees" },
]

function navLink(item, active, collapsed) {
  const base = "group flex items-center mx-2 my-0.5 py-2 rounded-lg text-sm transition duration-150 ease-in-out focus:outline-none"
  const state = active
    ? "bg-accent text-accent-foreground font-medium"
    : "text-gray-600 hover:bg-accent hover:text-accent-foreground focus:text-accent-foreground focus:bg-accent"
  const pad = collapsed ? "justify-center px-2" : "px-3"
  const ic = active ? "heroicon-s" : "heroicon-o"
  void ic
  return `<a href="${item.hash}" class="${base} ${state} ${pad}">
    ${icon(item.icon, "w-5 h-5 shrink-0")}
    ${collapsed ? "" : `<span class="ms-3 whitespace-nowrap">${item.label}</span>`}
  </a>`
}

function sidebar(collapsed, user, currentHash) {
  const links = NAV.map((n) => navLink(n, n.pattern.test(currentHash), collapsed)).join("")
  const initials = (user?.name || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("")
  return `<aside class="fixed inset-y-0 left-0 z-30 hidden md:flex flex-col bg-background border-r border-border transition-all duration-300 ease-in-out ${collapsed ? "w-20" : "w-64"}">
    <div class="flex items-center justify-center h-14 shrink-0 border-b border-border overflow-hidden">
      <a href="#/dashboard" class="flex items-center justify-center ${collapsed ? "h-5" : "h-9"}">${logo("h-full w-auto")}</a>
    </div>
    <nav class="flex-1 overflow-y-auto py-4">${links}</nav>
    <div class="shrink-0 border-t border-border">
      <div class="flex justify-center px-2 pt-2 pb-2">
        <button type="button" data-action="toggle-collapsed" title="${collapsed ? "Expand sidebar" : "Collapse sidebar"}"
          class="inline-flex items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition duration-150 ease-in-out">
          ${icon(collapsed ? "chevron-right" : "chevron-left", "w-4 h-4")}
        </button>
      </div>
      <div class="border-t border-border" aria-hidden="true"></div>
      <div class="p-2">
        <div class="w-full flex items-center px-2 py-2 rounded-lg text-gray-700 ${collapsed ? "justify-center px-0" : ""}">
          <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-sm font-semibold shrink-0">${initials}</span>
          ${collapsed ? "" : `<span class="ms-3 flex-1 min-w-0 text-start">
            <span class="block text-sm font-medium text-gray-800 truncate">${user?.name || ""}</span>
            <span class="block text-xs text-gray-500 truncate">${user?.email || ""}</span>
          </span>
          <button type="button" data-action="logout" title="Log Out" class="text-gray-400 hover:text-red-600">${icon("arrow-right-start-on-rectangle", "w-4 h-4")}</button>`}
        </div>
      </div>
    </div>
  </aside>`
}

function drawer(user, currentHash, open) {
  const links = NAV.map((n) => {
    const base = "group flex items-center mx-2 my-0.5 py-2 rounded-lg text-sm transition duration-150 ease-in-out focus:outline-none px-3"
    const state = n.pattern.test(currentHash)
      ? "bg-accent text-accent-foreground font-medium"
      : "text-gray-600 hover:bg-accent hover:text-accent-foreground focus:text-accent-foreground focus:bg-accent"
    return `<a href="${n.hash}" class="${base} ${state}">${icon(n.icon, "w-5 h-5 shrink-0")}<span class="ms-3 whitespace-nowrap">${n.label}</span></a>`
  }).join("")
  return `<aside class="fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-background border-r border-border shadow-xl md:hidden transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "-translate-x-full"}">
    <div class="flex items-center justify-between h-14 px-4 shrink-0 border-b border-border">
      <a href="#/dashboard" class="flex items-center">${logo("w-auto h-8")}</a>
      <button type="button" data-action="close-mobile" class="inline-flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent focus:outline-none focus:bg-accent focus:text-foreground transition duration-150 ease-in-out">${icon("x-mark", "w-6 h-6")}</button>
    </div>
    <nav class="flex-1 overflow-y-auto py-4">${links}</nav>
  </aside>`
}

export function shell({ user, collapsed, mobileOpen, header, content, currentHash }) {
  return `<div class="min-h-screen bg-muted">
    ${sidebar(collapsed, user, currentHash)}
    ${mobileOpen ? `<div class="fixed inset-0 z-30 bg-gray-900/50 md:hidden" data-action="close-mobile"></div>` : ""}
    ${drawer(user, currentHash, mobileOpen)}
    <div class="min-h-screen flex flex-col transition-all duration-300 ease-in-out ${collapsed ? "md:ml-20" : "md:ml-64"}">
      <header class="sticky top-0 z-20 bg-background border-b border-border">
        <div class="flex items-center px-4 sm:px-6 lg:px-8 h-14">
          <button type="button" data-action="open-mobile" class="me-3 -ms-2 inline-flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent md:hidden focus:outline-none focus:bg-accent focus:text-foreground transition duration-150 ease-in-out">
            ${icon("bars-3", "w-6 h-6")}
          </button>
          <div class="flex-1 min-w-0">${header}</div>
        </div>
      </header>
      <main class="flex-1">${content}</main>
    </div>
  </div>`
}
