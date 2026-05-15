function getAIConfig() {
  const provider = String(process.env.AI_PROVIDER || 'mock').toLowerCase();
  const normalizedProvider = ['mock', 'deepseek', 'ollama'].includes(provider) ? provider : 'mock';

  return {
    provider: normalizedProvider,
    api_base_url: process.env.AI_API_BASE_URL || '',
    api_key: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || '',
    ollama_url: process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
    ollama_model: process.env.OLLAMA_MODEL || 'qwen2.5:3b'
  };
}

function getPublicAIConfig() {
  const config = getAIConfig();

  return {
    provider: config.provider,
    model: config.provider === 'ollama' ? config.ollama_model : config.model,
    ollama_model: config.ollama_model,
    api_base_url_configured: Boolean(config.api_base_url),
    api_key_configured: Boolean(config.api_key)
  };
}

async function runAI(prompt) {
  const config = getAIConfig();

  if (config.provider === 'deepseek') {
    return callOpenAICompatible(config, prompt);
  }

  if (config.provider === 'ollama') {
    return callOllama(config, prompt);
  }

  throw new Error('AI provider is mock');
}

async function callOpenAICompatible(config, prompt) {
  if (!config.api_base_url) {
    throw new Error('AI_API_BASE_URL is required for deepseek provider');
  }

  if (!config.model) {
    throw new Error('AI_MODEL is required for deepseek provider');
  }

  const response = await fetchWithTimeout(toChatCompletionsUrl(config.api_base_url), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.api_key ? { Authorization: `Bearer ${config.api_key}` } : {})
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: '你是一个克制、准确的中文文章分析助手，只输出严格 JSON。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `AI request failed: ${response.status}`);
  }

  return data.choices?.[0]?.message?.content || '';
}

async function callOllama(config, prompt) {
  const response = await fetchWithTimeout(`${config.ollama_url.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollama_model,
      stream: false,
      messages: [
        { role: 'system', content: '你是一个克制、准确的中文文章分析助手，只输出严格 JSON。' },
        { role: 'user', content: prompt }
      ],
      options: {
        temperature: 0.2
      }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Ollama request failed: ${response.status}`);
  }

  return data.message?.content || '';
}

async function fetchWithTimeout(url, options, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function toChatCompletionsUrl(baseUrl) {
  const url = baseUrl.replace(/\/$/, '');

  if (url.endsWith('/chat/completions')) {
    return url;
  }

  return `${url}/chat/completions`;
}

module.exports = {
  getAIConfig,
  getPublicAIConfig,
  runAI
};
