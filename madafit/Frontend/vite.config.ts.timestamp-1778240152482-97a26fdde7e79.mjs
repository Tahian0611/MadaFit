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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxQcm9qZXQgRXJheSBEaWdpdGFsXFxcXE1BREFGSVQgUFJPRFxcXFxNYWRhRml0XFxcXG1hZGFmaXRcXFxcRnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXFByb2pldCBFcmF5IERpZ2l0YWxcXFxcTUFEQUZJVCBQUk9EXFxcXE1hZGFGaXRcXFxcbWFkYWZpdFxcXFxGcm9udGVuZFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovUHJvamV0JTIwRXJheSUyMERpZ2l0YWwvTUFEQUZJVCUyMFBST0QvTWFkYUZpdC9tYWRhZml0L0Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XG4gIC8vIENoYXJnZSBsZXMgdmFyaWFibGVzIGQnZW52aXJvbm5lbWVudCBiYXNcdTAwRTllcyBzdXIgbGUgbW9kZSAoZGV2LCBwcm9kLCBldGMuKVxuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksIFwiXCIpO1xuICBjb25zdCBhcGlUYXJnZXQgPSBlbnYuQVBJX0JBU0VfVVJMIHx8IFwiaHR0cHM6Ly8xMjcuMC4wLjE6ODAwMFwiO1xuXG4gIHJldHVybiB7XG4gICAgc2VydmVyOiB7XG4gICAgICBob3N0OiBcIjo6XCIsXG4gICAgICBwb3J0OiA4MDgwLFxuICAgICAgcHJveHk6IHtcbiAgICAgICAgXCIvYXBpXCI6IHtcbiAgICAgICAgICB0YXJnZXQ6IGFwaVRhcmdldCxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgICAgICB3czogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgXCIvdXBsb2Fkc1wiOiB7XG4gICAgICAgICAgdGFyZ2V0OiBhcGlUYXJnZXQsXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICAgIFwiL2F1dGhcIjoge1xuICAgICAgICAgIHRhcmdldDogYXBpVGFyZ2V0LFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICBzZWN1cmU6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGhtcjogeyBvdmVybGF5OiBmYWxzZSB9LFxuICAgIH0sXG4gICAgcGx1Z2luczogW3JlYWN0KCldLFxuICAgIHJlc29sdmU6IHtcbiAgICAgIGFsaWFzOiB7IFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpIH0sXG4gICAgfSxcbiAgfTtcbn0pOyJdLAogICJtYXBwaW5ncyI6ICI7QUFBd1gsU0FBUyxjQUFjLGVBQWU7QUFDOVosT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUZqQixJQUFNLG1DQUFtQztBQUl6QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssTUFBTTtBQUV4QyxRQUFNLE1BQU0sUUFBUSxNQUFNLFFBQVEsSUFBSSxHQUFHLEVBQUU7QUFDM0MsUUFBTSxZQUFZLElBQUksZ0JBQWdCO0FBRXRDLFNBQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxRQUNMLFFBQVE7QUFBQSxVQUNOLFFBQVE7QUFBQSxVQUNSLGNBQWM7QUFBQSxVQUNkLFFBQVE7QUFBQSxVQUNSLElBQUk7QUFBQSxRQUNOO0FBQUEsUUFDQSxZQUFZO0FBQUEsVUFDVixRQUFRO0FBQUEsVUFDUixjQUFjO0FBQUEsVUFDZCxRQUFRO0FBQUEsUUFDVjtBQUFBLFFBQ0EsU0FBUztBQUFBLFVBQ1AsUUFBUTtBQUFBLFVBQ1IsY0FBYztBQUFBLFVBQ2QsUUFBUTtBQUFBLFFBQ1Y7QUFBQSxNQUNGO0FBQUEsTUFDQSxLQUFLLEVBQUUsU0FBUyxNQUFNO0FBQUEsSUFDeEI7QUFBQSxJQUNBLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxJQUNqQixTQUFTO0FBQUEsTUFDUCxPQUFPLEVBQUUsS0FBSyxLQUFLLFFBQVEsa0NBQVcsT0FBTyxFQUFFO0FBQUEsSUFDakQ7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
