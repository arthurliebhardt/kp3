import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { domains } from "@korepush/db";
import { db } from "../../../../../lib/db";
import { jsonError } from "../../../../../lib/http";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ domainId: string }> }) {
  try {
    const { domainId } = await params;
    const [domain] = await db.select().from(domains).where(eq(domains.id, domainId)).limit(1);
    if (!domain) throw new Error("Domain not found");
    await db.transaction(async (tx) => {
      await tx.update(domains).set({ isPrimary: false }).where(eq(domains.environmentId, domain.environmentId));
      await tx.update(domains).set({ isPrimary: true }).where(eq(domains.id, domainId));
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
