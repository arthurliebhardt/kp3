import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { clusters } from "@korepush/db";
import { db } from "../../../../lib/db";

export async function GET() {
  const [cluster] = await db.select().from(clusters).where(eq(clusters.slug, "local")).limit(1);
  return NextResponse.json({
    id: cluster?.id,
    name: cluster?.name ?? "Local K3s",
    status: cluster?.status ?? "registered",
    defaultRegistryUrl: cluster?.defaultRegistryUrl ?? process.env.REGISTRY_URL,
    defaultIngressClass: cluster?.defaultIngressClass ?? "traefik"
  });
}
