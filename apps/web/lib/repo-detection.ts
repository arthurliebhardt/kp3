import path from "node:path";

type GitHubTreeEntry = {
  path: string;
  type: "blob" | "tree" | string;
};

type GitHubTreeResponse = {
  tree: GitHubTreeEntry[];
  truncated: boolean;
};

type GitHubRepoResponse = {
  default_branch: string;
};

type GitHubContentResponse = {
  content?: string;
  encoding?: string;
};

export type DockerfileDetection = {
  repoUrl: string;
  provider: "github";
  owner: string;
  repo: string;
  branch: string;
  dockerfilePath: string;
  buildContext: string;
  port: number;
  exposedPort: number | null;
  candidates: Array<{
    dockerfilePath: string;
    buildContext: string;
    score: number;
  }>;
  confidence: "high" | "medium" | "low";
};

export async function detectDockerfile(input: {
  repoUrl: string;
  branch?: string | null;
  token?: string;
}): Promise<DockerfileDetection> {
  const repo = parseGitHubRepoUrl(input.repoUrl);
  if (!repo) {
    throw new Error("Automatic Dockerfile detection currently supports GitHub repository URLs");
  }

  const branch = input.branch || (await fetchDefaultBranch(repo, input.token));
  const tree = await fetchGitHub<GitHubTreeResponse>(
    `/repos/${repo.owner}/${repo.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    input.token
  );

  if (tree.truncated) {
    throw new Error("Repository tree is too large for automatic detection. Set Dockerfile path manually.");
  }

  const candidates = tree.tree
    .filter((entry) => entry.type === "blob" && isDockerfile(entry.path))
    .map((entry) => ({
      dockerfilePath: entry.path,
      buildContext: path.posix.dirname(entry.path) === "." ? "." : path.posix.dirname(entry.path),
      score: scoreDockerfile(entry.path)
    }))
    .sort((left, right) => left.score - right.score || left.dockerfilePath.localeCompare(right.dockerfilePath));

  const best = candidates[0];
  if (!best) {
    throw new Error("No Dockerfile was found in this repository");
  }

  const dockerfile = await fetchRepoFile(repo, branch, best.dockerfilePath, input.token);
  const exposedPort = parseExposePort(dockerfile);

  return {
    repoUrl: `https://github.com/${repo.owner}/${repo.repo}`,
    provider: "github",
    owner: repo.owner,
    repo: repo.repo,
    branch,
    dockerfilePath: best.dockerfilePath,
    buildContext: best.buildContext,
    port: exposedPort ?? 3000,
    exposedPort,
    candidates: candidates.slice(0, 10),
    confidence: confidenceFor(best.dockerfilePath, exposedPort)
  };
}

function parseGitHubRepoUrl(repoUrl: string) {
  try {
    const url = new URL(repoUrl);
    if (url.hostname !== "github.com") return null;
    const [owner, repoWithSuffix] = url.pathname.replace(/^\/+/, "").split("/");
    if (!owner || !repoWithSuffix) return null;
    const repo = repoWithSuffix.replace(/\.git$/, "");
    return { owner, repo };
  } catch {
    return null;
  }
}

async function fetchDefaultBranch(repo: { owner: string; repo: string }, token?: string) {
  const result = await fetchGitHub<GitHubRepoResponse>(`/repos/${repo.owner}/${repo.repo}`, token);
  return result.default_branch;
}

async function fetchRepoFile(repo: { owner: string; repo: string }, branch: string, filePath: string, token?: string) {
  const result = await fetchGitHub<GitHubContentResponse>(
    `/repos/${repo.owner}/${repo.repo}/contents/${encodePath(filePath)}?ref=${encodeURIComponent(branch)}`,
    token
  );

  if (result.encoding !== "base64" || !result.content) {
    throw new Error(`Could not read ${filePath}`);
  }

  return Buffer.from(result.content, "base64").toString("utf8");
}

async function fetchGitHub<T>(pathName: string, token?: string): Promise<T> {
  const response = await fetch(`https://api.github.com${pathName}`, {
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

function isDockerfile(filePath: string) {
  return /^Dockerfile(?:\..+)?$/i.test(path.posix.basename(filePath));
}

function scoreDockerfile(filePath: string) {
  const directory = path.posix.dirname(filePath);
  const basename = path.posix.basename(filePath);
  const depth = directory === "." ? 0 : directory.split("/").length;
  let score = depth * 20;

  if (directory === ".") score -= 100;
  if (basename === "Dockerfile") score -= 20;
  if (/Dockerfile\.prod(?:uction)?$/i.test(basename)) score -= 8;
  if (/^(apps|services|packages)\//.test(filePath)) score -= 4;

  return score;
}

function parseExposePort(dockerfile: string) {
  for (const rawLine of dockerfile.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^EXPOSE\s+(.+)$/i);
    if (!match) continue;
    const firstPort = match[1]?.split(/\s+/)[0]?.split("/")[0];
    const port = Number(firstPort);
    if (Number.isInteger(port) && port >= 1 && port <= 65535) {
      return port;
    }
  }
  return null;
}

function confidenceFor(dockerfilePath: string, exposedPort: number | null): DockerfileDetection["confidence"] {
  if (dockerfilePath === "Dockerfile" && exposedPort) return "high";
  if (path.posix.basename(dockerfilePath) === "Dockerfile") return "medium";
  return "low";
}

function encodePath(filePath: string) {
  return filePath.split("/").map(encodeURIComponent).join("/");
}
