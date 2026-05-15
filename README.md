# AI WeChat / RSS Digest Assistant

[中文说明](./README_CN.md)

An MVP assistant for turning RSS-compatible information sources into a daily AI digest. It can manage RSS sources, fetch articles, summarize them with mock / DeepSeek-compatible / Ollama providers, generate a Markdown digest, and push the digest through console, PushPlus, or SMTP email.

## Project Overview

This project is designed as a portfolio-friendly full-stack MVP. It does not require any real AI API key by default, and the `mock` provider keeps the whole demo flow runnable offline or in restricted environments.

## Features

- RSS source management: add, enable, disable, delete.
- Single-source test fetch with a top-5 article preview.
- Fetch all enabled RSS sources and deduplicate articles by URL.
- Import sample articles for demos.
- AI summarization through mock, OpenAI-compatible APIs, or local Ollama.
- Personal preference profile via `backend/data/profile.json`.
- Daily Markdown digest grouped by importance.
- Re-summarize a single article.
- Push framework: console, PushPlus, SMTP email.
- Optional scheduler for daily fetch, digest generation, and push.

## Tech Stack

- Backend: Node.js, Express
- Database: Node built-in `node:sqlite`
- Scheduler: node-cron
- RSS: rss-parser
- AI: mock, OpenAI-compatible chat completions, Ollama `/api/chat`
- Push: console, PushPlus, nodemailer SMTP
- Frontend: plain HTML / CSS / JavaScript
- Deployment: Docker / Docker Compose

## Screenshots

Screenshots are intentionally left as placeholders:

- Home page: `docs/images/home-placeholder.png`
- Source management: `docs/images/sources-placeholder.png`
- Digest generation: `docs/images/digest-placeholder.png`
- Push result: `docs/images/push-placeholder.png`

## Quick Start

Node.js `22.5+` is recommended because this project uses Node's built-in SQLite module.

```bash
cd backend
npm install
npm run dev
```

Open `http://localhost:3090`.

## Docker

```bash
docker compose up --build
```

The app is exposed at `http://localhost:3090`.

## Environment Variables

Copy `backend/.env.example` to `backend/.env` if you want to customize settings.

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

## API Overview

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET | `/api/articles` | List articles |
| POST | `/api/articles/import-sample` | Import sample articles |
| POST | `/api/articles/:id/resummarize` | Re-summarize one article |
| GET | `/api/sources` | List sources |
| POST | `/api/sources` | Create source |
| PATCH | `/api/sources/:id` | Update source |
| DELETE | `/api/sources/:id` | Delete source |
| POST | `/api/sources/:id/test-fetch` | Preview one RSS source |
| POST | `/api/fetch` | Fetch enabled RSS sources |
| POST | `/api/digest/generate` | Generate today's digest |
| GET | `/api/digest/today` | Get today's digest |
| POST | `/api/push/today` | Push today's digest |
| GET | `/api/config/ai` | Public AI config, no secrets |
| GET | `/api/config/push` | Public push config, no secrets |

## Disclaimer

This project does not scrape WeChat directly. It does not include WeChat login, anti-bot bypassing, or restricted-content scraping logic. It only consumes RSS-compatible feeds, including WeWe RSS or other lawful sources provided by the user.
