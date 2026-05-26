import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(error: unknown, status = 400) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Validation failed", details: error.flatten() }, { status });
  }
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ error: "Unexpected error" }, { status });
}

export function currentUserId() {
  return "local-owner";
}
