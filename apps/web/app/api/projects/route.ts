import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { clusters, environments, projects, teams } from "@korepush/db";
import { validateRepoPath, projectNamespace } from "@korepush/k8s";
import { db } from "../../../lib/db";
import { currentUserId, jsonError } from "../../../lib/http";
import { detectDockerfile } from "../../../lib/repo-detection";
import { slugify } from "../../../lib/slug";

const createProjectSchema = z.object({
  name: z.string().min(1),
  repoUrl: z.url(),
  defaultBranch: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  dockerfilePath: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  buildContext: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  port: z.preprocess(emptyStringToUndefined, z.coerce.number().int().min(1).max(65535).optional()),
  clusterId: z.string().uuid().optional()
});

export async function GET() {
  const rows = await db.select().from(projects).orderBy(desc(projects.createdAt));
  return NextResponse.json({ projects: rows });
}

export async function POST(request: NextRequest) {
  try {
    const input = createProjectSchema.parse(await requestBody(request));
    const detection =
      !input.dockerfilePath || !input.buildContext || !input.port || !input.defaultBranch
        ? await detectDockerfile({
            repoUrl: input.repoUrl,
            branch: input.defaultBranch,
            token: process.env.GITHUB_TOKEN
          })
        : null;
    const defaultBranch = input.defaultBranch ?? detection?.branch ?? "main";
    const dockerfilePath = input.dockerfilePath ?? detection?.dockerfilePath ?? "Dockerfile";
    const buildContext = input.buildContext ?? detection?.buildContext ?? ".";
    const port = input.port ?? detection?.port ?? 3000;

    validateRepoPath(dockerfilePath);
    validateRepoPath(buildContext);

    const [team] = await db.select().from(teams).orderBy(desc(teams.createdAt)).limit(1);
    if (!team) throw new Error("No team exists. Complete first-run setup first.");

    const [cluster] = input.clusterId
      ? await db.select().from(clusters).where(eq(clusters.id, input.clusterId)).limit(1)
      : await db.select().from(clusters).where(eq(clusters.slug, "local")).limit(1);
    if (!cluster) throw new Error("No cluster is available.");

    const slug = slugify(input.name);
    const [project] = await db
      .insert(projects)
      .values({
        teamId: team.id,
        clusterId: cluster.id,
        name: input.name,
        slug,
        gitRepoUrl: input.repoUrl,
        gitDefaultBranch: defaultBranch,
        dockerfilePath,
        buildContext,
        port
      })
      .returning();

    const [environment] = await db
      .insert(environments)
      .values({
        projectId: project.id,
        type: "production",
        name: "Production",
        slug: "prod",
        namespace: projectNamespace(slug, "prod"),
        branch: defaultBranch
      })
      .returning();

    return acceptsHtml(request)
      ? NextResponse.redirect(new URL(`/dashboard/projects/${project.id}`, request.url), { status: 303 })
      : NextResponse.json({ projectId: project.id, environmentId: environment.id, createdByUserId: currentUserId() });
  } catch (error) {
    return jsonError(error);
  }
}

function emptyStringToUndefined(value: unknown) {
  return value === "" || value === "auto" ? undefined : value;
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
