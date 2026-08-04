const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script is running!');

contextBridge.exposeInMainWorld('electronAPI', {
  // Credentials
  credentials: {
    save: (accountId, credentials) => ipcRenderer.invoke('credentials:save', { accountId, credentials }),
    get: (accountId) => ipcRenderer.invoke('credentials:get', accountId),
    delete: (accountId) => ipcRenderer.invoke('credentials:delete', accountId)
  },

  // Accounts
  accounts: {
    list: () => ipcRenderer.invoke('accounts:list'),
    add: (account) => ipcRenderer.invoke('accounts:add', account),
    update: (account) => ipcRenderer.invoke('accounts:update', account),
    delete: (accountId) => ipcRenderer.invoke('accounts:delete', accountId)
  },

  // Scraper
  scraper: {
    run: (accountId) => ipcRenderer.invoke('scraper:run', accountId),
    test: (type, credentials) => ipcRenderer.invoke('scraper:test', { type, credentials }),
    onStatus: (callback) => {
      ipcRenderer.on('scraper:status', (event, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('scraper:status');
    }
  },

  // Transactions
  transactions: {
    list: (filters) => ipcRenderer.invoke('transactions:list', filters),
    update: (transaction) => ipcRenderer.invoke('transactions:update', transaction),
    stats: (period) => ipcRenderer.invoke('transactions:stats', period),
    bulkUpdateTag: (transactionIds, tagId) => ipcRenderer.invoke('transactions:bulkUpdateTag', { transactionIds, tagId })
  },

  // Categories
  categories: {
    list: () => ipcRenderer.invoke('categories:list'),
    add: (category) => ipcRenderer.invoke('categories:add', category),
    update: (category) => ipcRenderer.invoke('categories:update', category),
    delete: (categoryId) => ipcRenderer.invoke('categories:delete', categoryId)
  },

  // Alert Rules
  alerts: {
    list: () => ipcRenderer.invoke('alerts:list'),
    add: (rule) => ipcRenderer.invoke('alerts:add', rule),
    update: (rule) => ipcRenderer.invoke('alerts:update', rule),
    delete: (ruleId) => ipcRenderer.invoke('alerts:delete', ruleId),
    history: () => ipcRenderer.invoke('alerts:history')
  },

  // Settings
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (settings) => ipcRenderer.invoke('settings:update', settings)
  },

  // Scheduler
  scheduler: {
    start: () => ipcRenderer.invoke('scheduler:start'),
    stop: () => ipcRenderer.invoke('scheduler:stop'),
    status: () => ipcRenderer.invoke('scheduler:status')
  },

  // Tags
  tags: {
    list: () => ipcRenderer.invoke('tags:list'),
    add: (tag) => ipcRenderer.invoke('tags:add', tag),
    update: (tag) => ipcRenderer.invoke('tags:update', tag),
    delete: (tagId) => ipcRenderer.invoke('tags:delete', tagId)
  },

  // Tag Rules
  tagRules: {
    list: () => ipcRenderer.invoke('tagRules:list'),
    add: (rule) => ipcRenderer.invoke('tagRules:add', rule),
    update: (rule) => ipcRenderer.invoke('tagRules:update', rule),
    delete: (ruleId) => ipcRenderer.invoke('tagRules:delete', ruleId),
    apply: () => ipcRenderer.invoke('tagRules:apply')
  },

  // Supabase sync
  supabase: {
    syncAll: () => ipcRenderer.invoke('supabase:syncAll')
  },

  // Notifications
  onNotification: (callback) => {
    ipcRenderer.on('notification', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('notification');
  }
});
