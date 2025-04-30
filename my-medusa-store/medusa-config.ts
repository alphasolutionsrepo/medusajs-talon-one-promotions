import { loadEnv, defineConfig } from "@medusajs/framework/utils";
import { TALON_ONE_MODULE } from "./src/modules/talon-one";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  modules: {
    [TALON_ONE_MODULE]: {
      resolve: "./src/modules/talon-one",
      options: {
        basePath: process.env.TALON_ONE_BASE_PATH,
        apiKey: process.env.TALON_ONE_API_KEY,
        apiKeyPrefix: process.env.TALON_ONE_API_KEY_PREFIX,
      },
    },
  },
});
