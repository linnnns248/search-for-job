import { describe, expect, it } from "vitest";
import { isChineseStatutoryWorkday } from "./calendar";

describe("中国法定工作日", () => {
  it("识别普通工作日、法定假期和调休工作日", async () => {
    await expect(isChineseStatutoryWorkday("2026-09-29")).resolves.toBe(true);
    await expect(isChineseStatutoryWorkday("2026-10-02")).resolves.toBe(false);
    await expect(isChineseStatutoryWorkday("2026-10-10")).resolves.toBe(true);
  });

  it("未配置年份时安全停止", async () => {
    await expect(isChineseStatutoryWorkday("2027-01-04")).rejects.toThrow("缺少 2027 年");
  });
});
