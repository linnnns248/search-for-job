import { describe, expect, it } from "vitest";
import type { OfficialSiteSource } from "../types";
import { assertCloudViewDetailsAreDistinct, parseCloudViewDetail, parseCloudViewList } from "./cloudview";

const source: OfficialSiteSource = {
  id: "cloudview",
  company: "云览科技",
  careersUrl: "https://cloudview-inc.com/join/jobs",
  focusAreas: ["AI产品"],
  companySize: "100-499人",
  companySizeMin: 100,
  adapter: "cloudview",
  enabled: true,
  checkStatus: "reachable",
};

describe("CloudView adapter", () => {
  it("parses list cards and then enriches the full detail", () => {
    const list = `
      <a class="job-card" href="/join/jobDetail?jobCode=PM_1">
        <div class="job-card-title"><h3>AI产品经理</h3><strong>13-20k·15薪</strong></div>
        <p class="job-meta">成都｜校招｜产品类</p>
        <p>负责 AI 产品规划。</p>
      </a>`;
    const [candidate] = parseCloudViewList(list, source);
    expect(candidate).toMatchObject({
      title: "AI产品经理",
      city: "成都",
      salaryMinK: 13,
      employmentType: "full-time",
      educationLevel: null,
    });

    const detail = `
      <article class="detail-block"><h2>职位描述</h2><ol><li>负责 AI 产品规划。</li></ol></article>
      <article class="detail-block"><h2>职位要求</h2><ol><li>本科及以上学历。</li></ol></article>`;
    expect(parseCloudViewDetail(detail, candidate)).toMatchObject({
      education: "本科",
      educationLevel: "bachelor",
      description: "职位描述负责 AI 产品规划。\n职位要求本科及以上学历。",
    });
  });

  it("fails closed when different detail links return one repeated template", () => {
    const base = parseCloudViewList(`
      <a class="job-card" href="/join/jobDetail?jobCode=1"><h3>产品经理</h3><strong>13-20K</strong><p class="job-meta">成都｜校招</p></a>
      <a class="job-card" href="/join/jobDetail?jobCode=2"><h3>高级产品经理</h3><strong>13-20K</strong><p class="job-meta">成都｜校招</p></a>
    `, source);
    const jobs = base.map((job) => ({ ...job, description: "同一份错误模板", educationLevel: "bachelor" as const }));
    expect(() => assertCloudViewDetailsAreDistinct(jobs)).toThrow(/相同正文/);
  });
});
