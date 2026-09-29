# 配置说明

公开配置位于 `public/data/config.json`。

## 可配置字段

- `cities`：采集城市数组，当前为成都。
- `keywords`：岗位搜索关键词。
- `salary.minimumK` / `salary.maximumK`：月薪范围，`null` 表示不限制。
- `companySize.minimum`：最低公司人数。
- `schedule.timezone`：计划时区。
- `schedule.time`：每日执行时间。
- `schedule.statutoryWorkdaysOnly`：是否仅中国法定工作日执行。

## 官网配置

公司官网清单将在 `v0.3.0` 加入。每条来源至少包含公司名称、招聘页链接、公司规模、适配器类型、是否启用。官网不披露薪资时记录“未披露”，不做推测。

## 配置版本

配置和岗位数据均包含 `schemaVersion`。采集端写入数据前必须校验版本；页面构建前由 `scripts/validate-data.mjs` 校验公开数据。
