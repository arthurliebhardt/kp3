import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { clusters, platformSettings, teamMembers, teams, users } from "@korepush/db";
import { auth } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
import { jsonError } from "../../../../lib/http";
import { slugify } from "../../../../lib/slug";

const completeSetupSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  confirmPassword: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const input = completeSetupSchema.parse(await requestBody(request));
    if (input.confirmPassword && input.confirmPassword !== input.password) {
      throw new Error("Passwords do not match");
    }

    const [setupCompleted] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, "setup_completed"))
      .limit(1);

    if (setupCompleted?.value === true) {
      throw new Error("Setup is already complete");
    }

    const existingUsers = await db.select({ id: users.id }).from(users).limit(1);
    if (existingUsers.length > 0) {
      await db
        .insert(platformSettings)
        .values({ key: "setup_completed", value: true })
        .onConflictDoUpdate({ target: platformSettings.key, set: { value: true, updatedAt: new Date() } });
      throw new Error("Setup has already been claimed");
    }

    const signUp = await auth.api.signUpEmail({
      body: {
        email: input.email,
        password: input.password,
        name: "Owner"
      }
    });
    const userId = signUp.user.id;
    const teamSlug = slugify(input.email.split("@")[0] ?? "owner");

    await db.transaction(async (tx) => {
      const [team] = await tx
        .insert(teams)
        .values({ name: "Default Team", slug: teamSlug, createdByUserId: userId })
        .returning();
      await tx.insert(teamMembers).values({ teamId: team.id, userId, role: "owner" });
      await tx.insert(clusters).values({
        teamId: team.id,
        name: "Local K3s",
        slug: "local",
        status: "healthy",
        kubeconfigEncrypted: null,
        defaultRegistryUrl: process.env.REGISTRY_URL ?? "registry.yourpaas-system.svc.cluster.local:5000",
        defaultIngressClass: "traefik"
      });
      await tx
        .insert(platformSettings)
        .values({ key: "setup_completed", value: true })
        .onConflictDoUpdate({ target: platformSettings.key, set: { value: true, updatedAt: new Date() } });
    });

    return acceptsHtml(request)
      ? NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 })
      : NextResponse.json({ ok: true });
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
