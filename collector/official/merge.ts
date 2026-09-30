import type { JobDataset, JobRecord } from "../../src/types";

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

export function mergeOfficialJobs(
  existing: JobDataset,
  collectedJobs: JobRecord[],
  generatedAt: string,
): JobDataset {
  const retainedNonOfficial = existing.jobs.filter((job) => !job.id.startsWith("official-"));
  const existingOfficial = new Map(
    existing.jobs.filter((job) => job.id.startsWith("official-")).map((job) => [job.id, job]),
  );
  const collectedIds = new Set(collectedJobs.map((job) => job.id));
  const merged = collectedJobs.map((job) => {
    const previous = existingOfficial.get(job.id);
    if (!previous) return job;
    return {
      ...job,
      firstSeenAt: previous.firstSeenAt,
      status: contentSignature(previous) === contentSignature(job) ? "active" : "updated",
    } satisfies JobRecord;
  });
  const notObserved = [...existingOfficial.values()].filter((job) => !collectedIds.has(job.id));
  return {
    ...existing,
    generatedAt,
    isDemo: false,
    jobs: [...retainedNonOfficial, ...merged, ...notObserved],
  };
}

