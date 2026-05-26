import { createHash } from "node:crypto";
import path from "node:path";

import * as k8s from "@kubernetes/client-node";
import { z } from "zod";

export const MANAGED_BY = "yourpaas";
export const LABEL_PREFIX = "paas.example.com";

export const relativeRepoPathSchema = z
  .string()
  .min(1)
  .refine((value) => !path.isAbsolute(value), "Path must be relative")
  .refine((value) => !value.split(/[\\/]/).includes(".."), "Path must not contain '..'")
  .refine((value) => path.normalize(value) === "." || !path.normalize(value).startsWith(".."), "Path must stay inside repo");

export function validateRepoPath(value: string) {
  return relativeRepoPathSchema.parse(value);
}

export function projectNamespace(projectSlug: string, environmentSlug: string) {
  return `p-${dnsLabel(projectSlug)}-${dnsLabel(environmentSlug)}`;
}

export function buildJobName(deploymentId: string) {
  return `build-${deploymentId.replace(/-/g, "").slice(0, 8)}`;
}

export function commonLabels(input: {
  projectSlug: string;
  environmentSlug: string;
  component: "web" | "build" | "secret" | "service" | "ingress";
  projectId: string;
  environmentId: string;
  deploymentId?: string;
}) {
  return {
    "app.kubernetes.io/name": dnsLabel(input.projectSlug),
    "app.kubernetes.io/instance": dnsLabel(input.environmentSlug),
    "app.kubernetes.io/component": input.component,
    "app.kubernetes.io/part-of": dnsLabel(input.projectSlug),
    "app.kubernetes.io/managed-by": MANAGED_BY,
    [`${LABEL_PREFIX}/project-id`]: input.projectId,
    [`${LABEL_PREFIX}/environment-id`]: input.environmentId,
    ...(input.deploymentId ? { [`${LABEL_PREFIX}/deployment-id`]: input.deploymentId } : {})
  };
}

export function createInClusterClient() {
  const kc = new k8s.KubeConfig();
  kc.loadFromCluster();
  return {
    kc,
    core: kc.makeApiClient(k8s.CoreV1Api),
    apps: kc.makeApiClient(k8s.AppsV1Api),
    batch: kc.makeApiClient(k8s.BatchV1Api),
    networking: kc.makeApiClient(k8s.NetworkingV1Api),
    log: new k8s.Log(kc)
  };
}

export function createNamespaceManifest(name: string, labels: Record<string, string>) {
  return {
    apiVersion: "v1",
    kind: "Namespace",
    metadata: { name, labels }
  };
}

export function createEnvSecretManifest(input: {
  name: string;
  namespace: string;
  labels: Record<string, string>;
  values: Record<string, string>;
}) {
  return {
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      name: input.name,
      namespace: input.namespace,
      labels: input.labels
    },
    type: "Opaque",
    stringData: input.values
  };
}

export function createWebDeploymentManifest(input: {
  name: string;
  namespace: string;
  labels: Record<string, string>;
  image: string;
  port: number;
  secretName: string;
}) {
  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: input.name,
      namespace: input.namespace,
      labels: input.labels
    },
    spec: {
      replicas: 1,
      selector: { matchLabels: input.labels },
      template: {
        metadata: { labels: input.labels },
        spec: {
          containers: [
            {
              name: "web",
              image: input.image,
              ports: [{ name: "http", containerPort: input.port }],
              envFrom: [{ secretRef: { name: input.secretName } }],
              readinessProbe: {
                httpGet: { path: "/", port: "http" },
                initialDelaySeconds: 5,
                periodSeconds: 10
              },
              resources: {
                requests: { cpu: "100m", memory: "128Mi" },
                limits: { cpu: "500m", memory: "512Mi" }
              }
            }
          ]
        }
      }
    }
  };
}

export function createServiceManifest(input: {
  name: string;
  namespace: string;
  labels: Record<string, string>;
  port: number;
}) {
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: input.name,
      namespace: input.namespace,
      labels: input.labels
    },
    spec: {
      selector: input.labels,
      ports: [{ name: "http", port: 80, targetPort: input.port }]
    }
  };
}

export function createIngressManifest(input: {
  name: string;
  namespace: string;
  labels: Record<string, string>;
  hostname: string;
  ingressClassName: string;
  tlsEnabled?: boolean;
}) {
  return {
    apiVersion: "networking.k8s.io/v1",
    kind: "Ingress",
    metadata: {
      name: input.name,
      namespace: input.namespace,
      labels: input.labels,
      annotations: input.tlsEnabled ? { "cert-manager.io/cluster-issuer": "letsencrypt-prod" } : {}
    },
    spec: {
      ingressClassName: input.ingressClassName,
      ...(input.tlsEnabled ? { tls: [{ hosts: [input.hostname], secretName: `${input.name}-tls` }] } : {}),
      rules: [
        {
          host: input.hostname,
          http: {
            paths: [
              {
                path: "/",
                pathType: "Prefix",
                backend: {
                  service: {
                    name: input.name,
                    port: { number: 80 }
                  }
                }
              }
            ]
          }
        }
      ]
    }
  };
}

export function createBuildJobManifest(input: {
  name: string;
  namespace: string;
  labels: Record<string, string>;
  repoUrl: string;
  gitRef: string;
  commitSha?: string | null;
  dockerfilePath: string;
  buildContext: string;
  image: string;
  registrySecretName?: string;
}) {
  return {
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: {
      name: input.name,
      namespace: input.namespace,
      labels: input.labels
    },
    spec: {
      backoffLimit: 0,
      template: {
        metadata: { labels: input.labels },
        spec: {
          restartPolicy: "Never",
          containers: [
            {
              name: "build",
              image: "moby/buildkit:rootless",
              args: [
                "sh",
                "-lc",
                [
                  "set -euo pipefail",
                  "apk add --no-cache git >/dev/null",
                  "git clone \"$REPO_URL\" /workspace/src",
                  "cd /workspace/src",
                  "git checkout \"${COMMIT_SHA:-$GIT_REF}\"",
                  "test -f \"$DOCKERFILE_PATH\"",
                  "test -d \"$BUILD_CONTEXT\"",
                  "buildctl-daemonless.sh build --frontend dockerfile.v0 --local context=\"$BUILD_CONTEXT\" --local dockerfile=\"$(dirname \"$DOCKERFILE_PATH\")\" --opt filename=\"$(basename \"$DOCKERFILE_PATH\")\" --output type=image,name=\"$IMAGE\",push=true"
                ].join(" && ")
              ],
              env: [
                { name: "REPO_URL", value: input.repoUrl },
                { name: "GIT_REF", value: input.gitRef },
                { name: "COMMIT_SHA", value: input.commitSha ?? "" },
                { name: "DOCKERFILE_PATH", value: input.dockerfilePath },
                { name: "BUILD_CONTEXT", value: input.buildContext },
                { name: "IMAGE", value: input.image }
              ],
              securityContext: {
                privileged: true
              }
            }
          ],
          ...(input.registrySecretName ? { imagePullSecrets: [{ name: input.registrySecretName }] } : {})
        }
      }
    }
  };
}

export function manifestHash(manifest: unknown) {
  return createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
}

function dnsLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}
