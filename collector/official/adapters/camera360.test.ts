import { describe, expect, it } from "vitest";
import { parseCamera360Detail } from "./camera360";
import type { OfficialSiteSource } from "../types";

const source: OfficialSiteSource = {
  id: "camera360",
  company: "Camera360",
  careersUrl: "https://hr.camera360.com/recruitment.html?channel=social",
  focusAreas: [],
  companySize: "150-499人",
  companySizeMin: 150,
  adapter: "camera360",
  enabled: true,
  checkStatus: "reachable",
};

describe("parseCamera360Detail", () => {
  it("converts a public social job detail into a normalized candidate", () => {
    const job = parseCamera360Detail({
      status: 200,
      data: {
        id: "abc",
        job: "高级产品经理",
        description: ["负责产品规划"],
        require: ["本科及以上学历", "5年以上经验"],
      },
    }, source, "成都");

    expect(job.title).toBe("高级产品经理");
    expect(job.educationLevel).toBe("bachelor");
    expect(job.employmentType).toBe("full-time");
    expect(job.url).toContain("id=abc");
  });
});
