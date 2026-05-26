import { createDb } from "@korepush/db";

export const db = createDb(process.env.DATABASE_URL ?? "postgres://localhost:5432/korepush");
