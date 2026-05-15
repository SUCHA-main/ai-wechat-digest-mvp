const digestEl = document.querySelector('#digest');
const articlesEl = document.querySelector('#articles');
const sourcesEl = document.querySelector('#sources');
const fetchResultEl = document.querySelector('#fetchResult');
const aiModeEl = document.querySelector('#aiMode');
const sourceForm = document.querySelector('#sourceForm');
const fetchBtn = document.querySelector('#fetchBtn');
const digestBtn = document.querySelector('#digestBtn');
const importSampleBtn = document.querySelector('#importSampleBtn');
const refreshBtn = document.querySelector('#refreshBtn');

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '请求失败');
  }

  return data;
}

async function loadDigest() {
  const result = await requestJson('/api/digest/today');
  digestEl.textContent = result.data ? result.data.markdown : '今日晚报尚未生成。';
}

async function loadArticles() {
  const result = await requestJson('/api/articles');
  const articles = result.data || [];

  if (!articles.length) {
    articlesEl.innerHTML = '<p class="muted">暂无文章。可以先导入测试文章或抓取全部 RSS。</p>';
    return;
  }

  articlesEl.innerHTML = articles.map((article) => `
    <section class="article">
      <div class="article-title">
        <a href="${escapeHtml(article.url)}" target="_blank" rel="noreferrer">${escapeHtml(article.title)}</a>
        <span>${article.importance_score}/5</span>
      </div>
      <p>${escapeHtml(article.source_name)} · ${escapeHtml(article.published_at || article.created_at || '')}</p>
      ${renderSummary(article.summary)}
      <button class="small" type="button" data-resummarize="${article.id}">重新总结</button>
    </section>
  `).join('');
}

async function loadAiConfig() {
  const result = await requestJson('/api/config/ai');
  const config = result.data || {};
  aiModeEl.textContent = `AI 模式：${config.provider || 'mock'}${config.model ? ` · ${config.model}` : ''}`;
}

async function loadSources() {
  const result = await requestJson('/api/sources');
  const sources = result.data || [];

  if (!sources.length) {
    sourcesEl.innerHTML = '<p class="muted">暂无数据源。</p>';
    return;
  }

  sourcesEl.innerHTML = sources.map((source) => `
    <section class="source-item">
      <div>
        <strong>${escapeHtml(source.name)}</strong>
        <p>${escapeHtml(source.type.toUpperCase())} · ${escapeHtml(source.url)}</p>
      </div>
      <div class="source-actions">
        <button class="small" type="button" data-source-test="${source.id}">测试抓取</button>
        <label class="check">
          <input type="checkbox" data-source-toggle="${source.id}" ${source.enabled ? 'checked' : ''} /> 启用
        </label>
        <button class="danger" type="button" data-source-delete="${source.id}">删除</button>
      </div>
    </section>
  `).join('');
}

async function refreshAll() {
  try {
    await Promise.all([loadDigest(), loadArticles(), loadSources(), loadAiConfig()]);
  } catch (error) {
    digestEl.textContent = error.message;
  }
}

sourceForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(sourceForm);

  try {
    await requestJson('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.get('name'),
        type: formData.get('type'),
        url: formData.get('url'),
        enabled: formData.get('enabled') === 'on'
      })
    });
    sourceForm.reset();
    document.querySelector('#sourceEnabled').checked = true;
    await loadSources();
  } catch (error) {
    alert(error.message);
  }
});

sourcesEl.addEventListener('change', async (event) => {
  const id = event.target.dataset.sourceToggle;
  if (!id) {
    return;
  }

  try {
    await requestJson(`/api/sources/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: event.target.checked })
    });
    await loadSources();
  } catch (error) {
    alert(error.message);
    await loadSources();
  }
});

sourcesEl.addEventListener('click', async (event) => {
  const testId = event.target.dataset.sourceTest;
  const deleteId = event.target.dataset.sourceDelete;

  if (testId) {
    event.target.disabled = true;
    event.target.textContent = '测试中...';

    try {
      const result = await requestJson(`/api/sources/${testId}/test-fetch`, { method: 'POST' });
      fetchResultEl.textContent = renderTestFetchResult(result.data);
    } catch (error) {
      fetchResultEl.textContent = error.message;
    } finally {
      event.target.disabled = false;
      event.target.textContent = '测试抓取';
    }

    return;
  }

  if (!deleteId) {
    return;
  }

  try {
    await requestJson(`/api/sources/${deleteId}`, { method: 'DELETE' });
    await loadSources();
  } catch (error) {
    alert(error.message);
  }
});

articlesEl.addEventListener('click', async (event) => {
  const id = event.target.dataset.resummarize;
  if (!id) {
    return;
  }

  event.target.disabled = true;
  event.target.textContent = '总结中...';

  try {
    await requestJson(`/api/articles/${id}/resummarize`, { method: 'POST' });
    await requestJson('/api/digest/generate', { method: 'POST' });
    await refreshAll();
  } catch (error) {
    alert(error.message);
    event.target.disabled = false;
    event.target.textContent = '重新总结';
  }
});

importSampleBtn.addEventListener('click', async () => {
  importSampleBtn.disabled = true;
  importSampleBtn.textContent = '导入中...';

  try {
    await requestJson('/api/articles/import-sample', { method: 'POST' });
    await refreshAll();
  } catch (error) {
    alert(error.message);
  } finally {
    importSampleBtn.disabled = false;
    importSampleBtn.textContent = '导入测试文章';
  }
});

fetchBtn.addEventListener('click', async () => {
  fetchBtn.disabled = true;
  fetchBtn.textContent = '抓取中...';

  try {
    const result = await requestJson('/api/fetch', { method: 'POST' });
    fetchResultEl.textContent = renderFetchAllResult(result.data);
    await refreshAll();
  } catch (error) {
    alert(error.message);
  } finally {
    fetchBtn.disabled = false;
    fetchBtn.textContent = '抓取全部 RSS';
  }
});

digestBtn.addEventListener('click', async () => {
  digestBtn.disabled = true;
  digestBtn.textContent = '生成中...';

  try {
    await requestJson('/api/digest/generate', { method: 'POST' });
    await refreshAll();
  } catch (error) {
    alert(error.message);
  } finally {
    digestBtn.disabled = false;
    digestBtn.textContent = '生成今日晚报';
  }
});

refreshBtn.addEventListener('click', refreshAll);

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSummary(value) {
  const summary = parseSummary(value);

  if (!summary) {
    return '<pre>暂无摘要</pre>';
  }

  if (typeof summary === 'string') {
    return `<pre>${escapeHtml(summary)}</pre>`;
  }

  return `
    <div class="summary-box">
      <p><strong>一句话：</strong>${escapeHtml(summary.summary)}</p>
      <ul>
        ${(summary.points || []).map((point) => `<li>${escapeHtml(point)}</li>`).join('')}
      </ul>
      <p><strong>推荐理由：</strong>${escapeHtml(summary.reason)}</p>
    </div>
  `;
}

function parseSummary(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
}

function renderTestFetchResult(result) {
  if (!result) {
    return '测试抓取无返回结果。';
  }

  const lines = [
    `测试源：${result.source?.name || '未知'}`,
    `是否成功：${result.accessible ? '是' : '否'}`,
    `解析文章数：${result.articleCount || 0}`
  ];

  if (result.error) {
    lines.push(`错误：${result.error}`);
  }

  if (result.preview?.length) {
    lines.push('', '前 5 篇：');
    result.preview.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.title || '未命名文章'}`);
      lines.push(`   ${item.url || '无链接'}`);
    });
  }

  return lines.join('\n');
}

function renderFetchAllResult(result) {
  if (!result) {
    return 'RSS 抓取无返回结果。';
  }

  const lines = [
    `成功抓取源数：${result.fetchedSources}`,
    `新增文章：${result.imported}`,
    `跳过文章：${result.skipped}`,
    `失败源数：${result.failedSources?.length || 0}`
  ];

  if (result.failedSources?.length) {
    lines.push('', '失败源：');
    result.failedSources.forEach((source) => {
      lines.push(`- ${source.name}: ${source.error}`);
    });
  }

  return lines.join('\n');
}

refreshAll();
