const { app, BrowserWindow, ipcMain, safeStorage, Notification } = require('electron');
const path = require('path');
const Database = require('./database');
const Scraper = require('./scraper');
const Scheduler = require('./scheduler');

let mainWindow;
let db;
let scheduler;

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;

function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  console.log('Preload path:', preloadPath);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
      sandbox: false
    },
    show: false
  });

  mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
    console.error('Preload error:', preloadPath, error);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  db = new Database();
  await db.ready; // Wait for sql.js to initialize
  scheduler = new Scheduler(db, sendNotification);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function sendNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
  if (mainWindow) {
    mainWindow.webContents.send('notification', { title, body });
  }
}

// ============ IPC Handlers ============

// Credential Management (using OS keychain via safeStorage)
ipcMain.handle('credentials:save', async (event, { accountId, credentials }) => {
  console.log('Saving credentials for account:', accountId);
  if (!safeStorage.isEncryptionAvailable()) {
    console.error('Encryption not available!');
    throw new Error('Encryption not available on this system');
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(credentials));
  console.log('Encrypted, saving to DB...');
  db.saveEncryptedCredentials(accountId, encrypted.toString('base64'));
  console.log('Credentials saved successfully');
  return { success: true };
});

ipcMain.handle('credentials:get', async (event, accountId) => {
  console.log('Getting credentials for account:', accountId);
  const encrypted = db.getEncryptedCredentials(accountId);
  console.log('Encrypted data found:', !!encrypted);
  if (!encrypted) return null;
  const decrypted = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
  return JSON.parse(decrypted);
});

ipcMain.handle('credentials:delete', async (event, accountId) => {
  db.deleteCredentials(accountId);
  return { success: true };
});

// Account Management
ipcMain.handle('accounts:list', async () => {
  return db.getAccounts();
});

ipcMain.handle('accounts:add', async (event, account) => {
  return db.addAccount(account);
});

ipcMain.handle('accounts:update', async (event, account) => {
  return db.updateAccount(account);
});

ipcMain.handle('accounts:delete', async (event, accountId) => {
  db.deleteAccount(accountId);
  return { success: true };
});

// Scraping
ipcMain.handle('scraper:run', async (event, accountId) => {
  console.log('=== SCRAPER RUN STARTED ===');
  console.log('Account ID:', accountId);

  const account = db.getAccount(accountId);
  if (!account) throw new Error('Account not found');
  console.log('Account found:', account.name, account.type);

  const encryptedCreds = db.getEncryptedCredentials(accountId);
  if (!encryptedCreds) throw new Error('No credentials found');

  const decryptedCreds = safeStorage.decryptString(Buffer.from(encryptedCreds, 'base64'));
  const creds = JSON.parse(decryptedCreds);
  console.log('Credentials decrypted');

  mainWindow.webContents.send('scraper:status', { accountId, status: 'running' });

  try {
    console.log('Starting scraper for:', account.type);
    const scraper = new Scraper(account.type);
    const transactions = await scraper.scrape(creds);

    console.log('Scrape completed, transactions:', transactions.length);
    if (transactions.length > 0) {
      console.log('First transaction accountNumber:', transactions[0].accountNumber);
    }

    const newCount = db.saveTransactions(accountId, transactions);
    console.log('Saved to DB, new count:', newCount);
    db.updateLastScrape(accountId);

    mainWindow.webContents.send('scraper:status', { accountId, status: 'completed', newCount });

    // Check alerts for new transactions
    const alerts = scheduler.checkAlerts(transactions);
    alerts.forEach(alert => sendNotification(alert.title, alert.body));

    console.log('=== SCRAPER RUN COMPLETED ===');
    return { success: true, newCount };
  } catch (error) {
    console.error('Scraper error:', error);
    mainWindow.webContents.send('scraper:status', { accountId, status: 'error', error: error.message });
    throw error;
  }
});

ipcMain.handle('scraper:test', async (event, { type, credentials }) => {
  const scraper = new Scraper(type);
  return await scraper.testConnection(credentials);
});

// Transactions
ipcMain.handle('transactions:list', async (event, filters = {}) => {
  return db.getTransactions(filters);
});

ipcMain.handle('transactions:update', async (event, transaction) => {
  return db.updateTransaction(transaction);
});

ipcMain.handle('transactions:stats', async (event, period = 'month') => {
  return db.getTransactionStats(period);
});

// Categories
ipcMain.handle('categories:list', async () => {
  return db.getCategories();
});

ipcMain.handle('categories:add', async (event, category) => {
  return db.addCategory(category);
});

ipcMain.handle('categories:update', async (event, category) => {
  return db.updateCategory(category);
});

ipcMain.handle('categories:delete', async (event, categoryId) => {
  db.deleteCategory(categoryId);
  return { success: true };
});

// Alert Rules
ipcMain.handle('alerts:list', async () => {
  return db.getAlertRules();
});

ipcMain.handle('alerts:add', async (event, rule) => {
  return db.addAlertRule(rule);
});

ipcMain.handle('alerts:update', async (event, rule) => {
  return db.updateAlertRule(rule);
});

ipcMain.handle('alerts:delete', async (event, ruleId) => {
  db.deleteAlertRule(ruleId);
  return { success: true };
});

ipcMain.handle('alerts:history', async () => {
  return db.getAlertHistory();
});

// Settings
ipcMain.handle('settings:get', async () => {
  return db.getSettings();
});

ipcMain.handle('settings:update', async (event, settings) => {
  db.updateSettings(settings);
  scheduler.updateSchedule(settings.scrapeInterval);
  return { success: true };
});

// Scheduler
ipcMain.handle('scheduler:start', async () => {
  scheduler.start();
  return { success: true };
});

ipcMain.handle('scheduler:stop', async () => {
  scheduler.stop();
  return { success: true };
});

ipcMain.handle('scheduler:status', async () => {
  return scheduler.getStatus();
});

// Tags
ipcMain.handle('tags:list', async () => {
  return db.getTags();
});

ipcMain.handle('tags:add', async (event, tag) => {
  return db.addTag(tag);
});

ipcMain.handle('tags:update', async (event, tag) => {
  return db.updateTag(tag);
});

ipcMain.handle('tags:delete', async (event, tagId) => {
  db.deleteTag(tagId);
  return { success: true };
});

// Tag Rules
ipcMain.handle('tagRules:list', async () => {
  return db.getTagRules();
});

ipcMain.handle('tagRules:add', async (event, rule) => {
  return db.addTagRule(rule);
});

ipcMain.handle('tagRules:update', async (event, rule) => {
  return db.updateTagRule(rule);
});

ipcMain.handle('tagRules:delete', async (event, ruleId) => {
  db.deleteTagRule(ruleId);
  return { success: true };
});

ipcMain.handle('tagRules:apply', async () => {
  const count = db.applyTagRules();
  return { success: true, taggedCount: count };
});

// Bulk operations
ipcMain.handle('transactions:bulkUpdateTag', async (event, { transactionIds, tagId }) => {
  const count = db.bulkUpdateTag(transactionIds, tagId);
  return { success: true, updatedCount: count };
});
