import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { encryptSecret } from "@korepush/crypto";
import { envVars } from "@korepush/db";
import { db } from "../../../../lib/db";
import { jsonError } from "../../../../lib/http";

const updateEnvVarSchema = z.object({
  value: z.string()
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ envVarId: string }> }) {
  try {
    const { envVarId } = await params;
    const input = updateEnvVarSchema.parse(await request.json());
    await db
      .update(envVars)
      .set({ valueEncrypted: encryptSecret(input.value), updatedAt: new Date() })
      .where(eq(envVars.id, envVarId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ envVarId: string }> }) {
  const { envVarId } = await params;
  await db.delete(envVars).where(eq(envVars.id, envVarId));
  return NextResponse.json({ ok: true });
}
