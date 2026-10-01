import { describe, expect, it } from "vitest";
import type { OfficialSiteSource } from "../types";
import { parseHuaweiPage } from "./huawei";

const source: OfficialSiteSource = {
  id: "huawei",
  company: "华为",
  careersUrl: "https://career.huawei.com/reccampportal/portal5/social-recruitment.html",
  focusAreas: ["云", "产品规划"],
  companySize: "213,000人",
  companySizeMin: 213000,
  adapter: "huawei",
  huawei: {
    employmentType: "full-time",
    pageSize: 20,
    maximumPagesPerKeyword: 5,
  },
  enabled: true,
  checkStatus: "reachable",
};

describe("Huawei careers adapter", () => {
  it("maps a public social job to the shared candidate shape", () => {
    const parsed = parseHuaweiPage({
      pageVO: { totalRows: 1, totalPages: 1 },
      result: [{
        jobId: 34114,
        dataSource: 1,
        jobname: "AI产品经理",
        jobArea: "中国/成都",
        mainBusiness: "负责 AI 产品规划。",
        jobRequire: "教育背景要求：本科及以上；具备产品经验。",
        jobType: "社会招聘",
      }],
    }, source);

    expect(parsed.total).toBe(1);
    expect(parsed.jobs[0]).toMatchObject({
      company: "华为",
      title: "AI产品经理",
      city: "中国/成都",
      salary: "未披露",
      educationLevel: "bachelor",
      employmentType: "full-time",
      url: "https://career.huawei.com/reccampportal/portal5/social-recruitment-detail.html?jobId=34114&dataSource=1",
    });
  });

  it("accepts an explicit zero-result response", () => {
    expect(parseHuaweiPage({ pageVO: { totalRows: 0, totalPages: 0 }, result: [] }, source))
      .toEqual({ total: 0, jobs: [] });
  });

  it("fails closed when the response shape changes", () => {
    expect(() => parseHuaweiPage({ pageVO: { totalRows: 1 } }, source))
      .toThrow(/缺少岗位数据/);
  });
});
