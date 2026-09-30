import { describe, expect, it } from "vitest";
import { parseBaiduPage } from "./baidu";
import type { OfficialSiteSource } from "../types";

const source: OfficialSiteSource = {
  id: "baidu",
  company: "百度",
  careersUrl: "https://talent.baidu.com/jobs/social-list",
  focusAreas: ["AI产品"],
  companySize: "10000人以上",
  companySizeMin: 10000,
  adapter: "baidu",
  baidu: {
    cityCodes: { 成都: "5101" },
    postTypeCode: "2",
    recruitType: "SOCIAL",
    employmentType: "full-time",
    pageSize: 10,
    maximumPagesPerKeyword: 5,
  },
  enabled: true,
  checkStatus: "reachable",
};

describe("Baidu careers adapter", () => {
  it("maps a public social job to the shared candidate shape", () => {
    const parsed = parseBaiduPage({
      status: "ok",
      data: {
        total: "1",
        list: [{
          postId: "post-1",
          name: "AI产品经理（J100001）",
          postType: "产品",
          workPlace: "北京市,成都市",
          workContent: "负责 AI 产品规划。",
          serviceCondition: "本科及以上学历，3 年以上产品经验。",
        }],
      },
    }, source);

    expect(parsed.total).toBe(1);
    expect(parsed.jobs[0]).toMatchObject({
      company: "百度",
      title: "AI产品经理（J100001）",
      city: "北京市,成都市",
      salary: "未披露",
      educationLevel: "bachelor",
      employmentType: "full-time",
      url: "https://talent.baidu.com/jobs/detail/SOCIAL/post-1",
    });
  });

  it("accepts an explicit zero-result response", () => {
    expect(parseBaiduPage({ status: "ok", data: { total: "0", list: [] } }, source))
      .toEqual({ total: 0, jobs: [] });
    expect(parseBaiduPage({ status: "ok", data: { total: 0 } }, source))
      .toEqual({ total: 0, jobs: [] });
  });

  it("fails closed for an unsuccessful response", () => {
    expect(() => parseBaiduPage({ status: "fail", message: "invalid" }, source))
      .toThrow(/接口返回异常/);
  });
});
