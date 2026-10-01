import { describe, expect, it } from "vitest";
import { validateOfficialSitesConfig } from "./config";

describe("official site config", () => {
  const collection = {
    requestTimeoutMs: 30_000,
    maximumResponseBytes: 2_097_152,
    minimumDelayMs: 2_500,
    maximumDelayMs: 5_000,
    maximumDetailsPerSource: 100,
  };

  it("allows disabled onboarding sources with pending metadata", () => {
    const config = validateOfficialSitesConfig({
      schemaVersion: 1,
      collection,
      publicationPolicy: {
        allowUndisclosedSalary: true,
        allowUndisclosedEducation: false,
        allowUndisclosedEmploymentType: false,
      },
      sources: [{
        id: "example",
        company: "示例公司",
        careersUrl: "https://careers.example.com/jobs",
        focusAreas: [],
        companySize: null,
        companySizeMin: null,
        adapter: "pending",
        enabled: false,
        checkStatus: "pending",
      }],
    });
    expect(config.sources).toHaveLength(1);
  });

  it("requires size and an adapter before a source can be enabled", () => {
    expect(() => validateOfficialSitesConfig({
      schemaVersion: 1,
      collection,
      publicationPolicy: {
        allowUndisclosedSalary: true,
        allowUndisclosedEducation: false,
        allowUndisclosedEmploymentType: false,
      },
      sources: [{
        id: "example",
        company: "示例公司",
        careersUrl: "https://careers.example.com/jobs",
        focusAreas: [],
        companySize: null,
        companySizeMin: null,
        adapter: "pending",
        enabled: true,
        checkStatus: "reachable",
      }],
    })).toThrow(/尚未配置适配器/);
  });

  it("rejects non-public or non-HTTPS URLs", () => {
    expect(() => validateOfficialSitesConfig({
      schemaVersion: 1,
      collection,
      publicationPolicy: {
        allowUndisclosedSalary: true,
        allowUndisclosedEducation: false,
        allowUndisclosedEmploymentType: false,
      },
      sources: [{
        id: "unsafe",
        company: "不安全来源",
        careersUrl: "http://127.0.0.1/jobs",
        focusAreas: [],
        companySize: null,
        companySizeMin: null,
        adapter: "pending",
        enabled: false,
        checkStatus: "pending",
      }],
    })).toThrow(/HTTPS/);
  });

  it("keeps deferred onboarding sources disabled", () => {
    expect(() => validateOfficialSitesConfig({
      schemaVersion: 1,
      onboardingPolicy: {
        deferredSourceIds: ["game-company"],
        deferredReason: "纯游戏公司暂缓接入",
      },
      collection,
      publicationPolicy: {
        allowUndisclosedSalary: true,
        allowUndisclosedEducation: false,
        allowUndisclosedEmploymentType: false,
      },
      sources: [{
        id: "game-company",
        company: "游戏公司",
        careersUrl: "https://careers.example.com/jobs",
        focusAreas: ["游戏"],
        companySize: "100-499人",
        companySizeMin: 100,
        adapter: "selector",
        selectors: { card: ".job", title: ".title", url: "a" },
        enabled: true,
        checkStatus: "reachable",
      }],
    })).toThrow(/不能同时启用/);
  });

  it("accepts company-size ordering and a configured Huawei source", () => {
    const config = validateOfficialSitesConfig({
      schemaVersion: 1,
      onboardingPolicy: {
        deferredSourceIds: [],
        deferredReason: "当前没有延后来源",
        processingStrategy: "company-size-descending",
        processingReason: "按公开可核验的员工规模从大到小处理",
      },
      collection,
      publicationPolicy: {
        allowUndisclosedSalary: true,
        allowUndisclosedEducation: false,
        allowUndisclosedEmploymentType: false,
      },
      sources: [{
        id: "huawei",
        company: "华为",
        careersUrl: "https://career.huawei.com/reccampportal/portal5/social-recruitment.html",
        focusAreas: ["产品规划"],
        companySize: "213,000人",
        companySizeMin: 213000,
        adapter: "huawei",
        huawei: {
          employmentType: "full-time",
          pageSize: 20,
          maximumPagesPerKeyword: 5,
        },
        enabled: true,
        checkStatus: "reachable",
      }],
    });

    expect(config.onboardingPolicy?.processingStrategy).toBe("company-size-descending");
    expect(config.sources[0].adapter).toBe("huawei");
  });
});
