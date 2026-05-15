const cron = require('node-cron');
const { fetchAllSources } = require('./fetcher');
const { generateTodayDigest } = require('./digest');
const { pushDigest } = require('./pusher');

function startScheduler() {
  if (process.env.ENABLE_SCHEDULER !== 'true') {
    console.log('Scheduler disabled. Set ENABLE_SCHEDULER=true to enable daily digest generation.');
    return;
  }

  cron.schedule('30 22 * * *', async () => {
    let digest = null;

    try {
      const fetchResult = await fetchAllSources();
      console.log(`Scheduled RSS fetch completed: imported=${fetchResult.imported}, skipped=${fetchResult.skipped}, failed=${fetchResult.failedSources.length}`);
    } catch (error) {
      console.error('Scheduled RSS fetch failed:', error.message);
    }

    try {
      digest = generateTodayDigest();
      console.log(`Daily digest generated: ${digest.digest_date}, articles: ${digest.article_count}`);
    } catch (error) {
      console.error('Failed to generate scheduled digest:', error.message);
    }

    if (process.env.ENABLE_DAILY_PUSH === 'true' && digest) {
      try {
        const pushResult = await pushDigest(digest.markdown, {
          title: `AI 微信公众号晚报 ${digest.digest_date}`
        });
        console.log(`Scheduled digest push completed: provider=${pushResult.provider}, ok=${pushResult.ok}`);
        if (!pushResult.ok) {
          console.error(`Scheduled digest push failed: ${pushResult.error}`);
        }
      } catch (error) {
        console.error('Scheduled digest push failed:', error.message);
      }
    }
  });

  console.log('Scheduler enabled: daily RSS fetch and digest generation at 22:30.');
  if (process.env.ENABLE_DAILY_PUSH === 'true') {
    console.log('Daily push enabled.');
  }
}

module.exports = {
  startScheduler
};
