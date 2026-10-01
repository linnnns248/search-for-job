import { describe, expect, it } from "vitest";
import { parseOppoPage } from "./oppo";
import type { OfficialSiteSource } from "../types";

const source: OfficialSiteSource = {
  id: "oppo",
  company: "OPPO",
  careersUrl: "https://career.oppo.com/official/oppo/recruitment/post?recruitType=SOCIAL-RECRUITMENT",
  focusAreas: ["互联网服务"],
  companySize: "40,000人以上",
  companySizeMin: 40000,
  adapter: "oppo",
  oppo: {
    cityCodes: { "成都": "510100" },
    recruitType: "SOCIAL-RECRUITMENT",
    employmentType: "full-time",
    pageSize: 50,
    maximumPagesPerCity: 5,
  },
  enabled: true,
  checkStatus: "reachable",
};

describe("OPPO official adapter", () => {
  it("maps public social-job fields to an official candidate", () => {
    const parsed = parseOppoPage({
      code: "0",
      data: {
        pageNum: 1,
        pageSize: 50,
        pages: 1,
        total: "1",
        list: [{
          positionId: "2095687446614577154",
          publishName: "高级互联网产品经理",
          workCityName: "成都市",
          educationRequire: "UNDERGRADUATE-AND-ABOVE",
          jobDuty: "负责浏览器产品规划与落地。",
          workRequire: "本科及以上学历，4年以上产品经验。",
        }],
      },
    }, source);

    expect(parsed).toMatchObject({ total: 1, pages: 1 });
    expect(parsed.jobs).toMatchObject([{
      company: "OPPO",
      title: "高级互联网产品经理",
      city: "成都市",
      educationLevel: "bachelor",
      employmentType: "full-time",
      salary: "未披露",
      url: "https://career.oppo.com/official/oppo/recruitment/post/2095687446614577154",
    }]);
    expect(parsed.jobs[0].description).toContain("工作职责：负责浏览器产品规划与落地");
    expect(parsed.jobs[0].description).toContain("任职资格：本科及以上学历");
  });

  it("accepts a healthy empty result", () => {
    expect(parseOppoPage({
      code: 0,
      data: { pageNum: 1, pageSize: 50, pages: 0, total: 0, list: [] },
    }, source)).toEqual({ total: 0, pages: 0, jobs: [] });
  });

  it("fails closed when the API response is incomplete", () => {
    expect(() => parseOppoPage({ code: 0, data: { total: 1 } }, source))
      .toThrow(/缺少岗位数据/);
  });
});
