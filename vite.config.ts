import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { pagesBase } from "./src/web/pages-base";

export default defineConfig({
  base: pagesBase(process.env.BLOCKS_BASE),
  root: path.resolve(__dirname, "web"),
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 41713,
    strictPort: true,
  },
  resolve: {
    extensions: [".web.tsx", ".web.ts", ".tsx", ".ts", ".jsx", ".js"],
    alias: {
      "react-native": "react-native-web",
    },
  },
  plugins: [react()],
});
