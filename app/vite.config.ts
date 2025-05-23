import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import { componentTagger } from "./src/plugins/metadata-generator";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), componentTagger()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    hmr: {
      host: "0.0.0.0",
      port: 443,
      protocol: "ws",
      clientPort: 443,
      overlay: false,
    },
    host: "0.0.0.0",
    port: 3001,
    watch: {
      usePolling: true,
    },
    cors: true,
    allowedHosts: true,
  },
});
