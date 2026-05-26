import { createAuth } from "@korepush/auth";

import { db } from "./db";

export const auth = createAuth(db);
