# Boss 本地采集器

## 工作方式

采集器由普通 Chrome 中的本地扩展和仅监听 `127.0.0.1` 的接收器组成。扩展使用用户本人已完成的 Boss 登录状态读取公开岗位页面；它不会记录账号或密码，也不会绕过验证码。

本地令牌和日志保存在 `.collector/`，该目录已被 Git 忽略。Boss Cookie 仍由 Chrome 自己管理。唯一允许写入仓库的是经过字段白名单处理的 `public/data/jobs.json`，原始页面不会落盘。

## 首次安装

需要 Node.js 20 或更高版本，以及已安装的 Google Chrome。

```bash
git clone git@github.com:linnnns248/search-for-job.git
cd search-for-job
npm install
npm run build:extension
npm run collector:serve
```

1. 在普通 Chrome 打开 `chrome://extensions/` 并开启开发者模式。
2. 点击“加载未打包的扩展程序”，选择仓库中的 `extension/dist`。
3. 打开「成都岗位采集助手」，粘贴接收器输出的令牌并保存。
4. 在同一个 Chrome 中人工登录 Boss；若出现安全验证，也由用户本人完成。
5. 点击一次“立即采集一次”完成安装验证。

## 采集命令

扩展默认在中国法定工作日北京时间 23:00 自动运行。日常不需要点击按钮，但以下条件必须同时满足：

- 电脑处于开机并登录状态，Chrome 正在运行。
- Boss 登录没有失效，也没有待处理的安全验证。
- 本地接收器正在运行。

macOS 可执行 `npm run collector:install`，将接收器安装为登录后自动启动的 LaunchAgent；`npm run collector:uninstall` 可移除。扩展按钮是手动补跑和排查入口。

如果一次采集没有得到任何合格岗位，正式命令不会覆盖原数据。未在某次结果中出现的历史岗位也不会立即标记下架，避免局部扫描失败造成误判。

## 配置

- 搜索城市、关键词、岗位名称过滤词、求职类型、最低学历、薪资范围、最低公司规模：`public/data/config.json`。
- Boss 城市和求职类型编码、每关键词页数、访问间隔、冷却时间和单次详情上限：`config/collector.json`。
- 新增城市时，需要同时在公开配置中写城市名称，并在采集配置的 `cityCodes` 中补充对应 Boss 城市编码。

当前每个关键词最多采集 5 页，普通访问间隔为 6–12 秒；关键词切换及每 20 个详情后额外冷却 15–20 秒，单次最多读取 200 个详情。每一页搜索或一个详情完成后都会持久化进度，再通过 Chrome Alarm 继续下一步；因此 Service Worker 休眠后可从已保存进度续跑。页数是上限：空页或重复页会提前停止。该策略只能降低访问频率和账号风险，不能保证平台永远不触发验证；一旦出现验证，任务会立即停止并等待人工处理。

## 换电脑

代码、配置和公开岗位数据通过 GitHub 仓库同步。新电脑只需：

1. 克隆仓库并安装依赖。
2. 重新安装扩展并保存新电脑本地接收器生成的令牌。
3. 在新电脑的普通 Chrome 重新登录 Boss，并手动试采一次。
4. 执行 `npm run collector:install` 恢复接收器自动启动。

旧电脑的 Cookie、浏览器资料和账号状态不应传输，也不会被 GitHub 同步。

## 异常处理

- 提示需要登录或安全验证：在普通 Chrome 打开 Boss，人工完成页面要求后再补跑一次。
- 搜索页未识别岗位：Boss 页面结构可能变化，应更新解析器和测试后再正式采集。
- 详情采集失败：该岗位会被跳过并输出警告，不会发布空描述。
- 采集结果为 0：原有公开数据保持不变。
- 接收器不可用：运行 `npm run collector:serve` 临时启动，或重新执行 `npm run collector:install`。
