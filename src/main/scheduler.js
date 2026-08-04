const cron = require('node-cron');

class Scheduler {
  constructor(database, notifyCallback) {
    this.db = database;
    this.notify = notifyCallback;
    this.job = null;
    this.isRunning = false;
    this.lastRun = null;
    this.nextRun = null;
  }

  start() {
    const settings = this.db.getSettings();
    const intervalHours = parseInt(settings.scrapeInterval) || 6;

    // Stop existing job if any
    this.stop();

    // Run every X hours
    const cronExpression = `0 */${intervalHours} * * *`;

    this.job = cron.schedule(cronExpression, async () => {
      await this.runScrapeAll();
    });

    this.isRunning = true;
    this.calculateNextRun(intervalHours);

    console.log(`Scheduler started: running every ${intervalHours} hours`);
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
    }
    this.isRunning = false;
    this.nextRun = null;
  }

  updateSchedule(intervalHours) {
    if (this.isRunning) {
      this.start(); // Restart with new interval
    }
  }

  async runScrapeAll() {
    const accounts = this.db.getAccounts();

    for (const account of accounts) {
      try {
        // This would normally trigger the scraper via IPC
        // For now, we just log the attempt
        console.log(`Scheduled scrape for account: ${account.name}`);

        // The actual scraping is handled by the main process
        // This scheduler just triggers the event
      } catch (error) {
        console.error(`Scheduled scrape failed for ${account.name}:`, error);
        this.notify('שגיאה בעדכון', `נכשל לעדכן את ${account.name}`);
      }
    }

    this.lastRun = new Date();
    this.calculateNextRun();
  }

  calculateNextRun(intervalHours) {
    if (!intervalHours) {
      const settings = this.db.getSettings();
      intervalHours = parseInt(settings.scrapeInterval) || 6;
    }

    const now = new Date();
    this.nextRun = new Date(now.getTime() + intervalHours * 60 * 60 * 1000);
  }

  checkAlerts(transactions) {
    const rules = this.db.getAlertRules().filter(r => r.enabled);
    const triggeredAlerts = [];

    for (const txn of transactions) {
      for (const rule of rules) {
        const condition = JSON.parse(rule.condition);

        if (this.matchesRule(txn, rule.type, condition)) {
          const alert = {
            rule_id: rule.id,
            transaction_id: txn.id,
            title: rule.name,
            body: this.formatAlertBody(txn, rule)
          };

          this.db.saveAlert(alert);
          triggeredAlerts.push(alert);
        }
      }
    }

    return triggeredAlerts;
  }

  matchesRule(transaction, ruleType, condition) {
    switch (ruleType) {
      case 'amount':
        return this.matchAmountRule(transaction, condition);
      case 'category':
        return this.matchCategoryRule(transaction, condition);
      case 'merchant':
        return this.matchMerchantRule(transaction, condition);
      case 'keyword':
        return this.matchKeywordRule(transaction, condition);
      default:
        return false;
    }
  }

  matchAmountRule(txn, condition) {
    const amount = Math.abs(txn.chargedAmount || txn.amount);
    const { operator, value } = condition;

    switch (operator) {
      case 'gt': return amount > value;
      case 'gte': return amount >= value;
      case 'lt': return amount < value;
      case 'lte': return amount <= value;
      case 'eq': return amount === value;
      default: return false;
    }
  }

  matchCategoryRule(txn, condition) {
    const category = (txn.category || txn.original_category || '').toLowerCase();
    return condition.categories.some(c => category.includes(c.toLowerCase()));
  }

  matchMerchantRule(txn, condition) {
    const merchant = (txn.memo || txn.merchant || txn.description || '').toLowerCase();
    return condition.merchants.some(m => merchant.includes(m.toLowerCase()));
  }

  matchKeywordRule(txn, condition) {
    const text = `${txn.description || ''} ${txn.memo || ''} ${txn.merchant || ''}`.toLowerCase();
    return condition.keywords.some(k => text.includes(k.toLowerCase()));
  }

  formatAlertBody(txn, rule) {
    const amount = Math.abs(txn.chargedAmount || txn.amount);
    const description = txn.description || txn.memo || 'עסקה';
    return `${description} - ₪${amount.toFixed(2)}`;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun?.toISOString(),
      nextRun: this.nextRun?.toISOString()
    };
  }
}

module.exports = Scheduler;
