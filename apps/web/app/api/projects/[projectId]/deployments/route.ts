import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { deployments, environments, projects } from "@korepush/db";
import { enqueueJob } from "@korepush/queue";
import { db } from "../../../../../lib/db";
import { currentUserId, jsonError } from "../../../../../lib/http";

const createDeploymentSchema = z.object({
  environmentId: z.string().uuid(),
  gitRef: z.string().min(1)
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const rows = await db
    .select()
    .from(deployments)
    .where(eq(deployments.projectId, projectId))
    .orderBy(desc(deployments.createdAt));
  return NextResponse.json({ deployments: rows });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const input = createDeploymentSchema.parse(await requestBody(request));
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project) throw new Error("Project not found");

    const [environment] = await db.select().from(environments).where(eq(environments.id, input.environmentId)).limit(1);
    if (!environment || environment.projectId !== project.id) throw new Error("Environment not found");

    const [deployment] = await db
      .insert(deployments)
      .values({
        projectId: project.id,
        environmentId: environment.id,
        status: "queued",
        source: "manual",
        gitRef: input.gitRef,
        dockerfilePath: project.dockerfilePath,
        buildContext: project.buildContext,
        buildTarget: project.buildTarget,
        createdByUserId: currentUserId()
      })
      .returning();

    const job = await enqueueJob(db, {
      kind: "deploy.project",
      idempotencyKey: `deploy:${deployment.id}`,
      payload: {
        projectId: project.id,
        environmentId: environment.id,
        deploymentId: deployment.id,
        createdByUserId: currentUserId(),
        gitRef: input.gitRef
      }
    });

    return acceptsHtml(request)
      ? NextResponse.redirect(new URL(`/dashboard/projects/${project.id}/deployments/${deployment.id}`, request.url), {
          status: 303
        })
      : NextResponse.json({ deploymentId: deployment.id, jobId: job.id, status: "queued" });
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
