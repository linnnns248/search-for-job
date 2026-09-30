import { describe, expect, it } from "vitest";
import { parseMeituanPage } from "./meituan";
import type { OfficialSiteSource } from "../types";

const source: OfficialSiteSource = {
  id: "meituan",
  company: "美团",
  careersUrl: "https://zhaopin.meituan.com/web/social",
  focusAreas: ["AI产品"],
  companySize: "10000人以上",
  companySizeMin: 10000,
  adapter: "meituan",
  meituan: {
    cityCodes: { 成都: "001023001" },
    jobTypeCode: "3",
    employmentType: "full-time",
    pageSize: 100,
    maximumPagesPerKeyword: 5,
  },
  enabled: true,
  checkStatus: "reachable",
};

describe("Meituan careers adapter", () => {
  it("maps an active public job to the shared candidate shape", () => {
    const parsed = parseMeituanPage({
      status: 1,
      message: "成功",
      data: {
        page: { totalCount: 1 },
        list: [{
          jobUnionId: "4738781104",
          name: "AI营销产品经理",
          jobType: "3",
          jobStatus: "000",
          cityList: [{ name: "成都市" }],
          jobDuty: "负责 AI 营销产品规划。",
          jobRequirement: "本科及以上学历，5 年以上产品经验。",
        }],
      },
    }, source);

    expect(parsed.total).toBe(1);
    expect(parsed.jobs[0]).toMatchObject({
      company: "美团",
      title: "AI营销产品经理",
      city: "成都市",
      salary: "未披露",
      educationLevel: "bachelor",
      employmentType: "full-time",
      url: "https://zhaopin.meituan.com/web/position/detail?highlightType=social&jobUnionId=4738781104",
    });
    expect(parsed.jobs[0]?.description).toContain("工作职责：");
    expect(parsed.jobs[0]?.description).toContain("任职资格：");
  });

  it("accepts a successful zero-result page", () => {
    expect(parseMeituanPage({
      status: 1,
      data: { page: { totalCount: 0 }, list: [] },
    }, source)).toEqual({ total: 0, jobs: [] });
    expect(parseMeituanPage({
      status: 1,
      data: { page: { totalCount: 0 } },
    }, source)).toEqual({ total: 0, jobs: [] });
  });

  it("ignores non-active jobs", () => {
    const parsed = parseMeituanPage({
      status: 1,
      data: {
        page: { totalCount: 1 },
        list: [{ jobUnionId: "closed", name: "产品经理", jobStatus: "999" }],
      },
    }, source);
    expect(parsed.jobs).toEqual([]);
  });

  it("fails closed for an unsuccessful response", () => {
    expect(() => parseMeituanPage({ status: 0, message: "failed" }, source))
      .toThrow(/接口返回异常/);
  });
});
