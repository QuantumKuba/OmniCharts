import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "path";
import viteRawPlugin from "./vite/vite-raw-plugin.js";
import banner from "vite-plugin-banner";
import pkg from "./package.json";

// https://vitejs.dev/config/
export default defineConfig({
  root: "src",
  plugins: [
    banner({
      content:
        `/* NightVision/OmniCharts v${pkg.version} | License: MIT\n` +
        ` © 2022-2025 ChartMaster. All rights reserved */`,
      outDir: "../dist",
    }),
    svelte({
      emitCss: false,
    }),
    viteRawPlugin({
      fileRegex: /\.navy$/,
    }),
  ],
  server: {
    port: 8085,
    proxy: {
      '/api': {
        target: 'https://api.binance.com',
        changeOrigin: true,
        secure: true,
        rewrite: path => path.replace(/^\/api/, '/api')
      }
    },
  },
  build: {
    target: "es2018",
    outDir: "../dist",
    emptyOutDir: true,
    // Keep the library configuration for when building as a library
    lib: process.env.BUILD_AS_LIB ? {
      entry: resolve(__dirname, "src/index.js"),
      name: "NightVision",
      fileName: "night-vision",
    } : undefined,
    rollupOptions: {
      // When not building as a library, use main.js as the entry point
      input: process.env.BUILD_AS_LIB ? undefined : resolve(__dirname, "src/index.html"),
      output: {
        manualChunks: undefined,
      }
    },
    minify: process.env.NODE_ENV === 'production',
  },
});
