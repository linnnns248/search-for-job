import { createHash } from "node:crypto";
import type { JobRecord } from "../../src/types";
import type { OfficialJobCandidate } from "./types";

export function normalizeOfficialJob(job: OfficialJobCandidate, seenAt: string): JobRecord {
  const identity = `${job.sourceId}|${job.sourceKey}`;
  return {
    id: `official-${createHash("sha256").update(identity).digest("hex").slice(0, 16)}`,
    company: job.company,
    companySize: job.companySize,
    companySizeMin: job.companySizeMin,
    title: job.title,
    description: job.description,
    salary: job.salary || "未披露",
    salaryMinK: job.salaryMinK,
    salaryMaxK: job.salaryMaxK,
    city: job.city,
    sources: [{ type: "official", name: job.sourceName, url: job.url }],
    firstSeenAt: seenAt,
    lastSeenAt: seenAt,
    status: "new",
  };
}

