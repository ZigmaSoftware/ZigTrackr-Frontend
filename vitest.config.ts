import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  // node, not jsdom: these are pure config-consistency checks with no DOM, and
  // the jsdom build available on Node 20 fails to load here.
  test: { environment: "node", globals: true },
});
