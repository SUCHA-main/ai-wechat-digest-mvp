const digestEl = document.querySelector('#digest');
const articlesEl = document.querySelector('#articles');
const sourcesEl = document.querySelector('#sources');
const fetchResultEl = document.querySelector('#fetchResult');
const aiModeEl = document.querySelector('#aiMode');
const pushModeEl = document.querySelector('#pushMode');
const pushResultEl = document.querySelector('#pushResult');
const sourceForm = document.querySelector('#sourceForm');
const fetchBtn = document.querySelector('#fetchBtn');
const digestBtn = document.querySelector('#digestBtn');
const pushBtn = document.querySelector('#pushBtn');
const importSampleBtn = document.querySelector('#importSampleBtn');
const refreshBtn = document.querySelector('#refreshBtn');

let noticeContainer = null;

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '请求失败');
  }

  return data;
}

function ensureNoticeContainer() {
  if (noticeContainer) {
    return noticeContainer;
  }

  noticeContainer = document.createElement('div');
  noticeContainer.id = 'noticeContainer';
  noticeContainer.className = 'notice-container';
  document.body.appendChild(noticeContainer);
  return noticeContainer;
}

function showNotice(message, type = 'info') {
  const container = ensureNoticeContainer();
  const notice = document.createElement('div');
  notice.className = `notice notice-${type}`;
  notice.textContent = message;
  notice.style.cursor = 'pointer';
  notice.title = '点击关闭';

  const dismiss = () => {
    if (notice.parentNode) {
      notice.classList.add('notice-fade-out');
      setTimeout(() => {
        if (notice.parentNode) {
          notice.parentNode.removeChild(notice);
        }
      }, 300);
    }
  };

  notice.addEventListener('click', dismiss);
  container.appendChild(notice);

  const duration = type === 'error' ? 6000 : type === 'info' ? 4000 : 3000;
  setTimeout(dismiss, duration);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
  const trimmed = String(url || '').trim().toLowerCase();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('mailto:')) {
    return url;
  }
  return '#';
}

function renderMarkdown(text) {
  if (!text) {
    return '<p class="muted">暂无内容</p>';
  }

  let html = escapeHtml(text);

  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, (match, text, url) => {
    const safeUrl = sanitizeUrl(url);
    return `<a href="${safeUrl}" target="_blank" rel="noreferrer">${text}</a>`;
  });

  html = html.replace(/(?:^|\n)((?:\d+\. .+\n?)+)/g, (match, listContent) => {
    const items = listContent.trim().split('\n').map(item => {
      return `<li>${item.replace(/^\d+\. /, '')}</li>`;
    }).join('\n');
    return `\n<ol>${items}</ol>\n`;
  });

  html = html.replace(/(?:^|\n)((?:[-*] .+\n?)+)/g, (match, listContent) => {
    const items = listContent.trim().split('\n').map(item => {
      return `<li>${item.replace(/^[-*] /, '')}</li>`;
    }).join('\n');
    return `\n<ul>${items}</ul>\n`;
  });

  html = html.replace(/^(?!<[hulo]|<li)(.*\S.*)$/gm, '<p>$1</p>');

  html = html.replace(/<\/(h[1-3]|p|li)>\s*<(h[1-3]|p|li)/g, '</$1>\n<$2');
  html = html.replace(/<\/(ul|ol)>\s*<(ul|ol)/g, '</$1>\n<$2');

  return html;
}

async function loadDigest() {
  try {
    const result = await requestJson('/api/digest/today');
    if (result.data && result.data.markdown) {
      const markdown = result.data.markdown;
      if (markdown.includes('今天或最近 24 小时内还没有新增文章') || markdown.includes('今日晚报尚未生成')) {
        digestEl.innerHTML = `
          <div class="empty-state">
            <p>今天还没有可生成晚报的文章。</p>
            <p>你可以先<strong>导入测试文章</strong>，或<strong>抓取 RSS 数据源</strong>后再生成晚报。</p>
            <p class="muted">如果你已经导入过测试文章，可能是测试数据日期较旧，重新导入或刷新测试数据后再试。</p>
          </div>
        `;
      } else {
        digestEl.innerHTML = `<div class="digest-content">${renderMarkdown(markdown)}</div>`;
      }
    } else {
      digestEl.innerHTML = `
        <div class="empty-state">
          <p>今日晚报尚未生成。</p>
          <p>点击上方<strong>生成今日晚报</strong>按钮开始。</p>
        </div>
      `;
    }
  } catch (error) {
    digestEl.innerHTML = `
      <div class="empty-state">
        <p>加载晚报失败：${escapeHtml(error.message)}</p>
      </div>
    `;
  }
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

async function loadPushConfig() {
  const result = await requestJson('/api/config/push');
  const config = result.data || {};
  const configured = config.provider === 'pushplus'
    ? config.pushplus_configured
    : config.provider === 'email'
      ? config.email_configured
      : true;

  pushModeEl.textContent = `推送模式：${config.provider || 'console'}${configured ? '' : ' · 未完整配置'}`;
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
    await Promise.all([loadDigest(), loadArticles(), loadSources(), loadAiConfig(), loadPushConfig()]);
  } catch (error) {
    showNotice(`刷新失败：${error.message}`, 'error');
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
    showNotice('数据源添加成功', 'success');
  } catch (error) {
    showNotice(error.message, 'error');
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
    showNotice('数据源状态已更新', 'success');
  } catch (error) {
    showNotice(error.message, 'error');
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
      showNotice('测试抓取完成', 'success');
    } catch (error) {
      fetchResultEl.textContent = error.message;
      showNotice(error.message, 'error');
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
    showNotice('数据源已删除', 'success');
  } catch (error) {
    showNotice(error.message, 'error');
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
    showNotice('文章重新总结完成', 'success');
  } catch (error) {
    showNotice(error.message, 'error');
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
    showNotice('测试文章导入成功', 'success');
  } catch (error) {
    showNotice(error.message, 'error');
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
    showNotice('RSS 抓取完成', 'success');
  } catch (error) {
    showNotice(error.message, 'error');
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
    showNotice('今日晚报已生成', 'success');
  } catch (error) {
    showNotice(error.message, 'error');
  } finally {
    digestBtn.disabled = false;
    digestBtn.textContent = '生成今日晚报';
  }
});

pushBtn.addEventListener('click', async () => {
  pushBtn.disabled = true;
  pushBtn.textContent = '推送中...';

  try {
    const result = await requestJson('/api/push/today', { method: 'POST' });
    pushResultEl.textContent = renderPushResult(result.data);
    await loadPushConfig();
    showNotice('晚报推送完成', 'success');
  } catch (error) {
    pushResultEl.textContent = error.message;
    showNotice(error.message, 'error');
  } finally {
    pushBtn.disabled = false;
    pushBtn.textContent = '推送今日晚报';
  }
});

refreshBtn.addEventListener('click', refreshAll);

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

function renderPushResult(result) {
  if (!result) {
    return '推送无返回结果。';
  }

  return [
    `推送方式：${result.provider}`,
    `是否成功：${result.ok ? '是' : '否'}`,
    `结果：${result.message || result.error || '无详细信息'}`
  ].join('\n');
}

refreshAll();