import { describe, expect, it } from "vitest";
import { parseJsonLdJobs, parseOfficialList, parseSelectorJobs } from "./parse";
import type { OfficialSiteSource } from "./types";

const baseSource: OfficialSiteSource = {
  id: "example-company",
  company: "示例公司",
  careersUrl: "https://careers.example.com/jobs",
  focusAreas: ["产品"],
  companySize: "100-499人",
  companySizeMin: 100,
  adapter: "json-ld",
  enabled: true,
  checkStatus: "reachable",
};

describe("official site parsers", () => {
  it("parses JobPosting JSON-LD into the shared candidate shape", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "AI产品经理",
      description: "<p>负责 AI 产品规划。本科及以上。</p>",
      employmentType: "FULL_TIME",
      jobLocation: { address: { addressLocality: "成都" } },
      url: "https://careers.example.com/jobs/pm-1",
      baseSalary: { currency: "CNY", value: { minValue: 15, maxValue: 25, unitText: "K" } },
    })}</script>`;

    expect(parseJsonLdJobs(html, baseSource)).toMatchObject([{
      company: "示例公司",
      title: "AI产品经理",
      city: "成都",
      salary: "15-25K CNY",
      salaryMinK: 15,
      salaryMaxK: 25,
      educationLevel: "bachelor",
      employmentType: "full-time",
      url: "https://careers.example.com/jobs/pm-1",
    }]);
  });

  it("parses controlled selector cards and resolves relative links", () => {
    const html = `
      <article class="job">
        <a class="link" href="/jobs/pm-2"><span class="title">高级产品经理</span></a>
        <span class="city">成都</span><span class="salary">20-30K</span>
        <span class="education">本科</span><span class="type">全职</span>
        <p class="description">负责平台产品规划。</p>
      </article>`;

    const [job] = parseSelectorJobs(html, { ...baseSource, adapter: "selector" }, {
      card: ".job",
      title: ".title",
      url: ".link",
      city: ".city",
      salary: ".salary",
      education: ".education",
      employmentType: ".type",
      description: ".description",
    });

    expect(job).toMatchObject({
      title: "高级产品经理",
      city: "成都",
      salaryMinK: 20,
      educationLevel: "bachelor",
      employmentType: "full-time",
      url: "https://careers.example.com/jobs/pm-2",
    });
    expect(job.sourceKey).toHaveLength(20);
  });

  it("skips a source until company size has been confirmed", () => {
    const source = { ...baseSource, companySize: null, companySizeMin: null };
    const html = `<script type="application/ld+json">{"@type":"JobPosting","title":"产品经理","url":"/jobs/1"}</script>`;
    expect(parseJsonLdJobs(html, source)).toEqual([]);
  });

  it("fails closed for an adapter that has not been implemented", () => {
    expect(() => parseOfficialList("", { ...baseSource, adapter: "moka" }))
      .toThrow(/尚未实现/);
  });
});
