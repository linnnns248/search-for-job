import { readFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "./config";

interface ChinaWorkdayCalendar {
  schemaVersion: 1;
  year: number;
  timezone: "Asia/Shanghai";
  officialSource: string;
  holidayDates: string[];
  adjustedWorkdays: string[];
}

export async function isChineseStatutoryWorkday(date: string): Promise<boolean> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("日期必须使用 YYYY-MM-DD 格式");
  const calendar = JSON.parse(
    await readFile(path.join(projectRoot, "config", "china-workdays.json"), "utf8"),
  ) as ChinaWorkdayCalendar;
  const year = Number(date.slice(0, 4));
  if (year !== calendar.year) {
    throw new Error(`缺少 ${year} 年中国法定工作日配置，已停止自动采集`);
  }
  if (calendar.adjustedWorkdays.includes(date)) return true;
  if (calendar.holidayDates.includes(date)) return false;
  const weekday = new Date(`${date}T12:00:00+08:00`).getUTCDay();
  return weekday >= 1 && weekday <= 5;
}
