import { defineConfig } from "vite"

export default defineConfig({
  base: "/assets/ev_workshop/frontend/",
  build: {
    outDir: "../ev_workshop/public/frontend",
    emptyOutDir: false,
    target: "es2019",
    rollupOptions: {
      output: { entryFileNames: "assets/index.js", chunkFileNames: "assets/[name].js", assetFileNames: "assets/[name].[ext]" },
    },
  },
})
