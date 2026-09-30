import { describe, expect, it } from "vitest";
import type { JobDataset, JobRecord } from "../../src/types";
import { mergeOfficialJobs } from "./merge";

const previous: JobRecord = {
  id: "official-1",
  company: "云览科技",
  companySize: "100-499人",
  companySizeMin: 100,
  title: "产品经理",
  description: "旧描述",
  salary: "13-20K",
  salaryMinK: 13,
  salaryMaxK: 20,
  city: "成都",
  sources: [{ type: "official", name: "云览科技官网", url: "https://example.com/1" }],
  firstSeenAt: "2026-09-01T00:00:00.000Z",
  lastSeenAt: "2026-09-01T00:00:00.000Z",
  status: "new",
};

describe("official job merge", () => {
  it("updates observed jobs and retains other source data", () => {
    const boss = { ...previous, id: "boss-1", sources: [{ type: "boss" as const, name: "Boss直聘" }] };
    const existing: JobDataset = {
      schemaVersion: 1,
      generatedAt: previous.lastSeenAt,
      isDemo: false,
      jobs: [boss, previous],
    };
    const seenAt = "2026-09-30T00:00:00.000Z";
    const result = mergeOfficialJobs(existing, [{ ...previous, description: "新描述", lastSeenAt: seenAt }], seenAt);
    expect(result.jobs.find((job) => job.id === "boss-1")).toBeDefined();
    expect(result.jobs.find((job) => job.id === "official-1")).toMatchObject({
      firstSeenAt: previous.firstSeenAt,
      lastSeenAt: seenAt,
      description: "新描述",
      status: "updated",
    });
  });
});

