import type { JobDataset, JobRecord } from "../src/types";

function contentSignature(job: JobRecord): string {
  return JSON.stringify({
    company: job.company,
    companySize: job.companySize,
    title: job.title,
    description: job.description,
    salary: job.salary,
    city: job.city,
    sources: job.sources,
  });
}

export function mergeCollectedJobs(
  existing: JobDataset,
  collectedJobs: JobRecord[],
  generatedAt: string,
): JobDataset {
  const retained = existing.isDemo ? [] : existing.jobs.filter((job) => !job.id.startsWith("boss-"));
  const existingBoss = new Map(
    (existing.isDemo ? [] : existing.jobs.filter((job) => job.id.startsWith("boss-"))).map((job) => [job.id, job]),
  );

  const mergedBoss = collectedJobs.map((job) => {
    const previous = existingBoss.get(job.id);
    if (!previous) return job;
    const changed = contentSignature(previous) !== contentSignature(job);
    return {
      ...job,
      firstSeenAt: previous.firstSeenAt,
      status: changed ? "updated" : "active",
    } satisfies JobRecord;
  });

  // Missing jobs are intentionally retained. A later release will only mark jobs
  // offline after a complete, successful source scan and a configurable grace period.
  const collectedIds = new Set(collectedJobs.map((job) => job.id));
  const notObservedThisRun = [...existingBoss.values()].filter((job) => !collectedIds.has(job.id));

  return {
    schemaVersion: 1,
    generatedAt,
    isDemo: false,
    jobs: [...mergedBoss, ...notObservedThisRun, ...retained],
  };
}
