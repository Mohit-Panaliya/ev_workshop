import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  base: "/assets/ev_workshop/frontend/",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,woff,woff2}"],
        // Shell + read APIs stay usable offline after first load.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/method/ev_workshop.workshop_api.get_"),
            handler: "NetworkFirst",
            options: { cacheName: "evworkshop-api", networkTimeoutSeconds: 5 },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/method/frappe.auth.get_logged_user"),
            handler: "NetworkFirst",
            options: { cacheName: "evworkshop-auth", networkTimeoutSeconds: 3 },
          },
        ],
      },
      manifest: {
        name: "EV Workshop",
        short_name: "EVWorkshop",
        description: "Job cards, customers, counter sales, payments and analytics.",
        start_url: "/evhub",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#6366f1",
        background_color: "#ffffff",
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
    rollupOptions: {
      output: { entryFileNames: "assets/index.js", chunkFileNames: "assets/[name].js", assetFileNames: "assets/[name].[ext]" },
    },
  },
})
