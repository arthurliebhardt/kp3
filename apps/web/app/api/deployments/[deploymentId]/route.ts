import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { deploymentEvents, deployments } from "@korepush/db";
import { db } from "../../../../lib/db";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ deploymentId: string }> }) {
  const { deploymentId } = await params;
  const [deployment] = await db.select().from(deployments).where(eq(deployments.id, deploymentId)).limit(1);
  const events = await db.select().from(deploymentEvents).where(eq(deploymentEvents.deploymentId, deploymentId));
  return NextResponse.json({ ...deployment, events });
}
