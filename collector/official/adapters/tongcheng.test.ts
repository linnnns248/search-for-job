import { describe, expect, it } from "vitest";
import type { OfficialSiteSource } from "../types";
import { parseTongchengDetail, parseTongchengList } from "./tongcheng";

const source: OfficialSiteSource = {
  id: "tongcheng",
  company: "同程旅行",
  careersUrl: "https://mhr.ly.com/recruit/portal/#/socialJob",
  focusAreas: ["旅行产品"],
  companySize: "11,249人",
  companySizeMin: 11249,
  adapter: "tongcheng",
  tongcheng: {
    companyId: "0583d",
    cityIds: { "成都": "324" },
    queryType: 4,
    regularEmploymentTypeCode: "REGULAR",
    employmentType: "full-time",
    pageSize: 50,
    maximumPagesPerCity: 5,
  },
  enabled: true,
  checkStatus: "reachable",
};

describe("Tongcheng official adapter", () => {
  it("parses a healthy public list response", () => {
    expect(parseTongchengList({
      code: 0,
      data: {
        content: [{ jobId: "job-1", jobName: "AI产品经理" }],
        totalSize: 1,
        totalPages: 1,
      },
    })).toMatchObject({ total: 1, pages: 1, jobs: [{ jobId: "job-1" }] });
  });

  it("maps a formal social-job detail and normalizes yuan salary", () => {
    const job = parseTongchengDetail({
      code: 0,
      data: {
        id: "job-1",
        jobName: "AI产品经理",
        addressName: "成都",
        recruitmentTypeName: "社会招聘",
        qualifications: "本科及以上学历，3年以上产品经验。",
        duty: "负责旅行场景智能产品规划。",
        salary: "15000～25000",
        jobStatus: 1,
      },
    }, {
      jobId: "job-1",
      jobName: "AI产品经理",
      employmentType: "REGULAR",
      employmentTypeName: "正式-正式",
      workPlace: "成都",
      recruitType: 4,
    }, source);

    expect(job).toMatchObject({
      company: "同程旅行",
      title: "AI产品经理",
      city: "成都",
      educationLevel: "bachelor",
      employmentType: "full-time",
      salary: "15-25K",
      salaryMinK: 15,
      salaryMaxK: 25,
      url: "https://mhr.ly.com/recruit/portal/#/socialDetail?id=job-1&type=4",
    });
  });

  it("does not infer full-time for non-regular positions", () => {
    const job = parseTongchengDetail({
      code: 0,
      data: {
        id: "job-2",
        jobName: "产品经理",
        addressName: "成都",
        qualifications: "本科及以上学历。",
        duty: "负责产品规划。",
        jobStatus: 1,
      },
    }, {
      jobId: "job-2",
      jobName: "产品经理",
      employmentType: "OUTSOURCE_POSITION",
    }, source);

    expect(job?.employmentType).toBeNull();
  });

  it("fails closed when the public response is incomplete", () => {
    expect(() => parseTongchengList({ code: 0, data: { totalSize: 1 } }))
      .toThrow(/缺少岗位数据/);
  });
});
