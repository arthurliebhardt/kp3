import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { encryptSecret } from "@korepush/crypto";
import { envVars } from "@korepush/db";
import { db } from "../../../../../../../lib/db";
import { jsonError } from "../../../../../../../lib/http";

const envVarSchema = z.object({
  key: z.string().regex(/^[A-Z_][A-Z0-9_]*$/i),
  value: z.string()
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; environmentId: string }> }
) {
  const { projectId, environmentId } = await params;
  const rows = await db
    .select({
      id: envVars.id,
      key: envVars.key,
      createdAt: envVars.createdAt,
      updatedAt: envVars.updatedAt
    })
    .from(envVars)
    .where(and(eq(envVars.projectId, projectId), eq(envVars.environmentId, environmentId)));
  return NextResponse.json({ envVars: rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; environmentId: string }> }
) {
  try {
    const { projectId, environmentId } = await params;
    const input = envVarSchema.parse(await requestBody(request));
    const [row] = await db
      .insert(envVars)
      .values({
        projectId,
        environmentId,
        key: input.key,
        valueEncrypted: encryptSecret(input.value)
      })
      .onConflictDoUpdate({
        target: [envVars.environmentId, envVars.key],
        set: { valueEncrypted: encryptSecret(input.value), updatedAt: new Date() }
      })
      .returning({ id: envVars.id, key: envVars.key, createdAt: envVars.createdAt, updatedAt: envVars.updatedAt });

    return acceptsHtml(request)
      ? NextResponse.redirect(new URL(`/dashboard/projects/${projectId}/env`, request.url), { status: 303 })
      : NextResponse.json({ envVar: row });
  } catch (error) {
    return jsonError(error);
  }
}

async function requestBody(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return request.json();
  const form = await request.formData();
  return Object.fromEntries(form);
}

function acceptsHtml(request: NextRequest) {
  return request.headers.get("accept")?.includes("text/html") ?? false;
}
