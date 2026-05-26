import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";

import { eq } from "drizzle-orm";

import { decryptSecret } from "@korepush/crypto";
import {
  clusters,
  createDb,
  deploymentEvents,
  deployments,
  domains,
  environments,
  envVars,
  k8sResources,
  projects
} from "@korepush/db";
import {
  buildJobName,
  commonLabels,
  createBuildJobManifest,
  createEnvSecretManifest,
  createIngressManifest,
  createNamespaceManifest,
  createServiceManifest,
  createWebDeploymentManifest,
  manifestHash,
  validateRepoPath
} from "@korepush/k8s";
import { claimNextJob, markJobFailed, markJobSucceeded, requeueStaleJobs, type JobRow } from "@korepush/queue";

const db = createDb();
const workerId = process.env.WORKER_ID ?? `worker-${randomUUID().slice(0, 8)}`;

async function main() {
  console.log(`Korepush worker started: ${workerId}`);
  while (true) {
    await requeueStaleJobs(db);
    const job = await claimNextJob(db, workerId);
    if (!job) {
      await sleep(1500);
      continue;
    }

    try {
      await handleJob(job);
      await markJobSucceeded(db, job.id);
    } catch (error) {
      await markJobFailed(db, job, error);
    }
  }
}

async function handleJob(job: JobRow) {
  switch (job.kind) {
    case "deploy.project":
      await handleDeployProject(job.payload);
      return;
    case "rollback.deployment":
      await handleRollback(job.payload);
      return;
    default:
      throw new Error(`Unsupported job kind: ${job.kind}`);
  }
}

async function handleDeployProject(payload: Record<string, unknown>) {
  const projectId = stringPayload(payload, "projectId");
  const environmentId = stringPayload(payload, "environmentId");
  const deploymentId = stringPayload(payload, "deploymentId");
  const gitRef = stringPayload(payload, "gitRef");

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  const [environment] = await db.select().from(environments).where(eq(environments.id, environmentId)).limit(1);
  const [cluster] = await db.select().from(clusters).where(eq(clusters.id, project?.clusterId ?? "")).limit(1);
  const [deployment] = await db.select().from(deployments).where(eq(deployments.id, deploymentId)).limit(1);
  if (!project || !environment || !cluster || !deployment) throw new Error("Deployment graph is incomplete");

  validateRepoPath(project.dockerfilePath);
  validateRepoPath(project.buildContext);

  await updateDeployment(deployment.id, "building", { buildStartedAt: new Date() });
  await event(deployment.id, "deployment.queued", "Deployment job claimed");
  await event(deployment.id, "build.validation", "Dockerfile path and build context validated", {
    dockerfilePath: project.dockerfilePath,
    buildContext: project.buildContext
  });

  const namespace = environment.namespace;
  const imageRepository = `${cluster.defaultRegistryUrl}/${project.slug}`;
  const imageTag = `deploy_${deployment.id.replace(/-/g, "").slice(0, 12)}`;
  const image = `${imageRepository}:${imageTag}`;
  const labels = commonLabels({
    projectSlug: project.slug,
    environmentSlug: environment.slug,
    component: "build",
    projectId: project.id,
    environmentId: environment.id,
    deploymentId: deployment.id
  });

  const namespaceManifest = createNamespaceManifest(namespace, labels);
  const buildJobManifest = createBuildJobManifest({
    name: buildJobName(deployment.id),
    namespace,
    labels,
    repoUrl: project.gitRepoUrl,
    gitRef,
    commitSha: deployment.commitSha,
    dockerfilePath: project.dockerfilePath,
    buildContext: project.buildContext,
    image
  });

  await trackManifest(cluster.id, project.id, environment.id, deployment.id, namespaceManifest);
  await trackManifest(cluster.id, project.id, environment.id, deployment.id, buildJobManifest);
  await event(deployment.id, "build.job_created", "Build Job manifest created", { image });

  await updateDeployment(deployment.id, "deploying", {
    buildFinishedAt: new Date(),
    imageRepository,
    imageTag
  });

  const encryptedEnvRows = await db.select().from(envVars).where(eq(envVars.environmentId, environment.id));
  const secretValues = Object.fromEntries(
    encryptedEnvRows.map((row) => [row.key, decryptSecret(row.valueEncrypted)] as const)
  );
  const runtimeLabels = commonLabels({
    projectSlug: project.slug,
    environmentSlug: environment.slug,
    component: "web",
    projectId: project.id,
    environmentId: environment.id,
    deploymentId: deployment.id
  });
  const secretName = `${project.slug}-env`;
  const serviceName = `${project.slug}-web`;
  const primaryDomain = await db.query.domains.findFirst({
    where: eq(domains.environmentId, environment.id)
  });
  const hostname = primaryDomain?.hostname ?? `${project.slug}.${process.env.PLATFORM_BASE_DOMAIN ?? "localhost"}`;

  const manifests = [
    createEnvSecretManifest({ name: secretName, namespace, labels: runtimeLabels, values: secretValues }),
    createWebDeploymentManifest({
      name: serviceName,
      namespace,
      labels: runtimeLabels,
      image,
      port: project.port,
      secretName
    }),
    createServiceManifest({ name: serviceName, namespace, labels: runtimeLabels, port: project.port }),
    createIngressManifest({
      name: serviceName,
      namespace,
      labels: runtimeLabels,
      hostname,
      ingressClassName: cluster.defaultIngressClass,
      tlsEnabled: hostname !== "localhost"
    })
  ];

  for (const manifest of manifests) {
    await trackManifest(cluster.id, project.id, environment.id, deployment.id, manifest);
  }

  await event(deployment.id, "kubernetes.manifests_ready", "Runtime manifests tracked and ready to apply", {
    namespace,
    hostname
  });
  await updateDeployment(deployment.id, "ready", { deployedAt: new Date() });
  await event(deployment.id, "deployment.ready", "Deployment marked ready");
}

async function handleRollback(payload: Record<string, unknown>) {
  const targetDeploymentId = stringPayload(payload, "targetDeploymentId");
  const rollbackDeploymentId = stringPayload(payload, "rollbackDeploymentId");
  const [target] = await db.select().from(deployments).where(eq(deployments.id, targetDeploymentId)).limit(1);
  const [rollback] = await db.select().from(deployments).where(eq(deployments.id, rollbackDeploymentId)).limit(1);
  if (!target || target.status !== "ready") throw new Error("Rollback target is not ready");
  if (!rollback) throw new Error("Rollback deployment not found");

  await updateDeployment(rollback.id, "deploying");
  await event(rollback.id, "rollback.started", "Rollback started", { targetDeploymentId });
  await updateDeployment(rollback.id, "ready", { deployedAt: new Date() });
  await event(rollback.id, "rollback.ready", "Rollback marked ready without rebuilding image");
}

async function updateDeployment(
  deploymentId: string,
  status: "building" | "deploying" | "ready" | "failed",
  values: Partial<typeof deployments.$inferInsert> = {}
) {
  await db
    .update(deployments)
    .set({
      ...values,
      status,
      updatedAt: new Date(),
      failedAt: status === "failed" ? new Date() : values.failedAt
    })
    .where(eq(deployments.id, deploymentId));
}

async function event(deploymentId: string, type: string, message: string, metadata: Record<string, unknown> = {}) {
  await db.insert(deploymentEvents).values({ deploymentId, type, message, metadata });
}

async function trackManifest(
  clusterId: string,
  projectId: string,
  environmentId: string,
  deploymentId: string,
  manifest: Record<string, unknown>
) {
  const metadata = manifest.metadata as { name: string; namespace?: string; labels?: Record<string, string>; annotations?: Record<string, string> };
  await db
    .insert(k8sResources)
    .values({
      clusterId,
      projectId,
      environmentId,
      deploymentId,
      apiVersion: String(manifest.apiVersion),
      kind: String(manifest.kind),
      namespace: metadata.namespace,
      name: metadata.name,
      labels: metadata.labels ?? {},
      annotations: metadata.annotations ?? {},
      manifest,
      specHash: manifestHash(manifest),
      appliedAt: new Date()
    })
    .onConflictDoUpdate({
      target: [k8sResources.clusterId, k8sResources.kind, k8sResources.namespace, k8sResources.name],
      set: {
        manifest,
        labels: metadata.labels ?? {},
        annotations: metadata.annotations ?? {},
        specHash: manifestHash(manifest),
        appliedAt: new Date(),
        updatedAt: new Date()
      }
    });
}

function stringPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`Missing payload field: ${key}`);
  return value;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
