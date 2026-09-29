import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/search-for-job/",
  plugins: [react()],
  build: {
    sourcemap: true,
  },
});
