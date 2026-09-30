import { describe, expect, it } from "vitest";
import type { SearchConfig } from "../../src/types";
import { matchesOfficialCriteria } from "./criteria";
import type { OfficialJobCandidate, OfficialSitesConfig } from "./types";

const config: SearchConfig = {
  schemaVersion: 1,
  cities: ["成都"],
  keywords: ["产品经理"],
  titleIncludeKeywords: ["产品经理"],
  employmentTypes: ["full-time"],
  education: { minimum: "bachelor" },
  salary: { minimumK: 10, maximumK: null },
  companySize: { minimum: 100 },
  schedule: { timezone: "Asia/Shanghai", time: "23:00", statutoryWorkdaysOnly: true },
};

const policy: OfficialSitesConfig["publicationPolicy"] = {
  allowUndisclosedSalary: true,
  allowUndisclosedEducation: false,
  allowUndisclosedEmploymentType: false,
};

const job: OfficialJobCandidate = {
  sourceId: "example",
  sourceName: "示例公司官网",
  company: "示例公司",
  companySize: "100-499人",
  companySizeMin: 100,
  title: "AI产品经理",
  description: "负责产品规划",
  salary: "未披露",
  salaryMinK: null,
  salaryMaxK: null,
  education: "本科",
  educationLevel: "bachelor",
  employmentType: "full-time",
  city: "成都市",
  url: "https://careers.example.com/jobs/1",
  sourceKey: "job-1",
};

describe("official job criteria", () => {
  it("allows undisclosed salary when the source policy explicitly permits it", () => {
    expect(matchesOfficialCriteria(job, config, policy)).toBe(true);
  });

  it("keeps education and employment type strict by default", () => {
    expect(matchesOfficialCriteria({ ...job, educationLevel: null }, config, policy)).toBe(false);
    expect(matchesOfficialCriteria({ ...job, employmentType: null }, config, policy)).toBe(false);
  });

  it("enforces city, salary and company size when disclosed", () => {
    expect(matchesOfficialCriteria({ ...job, city: "北京" }, config, policy)).toBe(false);
    expect(matchesOfficialCriteria({ ...job, salary: "8-12K", salaryMinK: 8 }, config, policy)).toBe(false);
    expect(matchesOfficialCriteria({ ...job, companySizeMin: 99 }, config, policy)).toBe(false);
  });
});

