const fs = require('fs');
const path = require('path');
const { insertArticleIfNew, refreshSampleArticleDate } = require('./db');
const { summarizeArticle, formatSummary } = require('./summarizer');

const samplePath = path.join(__dirname, '..', 'data', 'sample-articles.json');

async function importSampleArticles() {
  const samples = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
  let imported = 0;
  let skipped = 0;
  let refreshed = 0;

  for (const sample of samples) {
    const summary = await summarizeArticle({
      source_name: sample.source_name,
      title: sample.title,
      content: sample.content
    });

    const result = insertArticleIfNew({
      source_name: sample.source_name,
      title: sample.title,
      url: sample.url,
      author: sample.author || '',
      published_at: sample.published_at || null,
      content: sample.content || '',
      summary: formatSummary(summary),
      importance_score: summary.importance_score
    });

    if (result.changes > 0) {
      imported += 1;
    } else {
      const refreshResult = refreshSampleArticleDate(sample.url);
      if (refreshResult.changes > 0) {
        refreshed += 1;
      } else {
        skipped += 1;
      }
    }
  }

  return {
    total: samples.length,
    imported,
    skipped,
    refreshed
  };
}

module.exports = {
  importSampleArticles
};
