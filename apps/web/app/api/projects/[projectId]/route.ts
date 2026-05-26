import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { projects } from "@korepush/db";
import { validateRepoPath } from "@korepush/k8s";
import { db } from "../../../../lib/db";
import { jsonError } from "../../../../lib/http";

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  repoUrl: z.url().optional(),
  defaultBranch: z.string().min(1).optional(),
  dockerfilePath: z.string().min(1).optional(),
  buildContext: z.string().min(1).optional(),
  port: z.coerce.number().int().min(1).max(65535).optional()
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const input = updateProjectSchema.parse(await requestBody(request));
    if (input.dockerfilePath) validateRepoPath(input.dockerfilePath);
    if (input.buildContext) validateRepoPath(input.buildContext);

    const [project] = await db
      .update(projects)
      .set({
        name: input.name,
        gitRepoUrl: input.repoUrl,
        gitDefaultBranch: input.defaultBranch,
        dockerfilePath: input.dockerfilePath,
        buildContext: input.buildContext,
        port: input.port,
        updatedAt: new Date()
      })
      .where(eq(projects.id, projectId))
      .returning();

    return NextResponse.json({ project });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  return PATCH(request, ctx);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await db.update(projects).set({ deletedAt: new Date() }).where(eq(projects.id, projectId));
  return NextResponse.json({ ok: true });
}

async function requestBody(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return request.json();
  const form = await request.formData();
  return Object.fromEntries(form);
}
