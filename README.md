# 成都产品经理岗位看板

一个面向成都产品经理岗位的公开信息看板。页面从版本化 JSON 数据中读取岗位，支持搜索、筛选、排序、详情查看，以及 CSV / Excel 下载。

## 当前版本

`v0.2.1`：公开岗位看板与本地 Boss 采集端。当前采集条件为成都、100 人以上公司、全职、本科及以上、月薪下限 10K 及以上的产品经理方向公开岗位。

## 本地运行

```bash
npm install
npm run dev
```

打开终端中显示的本地地址。

请勿直接双击源码根目录的 `index.html`。它是构建入口，必须通过开发服务器、预览服务器或 GitHub Pages 访问。直接打开时页面会显示对应提示。

## 验证

```bash
npm test
npm run build
```

构建结果位于 `dist/`。

## Boss 本地采集

采集器由普通 Chrome 中的本地扩展读取 Boss 公开岗位页面，再把白名单字段发送给仅监听 `127.0.0.1` 的本地接收器。首次使用：

```bash
npm install
npm run build:extension
npm run collector:serve
```

随后在 `chrome://extensions/` 开启开发者模式，通过“加载未打包的扩展程序”选择 `extension/dist`。把接收器输出的令牌保存到「成都岗位采集助手」，并在普通 Chrome 登录 Boss。

要让接收器在 macOS 登录后自动启动，可执行：

```bash
npm run collector:install
```

扩展会在中国法定工作日 23:00 自动运行；普通 Chrome、Boss 登录状态和本地接收器需保持可用。“立即采集一次”只用于安装验证或故障排查，不需要每天点击。换电脑时重新克隆仓库、安装依赖和扩展、重新登录 Boss即可，无需传输旧电脑文件。详见 `docs/collector.md`。

## 数据入口

- `public/data/config.json`：城市、搜索词、岗位名称过滤词、求职类型、学历、薪资、公司规模和定时配置。
- `config/collector.json`：Boss 城市/求职类型编码、分页、访问节奏和单次上限，不含账号信息。
- `config/official-sites.json`：46 个公司官网入口、适配器分类、验证状态和缺失字段策略；未验证来源默认关闭。
- `public/data/jobs.json`：网页可公开读取的岗位数据。
- `schemas/`：采集端与页面共享的数据协议。

`v0.3.0` 官网接入进度和启用门槛见 `docs/official-sites.md`。

## GitHub Pages

合并到 `main` 后，`.github/workflows/pages.yml` 会构建并发布页面。预期地址：

`https://linnnns248.github.io/search-for-job/`

仓库必须满足当前 GitHub Pages 套餐和可见性要求，并在仓库设置中选择 GitHub Actions 作为 Pages 来源。

## 隐私边界

这是公开网站。只允许发布公开岗位字段。Boss 登录状态、Cookie、Token、简历、投递记录、个人备注和简历分析结果不得进入仓库或构建产物。完整规则见 `docs/privacy.md`。
