import { describe, expect, it } from "vitest";
import { getOfficialCompaniesWithoutJobs } from "./official-companies";
import type { JobDataset, OfficialCompanyCatalog } from "./types";

const catalog: OfficialCompanyCatalog = {
  schemaVersion: 1,
  companies: [
    { id: "one", company: "已有官网岗位", companySize: "1000人以上", companySizeMin: 1000, careersUrl: "https://example.com/one", enabled: true, reason: "已有岗位" },
    { id: "two", company: "暂无官网岗位", companySize: "500人", companySizeMin: 500, careersUrl: "https://example.com/two", enabled: true, reason: "当前没有符合条件的岗位" },
    { id: "three", company: "已停止采集", companySize: "200人", companySizeMin: 200, careersUrl: "https://example.com/three", enabled: false, reason: "官网采集受限" },
  ],
};

const dataset: JobDataset = {
  schemaVersion: 1,
  generatedAt: "2026-10-01T00:00:00.000Z",
  isDemo: false,
  jobs: [{
    id: "official-one",
    company: "已有官网岗位",
    companySize: "1000人以上",
    companySizeMin: 1000,
    title: "产品经理",
    description: "负责产品规划",
    salary: "未披露",
    salaryMinK: null,
    salaryMaxK: null,
    city: "成都",
    sources: [{ type: "official", name: "已有官网岗位官网", url: "https://example.com/job" }],
    firstSeenAt: "2026-10-01T00:00:00.000Z",
    lastSeenAt: "2026-10-01T00:00:00.000Z",
    status: "new",
  }, {
    id: "official-three",
    company: "已停止采集",
    companySize: "200人",
    companySizeMin: 200,
    title: "产品经理",
    description: "历史官网岗位",
    salary: "未披露",
    salaryMinK: null,
    salaryMaxK: null,
    city: "成都",
    sources: [{ type: "official", name: "已停止采集官网", url: "https://example.com/old-job" }],
    firstSeenAt: "2026-09-01T00:00:00.000Z",
    lastSeenAt: "2026-09-01T00:00:00.000Z",
    status: "active",
  }],
};

describe("official company catalog", () => {
  it("keeps only companies without a published official job", () => {
    expect(getOfficialCompaniesWithoutJobs(catalog, dataset)).toEqual([
      catalog.companies[1],
      catalog.companies[2],
    ]);
  });
});
