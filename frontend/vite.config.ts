import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const proxyTarget = process.env.VITE_PROXY_TARGET ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: process.env.CHOKIDAR_USEPOLLING === "1",
    },
    proxy: {
      "/health": { target: proxyTarget, changeOrigin: true },
      "/ready": { target: proxyTarget, changeOrigin: true },
    },
  },
});
