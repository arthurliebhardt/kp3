import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { deploymentEvents } from "@korepush/db";
import { db } from "../../../../../lib/db";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ deploymentId: string }> }) {
  const { deploymentId } = await params;
  const events = await db.select().from(deploymentEvents).where(eq(deploymentEvents.deploymentId, deploymentId));
  return NextResponse.json({
    logs: events
      .filter((event) => event.type.startsWith("build"))
      .map((event) => ({
        timestamp: event.createdAt,
        line: event.message,
        metadata: event.metadata
      }))
  });
}
