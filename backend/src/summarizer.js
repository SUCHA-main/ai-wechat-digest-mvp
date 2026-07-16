const fs = require('fs');
const path = require('path');
const { getAIConfig, runAI } = require('./aiProvider');

const hotKeywords = ['AI', 'ai', '人工智能', '编程', '开源', '物联网', '机器人', '学习'];
const profilePath = path.join(__dirname, '..', 'data', 'profile.json');
const profileExamplePath = path.join(__dirname, '..', 'data', 'profile.example.json');

function summarizeWithMock({ title = '', content = '' }, profile = loadProfile()) {
  const text = `${title}\n${content}`;
  const interests = Array.isArray(profile.interests) ? profile.interests : [];
  const interestKeywords = interests.flatMap((item) => String(item).split(/[\s/、，,]+/).filter(Boolean));
  const keywords = [...new Set([...hotKeywords, ...interestKeywords])];
  const matchedKeywords = keywords.filter((keyword) => text.includes(keyword));
  const importanceScore = matchedKeywords.length ? Math.min(5, 2 + matchedKeywords.length) : 1;
  const cleanContent = stripHtml(content).replace(/\s+/g, ' ').trim();
  const excerpt = cleanContent.slice(0, 80) || '原文内容较少，建议结合标题和链接阅读全文。';

  return normalizeSummary({
    summary: `《${title || '未命名文章'}》主要关注${matchedKeywords[0] || '一般资讯'}，可按当前偏好判断是否继续阅读。`,
    points: [
      `主题关键词：${matchedKeywords.length ? matchedKeywords.slice(0, 5).join('、') : '暂未命中重点关键词'}`,
      `内容摘录：${excerpt}`,
      '建议结合原文链接快速确认是否有实操价值。'
    ],
    importance_score: importanceScore,
    reason: importanceScore >= 4 ? '命中个人关注方向，可能对学习、项目实践或工具选择有参考价值。' : '与当前重点偏好关联较弱，可作为补充信息或快速浏览。'
  });
}

async function summarizeWithAI(article, profile = loadProfile()) {
  const prompt = buildPrompt(article, profile);
  const raw = await runAI(prompt);
  return normalizeSummary(parseAIResponse(raw));
}

async function summarizeArticle(article, profile = loadProfile()) {
  const provider = getAIConfig().provider;

  if (provider === 'mock') {
    return summarizeWithMock(article, profile);
  }

  try {
    return await summarizeWithAI(article, profile);
  } catch (error) {
    console.warn(`AI summarize failed, fallback to mock: ${error.message}`);
    return summarizeWithMock(article, profile);
  }
}

function buildPrompt(article, profile) {
  const title = article.title || '未命名文章';
  const source = article.source_name || article.source || '未知来源';
  const content = stripHtml(article.content || '').slice(0, 6000);

  return `请根据用户个人偏好，判断这篇文章是否值得阅读，并输出严格 JSON。

用户个人偏好：
${JSON.stringify(profile, null, 2)}

文章信息：
标题：${title}
来源：${source}
正文：${content || '无正文，仅有标题和链接'}

要求：
1. 判断文章对用户是否重要，不要只复述标题。
2. 不要夸大文章价值，不确定时给中低分。
3. 对普通生活资讯、纯营销、重复资讯、无实操价值内容可以给低分。
4. importance_score 只能是 1-5 的整数。
5. points 必须刚好 3 条，每条用简短中文说明。
6. summary 必须是一句话总结。
7. reason 必须说明推荐或不推荐阅读的理由。
8. 只输出 JSON，不要输出 Markdown、代码块或额外解释。

JSON 格式必须完全符合：
{
  "summary": "一句话总结",
  "points": ["要点1", "要点2", "要点3"],
  "importance_score": 1,
  "reason": "推荐阅读理由"
}`;
}

function parseAIResponse(raw) {
  const text = String(raw || '').trim();

  if (!text) {
    throw new Error('AI returned empty content');
  }

  const withoutFence = text
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch (error) {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');

    if (start >= 0 && end > start) {
      return JSON.parse(withoutFence.slice(start, end + 1));
    }

    throw error;
  }
}

function normalizeSummary(value) {
  const summary = String(value.summary || value.one_sentence || '').trim() || '暂无一句话总结。';
  const points = Array.isArray(value.points) ? value.points : value.key_points;
  const normalizedPoints = Array.isArray(points) ? points.map((point) => String(point).trim()).filter(Boolean) : [];

  while (normalizedPoints.length < 3) {
    normalizedPoints.push('原文信息不足，建议打开链接进一步确认。');
  }

  return {
    summary,
    points: normalizedPoints.slice(0, 3),
    importance_score: clampScore(value.importance_score),
    reason: String(value.reason || value.recommendation || '').trim() || '按当前偏好暂未发现明确推荐理由。'
  };
}

function formatSummary(summary) {
  return JSON.stringify(normalizeSummary(summary));
}

function parseStoredSummary(article) {
  try {
    return normalizeSummary(JSON.parse(article.summary));
  } catch (error) {
    return summarizeWithMock(article);
  }
}

function loadProfile() {
  for (const candidate of [profilePath, profileExamplePath]) {
    try {
      return JSON.parse(fs.readFileSync(candidate, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`Failed to load profile from ${path.basename(candidate)}: ${error.message}`);
      }
    }
  }

  return {
    interests: [],
    avoid: [],
    scoring_rule: ''
  };
}

function clampScore(value) {
  const score = Number.parseInt(value, 10);

  if (Number.isNaN(score)) {
    return 1;
  }

  return Math.min(5, Math.max(1, score));
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ');
}

module.exports = {
  summarizeWithMock,
  summarizeWithAI,
  summarizeArticle,
  formatSummary,
  parseStoredSummary,
  loadProfile
};
