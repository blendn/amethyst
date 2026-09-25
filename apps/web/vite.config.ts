import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const hashWasmVersion = (
  require("hash-wasm/package.json") as { version: string }
).version;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react()],
    define: { __HASH_WASM_VERSION__: JSON.stringify(hashWasmVersion) },
    worker: { format: "es" },
    build: {
      rollupOptions: {
        input: {
          app: fileURLToPath(new URL("./index.html", import.meta.url)),
          benchmark: fileURLToPath(
            new URL("./benchmark.html", import.meta.url),
          ),
        },
      },
    },
    server: {
      proxy: {
        "/api": env.VITE_API_TARGET ?? "http://localhost:3001",
      },
    },
  };
});
