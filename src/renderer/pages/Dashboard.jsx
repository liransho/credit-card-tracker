import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const CATEGORY_COLORS = [
  '#EF4444', // red
  '#F59E0B', // amber
  '#10B981', // green
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime
  '#6366F1', // indigo
];

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (window.electronAPI) {
        const [statsData, transactionsData] = await Promise.all([
          window.electronAPI.transactions.stats(period),
          window.electronAPI.transactions.list({ limit: 10 })
        ]);
        setStats(statsData);
        setRecentTransactions(transactionsData);
      } else {
        // Demo data for development without Electron
        setStats({
          totalSpending: 15420.50,
          byCategory: [
            { category: 'מזון', color: '#EF4444', total: 4500 },
            { category: 'קניות', color: '#F59E0B', total: 3200 },
            { category: 'תחבורה', color: '#3B82F6', total: 2800 },
            { category: 'בילויים', color: '#8B5CF6', total: 2100 },
            { category: 'חשבונות', color: '#10B981', total: 1800 },
            { category: 'אחר', color: '#6B7280', total: 1020.50 }
          ],
          byAccount: [
            { account: 'Max', type: 'max', total: 8500 },
            { account: 'Cal', type: 'cal', total: 4200 },
            { account: 'Isracard', type: 'isracard', total: 2720.50 }
          ],
          dailySpending: [
            { date: '2026-07-01', total: 450 },
            { date: '2026-07-02', total: 320 },
            { date: '2026-07-03', total: 680 },
            { date: '2026-07-04', total: 220 },
            { date: '2026-07-05', total: 890 },
            { date: '2026-07-06', total: 150 },
            { date: '2026-07-07', total: 420 }
          ]
        });
        setRecentTransactions([
          { id: 1, date: '2026-07-19', description: 'סופר יודה', amount: -245.90, category_name: 'מזון', account_name: 'Max' },
          { id: 2, date: '2026-07-18', description: 'דלק פז', amount: -320.00, category_name: 'תחבורה', account_name: 'Cal' },
          { id: 3, date: '2026-07-17', description: 'Amazon', amount: -189.00, category_name: 'קניות', account_name: 'Isracard' }
        ]);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
    setLoading(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS'
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('he-IL');
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1 className="page-title">דשבורד</h1>
        <select
          className="filter-select"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="week">שבוע אחרון</option>
          <option value="month">חודש נוכחי</option>
          <option value="year">שנה נוכחית</option>
        </select>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">סה"כ הוצאות</div>
          <div className="stat-value negative">
            {formatCurrency(stats?.totalSpending || 0)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">מספר עסקאות</div>
          <div className="stat-value">
            {stats?.byCategory?.reduce((sum, c) => sum + (c.count || 0), 0) || 0}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">ממוצע יומי</div>
          <div className="stat-value">
            {formatCurrency((stats?.totalSpending || 0) / 30)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">קטגוריה מובילה</div>
          <div className="stat-value">
            {stats?.byCategory?.[0]?.category || '-'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Spending by Category */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">הוצאות לפי קטגוריה</h2>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={(stats?.byCategory || []).map((c, i) => ({
                    ...c,
                    color: c.color && c.color !== '#6B7280' ? c.color : CATEGORY_COLORS[i % CATEGORY_COLORS.length]
                  }))}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  labelLine={false}
                >
                  {(stats?.byCategory || []).map((entry, index) => (
                    <Cell key={index} fill={entry.color && entry.color !== '#6B7280' ? entry.color : CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px', justifyContent: 'center' }}>
            {(stats?.byCategory || []).slice(0, 6).map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: c.color && c.color !== '#6B7280' ? c.color : CATEGORY_COLORS[i % CATEGORY_COLORS.length]
                }}></span>
                <span>{c.category}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Spending by Card Number */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">הוצאות לפי כרטיס</h2>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(stats?.byCard || []).map(c => ({
                  ...c,
                  label: `*${c.card}`
                }))}
                layout="vertical"
              >
                <XAxis type="number" tickFormatter={(v) => `₪${v}`} />
                <YAxis type="category" dataKey="label" width={80} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="total" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Daily Spending Trend */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">מגמת הוצאות יומית</h2>
        </div>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats?.dailySpending || []}>
              <XAxis dataKey="date" tickFormatter={(d) => new Date(d).getDate()} />
              <YAxis tickFormatter={(v) => `₪${v}`} />
              <Tooltip
                formatter={(value) => formatCurrency(value)}
                labelFormatter={(label) => formatDate(label)}
              />
              <Line type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">עסקאות אחרונות</h2>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>תאריך</th>
                <th>תיאור</th>
                <th>קטגוריה</th>
                <th>כרטיס</th>
                <th>סכום</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((txn) => (
                <tr key={txn.id}>
                  <td>{formatDate(txn.date)}</td>
                  <td>{txn.description}</td>
                  <td>{txn.category_name || txn.original_category || '-'}</td>
                  <td>{txn.account_name}</td>
                  <td className={`amount ${txn.amount < 0 ? 'amount-negative' : 'amount-positive'}`}>
                    {formatCurrency(Math.abs(txn.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
