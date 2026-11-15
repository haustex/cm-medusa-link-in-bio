import { defineConfig } from "@medusajs/framework/utils"

// Test app for the E2E suite. Only started through scripts/guard.mjs, which on
// the Haus Kayu host allows nothing but the rw-spike-* containers and ports 9700+.
// e2e.mjs installs the plugin from its npm pack tarball into node_modules, like a user would
const pluginDir = process.env.LIB_PLUGIN_DIR || "medusa-link-in-bio"

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    workerMode: "shared",
    http: {
      storeCors: "*",
      adminCors: "*",
      authCors: "*",
      jwtSecret: "lib-e2e-jwt",
      cookieSecret: "lib-e2e-cookie",
    },
  },
  admin: { disable: process.env.LIB_ADMIN !== "1", backendUrl: "/" },
  plugins: [
    {
      resolve: pluginDir,
      options: {
        storefront: { url: "https://storefront.e2e.test", locales: { en: { prefix: "/us" } } },
        backend_url: "http://127.0.0.1:9700",
        clicks: { flush_ms: 0, count_bots: process.env.LIB_COUNT_BOTS === "1" },
        rate_limit: { max: Number(process.env.LIB_RATE_MAX ?? 0), window_seconds: 60 },
        reserved_handles: ["admin"],
        revalidate: process.env.LIB_REVALIDATE_URL ? { url: process.env.LIB_REVALIDATE_URL, secret: "e2e-revalidate", delay_ms: 300 } : undefined,
        showCredit: process.env.LIB_CREDIT === "1", // off by default, as in the plugin
      },
    },
  ],
})
