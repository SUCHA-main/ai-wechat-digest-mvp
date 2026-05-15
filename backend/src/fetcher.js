const Parser = require('rss-parser');
const { getEnabledSources, getArticleByUrl, insertArticleIfNew } = require('./db');
const { summarizeArticle, formatSummary } = require('./summarizer');

const parser = new Parser();

async function fetchAllSources() {
  const sources = getEnabledSources().filter((source) => source.type === 'rss');
  const summary = {
    fetchedSources: 0,
    imported: 0,
    skipped: 0,
    failedSources: [],
    sources: []
  };

  for (const source of sources) {
    try {
      const result = await fetchRssSource(source);
      summary.fetchedSources += 1;
      summary.imported += result.imported;
      summary.skipped += result.skipped;
      summary.sources.push(result);
    } catch (error) {
      const failed = {
        id: source.id,
        name: source.name,
        url: source.url,
        error: error.message
      };

      summary.failedSources.push(failed);
      summary.sources.push({
        source: formatSource(source),
        ok: false,
        fetched: 0,
        imported: 0,
        skipped: 0,
        error: error.message
      });
    }
  }

  return summary;
}

async function fetchRssSource(source) {
  const feed = await parser.parseURL(source.url);
  const items = feed.items || [];
  let imported = 0;
  let skipped = 0;

  for (const item of items) {
    const article = parseFeedItem(item, feed, source);

    if (!article.url) {
      skipped += 1;
      continue;
    }

    if (getArticleByUrl(article.url)) {
      skipped += 1;
      continue;
    }

    const summary = await summarizeArticle(article);
    const result = insertArticleIfNew({
      ...article,
      summary: formatSummary(summary),
      importance_score: summary.importance_score
    });

    if (result.changes > 0) {
      imported += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    source: formatSource(source),
    ok: true,
    fetched: items.length,
    imported,
    skipped
  };
}

async function testFetchSource(source) {
  try {
    if (!source || source.type !== 'rss') {
      return {
        source: source ? formatSource(source) : null,
        accessible: false,
        articleCount: 0,
        preview: [],
        error: '只支持测试 RSS 数据源'
      };
    }

    const feed = await parser.parseURL(source.url);
    const items = feed.items || [];

    return {
      source: formatSource(source),
      accessible: true,
      articleCount: items.length,
      preview: items.slice(0, 5).map((item) => {
        const article = parseFeedItem(item, feed, source);

        return {
          title: article.title,
          url: article.url,
          published_at: article.published_at
        };
      })
    };
  } catch (error) {
    return {
      source: formatSource(source),
      accessible: false,
      articleCount: 0,
      preview: [],
      error: error.message
    };
  }
}

function parseFeedItem(item, feed, source) {
  const title = item.title || '未命名文章';
  const url = item.link || item.url || item.guid || '';
  const content = item.content || item['content:encoded'] || item.contentSnippet || item.summary || '';

  return {
    source_name: source.name,
    title,
    url,
    author: item.creator || item.author || feed.title || '',
    published_at: normalizeDate(item.isoDate || item.pubDate),
    content
  };
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatSource(source) {
  return {
    id: source.id,
    name: source.name,
    type: source.type,
    url: source.url,
    enabled: Boolean(source.enabled)
  };
}

module.exports = {
  fetchAllSources,
  fetchRssSource,
  testFetchSource
};
