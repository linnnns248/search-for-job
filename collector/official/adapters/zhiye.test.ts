import { describe, expect, it } from "vitest";
import { parseZhiyePage } from "./zhiye";
import type { OfficialSiteSource } from "../types";

const source: OfficialSiteSource = {
  id: "iflytek",
  company: "科大讯飞",
  careersUrl: "https://iflytek.zhiye.com/",
  focusAreas: ["AI产品"],
  companySize: "10000人以上",
  companySizeMin: 10000,
  adapter: "zhiye",
  zhiye: { category: "1", pageSize: 100, maximumPagesPerKeyword: 3 },
  enabled: true,
  checkStatus: "reachable",
};

describe("Zhiye adapter", () => {
  it("maps the public API response to the shared candidate shape", () => {
    const result = parseZhiyePage({
      Code: 200,
      Count: 1,
      Data: [{
        Id: "abc-123",
        JobAdId: 190822517,
        JobAdName: "AI产品经理(J10001)",
        LocNames: ["四川省·成都市", "安徽省·合肥市"],
        Salary: null,
        Duty: "<p>负责 AI 产品规划。</p>",
        Require: "本科及以上学历，3 年产品经验。",
        Kind: "全职",
        Category: "社会招聘",
      }],
    }, source);

    expect(result.total).toBe(1);
    expect(result.jobs).toMatchObject([{
      company: "科大讯飞",
      title: "AI产品经理(J10001)",
      city: "四川省·成都市、安徽省·合肥市",
      salary: "未披露",
      salaryMinK: null,
      educationLevel: "bachelor",
      employmentType: "full-time",
      url: "https://iflytek.zhiye.com/social/detail?jobAdId=abc-123",
    }]);
    expect(result.jobs[0].description).toContain("工作职责：负责 AI 产品规划。");
    expect(result.jobs[0].description).toContain("任职资格：本科及以上学历");
  });

  it("fails closed when the API response is not successful", () => {
    expect(() => parseZhiyePage({ Code: 500, Message: "failed", Data: [] }, source))
      .toThrow(/接口返回异常/);
  });
});
