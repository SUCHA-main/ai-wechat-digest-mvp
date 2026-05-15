require('dotenv').config();

const path = require('path');
const express = require('express');
const {
  initDb,
  getArticles,
  getArticleById,
  getSourceById,
  updateArticleSummary,
  getSources,
  createSource,
  updateSource,
  deleteSource
} = require('./db');
const { fetchAllSources, testFetchSource } = require('./fetcher');
const { generateTodayDigest, getTodayDigest } = require('./digest');
const { importSampleArticles } = require('./sampleImporter');
const { summarizeArticle, formatSummary, loadProfile } = require('./summarizer');
const { getPublicAIConfig } = require('./aiProvider');
const { startScheduler } = require('./scheduler');

const app = express();
const port = Number(process.env.PORT || 3090);
const frontendDir = path.join(__dirname, '..', '..', 'frontend');

initDb();

app.use(express.json());
app.use(express.static(frontendDir));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/articles', (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 500);
  res.json({ data: getArticles(limit) });
});

app.post('/api/articles/import-sample', async (req, res) => {
  try {
    const result = await importSampleArticles();
    res.json({ ok: true, data: result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/articles/:id/resummarize', async (req, res) => {
  try {
    const article = getArticleById(Number(req.params.id));

    if (!article) {
      res.status(404).json({ ok: false, error: '文章不存在' });
      return;
    }

    const summary = await summarizeArticle(article, loadProfile());
    const updated = updateArticleSummary(article.id, formatSummary(summary), summary.importance_score);

    res.json({
      ok: true,
      data: {
        article: updated,
        summary
      }
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/config/ai', (req, res) => {
  res.json({ data: getPublicAIConfig() });
});

app.get('/api/sources', (req, res) => {
  res.json({ data: getSources().map(formatSource) });
});

app.post('/api/sources', (req, res) => {
  try {
    const payload = normalizeSourcePayload(req.body, true);
    const source = createSource(payload);
    res.status(201).json({ ok: true, data: formatSource(source) });
  } catch (error) {
    sendSourceError(res, error);
  }
});

app.post('/api/sources/:id/test-fetch', async (req, res) => {
  const source = getSourceById(Number(req.params.id));

  if (!source) {
    res.status(404).json({ ok: false, error: '数据源不存在' });
    return;
  }

  const result = await testFetchSource(source);
  res.json({ ok: true, data: result });
});

app.patch('/api/sources/:id', (req, res) => {
  try {
    const payload = normalizeSourcePayload(req.body, false);
    const source = updateSource(Number(req.params.id), payload);

    if (!source) {
      res.status(404).json({ ok: false, error: '数据源不存在' });
      return;
    }

    res.json({ ok: true, data: formatSource(source) });
  } catch (error) {
    sendSourceError(res, error);
  }
});

app.delete('/api/sources/:id', (req, res) => {
  const result = deleteSource(Number(req.params.id));

  if (result.changes === 0) {
    res.status(404).json({ ok: false, error: '数据源不存在' });
    return;
  }

  res.json({ ok: true });
});

app.get('/api/digest/today', (req, res) => {
  const digest = getTodayDigest();
  res.json({ data: digest || null });
});

app.post('/api/fetch', async (req, res) => {
  try {
    const result = await fetchAllSources();
    res.json({ ok: true, data: result, results: result.sources });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/digest/generate', (req, res) => {
  try {
    const digest = generateTodayDigest();
    res.json({ ok: true, data: digest });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`AI WeChat digest MVP running at http://localhost:${port}`);
  startScheduler();
});

function normalizeSourcePayload(body, requireAll) {
  const payload = {};
  const name = typeof body.name === 'string' ? body.name.trim() : undefined;
  const type = typeof body.type === 'string' ? body.type.trim() : undefined;
  const url = typeof body.url === 'string' ? body.url.trim() : undefined;

  if (name !== undefined && !name) {
    throw new Error('数据源名称不能为空');
  }

  if (type !== undefined && !['rss', 'json'].includes(type)) {
    throw new Error('数据源类型只支持 rss 或 json');
  }

  if (url !== undefined && !url) {
    throw new Error('数据源 URL 不能为空');
  }

  if (requireAll && (!name || !type || !url)) {
    throw new Error('name、type、url 为必填字段');
  }

  if (name !== undefined) payload.name = name;
  if (type !== undefined) payload.type = type;
  if (url !== undefined) payload.url = url;
  if (body.enabled !== undefined) payload.enabled = parseEnabled(body.enabled);
  if (requireAll && body.enabled === undefined) payload.enabled = true;

  return payload;
}

function formatSource(source) {
  return {
    ...source,
    enabled: Boolean(source.enabled)
  };
}

function parseEnabled(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    return !['false', '0', 'off', ''].includes(value.trim().toLowerCase());
  }

  return Boolean(value);
}

function sendSourceError(res, error) {
  if (error.message.includes('UNIQUE')) {
    res.status(409).json({ ok: false, error: '数据源名称已存在' });
    return;
  }

  res.status(400).json({ ok: false, error: error.message });
}
