import type { EducationLevel, EmploymentType, JobDataset, JobRecord } from "../src/types";

export interface CityConfig {
  name: string;
  bossCode: string;
}

export interface BossCollectorConfig {
  enabled: boolean;
  cities: CityConfig[];
  keywords: string[];
  titleIncludeKeywords: string[];
  employmentTypes: Array<{ name: EmploymentType; bossCode: string }>;
  minimumEducation: EducationLevel;
  minimumSalaryK: number | null;
  maximumSalaryK: number | null;
  minimumCompanySize: number;
  maximumPagesPerKeyword: number;
  maximumDetailsPerRun: number;
  minimumDelayMs: number;
  maximumDelayMs: number;
  minimumKeywordPauseMs: number;
  maximumKeywordPauseMs: number;
  detailBatchSize: number;
  minimumBatchPauseMs: number;
  maximumBatchPauseMs: number;
}

export interface CollectorConfig {
  schemaVersion: 1;
  boss: {
    enabled: boolean;
    cityCodes: Record<string, string>;
    employmentTypeCodes: Record<EmploymentType, string>;
    maximumPagesPerKeyword: number;
    maximumDetailsPerRun: number;
    minimumDelayMs: number;
    maximumDelayMs: number;
    minimumKeywordPauseMs: number;
    maximumKeywordPauseMs: number;
    detailBatchSize: number;
    minimumBatchPauseMs: number;
    maximumBatchPauseMs: number;
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
  education: string;
  educationLevel: EducationLevel | null;
  employmentType: EmploymentType;
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
