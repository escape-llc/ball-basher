import { defineConfig } from "vite";
import rootPackage from "./package.json";

export default defineConfig({
  base: "./",
  define: {
    __VANILLA_VERSION__: JSON.stringify(rootPackage.version),
  },
  server: {
    open: false,
  },
  build: {
    target: "esnext",
    outDir: "./dist",
    emptyOutDir: true,
  },
  optimizeDeps: {
    include: ["@babylonjs/havok"],
  },
});