import { describe, expect, it } from "vitest";
import { matchesConfiguredCriteria } from "./criteria";
import type { BossCollectorConfig, BossJobCandidate } from "./types";

const config = {
  titleIncludeKeywords: ["产品经理"],
  employmentTypes: [{ name: "full-time", bossCode: "1901" }],
  minimumEducation: "bachelor",
  minimumSalaryK: 10,
  maximumSalaryK: null,
} satisfies Pick<
  BossCollectorConfig,
  "titleIncludeKeywords" | "employmentTypes" | "minimumEducation" | "minimumSalaryK" | "maximumSalaryK"
>;

const candidate: BossJobCandidate = {
  company: "示例科技",
  companySize: "100-499人",
  companySizeMin: 100,
  title: "高级产品经理",
  salary: "10-20K",
  salaryMinK: 10,
  salaryMaxK: 20,
  education: "本科",
  educationLevel: "bachelor",
  employmentType: "full-time",
  city: "成都",
  url: "https://www.zhipin.com/job_detail/example.html",
  description: "负责产品规划",
};

describe("Boss 岗位条件", () => {
  it("接受全职、本科及以上、薪资下限不低于 10K 的产品经理", () => {
    expect(matchesConfiguredCriteria(candidate, config)).toBe(true);
    expect(matchesConfiguredCriteria({ ...candidate, education: "硕士", educationLevel: "master" }, config)).toBe(true);
  });

  it("拒绝低学历、低薪、兼职或无明确薪资的岗位", () => {
    expect(matchesConfiguredCriteria({ ...candidate, education: "大专", educationLevel: "associate" }, config)).toBe(false);
    expect(matchesConfiguredCriteria({ ...candidate, salary: "8-15K", salaryMinK: 8 }, config)).toBe(false);
    expect(matchesConfiguredCriteria({ ...candidate, salary: "面议", salaryMinK: null, salaryMaxK: null }, config)).toBe(false);
    expect(matchesConfiguredCriteria({ ...candidate, employmentType: "part-time" }, config)).toBe(false);
  });
});
