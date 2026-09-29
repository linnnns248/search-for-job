import { describe, expect, it } from "vitest";
import { filterJobs, sortJobs } from "./job-utils";
import type { Filters, JobRecord } from "./types";

const jobs: JobRecord[] = [
  {
    id: "one",
    company: "甲公司",
    companySize: "500-999人",
    companySizeMin: 500,
    title: "AI产品经理",
    description: "负责智能产品",
    salary: "20-30K",
    salaryMinK: 20,
    salaryMaxK: 30,
    city: "成都",
    sources: [{ type: "official", name: "公司官网", url: "https://example.com" }],
    firstSeenAt: "2026-09-29T15:00:00+08:00",
    lastSeenAt: "2026-09-29T15:00:00+08:00",
    status: "new",
  },
  {
    id: "two",
    company: "乙公司",
    companySize: "100-499人",
    companySizeMin: 100,
    title: "平台产品经理",
    description: "负责平台能力建设",
    salary: "未披露",
    salaryMinK: null,
    salaryMaxK: null,
    city: "成都",
    sources: [{ type: "boss", name: "Boss直聘" }],
    firstSeenAt: "2026-09-28T15:00:00+08:00",
    lastSeenAt: "2026-09-29T15:00:00+08:00",
    status: "active",
  },
];

const baseFilters: Filters = {
  query: "",
  city: "all",
  source: "all",
  status: "all",
  minimumSalaryK: 0,
};

describe("filterJobs", () => {
  it("matches Chinese job text", () => {
    expect(filterJobs(jobs, { ...baseFilters, query: "智能" })).toHaveLength(1);
  });

  it("filters by source and salary", () => {
    expect(filterJobs(jobs, { ...baseFilters, source: "official", minimumSalaryK: 25 })).toHaveLength(1);
    expect(filterJobs(jobs, { ...baseFilters, source: "boss", minimumSalaryK: 25 })).toHaveLength(0);
  });
});

describe("sortJobs", () => {
  it("sorts disclosed salary before undisclosed salary", () => {
    expect(sortJobs(jobs, "salaryDesc")[0].id).toBe("one");
  });
});
