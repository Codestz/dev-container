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
      port: 24678,
      protocol: "ws",
      clientPort: 24678,
      overlay: false,
    },
    host: "0.0.0.0",
    watch: {
      usePolling: true,
    },
  },
});
