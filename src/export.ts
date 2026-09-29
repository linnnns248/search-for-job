import writeExcelFile from "write-excel-file/browser";
import type { JobRecord } from "./types";
import { sourceLabel } from "./job-utils";

interface ExportRow {
  公司: string;
  公司规模: string;
  岗位名称: string;
  岗位描述: string;
  薪资: string;
  数据来源: string;
  岗位链接: string;
}

function toRows(jobs: JobRecord[]): ExportRow[] {
  return jobs.map((job) => ({
    公司: job.company,
    公司规模: job.companySize,
    岗位名称: job.title,
    岗位描述: job.description,
    薪资: job.salary,
    数据来源: sourceLabel(job),
    岗位链接: job.sources
      .map((source) => source.url)
      .filter((url): url is string => Boolean(url))
      .join("\n"),
  }));
}

function dateSuffix(): string {
  return new Date().toISOString().slice(0, 10);
}

export function downloadCsv(jobs: JobRecord[]): void {
  const rows = toRows(jobs);
  const headers = ["公司", "公司规模", "岗位名称", "岗位描述", "薪资", "数据来源", "岗位链接"] as const;
  const escapeCell = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const csv = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(",")),
  ].join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `成都产品经理岗位_${dateSuffix()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadXlsx(jobs: JobRecord[]): Promise<void> {
  const rows = toRows(jobs);
  const headerStyle = { fontWeight: "bold", backgroundColor: "#DFF2E7" } as const;
  const sheetData = [
    [
      { value: "公司", ...headerStyle },
      { value: "公司规模", ...headerStyle },
      { value: "岗位名称", ...headerStyle },
      { value: "岗位描述", ...headerStyle },
      { value: "薪资", ...headerStyle },
      { value: "数据来源", ...headerStyle },
      { value: "岗位链接", ...headerStyle },
    ],
    ...rows.map((row) => [
      row.公司,
      row.公司规模,
      row.岗位名称,
      { value: row.岗位描述, wrap: true },
      row.薪资,
      row.数据来源,
      { value: row.岗位链接, wrap: true },
    ]),
  ];
  await writeExcelFile(sheetData, {
    columns: [
      { width: 20 },
      { width: 14 },
      { width: 24 },
      { width: 72 },
      { width: 16 },
      { width: 20 },
      { width: 42 },
    ],
  }).toFile(`成都产品经理岗位_${dateSuffix()}.xlsx`);
}
