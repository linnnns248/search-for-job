export type JobStatus = "new" | "active" | "updated" | "suspected_offline" | "offline";
export type SourceType = "boss" | "official";

export interface JobSource {
  type: SourceType;
  name: string;
  url?: string;
}

export interface JobRecord {
  id: string;
  company: string;
  companySize: string;
  companySizeMin: number;
  title: string;
  description: string;
  salary: string;
  salaryMinK: number | null;
  salaryMaxK: number | null;
  city: string;
  sources: JobSource[];
  firstSeenAt: string;
  lastSeenAt: string;
  status: JobStatus;
}

export interface JobDataset {
  schemaVersion: number;
  generatedAt: string;
  isDemo: boolean;
  jobs: JobRecord[];
}

export interface SearchConfig {
  schemaVersion: number;
  cities: string[];
  keywords: string[];
  titleIncludeKeywords: string[];
  salary: {
    minimumK: number | null;
    maximumK: number | null;
  };
  companySize: {
    minimum: number;
  };
  schedule: {
    timezone: string;
    time: string;
    statutoryWorkdaysOnly: boolean;
  };
}

export interface Filters {
  query: string;
  city: string;
  source: "all" | SourceType;
  status: "all" | JobStatus;
  minimumSalaryK: number;
}

export type SortKey = "latest" | "salaryDesc" | "company";
