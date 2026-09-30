import { describe, expect, it } from "vitest";
import type { OfficialSiteSource } from "../types";
import { parseZhiyeClassicDetail, parseZhiyeClassicList } from "./zhiye-classic";

const source: OfficialSiteSource = {
  id: "xiaoduo",
  company: "晓多科技",
  careersUrl: "https://xiaoduoai.zhiye.com/Social",
  focusAreas: ["企业服务产品"],
  companySize: "400余人",
  companySizeMin: 400,
  adapter: "zhiye-classic",
  zhiyeClassic: {
    cityCodes: { 成都: "5101" },
    employmentType: "full-time",
    maximumPagesPerKeyword: 3,
  },
  enabled: true,
  checkStatus: "reachable",
};

describe("Zhiye classic adapter", () => {
  it("recognizes a healthy empty result page", () => {
    const result = parseZhiyeClassicList(`
      <table class="jobsTable"><tr><td colspan="4">没有搜索到相应职位</td></tr></table>
    `, source);
    expect(result).toEqual({ healthy: true, jobs: [], hasNextPage: false });
  });

  it("extracts list rows and detail links", () => {
    const result = parseZhiyeClassicList(`
      <table class="jobsTable">
        <tr class="title"><td>职位名称</td><td>类型</td><td>地点</td><td>日期</td></tr>
        <tr><td><a title="AI产品经理(J10001)" href="/zpdetail/123">职位</a></td>
          <td></td><td title="四川省-成都市">成都</td><td>2026-09-30</td></tr>
      </table>
      <div class="pager"><a class="next">下一页</a></div>
    `, source);
    expect(result).toMatchObject({
      healthy: true,
      hasNextPage: true,
      jobs: [{
        title: "AI产品经理(J10001)",
        city: "四川省-成都市",
        url: "https://xiaoduoai.zhiye.com/zpdetail/123",
      }],
    });
  });

  it("maps detail fields to the shared candidate shape", () => {
    const candidate = parseZhiyeClassicDetail(`
      <div class="positiondetail-template6">
        <div class="boxSupertitle"><span>AI产品经理(J10001) <b></b></span></div>
        <ul class="xiangqinglist">
          <li class="ntitle">工作性质：</li><li class="nvalue" title="全职">全职</li>
          <li class="ntitle">薪资范围：</li><li class="nvalue" title="12000-18000 元/月">薪资</li>
          <li class="ntitle">工作地点：</li><li class="nvcity">四川省-成都市</li>
        </ul>
        <div class="xiangqingtext"><p>工作职责：负责 AI 产品规划。</p><p>任职资格：本科及以上学历。</p></div>
      </div>
    `, source, {
      title: "AI产品经理(J10001)",
      city: "四川省-成都市",
      url: "https://xiaoduoai.zhiye.com/zpdetail/123",
    });
    expect(candidate).toMatchObject({
      title: "AI产品经理(J10001)",
      city: "四川省-成都市",
      salary: "12-18K",
      salaryMinK: 12,
      salaryMaxK: 18,
      educationLevel: "bachelor",
      employmentType: "full-time",
    });
  });
});
