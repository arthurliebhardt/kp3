import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { domains } from "@korepush/db";
import { db } from "../../../../../lib/db";
import { jsonError } from "../../../../../lib/http";

const domainSchema = z.object({
  environmentId: z.string().uuid(),
  hostname: z.string().min(3).toLowerCase()
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const rows = await db.select().from(domains).where(eq(domains.projectId, projectId));
  return NextResponse.json({ domains: rows });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const input = domainSchema.parse(await requestBody(request));
    const [existingPrimary] = await db.select().from(domains).where(eq(domains.projectId, projectId)).limit(1);
    const [domain] = await db
      .insert(domains)
      .values({
        projectId,
        environmentId: input.environmentId,
        hostname: input.hostname,
        isPrimary: !existingPrimary,
        verificationStatus: "pending",
        tlsStatus: "pending"
      })
      .returning();

    return acceptsHtml(request)
      ? NextResponse.redirect(new URL(`/dashboard/projects/${projectId}/domains`, request.url), { status: 303 })
      : NextResponse.json({ domain });
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
