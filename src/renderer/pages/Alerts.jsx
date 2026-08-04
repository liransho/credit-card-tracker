import React, { useState, useEffect } from 'react';

const RULE_TYPES = [
  { id: 'amount', name: 'סכום', description: 'התרעה כאשר סכום העסקה עובר ערך מסוים' },
  { id: 'merchant', name: 'בית עסק', description: 'התרעה על עסקאות מבתי עסק ספציפיים' },
  { id: 'keyword', name: 'מילת מפתח', description: 'התרעה על עסקאות המכילות מילים מסוימות' }
];

const AMOUNT_OPERATORS = [
  { id: 'gt', name: 'גדול מ-' },
  { id: 'gte', name: 'גדול או שווה ל-' },
  { id: 'lt', name: 'קטן מ-' },
  { id: 'eq', name: 'שווה ל-' }
];

function Alerts() {
  const [rules, setRules] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('rules');
  const [formData, setFormData] = useState({
    name: '',
    type: 'amount',
    condition: {},
    enabled: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      if (window.electronAPI) {
        const [rulesData, historyData] = await Promise.all([
          window.electronAPI.alerts.list(),
          window.electronAPI.alerts.history()
        ]);
        setRules(rulesData);
        setHistory(historyData);
      } else {
        // Demo data
        setRules([
          { id: 1, name: 'עסקה גדולה', type: 'amount', condition: '{"operator":"gt","value":1000}', enabled: true },
          { id: 2, name: 'Amazon', type: 'merchant', condition: '{"merchants":["amazon","אמזון"]}', enabled: true }
        ]);
        setHistory([
          { id: 1, title: 'עסקה גדולה', body: 'רכישה בזארא - ₪1,250', triggered_at: '2026-07-19T10:30:00' },
          { id: 2, title: 'Amazon', body: 'Amazon - ₪189.00', triggered_at: '2026-07-17T15:45:00' }
        ]);
      }
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
    setLoading(false);
  };

  const handleAddRule = async () => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.alerts.add({
          name: formData.name,
          type: formData.type,
          condition: formData.condition,
          enabled: formData.enabled
        });
      }
      setShowModal(false);
      setFormData({ name: '', type: 'amount', condition: {}, enabled: true });
      loadData();
    } catch (error) {
      console.error('Failed to add rule:', error);
    }
  };

  const handleToggleRule = async (rule) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.alerts.update({
          ...rule,
          enabled: !rule.enabled
        });
      }
      loadData();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק התראה זו?')) return;
    try {
      if (window.electronAPI) {
        await window.electronAPI.alerts.delete(ruleId);
      }
      loadData();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('he-IL');
  };

  const parseCondition = (conditionStr) => {
    try {
      return JSON.parse(conditionStr);
    } catch {
      return {};
    }
  };

  const formatCondition = (rule) => {
    const condition = parseCondition(rule.condition);

    switch (rule.type) {
      case 'amount':
        const op = AMOUNT_OPERATORS.find((o) => o.id === condition.operator);
        return `${op?.name || condition.operator} ₪${condition.value}`;
      case 'merchant':
        return (condition.merchants || []).join(', ');
      case 'keyword':
        return (condition.keywords || []).join(', ');
      default:
        return JSON.stringify(condition);
    }
  };

  const renderConditionForm = () => {
    switch (formData.type) {
      case 'amount':
        return (
          <>
            <div className="form-group">
              <label className="form-label">תנאי</label>
              <select
                className="form-select"
                value={formData.condition.operator || 'gt'}
                onChange={(e) => setFormData({
                  ...formData,
                  condition: { ...formData.condition, operator: e.target.value }
                })}
              >
                {AMOUNT_OPERATORS.map((op) => (
                  <option key={op.id} value={op.id}>{op.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">סכום (₪)</label>
              <input
                type="number"
                className="form-input"
                value={formData.condition.value || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  condition: { ...formData.condition, value: parseFloat(e.target.value) }
                })}
              />
            </div>
          </>
        );
      case 'merchant':
        return (
          <div className="form-group">
            <label className="form-label">בתי עסק (מופרדים בפסיק)</label>
            <input
              type="text"
              className="form-input"
              placeholder="אמזון, עלי אקספרס, eBay"
              value={(formData.condition.merchants || []).join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                condition: {
                  merchants: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                }
              })}
            />
          </div>
        );
      case 'keyword':
        return (
          <div className="form-group">
            <label className="form-label">מילות מפתח (מופרדות בפסיק)</label>
            <input
              type="text"
              className="form-input"
              placeholder="מנוי, משיכה, העברה"
              value={(formData.condition.keywords || []).join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                condition: {
                  keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                }
              })}
            />
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="alerts-page">
      <div className="page-header">
        <h1 className="page-title">התראות</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + הוסף התראה
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          className={`btn ${activeTab === 'rules' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('rules')}
        >
          חוקי התראה
        </button>
        <button
          className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('history')}
        >
          היסטוריה
        </button>
      </div>

      {activeTab === 'rules' && (
        <div className="card">
          {rules.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔔</div>
              <h3>אין חוקי התראה</h3>
              <p>הוסף התראה כדי לקבל עדכון על עסקאות חשובות</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>שם</th>
                    <th>סוג</th>
                    <th>תנאי</th>
                    <th>סטטוס</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id}>
                      <td>{rule.name}</td>
                      <td>{RULE_TYPES.find((t) => t.id === rule.type)?.name || rule.type}</td>
                      <td>{formatCondition(rule)}</td>
                      <td>
                        <span className={`badge ${rule.enabled ? 'badge-success' : 'badge-warning'}`}>
                          {rule.enabled ? 'פעיל' : 'מושבת'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleToggleRule(rule)}
                          >
                            {rule.enabled ? 'השבת' : 'הפעל'}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteRule(rule.id)}
                          >
                            מחק
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card">
          {history.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <h3>אין היסטוריית התראות</h3>
              <p>התראות שיופעלו יופיעו כאן</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>תאריך</th>
                    <th>התראה</th>
                    <th>פרטים</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((alert) => (
                    <tr key={alert.id}>
                      <td>{formatDate(alert.triggered_at)}</td>
                      <td>{alert.title}</td>
                      <td>{alert.body}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Rule Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">הוסף חוק התראה</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>

            <div className="form-group">
              <label className="form-label">שם ההתראה</label>
              <input
                type="text"
                className="form-input"
                placeholder="לדוגמה: עסקה גדולה"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">סוג</label>
              <select
                className="form-select"
                value={formData.type}
                onChange={(e) => setFormData({
                  ...formData,
                  type: e.target.value,
                  condition: {}
                })}
              >
                {RULE_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
              <p style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {RULE_TYPES.find((t) => t.id === formData.type)?.description}
              </p>
            </div>

            {renderConditionForm()}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                ביטול
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddRule}
                disabled={!formData.name}
              >
                הוסף התראה
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Alerts;
