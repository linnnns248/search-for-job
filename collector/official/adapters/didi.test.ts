import { describe, expect, it } from "vitest";
import { parseDidiPage } from "./didi";
import type { OfficialSiteSource } from "../types";

const source: OfficialSiteSource = {
  id: "didi",
  company: "滴滴",
  careersUrl: "https://talent.didiglobal.com/social/list/1",
  focusAreas: ["出行产品"],
  companySize: "22,335人",
  companySizeMin: 22335,
  adapter: "didi",
  didi: {
    cityNames: { "成都": "成都市" },
    employmentType: "full-time",
    pageSize: 100,
    maximumPagesPerCity: 5,
  },
  enabled: true,
  checkStatus: "reachable",
};

describe("Didi official adapter", () => {
  it("maps public social-job fields to an official candidate", () => {
    const parsed = parseDidiPage({
      meta: { code: 0, message: "" },
      data: {
        total: 1,
        items: [{
          jdId: 12345,
          jobName: "高级产品经理",
          workArea: "成都市",
          jobDuty: "负责出行产品规划与落地。",
          jobQualification: "本科及以上学历，5年以上产品经验。",
        }],
      },
    }, source);

    expect(parsed.total).toBe(1);
    expect(parsed.jobs).toMatchObject([{
      company: "滴滴",
      title: "高级产品经理",
      city: "成都市",
      educationLevel: "bachelor",
      employmentType: "full-time",
      salary: "未披露",
      url: "https://talent.didiglobal.com/social/jobDetail?jdId=12345",
    }]);
    expect(parsed.jobs[0].description).toContain("工作职责：负责出行产品规划与落地。");
    expect(parsed.jobs[0].description).toContain("任职资格：本科及以上学历");
  });

  it("accepts a healthy empty result", () => {
    expect(parseDidiPage({
      meta: { code: 0 },
      data: { total: 0, items: [] },
    }, source)).toEqual({ total: 0, jobs: [] });
  });

  it("fails closed when the API response is incomplete", () => {
    expect(() => parseDidiPage({ meta: { code: 0 }, data: { total: 1 } }, source))
      .toThrow(/缺少岗位数据/);
  });
});
