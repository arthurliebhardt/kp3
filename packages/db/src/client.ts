import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export function createDb(databaseUrl = requiredEnv("DATABASE_URL")) {
  const client = postgres(databaseUrl, { max: 10 });
  return drizzle(client, { schema });
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export type Db = ReturnType<typeof createDb>;
