import type { JobDataset, OfficialCompany, OfficialCompanyCatalog } from "./types";

export function getOfficialCompaniesWithoutJobs(
  catalog: OfficialCompanyCatalog,
  dataset: JobDataset,
): OfficialCompany[] {
  const companiesWithOfficialJobs = new Set(
    dataset.jobs
      .filter((job) => job.sources.some((source) => source.type === "official"))
      .map((job) => job.company),
  );
  return catalog.companies.filter((company) =>
    !company.enabled || !companiesWithOfficialJobs.has(company.company));
}
