import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { deployments } from "@korepush/db";
import { enqueueJob } from "@korepush/queue";
import { db } from "../../../../../lib/db";
import { currentUserId, jsonError } from "../../../../../lib/http";

export async function POST(request: NextRequest, { params }: { params: Promise<{ deploymentId: string }> }) {
  try {
    const { deploymentId } = await params;
    const [target] = await db.select().from(deployments).where(eq(deployments.id, deploymentId)).limit(1);
    if (!target || target.status !== "ready") throw new Error("Only ready deployments can be rollback targets");

    const [rollback] = await db
      .insert(deployments)
      .values({
        projectId: target.projectId,
        environmentId: target.environmentId,
        status: "queued",
        source: "rollback",
        gitRef: target.gitRef,
        commitSha: target.commitSha,
        commitMessage: target.commitMessage,
        imageRepository: target.imageRepository,
        imageTag: target.imageTag,
        imageDigest: target.imageDigest,
        dockerfilePath: target.dockerfilePath,
        buildContext: target.buildContext,
        buildTarget: target.buildTarget,
        createdByUserId: currentUserId(),
        rollbackFromDeploymentId: target.id
      })
      .returning();

    const job = await enqueueJob(db, {
      kind: "rollback.deployment",
      idempotencyKey: `rollback:${rollback.id}`,
      payload: {
        targetDeploymentId: target.id,
        rollbackDeploymentId: rollback.id,
        createdByUserId: currentUserId()
      }
    });

    return acceptsHtml(request)
      ? NextResponse.redirect(new URL(`/dashboard/projects/${target.projectId}/deployments/${rollback.id}`, request.url), {
          status: 303
        })
      : NextResponse.json({ deploymentId: rollback.id, jobId: job.id, status: "queued" });
  } catch (error) {
    return jsonError(error);
  }
}

function acceptsHtml(request: NextRequest) {
  return request.headers.get("accept")?.includes("text/html") ?? false;
}
