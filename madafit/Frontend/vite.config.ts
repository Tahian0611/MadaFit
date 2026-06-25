import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  // Charge les variables d'environnement basées sur le mode (dev, prod, etc.)
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.API_BASE_URL || "https://127.0.0.1:8000";

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
        "/uploads": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
        "/auth": {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
      hmr: { overlay: false },
    },
    plugins: [react()],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
  };
});