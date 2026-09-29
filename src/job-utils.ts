import type { Filters, JobRecord, JobStatus, SortKey } from "./types";

export const STATUS_LABELS: Record<JobStatus, string> = {
  new: "今日新增",
  active: "持续在招",
  updated: "信息更新",
  suspected_offline: "疑似下架",
  offline: "已下架",
};

export function filterJobs(jobs: JobRecord[], filters: Filters): JobRecord[] {
  const query = filters.query.trim().toLocaleLowerCase("zh-CN");

  return jobs.filter((job) => {
    const searchable = [job.company, job.title, job.description, job.salary]
      .join(" ")
      .toLocaleLowerCase("zh-CN");
    const matchesQuery = !query || searchable.includes(query);
    const matchesCity = filters.city === "all" || job.city === filters.city;
    const matchesSource =
      filters.source === "all" || job.sources.some((source) => source.type === filters.source);
    const matchesStatus = filters.status === "all" || job.status === filters.status;
    const matchesSalary =
      filters.minimumSalaryK === 0 ||
      (job.salaryMaxK !== null && job.salaryMaxK >= filters.minimumSalaryK);

    return matchesQuery && matchesCity && matchesSource && matchesStatus && matchesSalary;
  });
}

export function sortJobs(jobs: JobRecord[], sortKey: SortKey): JobRecord[] {
  return [...jobs].sort((left, right) => {
    if (sortKey === "salaryDesc") {
      return (right.salaryMaxK ?? -1) - (left.salaryMaxK ?? -1);
    }

    if (sortKey === "company") {
      return left.company.localeCompare(right.company, "zh-CN");
    }

    return new Date(right.firstSeenAt).getTime() - new Date(left.firstSeenAt).getTime();
  });
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function sourceLabel(job: JobRecord): string {
  return job.sources.map((source) => source.name).join("、");
}
