import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; environmentId: string }> }
) {
  const { projectId, environmentId } = await params;
  return NextResponse.json({
    projectId,
    environmentId,
    logs: [],
    note: "Runtime log streaming is implemented by the worker/Kubernetes client integration; this route is the polling contract."
  });
}
