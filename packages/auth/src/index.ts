import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import type { Db } from "@korepush/db";

export function createAuth(db: Db) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg"
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false
    },
    secret: process.env.BETTER_AUTH_SECRET ?? "development-build-secret-change-me",
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
  });
}
