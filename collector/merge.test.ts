import { describe, expect, it } from "vitest";
import type { JobDataset, JobRecord } from "../src/types";
import { mergeCollectedJobs } from "./merge";

const collected: JobRecord = {
  id: "boss-one",
  company: "示例公司",
  companySize: "100-499人",
  companySizeMin: 100,
  title: "产品经理",
  description: "负责产品规划",
  salary: "20-30K",
  salaryMinK: 20,
  salaryMaxK: 30,
  city: "成都",
  sources: [{ type: "boss", name: "Boss直聘", url: "https://www.zhipin.com/job_detail/one.html" }],
  firstSeenAt: "2026-09-29T00:00:00.000Z",
  lastSeenAt: "2026-09-29T00:00:00.000Z",
  status: "new",
};

describe("采集结果合并", () => {
  it("首次真实采集时移除演示数据", () => {
    const demo: JobDataset = {
      schemaVersion: 1,
      generatedAt: "2026-09-28T00:00:00.000Z",
      isDemo: true,
      jobs: [{ ...collected, id: "demo-001" }],
    };
    const result = mergeCollectedJobs(demo, [collected], "2026-09-29T00:00:00.000Z");
    expect(result.isDemo).toBe(false);
    expect(result.jobs.map((job) => job.id)).toEqual(["boss-one"]);
  });

  it("保留首次发现时间并识别内容更新", () => {
    const existing: JobDataset = {
      schemaVersion: 1,
      generatedAt: "2026-09-28T00:00:00.000Z",
      isDemo: false,
      jobs: [{ ...collected, description: "旧描述", firstSeenAt: "2026-09-01T00:00:00.000Z" }],
    };
    const result = mergeCollectedJobs(existing, [collected], "2026-09-29T00:00:00.000Z");
    expect(result.jobs[0].firstSeenAt).toBe("2026-09-01T00:00:00.000Z");
    expect(result.jobs[0].status).toBe("updated");
  });
});
