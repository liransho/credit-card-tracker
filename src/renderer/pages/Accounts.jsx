import React, { useState, useEffect } from 'react';

const CARD_TYPES = [
  { id: 'max', name: 'Max (מקס)' },
  { id: 'cal', name: 'Cal (כאל)' },
  { id: 'isracard', name: 'Isracard (ישראכרט)' },
  { id: 'amex', name: 'American Express' },
  { id: 'leumi', name: 'Bank Leumi (בנק לאומי)' },
  { id: 'hapoalim', name: 'Bank Hapoalim (בנק הפועלים)' },
  { id: 'discount', name: 'Discount Bank (בנק דיסקונט)' }
];

const CREDENTIAL_FIELDS = {
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
  ]
};

function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ type: 'max', name: '', credentials: {} });
  const [scrapeStatus, setScrapeStatus] = useState({});
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  console.log('Accounts component loaded, electronAPI:', !!window.electronAPI);

  useEffect(() => {
    console.log('useEffect running, electronAPI:', window.electronAPI);
    loadAccounts();

    if (window.electronAPI) {
      const cleanup = window.electronAPI.scraper.onStatus((status) => {
        setScrapeStatus((prev) => ({ ...prev, [status.accountId]: status }));
      });
      return cleanup;
    }
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      if (window.electronAPI) {
        const data = await window.electronAPI.accounts.list();
        setAccounts(data);
      } else {
        // Demo data
        setAccounts([
          { id: 1, type: 'max', name: 'Max שלי', last_scrape: '2026-07-19T10:30:00' },
          { id: 2, type: 'cal', name: 'Cal עסקי', last_scrape: '2026-07-18T14:00:00' }
        ]);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
    setLoading(false);
  };

  const handleAddAccount = async () => {
    if (!window.electronAPI) {
      alert('שגיאה: Electron API not available');
      return;
    }

    if (!formData.name) {
      alert('נא להזין שם לחשבון');
      return;
    }

    try {
      console.log('Adding account:', formData.type, formData.name);
      const account = await window.electronAPI.accounts.add({
        type: formData.type,
        name: formData.name
      });
      console.log('Account added:', account);

      console.log('Saving credentials for account:', account.id);
      await window.electronAPI.credentials.save(account.id, formData.credentials);
      console.log('Credentials saved');

      setShowModal(false);
      setFormData({ type: 'max', name: '', credentials: {} });
      setTestResult(null);
      loadAccounts();
    } catch (error) {
      console.error('Failed to add account:', error);
      alert('שגיאה בהוספת החשבון: ' + error.message);
    }
  };

  const handleDeleteAccount = async (accountId) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק חשבון זה?')) return;

    try {
      if (window.electronAPI) {
        await window.electronAPI.accounts.delete(accountId);
      }
      loadAccounts();
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  };

  const handleScrape = async (accountId) => {
    setScrapeStatus((prev) => ({ ...prev, [accountId]: { status: 'running' } }));
    try {
      if (window.electronAPI) {
        await window.electronAPI.scraper.run(accountId);
      }
      loadAccounts();
    } catch (error) {
      console.error('Scrape failed:', error);
      setScrapeStatus((prev) => ({
        ...prev,
        [accountId]: { status: 'error', error: error.message }
      }));
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      if (!window.electronAPI) {
        setTestResult({ success: false, errorMessage: 'Electron API not available - running in browser mode' });
        setTesting(false);
        return;
      }
      const result = await window.electronAPI.scraper.test(formData.type, formData.credentials);
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, errorMessage: error.message });
    }
    setTesting(false);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'לא עודכן';
    return new Date(dateStr).toLocaleString('he-IL');
  };

  const getCardTypeName = (type) => {
    return CARD_TYPES.find((c) => c.id === type)?.name || type;
  };

  const credentialFields = CREDENTIAL_FIELDS[formData.type] || CREDENTIAL_FIELDS.max;

  return (
    <div className="accounts-page">
      <div className="page-header">
        <h1 className="page-title">חשבונות</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + הוסף חשבון
        </button>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : accounts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏦</div>
          <h3>אין חשבונות</h3>
          <p>הוסף את כרטיסי האשראי שלך כדי להתחיל לעקוב אחר ההוצאות</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: '20px' }}>
            הוסף חשבון ראשון
          </button>
        </div>
      ) : (
        <div className="stats-grid">
          {accounts.map((account) => (
            <div key={account.id} className="card">
              <div className="card-header">
                <h3 className="card-title">{account.name}</h3>
                <span className="badge badge-success">{getCardTypeName(account.type)}</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                עדכון אחרון: {formatDate(account.last_scrape)}
              </p>

              {scrapeStatus[account.id]?.status === 'running' && (
                <div className="badge badge-warning" style={{ marginBottom: '16px' }}>
                  מעדכן...
                </div>
              )}

              {scrapeStatus[account.id]?.status === 'error' && (
                <div className="badge badge-danger" style={{ marginBottom: '16px' }}>
                  שגיאה: {scrapeStatus[account.id].error}
                </div>
              )}

              {scrapeStatus[account.id]?.status === 'completed' && (
                <div className="badge badge-success" style={{ marginBottom: '16px' }}>
                  נוספו {scrapeStatus[account.id].newCount} עסקאות חדשות
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleScrape(account.id)}
                  disabled={scrapeStatus[account.id]?.status === 'running'}
                >
                  עדכן עכשיו
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDeleteAccount(account.id)}
                >
                  מחק
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Account Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">הוסף חשבון חדש</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>

            <div className="form-group">
              <label className="form-label">סוג כרטיס</label>
              <select
                className="form-select"
                value={formData.type}
                onChange={(e) => setFormData({
                  ...formData,
                  type: e.target.value,
                  credentials: {}
                })}
              >
                {CARD_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">שם החשבון</label>
              <input
                type="text"
                className="form-input"
                placeholder="לדוגמה: Max האישי שלי"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <hr style={{ margin: '20px 0', borderColor: 'var(--border)' }} />

            <h4 style={{ marginBottom: '16px' }}>פרטי התחברות</h4>

            {credentialFields.map((field) => (
              <div className="form-group" key={field.name}>
                <label className="form-label">{field.label}</label>
                <input
                  type={field.type}
                  className="form-input"
                  value={formData.credentials[field.name] || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    credentials: {
                      ...formData.credentials,
                      [field.name]: e.target.value
                    }
                  })}
                />
              </div>
            ))}

            {testResult && (
              <div className={`badge ${testResult.success ? 'badge-success' : 'badge-danger'}`} style={{ marginBottom: '16px', display: 'block', padding: '12px' }}>
                {testResult.success ? 'התחברות הצליחה!' : `שגיאה: ${testResult.errorMessage || testResult.errorType}`}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                ביטול
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? 'בודק...' : 'בדוק חיבור'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onMouseDown={() => console.log('mousedown')}
                onClick={() => {
                  alert('Button clicked!');
                  console.log('Button clicked, formData:', formData);
                  handleAddAccount();
                }}
              >
                הוסף חשבון (TEST)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Accounts;
