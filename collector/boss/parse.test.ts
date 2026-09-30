import { describe, expect, it } from "vitest";
import {
  decodeBossText,
  isBossLoginOrVerificationPage,
  parseBossCompanySize,
  parseBossJobDescription,
  parseBossSearchPage,
  parseCompanySizeMin,
  parseEducationRequirement,
  parseSalary,
} from "./parse";

describe("Boss 页面解析", () => {
  it("解析搜索结果中的公开岗位字段", () => {
    const jobs = parseBossSearchPage(
      `<ul class="job-list-box"><li class="job-card-wrapper">
        <a class="job-card-left" href="/job_detail/abc123.html">
          <span class="job-name">AI产品经理</span><span class="salary">20-30K·14薪</span>
        </a>
        <ul class="tag-list"><li>3-5年</li><li>本科</li></ul>
        <h3 class="company-name">成都示例科技</h3>
        <ul class="company-tag-list"><li>互联网</li><li>500-999人</li></ul>
      </li></ul>`,
      "成都",
    );

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      company: "成都示例科技",
      companySizeMin: 500,
      title: "AI产品经理",
      salaryMinK: 20,
      salaryMaxK: 30,
      education: "本科",
      educationLevel: "bachelor",
      employmentType: "full-time",
      city: "成都",
      url: "https://www.zhipin.com/job_detail/abc123.html",
    });
  });

  it("卡片 class 变化时按岗位链接和公司链接回退解析", () => {
    const jobs = parseBossSearchPage(
      `<section class="search-result-v3"><div class="item-v3">
        <div><a href="/job_detail/new-structure.html">商业产品经理</a><span class="job-salary">18-28K</span></div>
        <div><a href="/gongsi/example.html">示例网络</a></div>
      </div></section>`,
      "成都",
    );

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      title: "商业产品经理",
      company: "示例网络",
      salary: "18-28K",
      url: "https://www.zhipin.com/job_detail/new-structure.html",
    });
  });

  it("解析岗位描述、公司规模和薪资", () => {
    expect(parseBossJobDescription('<div class="job-sec-text">负责 产品规划\n与需求分析</div>')).toBe(
      "负责 产品规划 与需求分析",
    );
    expect(parseCompanySizeMin("10000人以上")).toBe(10000);
    expect(parseCompanySizeMin("20-99人")).toBe(20);
    expect(parseBossCompanySize('<aside class="sider-company"><p>互联网</p><p>500-999人</p></aside>'))
      .toBe("500-999人");
    expect(parseSalary("25-35K·13薪")).toEqual({ minimumK: 25, maximumK: 35 });
    expect(parseSalary("面议")).toEqual({ minimumK: null, maximumK: null });
    expect(parseEducationRequirement("3-5年 本科及以上")).toEqual({ label: "本科", level: "bachelor" });
    expect(parseEducationRequirement("硕士")).toEqual({ label: "硕士", level: "master" });
    expect(parseEducationRequirement("学历不限")).toEqual({ label: "", level: null });
    expect(decodeBossText("\uE033\uE036-\uE034\uE036K·\uE032\uE034薪")).toBe("25-35K·13薪");
  });

  it("识别登录和安全验证页面", () => {
    expect(isBossLoginOrVerificationPage("https://www.zhipin.com/web/user/?ka=header-login", "<body></body>"))
      .toBe(true);
    expect(isBossLoginOrVerificationPage("https://www.zhipin.com/web/user/?from=passport-zp", '<body class="login-page"></body>'))
      .toBe(true);
    expect(isBossLoginOrVerificationPage("https://www.zhipin.com/web/geek/job", "<body>请完成安全验证</body>"))
      .toBe(true);
  });
});
