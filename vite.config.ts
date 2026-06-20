import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        // This will transform your SVG to a React component
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  base: '/', // обязательно для корневого деплоя
  optimizeDeps: {
    // Pre-bundle the heavy editor deps so Vite doesn't discover them lazily
    // and trigger a dev-server reload loop on first load.
    include: [
      "@blocknote/core",
      "@blocknote/react",
      "@blocknote/mantine",
      "@mantine/core",
      "@mantine/hooks",
    ],
  },
});
