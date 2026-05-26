import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { domains } from "@korepush/db";
import { db } from "../../../../lib/db";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ domainId: string }> }) {
  const { domainId } = await params;
  await db.delete(domains).where(eq(domains.id, domainId));
  return NextResponse.json({ ok: true });
}
