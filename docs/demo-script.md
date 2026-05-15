# Demo Script

This script is intended for local demos, portfolio walkthroughs, or recording a short project video.

## 1. Start The Project

```bash
cd backend
npm install
npm run dev
```

Open `http://localhost:3090`.

## 2. Import Sample Articles

Click `导入测试文章`.

Expected result: the article list shows five simulated articles covering AI coding tools, IoT, study planning, open source, and lifestyle information.

## 3. Add An RSS Source

In the source form:

- Name: `Demo RSS`
- Type: `RSS`
- URL: any reachable RSS feed URL
- Enabled: checked

Click `添加数据源`.

## 4. Test Fetch

Click `测试抓取` next to the RSS source.

Expected result: the result box shows whether the feed is accessible, the parsed article count, and the first five titles.

## 5. Fetch All RSS

Click `抓取全部 RSS`.

Expected result: the result box shows imported, skipped, and failed source counts. The article list refreshes automatically.

## 6. Generate Today's Digest

Click `生成今日晚报`.

Expected result: the digest panel shows a Markdown report grouped by importance.

## 7. Re-Summarize One Article

Click `重新总结` on any article.

Expected result: the article summary and importance score are refreshed, then today's digest is regenerated.

## 8. Push Today's Digest In Console Mode

Keep default configuration:

```env
PUSH_PROVIDER=console
```

Click `推送今日晚报`.

Expected result: the browser shows a successful push message, and the server console prints the Markdown digest.
