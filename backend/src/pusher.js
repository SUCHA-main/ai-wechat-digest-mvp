const nodemailer = require('nodemailer');

function getPushConfig() {
  const provider = String(process.env.PUSH_PROVIDER || 'console').toLowerCase();
  const normalizedProvider = ['console', 'pushplus', 'email'].includes(provider) ? provider : 'console';

  return {
    provider: normalizedProvider,
    pushplus_token: process.env.PUSHPLUS_TOKEN || '',
    smtp_host: process.env.SMTP_HOST || '',
    smtp_port: process.env.SMTP_PORT || '',
    smtp_user: process.env.SMTP_USER || '',
    smtp_pass: process.env.SMTP_PASS || '',
    smtp_from: process.env.SMTP_FROM || '',
    smtp_to: process.env.SMTP_TO || ''
  };
}

function getPublicPushConfig() {
  const config = getPushConfig();

  return {
    provider: config.provider,
    pushplus_configured: Boolean(config.pushplus_token),
    email_configured: Boolean(
      config.smtp_host &&
      config.smtp_port &&
      config.smtp_user &&
      config.smtp_pass &&
      config.smtp_from &&
      config.smtp_to
    )
  };
}

async function pushDigest(markdown, options = {}) {
  const config = getPushConfig();
  const title = options.title || `AI 微信公众号晚报 ${new Date().toISOString().slice(0, 10)}`;

  if (!markdown) {
    return { ok: false, provider: config.provider, error: '今日晚报内容为空，无法推送' };
  }

  if (config.provider === 'console') {
    console.log(`[Digest Push Preview] ${title}`);
    console.log(markdown);
    return { ok: true, provider: 'console', message: '已在控制台打印今日晚报' };
  }

  if (config.provider === 'pushplus') {
    return pushWithPushPlus(config, title, markdown);
  }

  if (config.provider === 'email') {
    return pushWithEmail(config, title, markdown);
  }

  return { ok: false, provider: config.provider, error: '未知推送方式' };
}

async function pushWithPushPlus(config, title, markdown) {
  if (!config.pushplus_token) {
    return { ok: false, provider: 'pushplus', error: 'PushPlus 未配置 PUSHPLUS_TOKEN' };
  }

  try {
    const response = await fetch('https://www.pushplus.plus/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: config.pushplus_token,
        title,
        content: markdown,
        template: 'markdown'
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || (data.code !== undefined && data.code !== 200)) {
      return {
        ok: false,
        provider: 'pushplus',
        error: data.msg || data.message || `PushPlus 请求失败：${response.status}`
      };
    }

    return { ok: true, provider: 'pushplus', message: 'PushPlus 推送成功' };
  } catch (error) {
    return { ok: false, provider: 'pushplus', error: error.message };
  }
}

async function pushWithEmail(config, title, markdown) {
  const missing = [];
  if (!config.smtp_host) missing.push('SMTP_HOST');
  if (!config.smtp_port) missing.push('SMTP_PORT');
  if (!config.smtp_user) missing.push('SMTP_USER');
  if (!config.smtp_pass) missing.push('SMTP_PASS');
  if (!config.smtp_from) missing.push('SMTP_FROM');
  if (!config.smtp_to) missing.push('SMTP_TO');

  if (missing.length) {
    return { ok: false, provider: 'email', error: `SMTP 配置缺失：${missing.join(', ')}` };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: Number(config.smtp_port),
      secure: Number(config.smtp_port) === 465,
      auth: {
        user: config.smtp_user,
        pass: config.smtp_pass
      }
    });

    await transporter.sendMail({
      from: config.smtp_from,
      to: config.smtp_to,
      subject: title,
      text: markdown
    });

    return { ok: true, provider: 'email', message: '邮件推送成功' };
  } catch (error) {
    return { ok: false, provider: 'email', error: error.message };
  }
}

module.exports = {
  getPushConfig,
  getPublicPushConfig,
  pushDigest
};
