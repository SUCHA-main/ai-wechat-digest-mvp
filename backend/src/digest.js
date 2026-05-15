const { getDigestCandidateArticles, upsertDigest, getDigestByDate } = require('./db');
const { parseStoredSummary } = require('./summarizer');

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function generateTodayDigest() {
  const digestDate = todayString();
  const articles = getDigestCandidateArticles();
  const markdown = buildDigestMarkdown(digestDate, articles);

  upsertDigest(digestDate, markdown);

  return {
    digest_date: digestDate,
    markdown,
    article_count: articles.length
  };
}

function getTodayDigest() {
  return getDigestByDate(todayString());
}

function buildDigestMarkdown(digestDate, articles) {
  if (!articles.length) {
    return `# AI 微信公众号晚报 ${digestDate}\n\n今天或最近 24 小时内还没有新增文章。可以先导入测试文章，或配置 RSS/JSON 数据源后调用 /api/fetch。`;
  }

  const lines = [`# AI 微信公众号晚报 ${digestDate}`, ''];
  appendGroup(lines, '今日最值得看', articles.filter((article) => article.importance_score >= 4));
  appendGroup(lines, '可以快速扫一眼', articles.filter((article) => article.importance_score >= 2 && article.importance_score <= 3));
  appendGroup(lines, '可以跳过', articles.filter((article) => article.importance_score === 1));

  return lines.join('\n');
}

function appendGroup(lines, title, articles) {
  lines.push(`## ${title}`);
  lines.push('');

  if (!articles.length) {
    lines.push('暂无。');
    lines.push('');
    return;
  }

  for (const article of articles) {
    const summary = parseStoredSummary(article);

    lines.push(`### ${article.title}`);
    lines.push(`- 来源：${article.source_name}`);
    lines.push(`- 重要性：${article.importance_score}/5`);
    lines.push(`- 一句话总结：${summary.summary}`);
    lines.push('- 3 个要点：');
    for (const point of summary.points) {
      lines.push(`  - ${point}`);
    }
    lines.push(`- 推荐阅读理由：${summary.reason}`);
    lines.push(`- 原文链接：${article.url}`);
    lines.push('');
  }
}

module.exports = {
  generateTodayDigest,
  getTodayDigest
};
