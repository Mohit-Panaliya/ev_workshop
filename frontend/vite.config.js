import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  base: "/assets/ev_workshop/frontend/",
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,woff,woff2}"],
        runtimeCaching: [
          {
            // Read-only API GETs work offline after first load
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/api/method/ev_workshop.workshop_api.get_"),
            handler: "NetworkFirst",
            options: { cacheName: "workshop-api", networkTimeoutSeconds: 5 },
          },
          {
            // Frappe boot/session check stays online-first with fast fallback
            urlPattern: ({ url }) => url.pathname.startsWith("/api/method/frappe.auth.get_logged_user"),
            handler: "NetworkFirst",
            options: { cacheName: "workshop-auth", networkTimeoutSeconds: 3 },
          },
        ],
      },
      manifest: {
        name: "EV Workshop",
        short_name: "EVWorkshop",
        description: "Job cards, status tracking and billing for the workshop floor.",
        start_url: "/workshop",
        scope: "/workshop",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#1d4ed8",
        background_color: "#f1f5f9",
        icons: [
          { src: "/assets/ev_workshop/frontend/manifest/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/assets/ev_workshop/frontend/manifest/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/assets/ev_workshop/frontend/manifest/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/assets/ev_workshop/frontend/manifest/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  build: {
    outDir: "../ev_workshop/public/frontend",
    emptyOutDir: false,
    target: "es2019",
    rollupOptions: { output: { entryFileNames: "assets/index.js", chunkFileNames: "assets/[name].js", assetFileNames: "assets/[name].[ext]" } },
  },
})
