const { createScraper, CompanyTypes } = require('israeli-bank-scrapers');

const COMPANY_MAP = {
  max: CompanyTypes.max,
  cal: CompanyTypes.visaCal,
  isracard: CompanyTypes.isracard,
  amex: CompanyTypes.amex,
  leumi: CompanyTypes.leumi,
  hapoalim: CompanyTypes.hapoalim,
  discount: CompanyTypes.discount,
  mizrahi: CompanyTypes.mizrahi,
  otsar: CompanyTypes.otsarHahayal,
  beinleumi: CompanyTypes.beinpiInternational
};

class Scraper {
  constructor(companyType) {
    this.companyType = COMPANY_MAP[companyType] || companyType;
  }

  async scrape(credentials, options = {}) {
    const startDate = options.startDate || this.getDefaultStartDate();

    const scraper = createScraper({
      companyId: this.companyType,
      startDate,
      combineInstallments: false,
      showBrowser: false,
      verbose: false,
      additionalTransactionInformation: true,
      includeRawTransaction: true
    });

    try {
      const scrapeResult = await scraper.scrape(credentials);

      if (!scrapeResult.success) {
        throw new Error(scrapeResult.errorType || 'Scraping failed');
      }

      // Flatten all transactions from all accounts
      const allTransactions = [];
      console.log('Scrape result accounts:', scrapeResult.accounts?.length);
      for (const account of scrapeResult.accounts || []) {
        // Log full account object to see what fields are available
        const accountInfo = { ...account, txns: `[${account.txns?.length} transactions]` };
        console.log('Account full info:', JSON.stringify(accountInfo, null, 2));

        for (const txn of account.txns || []) {
          allTransactions.push({
            ...txn,
            accountNumber: account.accountNumber,
            cardHolderName: txn.rawTransaction?.dealData?.userName || account.cardHolderName || account.holderName || account.name || null,
            maxLabel: txn.rawTransaction?.tag?.name || null,
            purchaseTime: txn.rawTransaction?.dealData?.purchaseTime || null
          });
        }
      }

      console.log('Total transactions:', allTransactions.length);
      if (allTransactions.length > 0) {
        // Log all unique keys from all transactions
        const allKeys = new Set();
        allTransactions.forEach(t => {
          Object.keys(t).forEach(k => allKeys.add(k));
          if (t.rawTransaction) {
            Object.keys(t.rawTransaction).forEach(k => allKeys.add('raw.' + k));
          }
        });
        console.log('All transaction fields found:', Array.from(allKeys).sort().join(', '));

        // Try to find transactions with potential label fields
        const labelFields = ['label', 'tag', 'userLabel', 'personalLabel', 'note', 'userNote', 'shortDescription', 'userCategory'];
        for (const txn of allTransactions) {
          // Check in top-level
          for (const field of labelFields) {
            if (txn[field]) {
              console.log(`Found ${field} in transaction:`, txn[field], '- Full txn:', JSON.stringify(txn, null, 2));
            }
          }
          // Check in rawTransaction
          if (txn.rawTransaction) {
            for (const field of Object.keys(txn.rawTransaction)) {
              if (txn.rawTransaction[field] && typeof txn.rawTransaction[field] === 'string' && txn.rawTransaction[field].length > 0) {
                // Log any non-empty string fields from raw data
              }
            }
            // Print first raw transaction with non-standard fields
            const rawKeys = Object.keys(txn.rawTransaction);
            const hasExtra = rawKeys.some(k => !['merchantName', 'purchaseDate', 'paymentDate', 'originalAmount', 'actualPaymentAmount', 'originalCurrency', 'paymentCurrency', 'categoryId', 'planName', 'planTypeId', 'comments', 'dealData'].includes(k));
            if (hasExtra) {
              console.log('Transaction with extra raw fields:', JSON.stringify(txn.rawTransaction, null, 2));
              break; // Only log one
            }
          }
        }
      }

      return allTransactions;
    } catch (error) {
      console.error('Scraping error:', error);
      throw error;
    }
  }

  async testConnection(credentials) {
    const scraper = createScraper({
      companyId: this.companyType,
      startDate: new Date(),
      showBrowser: true,  // Show browser so user can see login and enter 2FA if needed
      verbose: true
    });

    try {
      const result = await scraper.scrape(credentials);
      return {
        success: result.success,
        errorType: result.errorType,
        errorMessage: result.errorMessage
      };
    } catch (error) {
      return {
        success: false,
        errorType: 'GENERAL_ERROR',
        errorMessage: error.message
      };
    }
  }

  getDefaultStartDate() {
    // Default: 12 months ago
    const date = new Date();
    date.setMonth(date.getMonth() - 12);
    return date;
  }

  static getCompanyTypes() {
    return Object.keys(COMPANY_MAP).map(key => ({
      id: key,
      name: Scraper.getCompanyName(key)
    }));
  }

  static getCompanyName(key) {
    const names = {
      max: 'Max (מקס)',
      cal: 'Cal (כאל)',
      isracard: 'Isracard (ישראכרט)',
      amex: 'American Express',
      leumi: 'Bank Leumi (בנק לאומי)',
      hapoalim: 'Bank Hapoalim (בנק הפועלים)',
      discount: 'Discount Bank (בנק דיסקונט)',
      mizrahi: 'Mizrahi Bank (בנק מזרחי)',
      otsar: 'Otsar Hahayal (אוצר החייל)',
      beinleumi: 'First International (הבינלאומי הראשון)'
    };
    return names[key] || key;
  }

  static getCredentialFields(companyType) {
    const fields = {
      max: [
        { name: 'username', label: 'שם משתמש', type: 'text' },
        { name: 'password', label: 'סיסמה', type: 'password' }
      ],
      cal: [
        { name: 'username', label: 'שם משתמש', type: 'text' },
        { name: 'password', label: 'סיסמה', type: 'password' }
      ],
      isracard: [
        { name: 'id', label: 'תעודת זהות', type: 'text' },
        { name: 'card6Digits', label: '6 ספרות אחרונות', type: 'text' },
        { name: 'password', label: 'סיסמה', type: 'password' }
      ],
      leumi: [
        { name: 'username', label: 'שם משתמש', type: 'text' },
        { name: 'password', label: 'סיסמה', type: 'password' }
      ],
      hapoalim: [
        { name: 'userCode', label: 'קוד משתמש', type: 'text' },
        { name: 'password', label: 'סיסמה', type: 'password' }
      ],
      discount: [
        { name: 'id', label: 'תעודת זהות', type: 'text' },
        { name: 'password', label: 'סיסמה', type: 'password' },
        { name: 'num', label: 'קוד משתמש', type: 'text' }
      ],
      mizrahi: [
        { name: 'username', label: 'שם משתמש', type: 'text' },
        { name: 'password', label: 'סיסמה', type: 'password' }
      ],
      otsar: [
        { name: 'username', label: 'שם משתמש', type: 'text' },
        { name: 'password', label: 'סיסמה', type: 'password' }
      ],
      beinleumi: [
        { name: 'username', label: 'שם משתמש', type: 'text' },
        { name: 'password', label: 'סיסמה', type: 'password' }
      ],
      amex: [
        { name: 'id', label: 'תעודת זהות', type: 'text' },
        { name: 'card6Digits', label: '6 ספרות אחרונות', type: 'text' },
        { name: 'password', label: 'סיסמה', type: 'password' }
      ]
    };
    return fields[companyType] || fields.max;
  }
}

module.exports = Scraper;
