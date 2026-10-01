import type { EducationLevel, EmploymentType } from "../../src/types";

export type OfficialAdapterType = "json-ld" | "selector" | "cloudview" | "moka" | "zhiye" | "zhiye-classic" | "tencent" | "meituan" | "baidu" | "huawei" | "didi" | "oppo" | "tongcheng" | "custom" | "pending";
export type OfficialSourceCheckStatus = "reachable" | "needs-browser" | "unavailable" | "pending";

export interface SelectorAdapterConfig {
  card: string;
  title: string;
  url: string;
  company?: string;
  city?: string;
  description?: string;
  salary?: string;
  education?: string;
  employmentType?: string;
  urlAttribute?: string;
}

export interface ZhiyeAdapterConfig {
  category: "1" | "2";
  pageSize: number;
  maximumPagesPerKeyword: number;
}

export interface ZhiyeClassicAdapterConfig {
  cityCodes: Record<string, string>;
  employmentType: EmploymentType;
  maximumPagesPerKeyword: number;
}

export interface TencentAdapterConfig {
  cityIds: Record<string, number>;
  recruitmentTypeId: number;
  employmentType: EmploymentType;
  pageSize: number;
  maximumPagesPerKeyword: number;
}

export interface MeituanAdapterConfig {
  cityCodes: Record<string, string>;
  jobTypeCode: string;
  employmentType: EmploymentType;
  pageSize: number;
  maximumPagesPerKeyword: number;
}

export interface BaiduAdapterConfig {
  cityCodes: Record<string, string>;
  postTypeCode: string;
  recruitType: "SOCIAL";
  employmentType: EmploymentType;
  pageSize: number;
  maximumPagesPerKeyword: number;
}

export interface HuaweiAdapterConfig {
  employmentType: EmploymentType;
  pageSize: number;
  maximumPagesPerKeyword: number;
}

export interface DidiAdapterConfig {
  cityNames: Record<string, string>;
  employmentType: EmploymentType;
  pageSize: number;
  maximumPagesPerCity: number;
}

export interface OppoAdapterConfig {
  cityCodes: Record<string, string>;
  recruitType: "SOCIAL-RECRUITMENT";
  employmentType: EmploymentType;
  pageSize: number;
  maximumPagesPerCity: number;
}

export interface TongchengAdapterConfig {
  companyId: string;
  cityIds: Record<string, string>;
  queryType: 4;
  regularEmploymentTypeCode: "REGULAR";
  employmentType: EmploymentType;
  pageSize: number;
  maximumPagesPerCity: number;
}

export interface OfficialSiteSource {
  id: string;
  company: string;
  careersUrl: string;
  focusAreas: string[];
  companySize: string | null;
  companySizeMin: number | null;
  companySizeEvidenceUrl?: string;
  adapter: OfficialAdapterType;
  selectors?: SelectorAdapterConfig;
  zhiye?: ZhiyeAdapterConfig;
  zhiyeClassic?: ZhiyeClassicAdapterConfig;
  tencent?: TencentAdapterConfig;
  meituan?: MeituanAdapterConfig;
  baidu?: BaiduAdapterConfig;
  huawei?: HuaweiAdapterConfig;
  didi?: DidiAdapterConfig;
  oppo?: OppoAdapterConfig;
  tongcheng?: TongchengAdapterConfig;
  enabled: boolean;
  checkStatus: OfficialSourceCheckStatus;
  notes?: string;
}

export interface OfficialSitesConfig {
  schemaVersion: 1;
  onboardingPolicy?: {
    deferredSourceIds: string[];
    deferredReason: string;
    processingStrategy?: "company-size-descending";
    processingReason?: string;
  };
  collection: {
    requestTimeoutMs: number;
    maximumResponseBytes: number;
    minimumDelayMs: number;
    maximumDelayMs: number;
    maximumDetailsPerSource: number;
  };
  publicationPolicy: {
    allowUndisclosedSalary: boolean;
    allowUndisclosedEducation: boolean;
    allowUndisclosedEmploymentType: boolean;
  };
  sources: OfficialSiteSource[];
}

export interface OfficialJobCandidate {
  sourceId: string;
  sourceName: string;
  company: string;
  companySize: string;
  companySizeMin: number;
  title: string;
  description: string;
  salary: string;
  salaryMinK: number | null;
  salaryMaxK: number | null;
  education: string;
  educationLevel: EducationLevel | null;
  employmentType: EmploymentType | null;
  city: string;
  url: string;
  sourceKey: string;
}
