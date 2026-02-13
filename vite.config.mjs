import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig(({ command }) => {
  if (command === "serve") {
    return {
      plugins: [react()]
    };
  }

  return {
    build: {
      target: "es2019",
      outDir: "dist",
      sourcemap: true,
      lib: {
        entry: {
          index: resolve(__dirname, "src/index.ts"),
          react: resolve(__dirname, "src/react.ts")
        },
        formats: ["es", "cjs"],
        fileName: (format, entryName) =>
          `${entryName}.${format === "es" ? "mjs" : "cjs"}`
      },
      rollupOptions: {
        external: ["react", "react-dom", "react/jsx-runtime"]
      }
    }
  };
});
