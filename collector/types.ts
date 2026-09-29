import type { JobDataset, JobRecord } from "../src/types";

export interface CityConfig {
  name: string;
  bossCode: string;
}

export interface BossCollectorConfig {
  enabled: boolean;
  cities: CityConfig[];
  keywords: string[];
  titleIncludeKeywords: string[];
  minimumCompanySize: number;
  maximumPagesPerKeyword: number;
  minimumDelayMs: number;
  maximumDelayMs: number;
}

export interface CollectorConfig {
  schemaVersion: 1;
  boss: {
    enabled: boolean;
    cityCodes: Record<string, string>;
    maximumPagesPerKeyword: number;
    minimumDelayMs: number;
    maximumDelayMs: number;
  };
}

export interface BossJobCandidate {
  company: string;
  companySize: string;
  companySizeMin: number | null;
  title: string;
  salary: string;
  salaryMinK: number | null;
  salaryMaxK: number | null;
  city: string;
  url: string;
  description: string;
}

export interface CollectionResult {
  dataset: JobDataset;
  collectedJobs: JobRecord[];
  rejectedCount: number;
  warnings: string[];
}
