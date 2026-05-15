const Parser = require('rss-parser');
const { getEnabledSources, insertArticle } = require('./db');
const { summarizeArticle, formatSummary } = require('./summarizer');

const parser = new Parser();

async function fetchAllSources() {
  const sources = getEnabledSources().filter((source) => source.type === 'rss');
  const results = [];

  for (const source of sources) {
    try {
      const result = await fetchRssSource(source);
      results.push(result);
    } catch (error) {
      results.push({
        source: source.name,
        fetched: 0,
        inserted_or_updated: 0,
        error: error.message
      });
    }
  }

  return results;
}

async function fetchRssSource(source) {
  const feed = await parser.parseURL(source.url);
  const items = feed.items || [];
  let changed = 0;

  for (const item of items) {
    const title = item.title || '未命名文章';
    const url = item.link || item.guid;

    if (!url) {
      continue;
    }

    const content = item.contentSnippet || item.content || item.summary || '';
    const summary = await summarizeArticle({ title, content, source_name: source.name });
    const info = insertArticle({
      source_name: source.name,
      title,
      url,
      author: item.creator || item.author || feed.title || '',
      published_at: normalizeDate(item.isoDate || item.pubDate),
      content,
      summary: formatSummary(summary),
      importance_score: summary.importance_score
    });

    changed += info.changes;
  }

  return {
    source: source.name,
    fetched: items.length,
    inserted_or_updated: changed
  };
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

module.exports = {
  fetchAllSources
};
