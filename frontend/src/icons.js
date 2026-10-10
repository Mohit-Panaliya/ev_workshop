// Exact heroicons (outline) used by the Laravel UI, vendored locally
// (see scripts/sync-icons.js) so the production bundle always includes them.
const modules = import.meta.glob("./icons/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

export function icon(name, cls = "w-5 h-5", solid = false) {
  const file = solid ? `./icons/solid-${name}.svg` : `./icons/${name}.svg`;
  const raw = modules[file] || modules[`./icons/${name}.svg`] || "";
  if (!raw) return "";
  return raw.replace("<svg", `<svg class="${cls}" aria-hidden="true"`);
}
