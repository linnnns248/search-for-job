import { educationRanks } from "./boss/parse";
import type { BossCollectorConfig, BossJobCandidate } from "./types";

type CriteriaConfig = Pick<
  BossCollectorConfig,
  "titleIncludeKeywords" | "employmentTypes" | "minimumEducation" | "minimumSalaryK" | "maximumSalaryK"
>;

export function matchesConfiguredCriteria(job: BossJobCandidate, config: CriteriaConfig): boolean {
  const titleMatches = config.titleIncludeKeywords.some((keyword) =>
    job.title.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()),
  );
  const employmentMatches = config.employmentTypes.some((type) => type.name === job.employmentType);
  const educationMatches = job.educationLevel !== null
    && educationRanks[job.educationLevel] >= educationRanks[config.minimumEducation];
  const minimumSalaryMatches = config.minimumSalaryK === null
    || (job.salaryMinK !== null && job.salaryMinK >= config.minimumSalaryK);
  const maximumSalaryMatches = config.maximumSalaryK === null
    || (job.salaryMaxK !== null && job.salaryMaxK <= config.maximumSalaryK);

  return titleMatches && employmentMatches && educationMatches
    && minimumSalaryMatches && maximumSalaryMatches;
}
