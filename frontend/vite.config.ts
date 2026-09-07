import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

const pagesBase = "/Chess-Trainer/";

export default defineConfig(({ command }) => {
  const usePagesBase =
    Boolean(process.env.BASE_URL) ||
    command === "build" ||
    process.env.NODE_ENV === "production";

  return {
    plugins: [react(), tailwindcss()],
    base: process.env.BASE_URL || (usePagesBase ? pagesBase : "/"),
    server: {
      proxy: {
        "/api": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
        },
        // Old local bookmarks and BASE_URL-prefixed fetches.
        "/Chess-Trainer/api": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/Chess-Trainer/, ""),
        },
      },
    },
  };
});
