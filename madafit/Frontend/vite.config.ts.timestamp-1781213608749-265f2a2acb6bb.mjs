// vite.config.ts
import { defineConfig, loadEnv } from "file:///D:/Projet%20Eray%20Digital/MADAFIT%20PROD/MadaFit/madafit/Frontend/node_modules/vite/dist/node/index.js";
import react from "file:///D:/Projet%20Eray%20Digital/MADAFIT%20PROD/MadaFit/madafit/Frontend/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
var __vite_injected_original_dirname = "D:\\Projet Eray Digital\\MADAFIT PROD\\MadaFit\\madafit\\Frontend";
var vite_config_default = defineConfig(({ mode }) => {
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
          ws: true
        },
        "/uploads": {
          target: apiTarget,
          changeOrigin: true,
          secure: false
        },
        "/auth": {
          target: apiTarget,
          changeOrigin: true,
          secure: false
        }
      },
      hmr: { overlay: false }
    },
    plugins: [react()],
    resolve: {
      alias: { "@": path.resolve(__vite_injected_original_dirname, "./src") }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxQcm9qZXQgRXJheSBEaWdpdGFsXFxcXE1BREFGSVQgUFJPRFxcXFxNYWRhRml0XFxcXG1hZGFmaXRcXFxcRnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXFByb2pldCBFcmF5IERpZ2l0YWxcXFxcTUFEQUZJVCBQUk9EXFxcXE1hZGFGaXRcXFxcbWFkYWZpdFxcXFxGcm9udGVuZFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovUHJvamV0JTIwRXJheSUyMERpZ2l0YWwvTUFEQUZJVCUyMFBST0QvTWFkYUZpdC9tYWRhZml0L0Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+IHtcclxuICAvLyBDaGFyZ2UgbGVzIHZhcmlhYmxlcyBkJ2Vudmlyb25uZW1lbnQgYmFzXHUwMEU5ZXMgc3VyIGxlIG1vZGUgKGRldiwgcHJvZCwgZXRjLilcclxuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksIFwiXCIpO1xyXG4gIGNvbnN0IGFwaVRhcmdldCA9IGVudi5BUElfQkFTRV9VUkwgfHwgXCJodHRwczovLzEyNy4wLjAuMTo4MDAwXCI7XHJcblxyXG4gIHJldHVybiB7XHJcbiAgICBzZXJ2ZXI6IHtcclxuICAgICAgaG9zdDogXCI6OlwiLFxyXG4gICAgICBwb3J0OiA4MDgwLFxyXG4gICAgICBwcm94eToge1xyXG4gICAgICAgIFwiL2FwaVwiOiB7XHJcbiAgICAgICAgICB0YXJnZXQ6IGFwaVRhcmdldCxcclxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgICAgICB3czogdHJ1ZSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIFwiL3VwbG9hZHNcIjoge1xyXG4gICAgICAgICAgdGFyZ2V0OiBhcGlUYXJnZXQsXHJcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgXCIvYXV0aFwiOiB7XHJcbiAgICAgICAgICB0YXJnZXQ6IGFwaVRhcmdldCxcclxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgICAgaG1yOiB7IG92ZXJsYXk6IGZhbHNlIH0sXHJcbiAgICB9LFxyXG4gICAgcGx1Z2luczogW3JlYWN0KCldLFxyXG4gICAgcmVzb2x2ZToge1xyXG4gICAgICBhbGlhczogeyBcIkBcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL3NyY1wiKSB9LFxyXG4gICAgfSxcclxuICB9O1xyXG59KTsiXSwKICAibWFwcGluZ3MiOiAiO0FBQXdYLFNBQVMsY0FBYyxlQUFlO0FBQzlaLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFGakIsSUFBTSxtQ0FBbUM7QUFJekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE1BQU07QUFFeEMsUUFBTSxNQUFNLFFBQVEsTUFBTSxRQUFRLElBQUksR0FBRyxFQUFFO0FBQzNDLFFBQU0sWUFBWSxJQUFJLGdCQUFnQjtBQUV0QyxTQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsUUFDTCxRQUFRO0FBQUEsVUFDTixRQUFRO0FBQUEsVUFDUixjQUFjO0FBQUEsVUFDZCxRQUFRO0FBQUEsVUFDUixJQUFJO0FBQUEsUUFDTjtBQUFBLFFBQ0EsWUFBWTtBQUFBLFVBQ1YsUUFBUTtBQUFBLFVBQ1IsY0FBYztBQUFBLFVBQ2QsUUFBUTtBQUFBLFFBQ1Y7QUFBQSxRQUNBLFNBQVM7QUFBQSxVQUNQLFFBQVE7QUFBQSxVQUNSLGNBQWM7QUFBQSxVQUNkLFFBQVE7QUFBQSxRQUNWO0FBQUEsTUFDRjtBQUFBLE1BQ0EsS0FBSyxFQUFFLFNBQVMsTUFBTTtBQUFBLElBQ3hCO0FBQUEsSUFDQSxTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsSUFDakIsU0FBUztBQUFBLE1BQ1AsT0FBTyxFQUFFLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU8sRUFBRTtBQUFBLElBQ2pEO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
