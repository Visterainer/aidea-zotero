import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://visterainer.github.io",
  base: "/aidea-zotero",
  integrations: [sitemap()],
  build: {
    format: "directory",
  },
});
