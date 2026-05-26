import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid
} from "drizzle-orm/pg-core";

export const teamRole = pgEnum("team_role", ["owner", "admin", "member"]);
export const clusterStatus = pgEnum("cluster_status", ["registered", "healthy", "degraded", "offline"]);
export const buildMode = pgEnum("build_mode", ["dockerfile"]);
export const environmentType = pgEnum("environment_type", ["production", "staging", "preview"]);
export const deploymentStatus = pgEnum("deployment_status", [
  "queued",
  "building",
  "deploying",
  "ready",
  "failed",
  "cancelled",
  "rolled_back"
]);
export const deploymentSource = pgEnum("deployment_source", ["manual", "webhook", "rollback"]);
export const domainVerificationStatus = pgEnum("domain_verification_status", ["pending", "verified", "failed"]);
export const domainTlsStatus = pgEnum("domain_tls_status", ["pending", "issuing", "active", "failed", "disabled"]);
export const jobKind = pgEnum("job_kind", ["deploy.project", "rollback.deployment", "delete.project", "sync.domain"]);
export const jobStatus = pgEnum("job_status", ["queued", "running", "succeeded", "failed", "cancelled"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
};

export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  ...timestamps
});

export const setupTokens = pgTable("setup_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  tokenHash: text("token_hash").notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" })
});

export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
});

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
  ...timestamps
});

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: teamRole("role").default("owner").notNull(),
    ...timestamps
  },
  (table) => ({
    userTeamUnique: unique("team_members_team_user_unique").on(table.teamId, table.userId)
  })
);

export const clusters = pgTable(
  "clusters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: clusterStatus("status").default("registered").notNull(),
    kubeconfigEncrypted: text("kubeconfig_encrypted"),
    defaultRegistryUrl: text("default_registry_url").notNull(),
    defaultIngressClass: text("default_ingress_class").default("traefik").notNull(),
    ...timestamps
  },
  (table) => ({
    teamSlugUnique: unique("clusters_team_slug_unique").on(table.teamId, table.slug)
  })
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    clusterId: uuid("cluster_id").notNull().references(() => clusters.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    gitProvider: text("git_provider").default("url").notNull(),
    gitRepoUrl: text("git_repo_url").notNull(),
    gitDefaultBranch: text("git_default_branch").default("main").notNull(),
    buildMode: buildMode("build_mode").default("dockerfile").notNull(),
    dockerfilePath: text("dockerfile_path").default("Dockerfile").notNull(),
    buildContext: text("build_context").default(".").notNull(),
    buildTarget: text("build_target"),
    port: integer("port").default(3000).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    teamSlugUnique: unique("projects_team_slug_unique").on(table.teamId, table.slug)
  })
);

export const environments = pgTable(
  "environments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    type: environmentType("type").default("production").notNull(),
    name: text("name").default("Production").notNull(),
    slug: text("slug").default("prod").notNull(),
    namespace: text("namespace").notNull(),
    branch: text("branch").default("main").notNull(),
    pullRequestNumber: integer("pull_request_number"),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps
  },
  (table) => ({
    projectSlugUnique: unique("environments_project_slug_unique").on(table.projectId, table.slug)
  })
);

export const deployments = pgTable("deployments", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  environmentId: uuid("environment_id").notNull().references(() => environments.id, { onDelete: "cascade" }),
  status: deploymentStatus("status").default("queued").notNull(),
  source: deploymentSource("source").default("manual").notNull(),
  commitSha: text("commit_sha"),
  commitMessage: text("commit_message"),
  gitRef: text("git_ref").notNull(),
  imageRepository: text("image_repository"),
  imageTag: text("image_tag"),
  imageDigest: text("image_digest"),
  dockerfilePath: text("dockerfile_path").notNull(),
  buildContext: text("build_context").notNull(),
  buildTarget: text("build_target"),
  buildStartedAt: timestamp("build_started_at", { withTimezone: true }),
  buildFinishedAt: timestamp("build_finished_at", { withTimezone: true }),
  deployedAt: timestamp("deployed_at", { withTimezone: true }),
  failedAt: timestamp("failed_at", { withTimezone: true }),
  failureReason: text("failure_reason"),
  createdByUserId: text("created_by_user_id").references(() => users.id),
  rollbackFromDeploymentId: uuid("rollback_from_deployment_id"),
  ...timestamps
});

export const deploymentEvents = pgTable("deployment_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  deploymentId: uuid("deployment_id").notNull().references(() => deployments.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const domains = pgTable("domains", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  environmentId: uuid("environment_id").notNull().references(() => environments.id, { onDelete: "cascade" }),
  hostname: text("hostname").notNull().unique(),
  isPrimary: boolean("is_primary").default(false).notNull(),
  verificationStatus: domainVerificationStatus("verification_status").default("pending").notNull(),
  tlsStatus: domainTlsStatus("tls_status").default("pending").notNull(),
  ...timestamps
});

export const envVars = pgTable(
  "env_vars",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    environmentId: uuid("environment_id").notNull().references(() => environments.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    valueEncrypted: text("value_encrypted").notNull(),
    ...timestamps
  },
  (table) => ({
    environmentKeyUnique: unique("env_vars_environment_key_unique").on(table.environmentId, table.key)
  })
);

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: jobKind("kind").notNull(),
  status: jobStatus("status").default("queued").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  priority: integer("priority").default(100).notNull(),
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  runAt: timestamp("run_at", { withTimezone: true }).defaultNow().notNull(),
  lockedBy: text("locked_by"),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  idempotencyKey: text("idempotency_key").unique(),
  dedupeKey: text("dedupe_key"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true })
});

export const jobEvents = pgTable("job_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const k8sResources = pgTable(
  "k8s_resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clusterId: uuid("cluster_id").notNull().references(() => clusters.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    environmentId: uuid("environment_id").references(() => environments.id, { onDelete: "cascade" }),
    deploymentId: uuid("deployment_id").references(() => deployments.id, { onDelete: "set null" }),
    apiVersion: text("api_version").notNull(),
    kind: text("kind").notNull(),
    namespace: text("namespace"),
    name: text("name").notNull(),
    labels: jsonb("labels").$type<Record<string, string>>().default({}).notNull(),
    annotations: jsonb("annotations").$type<Record<string, string>>().default({}).notNull(),
    manifest: jsonb("manifest").$type<Record<string, unknown>>().notNull(),
    specHash: text("spec_hash").notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    resourceIdentity: unique("k8s_resources_identity_unique").on(table.clusterId, table.kind, table.namespace, table.name)
  })
);

export const deploymentRelations = relations(deployments, ({ one, many }) => ({
  project: one(projects, { fields: [deployments.projectId], references: [projects.id] }),
  environment: one(environments, { fields: [deployments.environmentId], references: [environments.id] }),
  events: many(deploymentEvents)
}));

export const projectRelations = relations(projects, ({ one, many }) => ({
  team: one(teams, { fields: [projects.teamId], references: [teams.id] }),
  cluster: one(clusters, { fields: [projects.clusterId], references: [clusters.id] }),
  environments: many(environments),
  deployments: many(deployments)
}));

export const environmentRelations = relations(environments, ({ one, many }) => ({
  project: one(projects, { fields: [environments.projectId], references: [projects.id] }),
  domains: many(domains),
  envVars: many(envVars)
}));

export const jobClaimSql = sql`
  status = 'queued'
  AND run_at <= now()
`;
