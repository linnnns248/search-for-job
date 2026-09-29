import { createHash } from "node:crypto";
import type { JobRecord } from "../src/types";
import type { BossJobCandidate } from "./types";

function stableBossId(job: BossJobCandidate): string {
  const key = job.url || `${job.company}|${job.title}|${job.city}`;
  return `boss-${createHash("sha256").update(key).digest("hex").slice(0, 16)}`;
}

export function normalizeBossJob(job: BossJobCandidate, seenAt: string): JobRecord {
  return {
    id: stableBossId(job),
    company: job.company,
    companySize: job.companySize,
    companySizeMin: job.companySizeMin ?? 0,
    title: job.title,
    description: job.description,
    salary: job.salary,
    salaryMinK: job.salaryMinK,
    salaryMaxK: job.salaryMaxK,
    city: job.city,
    sources: [{ type: "boss", name: "Boss直聘", url: job.url }],
    firstSeenAt: seenAt,
    lastSeenAt: seenAt,
    status: "new",
  };
}
