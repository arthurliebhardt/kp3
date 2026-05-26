import { and, eq, lt, sql } from "drizzle-orm";

import type { Db } from "@korepush/db";
import { jobEvents, jobs } from "@korepush/db";

export type JobKind = typeof jobs.$inferInsert.kind;
export type JobRow = typeof jobs.$inferSelect;

export async function enqueueJob(
  db: Db,
  input: {
    kind: JobKind;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
    dedupeKey?: string;
    runAt?: Date;
    priority?: number;
    maxAttempts?: number;
  }
) {
  const [job] = await db
    .insert(jobs)
    .values({
      kind: input.kind,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
      dedupeKey: input.dedupeKey,
      runAt: input.runAt ?? new Date(),
      priority: input.priority ?? 100,
      maxAttempts: input.maxAttempts ?? 3
    })
    .onConflictDoUpdate({
      target: jobs.idempotencyKey,
      set: {
        payload: input.payload,
        runAt: input.runAt ?? new Date(),
        status: "queued"
      }
    })
    .returning();

  return job;
}

export async function claimNextJob(db: Db, workerId: string) {
  const [job] = await db.execute<JobRow>(sql`
    UPDATE ${jobs}
    SET
      status = 'running',
      locked_by = ${workerId},
      locked_at = now(),
      attempts = attempts + 1
    WHERE id = (
      SELECT id
      FROM ${jobs}
      WHERE status = 'queued'
        AND run_at <= now()
      ORDER BY priority ASC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `);

  if (job) {
    await writeJobEvent(db, job.id, "claimed", `Job claimed by ${workerId}`, { workerId });
  }

  return job;
}

export async function markJobSucceeded(db: Db, jobId: string) {
  await db.update(jobs).set({ status: "succeeded", finishedAt: new Date() }).where(eq(jobs.id, jobId));
  await writeJobEvent(db, jobId, "succeeded", "Job completed", {});
}

export async function markJobFailed(db: Db, job: JobRow, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const shouldRetry = job.attempts < job.maxAttempts;
  const delaySeconds = Math.min(300, Math.pow(2, Math.max(0, job.attempts - 1)) * 15);

  await db
    .update(jobs)
    .set({
      status: shouldRetry ? "queued" : "failed",
      lastError: message,
      lockedBy: null,
      lockedAt: null,
      runAt: shouldRetry ? new Date(Date.now() + delaySeconds * 1000) : job.runAt,
      finishedAt: shouldRetry ? null : new Date()
    })
    .where(eq(jobs.id, job.id));

  await writeJobEvent(db, job.id, shouldRetry ? "retry_scheduled" : "failed", message, {
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    delaySeconds: shouldRetry ? delaySeconds : undefined
  });
}

export async function requeueStaleJobs(db: Db, olderThan = new Date(Date.now() - 15 * 60 * 1000)) {
  await db
    .update(jobs)
    .set({ status: "queued", lockedBy: null, lockedAt: null })
    .where(and(eq(jobs.status, "running"), lt(jobs.lockedAt, olderThan)));
}

export async function writeJobEvent(
  db: Db,
  jobId: string,
  type: string,
  message: string,
  metadata: Record<string, unknown>
) {
  await db.insert(jobEvents).values({ jobId, type, message, metadata });
}
