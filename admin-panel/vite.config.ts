import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const gameHttpTarget = process.env.VITE_DEV_GAME_HTTP_TARGET ?? "http://localhost:3100";
const authTarget = process.env.VITE_DEV_AUTH_TARGET ?? "http://localhost:3200";
const blockchainTarget = process.env.VITE_DEV_BLOCKCHAIN_TARGET ?? "http://localhost:3300";

export default defineConfig({
  // Served from https://darkvell.ru/admin/ in production. Without this the built
  // asset URLs would point at /assets/, which nginx maps to the game client's
  // own hashed bundles.
  base: "/admin/",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/game": {
        target: gameHttpTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/game/, "")
      },
      "/auth": {
        target: authTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/auth/, "")
      },
      "/blockchain": {
        target: blockchainTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/blockchain/, "")
      }
    }
  },
  preview: {
    host: "0.0.0.0"
  }
});
