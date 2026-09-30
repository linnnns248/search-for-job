import type { SearchConfig } from "../../src/types";
import { educationRanks } from "../boss/parse";
import type { OfficialJobCandidate, OfficialSitesConfig } from "./types";

function matchesCity(city: string, configuredCities: string[]): boolean {
  const normalized = city.replace(/市$/u, "").toLocaleLowerCase();
  return configuredCities.some((candidate) => {
    const configured = candidate.replace(/市$/u, "").toLocaleLowerCase();
    return normalized === configured || normalized.includes(configured);
  });
}

export function matchesOfficialCriteria(
  job: OfficialJobCandidate,
  searchConfig: SearchConfig,
  policy: OfficialSitesConfig["publicationPolicy"],
): boolean {
  const titleMatches = searchConfig.titleIncludeKeywords.some((keyword) =>
    job.title.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()),
  );
  const cityMatches = matchesCity(job.city, searchConfig.cities);
  const companySizeMatches = job.companySizeMin >= searchConfig.companySize.minimum;
  const employmentMatches = job.employmentType === null
    ? policy.allowUndisclosedEmploymentType
    : searchConfig.employmentTypes.includes(job.employmentType);
  const educationMatches = job.educationLevel === null
    ? policy.allowUndisclosedEducation
    : educationRanks[job.educationLevel] >= educationRanks[searchConfig.education.minimum];
  const minimumSalaryMatches = searchConfig.salary.minimumK === null
    || (job.salaryMinK === null
      ? policy.allowUndisclosedSalary
      : job.salaryMinK >= searchConfig.salary.minimumK);
  const maximumSalaryMatches = searchConfig.salary.maximumK === null
    || (job.salaryMaxK === null
      ? policy.allowUndisclosedSalary
      : job.salaryMaxK <= searchConfig.salary.maximumK);

  return titleMatches && cityMatches && companySizeMatches && employmentMatches
    && educationMatches && minimumSalaryMatches && maximumSalaryMatches;
}

