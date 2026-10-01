# 配置说明

公开配置位于 `public/data/config.json`。

## 可配置字段

- `cities`：采集城市数组，当前为成都。
- `keywords`：岗位搜索关键词。
- `titleIncludeKeywords`：最终允许保留的岗位名称关键词，用于排除搜索联想中的销售、运营和研发岗位。
- `employmentTypes`：求职类型，当前为 `full-time`。
- `education.minimum`：最低学历，当前为 `bachelor`；硕士和博士同样满足条件。
- `salary.minimumK` / `salary.maximumK`：月薪范围，`null` 表示不限制。
- `companySize.minimum`：最低公司人数。
- `schedule.timezone`：计划时区。
- `schedule.time`：每日执行时间。
- `schedule.statutoryWorkdaysOnly`：是否仅中国法定工作日执行。

Boss 数据源参数位于 `config/collector.json`：

- `cityCodes`：公开配置中的城市名称到 Boss 城市编码的映射。
- `employmentTypeCodes`：公开求职类型到 Boss 网页筛选编码的映射。
- `maximumPagesPerKeyword`：每个城市、关键词最多采集页数。
- `maximumDetailsPerRun`：单次任务最多读取的岗位详情数，防止异常结果导致访问量失控。
- `minimumDelayMs` / `maximumDelayMs`：普通页面访问间隔。
- `minimumKeywordPauseMs` / `maximumKeywordPauseMs`：不同关键词之间的冷却时间。
- `detailBatchSize` 与批次暂停配置：分批读取详情并在批次之间休息。

关键词、岗位名称过滤词、求职类型、最低学历、薪资范围和最低公司规模不在采集配置中重复保存，由采集器直接读取公开配置，避免两份配置不一致。

## 官网配置

公司官网清单位于 `config/official-sites.json`。每条来源包含稳定 ID、公司名称、招聘页链接、关注方向、公司规模、适配器类型、检查状态和是否启用。

`onboardingPolicy.deferredSourceIds` 用于保存“暂缓开发”的来源，与已实现后的 `enabled` 开关分开。当前纯游戏类公司位于延后清单，新设备或新 Codex 会从版本化配置中继承该优先级。

`onboardingPolicy.processingStrategy` 保存其余来源的处理顺序。当前为 `company-size-descending`：先使用公司官网、年报等公开依据确认员工规模，再从大到小接入；同一规模档优先处理无需登录、字段完整且能稳定低频读取的官网。

新来源先以 `enabled: false` 加入。只有确认公司规模、完成适配器并通过岗位字段验证后才允许启用。当前适配器类型包括 `json-ld`、`selector`、`cloudview`、`moka`、`zhiye`、`tencent`、`meituan`、`baidu`、`huawei`、`didi`、`oppo`、`custom` 和 `pending`。

Zhiye 来源可在单站点 `zhiye` 配置中调整招聘类型（社招/校招）、每页数量和每关键词最大页数。采集关键词仍统一读取公开配置的 `titleIncludeKeywords`，避免站点配置复制业务条件。

腾讯、美团、百度、华为、滴滴和 OPPO 来源分别在 `tencent` / `meituan` / `baidu` / `huawei` / `didi` / `oppo` 配置中维护招聘类型、求职类型和分页上限；支持城市编码或城市名称的站点还在各自配置中维护城市映射。北森招聘系统根据站点版本使用 `zhiye` 或 `zhiyeClassic` 配置；城市、岗位名称、学历、薪资和公司规模的发布条件仍统一由公开搜索配置控制。

`publicationPolicy` 控制官网缺失字段的发布口径。当前允许薪资未披露，但不允许学历或求职类型未披露。完整清单和启用门槛见 `docs/official-sites.md`。

## 配置版本

配置和岗位数据均包含 `schemaVersion`。采集端写入数据前必须校验版本；页面构建前由 `scripts/validate-data.mjs` 校验公开数据。
