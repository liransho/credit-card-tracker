const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class AppDatabase {
  constructor() {
    this.db = null;
    this.dbPath = null;
    this.ready = this.init();
  }

  async init() {
    const SQL = await initSqlJs();

    this.dbPath = app.isPackaged
      ? path.join(app.getPath('userData'), 'credit-tracker.db')
      : path.join(__dirname, '../../data/credit-tracker.db');

    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    this.createTables();
    this.save();
  }

  save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  createTables() {
    this.db.run(`
      -- Accounts table
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        last_scrape TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Encrypted credentials (stored separately for security)
      CREATE TABLE IF NOT EXISTS credentials (
        account_id INTEGER PRIMARY KEY,
        encrypted_data TEXT NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      -- Transactions
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        external_id TEXT,
        date TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        original_category TEXT,
        user_category_id INTEGER,
        merchant TEXT,
        memo TEXT,
        type TEXT,
        status TEXT,
        card_number TEXT,
        max_label TEXT,
        tag_id INTEGER,
        scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
        raw_data TEXT,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_category_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE SET NULL,
        UNIQUE(account_id, external_id)
      );

      -- Personal tags for expense tracking
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT DEFAULT '#3B82F6',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Auto-tagging rules
      CREATE TABLE IF NOT EXISTS tag_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        tag_id INTEGER NOT NULL,
        match_type TEXT NOT NULL,
        match_value TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );

      -- Categories
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT DEFAULT '#6B7280',
        icon TEXT,
        budget_limit REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Alert rules
      CREATE TABLE IF NOT EXISTS alert_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        condition TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Alert history
      CREATE TABLE IF NOT EXISTS alert_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id INTEGER,
        transaction_id INTEGER,
        title TEXT NOT NULL,
        body TEXT,
        triggered_at TEXT DEFAULT CURRENT_TIMESTAMP,
        acknowledged INTEGER DEFAULT 0,
        FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE SET NULL,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
      );

      -- Settings
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // Create indexes
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(user_category_id)`);

    // Insert default settings
    this.db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('scrapeInterval', '6')`);
    this.db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('currency', 'ILS')`);
    this.db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('language', 'he')`);

    // Insert default categories
    this.db.run(`INSERT OR IGNORE INTO categories (name, color, icon) VALUES ('מזון', '#EF4444', 'utensils')`);
    this.db.run(`INSERT OR IGNORE INTO categories (name, color, icon) VALUES ('קניות', '#F59E0B', 'shopping-bag')`);
    this.db.run(`INSERT OR IGNORE INTO categories (name, color, icon) VALUES ('תחבורה', '#3B82F6', 'car')`);
    this.db.run(`INSERT OR IGNORE INTO categories (name, color, icon) VALUES ('בילויים', '#8B5CF6', 'music')`);
    this.db.run(`INSERT OR IGNORE INTO categories (name, color, icon) VALUES ('חשבונות', '#10B981', 'file-text')`);
    this.db.run(`INSERT OR IGNORE INTO categories (name, color, icon) VALUES ('בריאות', '#EC4899', 'heart')`);
    this.db.run(`INSERT OR IGNORE INTO categories (name, color, icon) VALUES ('אחר', '#6B7280', 'more-horizontal')`);

    // Insert default tags
    this.db.run(`INSERT OR IGNORE INTO tags (name, color) VALUES ('לירן', '#3B82F6')`);
    this.db.run(`INSERT OR IGNORE INTO tags (name, color) VALUES ('עדי', '#EC4899')`);
    this.db.run(`INSERT OR IGNORE INTO tags (name, color) VALUES ('יחד-קבוע', '#10B981')`);
    this.db.run(`INSERT OR IGNORE INTO tags (name, color) VALUES ('יחד-קניות מזון וצריכה', '#F59E0B')`);
    this.db.run(`INSERT OR IGNORE INTO tags (name, color) VALUES ('יחד-בילויים', '#8B5CF6')`);
    this.db.run(`INSERT OR IGNORE INTO tags (name, color) VALUES ('יחד-קניות אחר', '#6B7280')`);
    this.db.run(`INSERT OR IGNORE INTO tags (name, color) VALUES ('ילדים', '#EF4444')`);
  }

  // Helper to convert sql.js result to array of objects
  queryAll(sql, params = []) {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  queryOne(sql, params = []) {
    const results = this.queryAll(sql, params);
    return results[0] || null;
  }

  run(sql, params = []) {
    this.db.run(sql, params);
    const lastIdResult = this.db.exec("SELECT last_insert_rowid() as id");
    const lastId = lastIdResult.length > 0 ? lastIdResult[0].values[0][0] : null;
    console.log('Last insert ID:', lastId);
    this.save();
    return {
      lastInsertRowid: lastId,
      changes: this.db.getRowsModified()
    };
  }

  // ============ Accounts ============
  getAccounts() {
    return this.queryAll('SELECT * FROM accounts ORDER BY name');
  }

  getAccount(id) {
    return this.queryOne('SELECT * FROM accounts WHERE id = ?', [id]);
  }

  addAccount(account) {
    const result = this.run('INSERT INTO accounts (type, name) VALUES (?, ?)', [account.type, account.name]);
    return { id: result.lastInsertRowid, ...account };
  }

  updateAccount(account) {
    this.run('UPDATE accounts SET name = ?, type = ? WHERE id = ?', [account.name, account.type, account.id]);
    return account;
  }

  deleteAccount(id) {
    this.run('DELETE FROM accounts WHERE id = ?', [id]);
  }

  updateLastScrape(accountId) {
    this.run('UPDATE accounts SET last_scrape = datetime("now") WHERE id = ?', [accountId]);
  }

  // ============ Credentials ============
  saveEncryptedCredentials(accountId, encryptedData) {
    this.run('INSERT OR REPLACE INTO credentials (account_id, encrypted_data) VALUES (?, ?)', [accountId, encryptedData]);
  }

  getEncryptedCredentials(accountId) {
    const row = this.queryOne('SELECT encrypted_data FROM credentials WHERE account_id = ?', [accountId]);
    return row?.encrypted_data;
  }

  deleteCredentials(accountId) {
    this.run('DELETE FROM credentials WHERE account_id = ?', [accountId]);
  }

  // ============ Transactions ============
  getTransactions(filters = {}) {
    let query = `
      SELECT t.*, t.card_number, t.max_label, t.tag_id, t.card_holder_name, t.purchase_time,
        a.name as account_name, a.type as account_type,
        c.name as category_name, c.color as category_color,
        tg.name as tag_name, tg.color as tag_color
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.user_category_id = c.id
      LEFT JOIN tags tg ON t.tag_id = tg.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.accountId) {
      query += ' AND t.account_id = ?';
      params.push(filters.accountId);
    }

    if (filters.startDate) {
      query += ' AND t.date >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      query += ' AND t.date <= ?';
      params.push(filters.endDate);
    }

    if (filters.categoryId) {
      query += ' AND t.user_category_id = ?';
      params.push(filters.categoryId);
    }

    if (filters.search) {
      query += ' AND (t.description LIKE ? OR t.merchant LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    if (filters.minAmount) {
      query += ' AND ABS(t.amount) >= ?';
      params.push(filters.minAmount);
    }

    if (filters.maxAmount) {
      query += ' AND ABS(t.amount) <= ?';
      params.push(filters.maxAmount);
    }

    query += ' ORDER BY t.date DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    return this.queryAll(query, params);
  }

  saveTransactions(accountId, transactions) {
    let insertedCount = 0;

    // Ensure new columns exist (for migration)
    try {
      this.db.run("ALTER TABLE transactions ADD COLUMN card_number TEXT");
      this.save();
    } catch (e) {}
    try {
      this.db.run("ALTER TABLE transactions ADD COLUMN max_label TEXT");
      this.save();
    } catch (e) {}
    try {
      this.db.run("ALTER TABLE transactions ADD COLUMN tag_id INTEGER");
      this.save();
    } catch (e) {}
    try {
      this.db.run("ALTER TABLE transactions ADD COLUMN card_holder_name TEXT");
      this.save();
    } catch (e) {}
    try {
      this.db.run("ALTER TABLE transactions ADD COLUMN purchase_time TEXT");
      this.save();
    } catch (e) {}

    console.log('Saving', transactions.length, 'transactions');
    if (transactions.length > 0) {
      console.log('Sample txn keys:', Object.keys(transactions[0]));
      console.log('Sample txn label:', transactions[0].label);
    }

    for (const txn of transactions) {
      try {
        // Extract last 4 digits of card number
        const cardNumber = txn.accountNumber ? txn.accountNumber.slice(-4) : null;
        // Extract Max label from the maxLabel field we set in scraper
        const maxLabel = txn.maxLabel || null;

        const result = this.run(`
          INSERT OR IGNORE INTO transactions
          (account_id, external_id, date, amount, description, original_category, merchant, type, status, card_number, max_label, card_holder_name, purchase_time, raw_data)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          accountId,
          txn.identifier || `${txn.date}-${txn.chargedAmount}-${txn.description}`,
          txn.date,
          txn.chargedAmount,
          txn.description,
          txn.category,
          txn.memo,
          txn.type,
          txn.status,
          cardNumber,
          maxLabel,
          txn.cardHolderName || null,
          txn.purchaseTime || null,
          JSON.stringify(txn)
        ]);
        if (result.changes > 0) insertedCount++;
      } catch (e) {
        console.error('Failed to insert transaction:', e);
      }
    }

    return insertedCount;
  }

  updateTransaction(transaction) {
    this.run(`
      UPDATE transactions
      SET user_category_id = ?, memo = ?
      WHERE id = ?
    `, [transaction.user_category_id, transaction.memo, transaction.id]);
    return transaction;
  }

  getTransactionStats(period = 'month') {
    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const startDateStr = startDate.toISOString().split('T')[0];

    const totalSpending = this.queryOne(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as total
      FROM transactions
      WHERE date >= ? AND amount < 0
    `, [startDateStr]);

    const byCategory = this.queryAll(`
      SELECT
        COALESCE(c.name, t.original_category, 'אחר') as category,
        COALESCE(c.color, '#6B7280') as color,
        SUM(ABS(t.amount)) as total,
        COUNT(*) as count
      FROM transactions t
      LEFT JOIN categories c ON t.user_category_id = c.id
      WHERE t.date >= ? AND t.amount < 0
      GROUP BY COALESCE(c.name, t.original_category, 'אחר')
      ORDER BY total DESC
    `, [startDateStr]);

    const byAccount = this.queryAll(`
      SELECT
        a.name as account,
        a.type,
        SUM(ABS(t.amount)) as total,
        COUNT(*) as count
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      WHERE t.date >= ? AND t.amount < 0
      GROUP BY t.account_id
      ORDER BY total DESC
    `, [startDateStr]);

    const byCard = this.queryAll(`
      SELECT
        COALESCE(t.card_number, 'לא ידוע') as card,
        a.name as account_name,
        SUM(ABS(t.amount)) as total,
        COUNT(*) as count
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.date >= ? AND t.amount < 0
      GROUP BY t.card_number
      ORDER BY total DESC
    `, [startDateStr]);

    const dailySpending = this.queryAll(`
      SELECT
        date,
        SUM(ABS(amount)) as total
      FROM transactions
      WHERE date >= ? AND amount < 0
      GROUP BY date
      ORDER BY date
    `, [startDateStr]);

    return {
      totalSpending: totalSpending?.total || 0,
      byCategory,
      byAccount,
      byCard,
      dailySpending,
      period,
      startDate: startDateStr
    };
  }

  // ============ Categories ============
  getCategories() {
    return this.queryAll('SELECT * FROM categories ORDER BY name');
  }

  addCategory(category) {
    const result = this.run(`
      INSERT INTO categories (name, color, icon, budget_limit) VALUES (?, ?, ?, ?)
    `, [category.name, category.color, category.icon, category.budget_limit]);
    return { id: result.lastInsertRowid, ...category };
  }

  updateCategory(category) {
    this.run(`
      UPDATE categories SET name = ?, color = ?, icon = ?, budget_limit = ? WHERE id = ?
    `, [category.name, category.color, category.icon, category.budget_limit, category.id]);
    return category;
  }

  deleteCategory(id) {
    this.run('DELETE FROM categories WHERE id = ?', [id]);
  }

  // ============ Alert Rules ============
  getAlertRules() {
    return this.queryAll('SELECT * FROM alert_rules ORDER BY name');
  }

  addAlertRule(rule) {
    const result = this.run(`
      INSERT INTO alert_rules (name, type, condition, enabled) VALUES (?, ?, ?, ?)
    `, [rule.name, rule.type, JSON.stringify(rule.condition), rule.enabled ? 1 : 0]);
    return { id: result.lastInsertRowid, ...rule };
  }

  updateAlertRule(rule) {
    this.run(`
      UPDATE alert_rules SET name = ?, type = ?, condition = ?, enabled = ? WHERE id = ?
    `, [rule.name, rule.type, JSON.stringify(rule.condition), rule.enabled ? 1 : 0, rule.id]);
    return rule;
  }

  deleteAlertRule(id) {
    this.run('DELETE FROM alert_rules WHERE id = ?', [id]);
  }

  getAlertHistory() {
    return this.queryAll(`
      SELECT ah.*, ar.name as rule_name
      FROM alert_history ah
      LEFT JOIN alert_rules ar ON ah.rule_id = ar.id
      ORDER BY ah.triggered_at DESC
      LIMIT 100
    `);
  }

  saveAlert(alert) {
    this.run(`
      INSERT INTO alert_history (rule_id, transaction_id, title, body) VALUES (?, ?, ?, ?)
    `, [alert.rule_id, alert.transaction_id, alert.title, alert.body]);
  }

  // ============ Settings ============
  getSettings() {
    const rows = this.queryAll('SELECT key, value FROM settings');
    return rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
  }

  updateSettings(settings) {
    for (const [key, value] of Object.entries(settings)) {
      this.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
    }
  }

  // ============ Tags ============
  getTags() {
    return this.queryAll('SELECT * FROM tags ORDER BY name');
  }

  addTag(tag) {
    const result = this.run(`
      INSERT INTO tags (name, color) VALUES (?, ?)
    `, [tag.name, tag.color || '#3B82F6']);
    return { id: result.lastInsertRowid, ...tag };
  }

  updateTag(tag) {
    this.run(`
      UPDATE tags SET name = ?, color = ? WHERE id = ?
    `, [tag.name, tag.color, tag.id]);
    return tag;
  }

  deleteTag(id) {
    this.run('DELETE FROM tags WHERE id = ?', [id]);
  }

  // ============ Tag Rules ============
  getTagRules() {
    return this.queryAll(`
      SELECT tr.*, t.name as tag_name, t.color as tag_color
      FROM tag_rules tr
      LEFT JOIN tags t ON tr.tag_id = t.id
      ORDER BY tr.name
    `);
  }

  addTagRule(rule) {
    const result = this.run(`
      INSERT INTO tag_rules (name, tag_id, match_type, match_value, enabled) VALUES (?, ?, ?, ?, ?)
    `, [rule.name, rule.tag_id, rule.match_type, rule.match_value, rule.enabled ? 1 : 0]);
    return { id: result.lastInsertRowid, ...rule };
  }

  updateTagRule(rule) {
    this.run(`
      UPDATE tag_rules SET name = ?, tag_id = ?, match_type = ?, match_value = ?, enabled = ? WHERE id = ?
    `, [rule.name, rule.tag_id, rule.match_type, rule.match_value, rule.enabled ? 1 : 0, rule.id]);
    return rule;
  }

  deleteTagRule(id) {
    this.run('DELETE FROM tag_rules WHERE id = ?', [id]);
  }

  applyTagRules() {
    const rules = this.getTagRules().filter(r => r.enabled);
    let taggedCount = 0;

    for (const rule of rules) {
      let query = '';
      const matchValue = `%${rule.match_value.toLowerCase()}%`;

      switch (rule.match_type) {
        case 'description':
          query = `UPDATE transactions SET tag_id = ? WHERE tag_id IS NULL AND LOWER(description) LIKE ?`;
          break;
        case 'merchant':
          query = `UPDATE transactions SET tag_id = ? WHERE tag_id IS NULL AND LOWER(merchant) LIKE ?`;
          break;
        case 'category':
          query = `UPDATE transactions SET tag_id = ? WHERE tag_id IS NULL AND LOWER(original_category) LIKE ?`;
          break;
        default:
          continue;
      }

      const result = this.run(query, [rule.tag_id, matchValue]);
      taggedCount += result.changes || 0;
    }

    return taggedCount;
  }

  // Bulk update tag for multiple transactions
  bulkUpdateTag(transactionIds, tagId) {
    if (!transactionIds || transactionIds.length === 0) return 0;

    const placeholders = transactionIds.map(() => '?').join(',');
    const result = this.run(
      `UPDATE transactions SET tag_id = ? WHERE id IN (${placeholders})`,
      [tagId, ...transactionIds]
    );
    return result.changes || 0;
  }

  close() {
    if (this.db) {
      this.save();
      this.db.close();
    }
  }
}

module.exports = AppDatabase;
