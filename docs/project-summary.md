# Project Summary

## Project Background

Many readers follow technical articles, public-account content, RSS feeds, and community updates every day. The information volume is high, but most content does not deserve deep reading. This project explores a lightweight personal digest workflow: collect articles, summarize them with AI, rank them by personal preference, and generate a daily report.

## Problem Solved

The project helps users reduce repetitive information screening. It turns scattered RSS-compatible content into a structured daily digest with clear priorities: must-read, quick-scan, and skippable.

## System Architecture

The system is split into small modules:

- `fetcher.js`: reads enabled RSS sources, fetches feeds, parses items, deduplicates by URL, and inserts new articles.
- `summarizer.js`: normalizes all summary outputs into JSON and falls back to mock when AI fails.
- `aiProvider.js`: adapts mock, DeepSeek/OpenAI-compatible APIs, and Ollama.
- `digest.js`: builds the daily Markdown digest from recent articles.
- `pusher.js`: pushes the digest through console, PushPlus, or SMTP email.
- `scheduler.js`: optionally runs the daily pipeline at 22:30.
- `server.js`: exposes REST APIs and hosts the static frontend.

## Completed Stages

- Stage 1: MVP scaffold with Express, SQLite, mock summary, and static frontend.
- Stage 2: source management and sample article import.
- Stage 3: AI provider abstraction and personal profile summarization.
- Stage 4: real RSS fetching and source test preview.
- Stage 5: daily digest push framework.
- Presentation stage: bilingual README, demo docs, screenshots placeholders, and Docker support.

## Technical Challenges

- Keeping the project runnable without API keys by making mock the default provider.
- Normalizing unreliable AI output into strict JSON with fallback behavior.
- Preventing one failed RSS source from breaking the entire fetch request.
- Avoiding accidental pushes by making console the default push mode and disabling scheduled push by default.
- Using Node's built-in SQLite to avoid native dependency compilation issues on Windows.

## Extensibility

- Add WeWe RSS deployment examples.
- Add JSON source import.
- Improve personal preference scoring with tags and embeddings.
- Add digest history and search.
- Add Docker volume persistence guidance.
- Add a richer dashboard with charts, filters, and source health status.

## Portfolio Pitch

AI WeChat / RSS Digest Assistant is a pragmatic full-stack MVP that demonstrates data ingestion, persistence, AI provider abstraction, prompt engineering, scheduled jobs, push integrations, and a lightweight frontend. It is intentionally scoped to avoid scraping WeChat directly and instead consumes legal RSS-compatible feeds, making it suitable for personal productivity and portfolio demonstration.
