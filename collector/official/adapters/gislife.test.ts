import { describe, expect, it } from "vitest";
import { parseGisLifeJobs } from "./gislife";
import type { OfficialSiteSource } from "../types";

const source: OfficialSiteSource = {
  id: "gislife",
  company: "空间座标 GISLife",
  careersUrl: "https://www.gislife.com.cn/job",
  focusAreas: [],
  companySize: "150-500人",
  companySizeMin: 150,
  adapter: "gislife",
  enabled: true,
  checkStatus: "reachable",
};

describe("parseGisLifeJobs", () => {
  it("pairs a list row with its following detail row", () => {
    const jobs = parseGisLifeJobs(`
      <table class="list"><tbody>
        <tr class="li"><td class="name">高级产品经理</td><td>1</td><td>四川/成都</td><td></td></tr>
        <tr class="fold"><td><div class="require">
          <div class="item"><div class="richText">负责产品规划</div></div>
          <div class="item"><div class="richText">本科及以上学历</div></div>
        </div></td></tr>
      </tbody></table>
    `, source);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      title: "高级产品经理",
      city: "四川/成都",
      educationLevel: "bachelor",
      employmentType: "full-time",
    });
  });
});
