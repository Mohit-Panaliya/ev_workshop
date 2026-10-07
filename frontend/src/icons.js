// Exact heroicons (outline) used by the Laravel UI, bundled from the package.
const modules = import.meta.glob("../../node_modules/heroicons/24/outline/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
})

export function icon(name, cls = "w-5 h-5") {
  const raw = modules[`../../node_modules/heroicons/24/outline/${name}.svg`] || ""
  if (!raw) return ""
  return raw.replace("<svg", `<svg class="${cls}" aria-hidden="true"`)
}
