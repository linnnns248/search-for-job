import { describe, expect, it } from "vitest";
import { parseTencentDetail, parseTencentList } from "./tencent";
import type { OfficialSiteSource } from "../types";

const source: OfficialSiteSource = {
  id: "tencent",
  company: "腾讯",
  careersUrl: "https://careers.tencent.com/search.html?query=ci_8",
  focusAreas: ["产品"],
  companySize: "10000人以上",
  companySizeMin: 10000,
  adapter: "tencent",
  tencent: {
    cityIds: { 成都: 8 },
    recruitmentTypeId: 1,
    employmentType: "full-time",
    pageSize: 20,
    maximumPagesPerKeyword: 5,
  },
  enabled: true,
  checkStatus: "reachable",
};

describe("Tencent careers adapter", () => {
  it("parses a public search response", () => {
    expect(parseTencentList({
      Code: 200,
      Data: { Count: 1, Posts: [{ PostId: "post-1", RecruitPostName: "高级产品经理" }] },
    })).toEqual({
      total: 1,
      posts: [{ PostId: "post-1", RecruitPostName: "高级产品经理" }],
    });
  });

  it("accepts an explicit zero-result page when Posts is omitted", () => {
    expect(parseTencentList({ Code: 200, Data: { Count: 0 } }))
      .toEqual({ total: 0, posts: [] });
  });

  it("maps a public detail response to the shared candidate shape", () => {
    const job = parseTencentDetail({
      Code: 200,
      Data: {
        PostId: "post-1",
        RecruitPostName: "安全平台高级产品经理",
        LocationName: "成都",
        Responsibility: "负责平台产品规划。",
        Requirement: "全日制本科及以上，5年以上产品经验。",
      },
    }, source);

    expect(job).toMatchObject({
      company: "腾讯",
      title: "安全平台高级产品经理",
      city: "成都",
      salary: "未披露",
      educationLevel: "bachelor",
      employmentType: "full-time",
      url: "https://careers.tencent.com/jobdesc.html?postId=post-1",
    });
    expect(job.description).toContain("工作职责：负责平台产品规划。");
    expect(job.description).toContain("任职资格：全日制本科及以上");
  });

  it("fails closed for an unsuccessful response", () => {
    expect(() => parseTencentList({ Code: 500, Message: "failed" })).toThrow(/接口返回异常/);
  });
});
