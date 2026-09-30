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
});
