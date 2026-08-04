import React, { useState, useEffect } from 'react';

const MATCH_TYPES = [
  { id: 'description', name: 'תיאור' },
  { id: 'merchant', name: 'בית עסק' },
  { id: 'category', name: 'קטגוריה' }
];

function Settings() {
  const [settings, setSettings] = useState({
    scrapeInterval: '6',
    currency: 'ILS',
    language: 'he'
  });
  const [schedulerStatus, setSchedulerStatus] = useState({
    isRunning: false,
    lastRun: null,
    nextRun: null
  });
  const [tags, setTags] = useState([]);
  const [tagRules, setTagRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    tag_id: '',
    match_type: 'description',
    match_value: '',
    enabled: true
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      if (window.electronAPI) {
        const [settingsData, statusData, tagsData, rulesData] = await Promise.all([
          window.electronAPI.settings.get(),
          window.electronAPI.scheduler.status(),
          window.electronAPI.tags.list(),
          window.electronAPI.tagRules.list()
        ]);
        setSettings(settingsData);
        setSchedulerStatus(statusData);
        setTags(tagsData);
        setTagRules(rulesData);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (window.electronAPI) {
        await window.electronAPI.settings.update(settings);
      }
      alert('ההגדרות נשמרו בהצלחה');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('שגיאה בשמירת ההגדרות');
    }
    setSaving(false);
  };

  const handleSchedulerToggle = async () => {
    try {
      if (window.electronAPI) {
        if (schedulerStatus.isRunning) {
          await window.electronAPI.scheduler.stop();
        } else {
          await window.electronAPI.scheduler.start();
        }
        const status = await window.electronAPI.scheduler.status();
        setSchedulerStatus(status);
      }
    } catch (error) {
      console.error('Failed to toggle scheduler:', error);
    }
  };

  const handleAddRule = async () => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.tagRules.add(newRule);
      }
      setShowRuleModal(false);
      setNewRule({
        name: '',
        tag_id: '',
        match_type: 'description',
        match_value: '',
        enabled: true
      });
      loadSettings();
    } catch (error) {
      console.error('Failed to add rule:', error);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!confirm('האם למחוק כלל זה?')) return;
    try {
      if (window.electronAPI) {
        await window.electronAPI.tagRules.delete(ruleId);
      }
      loadSettings();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const handleApplyRules = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.tagRules.apply();
        alert(`תויגו ${result.taggedCount} עסקאות`);
      }
      loadSettings();
    } catch (error) {
      console.error('Failed to apply rules:', error);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('he-IL');
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1 className="page-title">הגדרות</h1>
      </div>

      {/* Tag Rules */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">כללי תיוג אוטומטי</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleApplyRules}>
              החל כללים על עסקאות קיימות
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowRuleModal(true)}>
              + הוסף כלל
            </button>
          </div>
        </div>

        {tagRules.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>
            אין כללי תיוג. הוסף כלל כדי לתייג עסקאות אוטומטית לפי תיאור, בית עסק או קטגוריה.
          </p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>שם</th>
                  <th>תג</th>
                  <th>סוג התאמה</th>
                  <th>ערך</th>
                  <th>סטטוס</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {tagRules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{rule.name}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: `${rule.tag_color}20`,
                          color: rule.tag_color
                        }}
                      >
                        {rule.tag_name}
                      </span>
                    </td>
                    <td>{MATCH_TYPES.find(m => m.id === rule.match_type)?.name || rule.match_type}</td>
                    <td><code>{rule.match_value}</code></td>
                    <td>
                      <span className={`badge ${rule.enabled ? 'badge-success' : 'badge-warning'}`}>
                        {rule.enabled ? 'פעיל' : 'מושבת'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteRule(rule.id)}
                      >
                        מחק
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Scheduler Settings */}
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: '20px' }}>עדכון אוטומטי</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div className="stat-card">
            <div className="stat-label">סטטוס</div>
            <div className="stat-value" style={{ fontSize: '1.25rem' }}>
              <span className={`badge ${schedulerStatus.isRunning ? 'badge-success' : 'badge-warning'}`}>
                {schedulerStatus.isRunning ? 'פעיל' : 'מושבת'}
              </span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">עדכון הבא</div>
            <div className="stat-value" style={{ fontSize: '1rem' }}>
              {formatDate(schedulerStatus.nextRun)}
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">תדירות עדכון (שעות)</label>
          <select
            className="form-select"
            value={settings.scrapeInterval}
            onChange={(e) => setSettings({ ...settings, scrapeInterval: e.target.value })}
          >
            <option value="1">כל שעה</option>
            <option value="3">כל 3 שעות</option>
            <option value="6">כל 6 שעות</option>
            <option value="12">כל 12 שעות</option>
            <option value="24">פעם ביום</option>
          </select>
        </div>

        <button
          className={`btn ${schedulerStatus.isRunning ? 'btn-danger' : 'btn-primary'}`}
          onClick={handleSchedulerToggle}
        >
          {schedulerStatus.isRunning ? 'עצור עדכון אוטומטי' : 'הפעל עדכון אוטומטי'}
        </button>
      </div>

      {/* Display Settings */}
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: '20px' }}>הגדרות תצוגה</h2>

        <div className="form-group">
          <label className="form-label">מטבע</label>
          <select
            className="form-select"
            value={settings.currency}
            onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
          >
            <option value="ILS">₪ שקל</option>
            <option value="USD">$ דולר</option>
            <option value="EUR">€ אירו</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">שפה</label>
          <select
            className="form-select"
            value={settings.language}
            onChange={(e) => setSettings({ ...settings, language: e.target.value })}
          >
            <option value="he">עברית</option>
            <option value="en">English</option>
          </select>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'שומר...' : 'שמור הגדרות'}
        </button>
      </div>

      {/* About */}
      <div className="card">
        <h2 className="card-title" style={{ marginBottom: '20px' }}>אודות</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Credit Card Tracker v1.0.0
        </p>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
          אפליקציה לניהול ומעקב אחר הוצאות כרטיסי אשראי
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          משתמש ב-israeli-bank-scrapers לשליפת נתונים מ-Max, Cal, Isracard ועוד
        </p>
      </div>

      {/* Add Rule Modal */}
      {showRuleModal && (
        <div className="modal-overlay" onClick={() => setShowRuleModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">הוסף כלל תיוג</h2>
              <button className="modal-close" onClick={() => setShowRuleModal(false)}>&times;</button>
            </div>

            <div className="form-group">
              <label className="form-label">שם הכלל</label>
              <input
                type="text"
                className="form-input"
                placeholder="לדוגמה: וולט = אישי"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">תג</label>
              <select
                className="form-select"
                value={newRule.tag_id}
                onChange={(e) => setNewRule({ ...newRule, tag_id: e.target.value })}
              >
                <option value="">בחר תג...</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>{tag.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">סוג התאמה</label>
              <select
                className="form-select"
                value={newRule.match_type}
                onChange={(e) => setNewRule({ ...newRule, match_type: e.target.value })}
              >
                {MATCH_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">ערך לחיפוש</label>
              <input
                type="text"
                className="form-input"
                placeholder="לדוגמה: wolt"
                value={newRule.match_value}
                onChange={(e) => setNewRule({ ...newRule, match_value: e.target.value })}
              />
              <p style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                הכלל יחפש עסקאות שמכילות את הטקסט הזה (לא רגיש לאותיות גדולות/קטנות)
              </p>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowRuleModal(false)}>
                ביטול
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddRule}
                disabled={!newRule.name || !newRule.tag_id || !newRule.match_value}
              >
                הוסף כלל
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
