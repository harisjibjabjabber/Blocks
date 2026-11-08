import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "web"),
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
