import { describe, expect, it } from "vitest";
import { parseSangforPage } from "./sangfor";
import type { OfficialSiteSource } from "../types";

const source: OfficialSiteSource = {
  id: "sangfor",
  company: "深信服",
  careersUrl: "https://hr.sangfor.com/",
  focusAreas: ["安全"],
  companySize: "7,282人",
  companySizeMin: 7282,
  adapter: "sangfor",
  sangfor: { channelId: 110, pageSize: 100, maximumPagesPerKeyword: 3 },
  enabled: true,
  checkStatus: "reachable",
};

describe("Sangfor official adapter", () => {
  it("maps the anonymous public social-recruitment response", () => {
    const parsed = parseSangforPage({
      code: 0,
      data: {
        count: 1,
        listData: [{
          positionId: 2067,
          title: "售前产品经理",
          description: "<p>任职要求：本科及以上学历。</p>",
          workPlaceText: "成都市",
          education: "本科",
          commitment: "全职",
          minSalary: 12,
          maxSalary: 24,
        }],
      },
    }, source);

    expect(parsed.total).toBe(1);
    expect(parsed.jobs).toMatchObject([{
      title: "售前产品经理",
      city: "成都市",
      salary: "12-24K",
      salaryMinK: 12,
      educationLevel: "bachelor",
      employmentType: "full-time",
      url: "https://hr.sangfor.com/index/Delivery/2067",
    }]);
  });
});
