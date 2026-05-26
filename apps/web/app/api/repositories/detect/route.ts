import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "../../../../lib/http";
import { detectDockerfile } from "../../../../lib/repo-detection";

const detectSchema = z.object({
  repoUrl: z.url(),
  branch: z.string().min(1).optional()
});

export async function POST(request: NextRequest) {
  try {
    const input = detectSchema.parse(await request.json());
    const detection = await detectDockerfile({
      repoUrl: input.repoUrl,
      branch: input.branch,
      token: process.env.GITHUB_TOKEN
    });
    return NextResponse.json({ detection });
  } catch (error) {
    return jsonError(error);
  }
}
