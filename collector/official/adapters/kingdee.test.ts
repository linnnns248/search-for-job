import { describe, expect, it } from "vitest";
import { parseKingdeePage } from "./kingdee";
import type { OfficialSiteSource } from "../types";

const source: OfficialSiteSource = {
  id: "kingdee",
  company: "金蝶",
  careersUrl: "https://www.kingdee.com/job/social",
  focusAreas: ["企业软件"],
  companySize: "11,294人",
  companySizeMin: 11294,
  adapter: "kingdee",
  kingdee: { pageSize: 100, maximumPagesPerKeyword: 3 },
  enabled: true,
  checkStatus: "reachable",
};

describe("Kingdee official adapter", () => {
  it("maps the public social-recruitment API response", () => {
    const parsed = parseKingdeePage({
      code: 200,
      data: {
        size: 1,
        content: [{
          id: 42,
          jobTitle: "产品经理",
          jobCity: "成都市",
          jobDistrict: "高新区",
          demandEducation: "大学本科",
          jobSalary: "15000,25000",
          jobDescription: "任职资格：本科及以上学历。职位职责：负责产品规划。",
        }],
      },
    }, source);

    expect(parsed.total).toBe(1);
    expect(parsed.jobs).toMatchObject([{
      title: "产品经理",
      city: "成都市·高新区",
      salary: "15-25K",
      salaryMinK: 15,
      educationLevel: "bachelor",
      employmentType: "full-time",
      url: "https://www.kingdee.com/zpxq1?id=42&social=false",
    }]);
  });
});
