const cron = require('node-cron');
const { generateTodayDigest } = require('./digest');

function startScheduler() {
  if (process.env.ENABLE_SCHEDULER !== 'true') {
    console.log('Scheduler disabled. Set ENABLE_SCHEDULER=true to enable daily digest generation.');
    return;
  }

  cron.schedule('30 22 * * *', () => {
    try {
      const result = generateTodayDigest();
      console.log(`Daily digest generated: ${result.digest_date}, articles: ${result.article_count}`);
    } catch (error) {
      console.error('Failed to generate scheduled digest:', error);
    }
  });

  console.log('Scheduler enabled: daily digest generation at 22:30.');
}

module.exports = {
  startScheduler
};
