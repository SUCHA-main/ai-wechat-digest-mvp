# 公众号文章 AI 晚报系统 MVP

这是一个可运行的“公众号文章 AI 晚报系统”框架，用于接入 RSS/JSON 数据源、AI 总结模型和推送渠道。

当前阶段是 MVP 框架：不接真实微信爬虫，支持 mock、DeepSeek/OpenAI 兼容接口和本地 Ollama 三种 AI 总结模式。

## 第二阶段新增功能

- 数据源管理 API：支持查看、新增、更新、删除数据源。
- `sources.json` 作为初始种子文件，服务启动时仅在数据库 `sources` 表为空时导入一次。
- 测试文章导入：可从 `backend/data/sample-articles.json` 导入 5 篇模拟文章。
- 晚报生成优化：只统计当天或最近 24 小时新增文章，并按重要性分组。
- 前端增强：支持数据源管理、导入测试文章、生成晚报和查看 Markdown 晚报。

## 第三阶段新增功能

- 新增 AI Provider 适配层：`mock`、`deepseek`、`ollama`。
- 默认 `AI_PROVIDER=mock`，不开 API 也能运行。
- DeepSeek/OpenAI 兼容接口使用 chat completions 格式。
- Ollama 本地模式使用 `/api/chat`。
- 真实 AI 调用失败、返回非 JSON 或配置缺失时，自动 fallback 到 mock。
- 新增个人偏好文件 `backend/data/profile.json`，AI 会按兴趣和避雷项判断重要性。
- 前端展示当前 AI 模式，并支持对单篇文章重新总结。

## 第四阶段新增功能

- 支持从真实 RSS URL 抓取文章并写入 `articles` 表。
- WeWe RSS 可作为普通 RSS 数据源添加，本项目不直接爬取微信。
- RSS 抓取按文章 URL 去重，重复文章不会重复入库。
- 新文章入库时自动生成 AI 总结，真实 AI 失败时仍 fallback 到 mock。
- 新增单个数据源测试抓取，可预览前 5 篇文章，不影响数据库。
- 前端支持“测试抓取”和“抓取全部 RSS”，并展示 imported/skipped/failedSources 统计。

## 第五阶段新增功能

- 新增晚报推送模块：`console`、`pushplus`、`email`。
- 默认 `PUSH_PROVIDER=console`，只在控制台打印晚报，不会真实发送。
- 新增手动推送 API：`POST /api/push/today`。
- 新增推送配置查询 API：`GET /api/config/push`，不返回 token/password。
- 定时任务增强：开启后每天 22:30 自动抓取 RSS、生成晚报，并可选推送。
- 默认不自动推送，避免调试时误发。

## 项目结构

```text
backend/
  src/
    server.js
    db.js
    fetcher.js
    aiProvider.js
    pusher.js
    summarizer.js
    scheduler.js
    digest.js
  data/
    sources.json
    sample-articles.json
    profile.json
    app.db
  package.json
  .env.example
frontend/
  index.html
  app.js
  style.css
README_CN.md
```

## 安装

建议使用 Node.js `22.5+`，当前项目使用 Node 内置 SQLite 能力，避免本地编译数据库依赖。

```bash
cd backend
npm install
```

## 启动

```bash
cd backend
npm run dev
```

默认后端端口：`3090`。

浏览器访问：`http://localhost:3090`

## 环境变量

复制 `.env.example` 为 `.env` 后可按需修改：

```env
PORT=3090
ENABLE_SCHEDULER=false
ENABLE_DAILY_PUSH=false
AI_PROVIDER=mock
AI_API_BASE_URL=
AI_API_KEY=
AI_MODEL=
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b
PUSH_PROVIDER=console
PUSHPLUS_TOKEN=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
SMTP_TO=
```

`ENABLE_SCHEDULER=true` 表示开启每天 `22:30` 的定时任务，流程包括抓取 RSS 和生成晚报。

`ENABLE_DAILY_PUSH=true` 只在 `ENABLE_SCHEDULER=true` 时生效，表示定时任务生成晚报后自动推送。默认关闭，避免调试时误发。

## AI Provider 配置

### mock 模式

默认模式，不需要任何 API Key：

```env
AI_PROVIDER=mock
```

mock 会根据标题、内容和 `profile.json` 中的兴趣关键词进行规则评分。

### DeepSeek/OpenAI 兼容接口

适用于 DeepSeek 或其他 OpenAI compatible chat completions 服务：

```env
AI_PROVIDER=deepseek
AI_API_BASE_URL=https://api.deepseek.com/v1
AI_API_KEY=你的 API Key
AI_MODEL=deepseek-chat
```

如果 `AI_API_BASE_URL` 已经包含 `/chat/completions`，程序会直接使用该地址；否则会自动拼接 `/chat/completions`。

### Ollama 本地模式

先启动本地 Ollama 并拉取模型，例如：

```bash
ollama pull qwen2.5:3b
```

环境变量：

```env
AI_PROVIDER=ollama
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b
```

### Fallback 说明

无论使用 `deepseek` 还是 `ollama`，如果请求失败、超时、模型返回非 JSON、JSON 字段不符合要求，系统都会自动 fallback 到 mock，避免文章导入、重新总结或晚报生成失败。

## 推送配置

### console 模式

默认模式，不需要任何 token 或邮箱配置，只会把今日晚报打印到服务端控制台：

```env
PUSH_PROVIDER=console
```

### PushPlus 模式

```env
PUSH_PROVIDER=pushplus
PUSHPLUS_TOKEN=你的 PushPlus Token
```

如果缺少 `PUSHPLUS_TOKEN`，推送 API 会返回明确错误，不会让服务崩溃，也不会打印 token。

### SMTP 邮箱模式

```env
PUSH_PROVIDER=email
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=your@example.com
SMTP_PASS=你的邮箱授权码或密码
SMTP_FROM=your@example.com
SMTP_TO=target@example.com
```

如果 SMTP 配置缺失，推送 API 会返回缺失字段，不会打印 `SMTP_PASS`。

## API 列表

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查，返回 `ok` |
| GET | `/api/articles` | 获取文章列表 |
| POST | `/api/articles/import-sample` | 导入测试文章 |
| POST | `/api/articles/:id/resummarize` | 对单篇文章重新总结并更新数据库 |
| GET | `/api/sources` | 获取所有数据源 |
| POST | `/api/sources` | 新增数据源 |
| POST | `/api/sources/:id/test-fetch` | 测试单个 RSS 源并返回前 5 篇预览 |
| PATCH | `/api/sources/:id` | 更新数据源名称、URL、类型或启用状态 |
| DELETE | `/api/sources/:id` | 删除数据源 |
| GET | `/api/config/ai` | 获取当前 AI 模式，不返回 API Key |
| GET | `/api/config/push` | 获取当前推送模式，不返回 token/password |
| GET | `/api/digest/today` | 获取今日晚报 |
| POST | `/api/fetch` | 手动触发 RSS 抓取 |
| POST | `/api/digest/generate` | 手动生成今日摘要 |
| POST | `/api/push/today` | 推送今日晚报 |

## 数据源配置

RSS 示例配置在 `backend/data/sources.json`：

```json
[
  {
    "name": "示例公众号",
    "type": "rss",
    "url": "https://example.com/rss.xml",
    "enabled": true
  }
]
```

当前只放示例源，不写死真实公众号源。实际使用时可在前端添加普通 RSS、WeWe RSS 或其他工具生成的 RSS 源。

## RSS / WeWe RSS 接入

添加 RSS 源时，在前端“数据源管理”里填写：

- 名称：自定义名称，例如 `我的技术 RSS`
- 类型：选择 `RSS`
- URL：填写可访问的 RSS XML 地址
- 启用：保持勾选，`/api/fetch` 只抓取启用的数据源

WeWe RSS 接入方式：

本项目不直接爬取微信，也不包含任何微信爬虫逻辑。你可以使用 WeWe RSS 或其他工具在外部生成 RSS/JSON 地址，然后把该地址作为普通 RSS 数据源添加到本项目。

RSS 抓取逻辑：

- 从数据库 `sources` 表读取 `enabled=true` 且 `type=rss` 的数据源
- 使用 `rss-parser` 拉取和解析 RSS
- 提取标题、链接、作者、发布时间、正文摘要和来源名
- 按 URL 去重，已存在文章会跳过
- 新文章入库时自动生成统一 JSON 摘要

## 数据源管理 API

新增数据源：

```bash
curl -X POST http://localhost:3090/api/sources \
  -H "Content-Type: application/json" \
  -d '{"name":"我的 RSS","type":"rss","url":"https://example.com/rss.xml","enabled":true}'
```

更新数据源：

```bash
curl -X PATCH http://localhost:3090/api/sources/1 \
  -H "Content-Type: application/json" \
  -d '{"enabled":false}'
```

删除数据源：

```bash
curl -X DELETE http://localhost:3090/api/sources/1
```

测试单个 RSS 源：

```bash
curl -X POST http://localhost:3090/api/sources/1/test-fetch
```

## 推送今日晚报

推送前需要先生成今日晚报：

```bash
curl -X POST http://localhost:3090/api/digest/generate
curl -X POST http://localhost:3090/api/push/today
```

查询当前推送配置：

```bash
curl http://localhost:3090/api/config/push
```

该接口只返回是否已配置，不返回 `PUSHPLUS_TOKEN`、`SMTP_PASS` 等敏感信息。

## 测试文章导入

测试文章位于 `backend/data/sample-articles.json`，包含 5 篇模拟文章，主题包括 AI 编程工具、物联网项目、专升本学习、开源项目和普通生活资讯。

导入命令：

```bash
curl -X POST http://localhost:3090/api/articles/import-sample
```

导入逻辑按 `url` 去重，重复导入不会重复插入。

## 推荐调试流程

先用 mock 验证：

```bash
npm run dev
```

打开 `http://localhost:3090`，按顺序操作：

1. 点击“导入测试文章”
2. 点击“生成今日晚报”
3. 查看今日晚报结果

调试真实 RSS：

1. 添加 RSS 源
2. 点击“测试抓取”
3. 点击“抓取全部 RSS”
4. 点击“生成今日晚报”
5. 查看文章列表和今日晚报结果
6. 点击“推送今日晚报”验证推送配置

再用 Ollama 验证：

1. 启动 Ollama 并确认模型可用
2. 设置 `AI_PROVIDER=ollama`
3. 重启服务后点击文章旁边的“重新总结”

最后再配置 DeepSeek：

1. 设置 `AI_PROVIDER=deepseek`
2. 配置 `AI_API_BASE_URL`、`AI_API_KEY`、`AI_MODEL`
3. 用 `POST /api/articles/:id/resummarize` 单篇测试，确认效果后再用于批量导入或 RSS 抓取

## 常见问题

RSS 无法访问：检查 URL 是否能在浏览器打开，是否需要代理，是否返回标准 RSS/XML 内容。

内容为空：部分 RSS 只提供标题和链接，不提供全文；系统会尽量使用 `content`、`contentSnippet` 或 `summary` 字段。

AI 总结失败：`deepseek` 或 `ollama` 请求失败时会自动 fallback 到 mock，不会阻断文章入库或晚报生成。

重复文章：系统按文章 URL 去重，重复抓取不会重复写入 `articles` 表。

PushPlus/邮箱推送失败：检查 `PUSH_PROVIDER` 是否正确，以及 token、SMTP 配置是否完整。配置查询接口不会泄露敏感信息。

## AI 总结 Mock 规则

`backend/src/summarizer.js` 会根据标题和内容生成：

- 一句话总结
- 3 个要点
- 重要性评分 1-5
- 推荐阅读理由

当前通过关键词规则模拟评分，标题或内容包含 `AI`、`编程`、`开源`、`物联网`、`机器人`、`学习` 时评分更高。

真实 AI 和 mock 的输出都会统一保存为 JSON：

```json
{
  "summary": "一句话总结",
  "points": ["要点1", "要点2", "要点3"],
  "importance_score": 1,
  "reason": "推荐阅读理由"
}
```

## 后续计划

- 增加 PushPlus/邮箱推送
- 增加个人偏好 `profile.yaml`
- 增加 JSON 数据源入口
- 增加摘要去重、标签和检索
