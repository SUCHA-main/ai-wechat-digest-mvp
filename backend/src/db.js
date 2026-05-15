const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'app.db');
const sourcesPath = path.join(dataDir, 'sources.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_name TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      author TEXT,
      published_at TEXT,
      content TEXT,
      summary TEXT,
      importance_score INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS digests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      digest_date TEXT NOT NULL UNIQUE,
      markdown TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  seedSourcesFromJsonIfEmpty();
}

function seedSourcesFromJsonIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM sources').get().count;
  if (count > 0) {
    return;
  }

  if (!fs.existsSync(sourcesPath)) {
    return;
  }

  const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
  const upsert = db.prepare(`
    INSERT INTO sources (name, type, url, enabled)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      type = excluded.type,
      url = excluded.url,
      enabled = excluded.enabled
  `);

  db.exec('BEGIN');
  try {
    for (const source of sources) {
      upsert.run(source.name, source.type, source.url, source.enabled ? 1 : 0);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function getSources() {
  return db.prepare('SELECT * FROM sources ORDER BY id ASC').all();
}

function getEnabledSources() {
  return db.prepare('SELECT * FROM sources WHERE enabled = 1 ORDER BY id ASC').all();
}

function createSource(source) {
  const result = db.prepare(`
    INSERT INTO sources (name, type, url, enabled)
    VALUES (?, ?, ?, ?)
  `).run(source.name, source.type, source.url, source.enabled ? 1 : 0);

  return getSourceById(result.lastInsertRowid);
}

function updateSource(id, updates) {
  const current = getSourceById(id);
  if (!current) {
    return null;
  }

  const next = {
    name: updates.name !== undefined ? updates.name : current.name,
    type: updates.type !== undefined ? updates.type : current.type,
    url: updates.url !== undefined ? updates.url : current.url,
    enabled: updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : current.enabled
  };

  db.prepare(`
    UPDATE sources
    SET name = ?, type = ?, url = ?, enabled = ?
    WHERE id = ?
  `).run(next.name, next.type, next.url, next.enabled, id);

  return getSourceById(id);
}

function deleteSource(id) {
  return db.prepare('DELETE FROM sources WHERE id = ?').run(id);
}

function getSourceById(id) {
  return db.prepare('SELECT * FROM sources WHERE id = ?').get(id);
}

function insertArticle(article) {
  const stmt = db.prepare(`
    INSERT INTO articles (
      source_name, title, url, author, published_at, content, summary, importance_score
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(url) DO UPDATE SET
      source_name = excluded.source_name,
      title = excluded.title,
      author = excluded.author,
      published_at = excluded.published_at,
      content = excluded.content,
      summary = excluded.summary,
      importance_score = excluded.importance_score
  `);

  return stmt.run(
    article.source_name,
    article.title,
    article.url,
    article.author,
    article.published_at,
    article.content,
    article.summary,
    article.importance_score
  );
}

function insertArticleIfNew(article) {
  const stmt = db.prepare(`
    INSERT INTO articles (
      source_name, title, url, author, published_at, content, summary, importance_score
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(url) DO NOTHING
  `);

  return stmt.run(
    article.source_name,
    article.title,
    article.url,
    article.author,
    article.published_at,
    article.content,
    article.summary,
    article.importance_score
  );
}

function getArticleById(id) {
  return db.prepare('SELECT * FROM articles WHERE id = ?').get(id);
}

function updateArticleSummary(id, summary, importanceScore) {
  db.prepare(`
    UPDATE articles
    SET summary = ?, importance_score = ?
    WHERE id = ?
  `).run(summary, importanceScore, id);

  return getArticleById(id);
}

function getArticles(limit = 100) {
  return db.prepare(`
    SELECT * FROM articles
    ORDER BY importance_score DESC, COALESCE(published_at, created_at) DESC, id DESC
    LIMIT ?
  `).all(limit);
}

function getDigestCandidateArticles() {
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  return db.prepare(`
    SELECT * FROM articles
    WHERE date(created_at) = date(?)
       OR datetime(created_at) >= datetime(?)
       OR (published_at IS NOT NULL AND date(published_at) = date(?))
       OR (published_at IS NOT NULL AND datetime(published_at) >= datetime(?))
    ORDER BY importance_score DESC, COALESCE(published_at, created_at) DESC
  `).all(today, since, today, since);
}

function upsertDigest(digestDate, markdown) {
  return db.prepare(`
    INSERT INTO digests (digest_date, markdown)
    VALUES (?, ?)
    ON CONFLICT(digest_date) DO UPDATE SET
      markdown = excluded.markdown,
      created_at = CURRENT_TIMESTAMP
  `).run(digestDate, markdown);
}

function getDigestByDate(digestDate) {
  return db.prepare('SELECT * FROM digests WHERE digest_date = ?').get(digestDate);
}

module.exports = {
  db,
  initDb,
  getSources,
  getEnabledSources,
  createSource,
  updateSource,
  deleteSource,
  insertArticle,
  insertArticleIfNew,
  getArticleById,
  updateArticleSummary,
  getArticles,
  getDigestCandidateArticles,
  upsertDigest,
  getDigestByDate
};
