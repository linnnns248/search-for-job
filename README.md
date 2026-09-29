# 成都产品经理岗位看板

一个面向成都产品经理岗位的公开信息看板。页面从版本化 JSON 数据中读取岗位，支持搜索、筛选、排序、详情查看，以及 CSV / Excel 下载。

## 当前版本

`v0.1.0` 页面原型：使用明确标记的示例数据验证产品交互和 GitHub Pages 发布链路。Boss 直聘与公司官网自动采集将在后续版本接入。

## 本地运行

```bash
npm install
npm run dev
```

打开终端中显示的本地地址。

## 验证

```bash
npm test
npm run build
```

构建结果位于 `dist/`。

## 数据入口

- `public/data/config.json`：城市、关键词、薪资、公司规模和定时配置。
- `public/data/jobs.json`：网页可公开读取的岗位数据。
- `schemas/`：采集端与页面共享的数据协议。

## GitHub Pages

合并到 `main` 后，`.github/workflows/pages.yml` 会构建并发布页面。预期地址：

`https://linnnns248.github.io/search-for-job/`

仓库必须满足当前 GitHub Pages 套餐和可见性要求，并在仓库设置中选择 GitHub Actions 作为 Pages 来源。

## 隐私边界

这是公开网站。只允许发布公开岗位字段。Boss 登录状态、Cookie、Token、简历、投递记录、个人备注和简历分析结果不得进入仓库或构建产物。完整规则见 `docs/privacy.md`。
