import React, { useState, useEffect, useMemo } from 'react';

function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    categoryId: '',
    accountId: '',
    cardNumber: '',
    startDate: '',
    endDate: ''
  });
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [bulkTagId, setBulkTagId] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (window.electronAPI) {
        const [txnData, catData, tagData] = await Promise.all([
          window.electronAPI.transactions.list(filters),
          window.electronAPI.categories.list(),
          window.electronAPI.tags.list()
        ]);
        setTransactions(txnData);
        setCategories(catData);
        setTags(tagData);
      } else {
        // Demo data
        setTransactions([
          { id: 1, date: '2026-07-19', description: 'סופר יודה', amount: -245.90, original_category: 'מזון', account_name: 'Max', category_color: '#EF4444' },
          { id: 2, date: '2026-07-18', description: 'דלק פז', amount: -320.00, original_category: 'תחבורה', account_name: 'Cal', category_color: '#3B82F6' },
        ]);
        setCategories([]);
        setTags([
          { id: 1, name: 'אישי', color: '#3B82F6' },
          { id: 2, name: 'בית', color: '#10B981' },
        ]);
      }
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
    setLoading(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS'
    }).format(Math.abs(amount));
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('he-IL');
  };

  const handleUpdateCategory = async (transactionId, categoryId) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.transactions.update({
          id: transactionId,
          user_category_id: categoryId
        });
      }
      loadData();
    } catch (error) {
      console.error('Failed to update transaction:', error);
    }
  };

  const handleSearch = (e) => {
    setFilters({ ...filters, search: e.target.value });
  };

  const handleSelectRow = (id) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const handleBulkTag = async () => {
    if (!bulkTagId || selectedRows.size === 0) return;

    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.transactions.bulkUpdateTag(
          Array.from(selectedRows),
          bulkTagId === 'none' ? null : parseInt(bulkTagId)
        );
        console.log('Bulk tag result:', result);
      }
      setSelectedRows(new Set());
      setBulkTagId('');
      loadData();
    } catch (error) {
      console.error('Failed to bulk tag:', error);
    }
  };

  const uniqueCardNumbers = useMemo(() => {
    const cards = transactions
      .map(t => t.card_number)
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
    return cards.sort();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    if (filters.cardNumber) {
      result = result.filter(t => t.card_number === filters.cardNumber);
    }

    return result;
  }, [transactions, filters.cardNumber]);

  const sortedTransactions = useMemo(() => {
    const sorted = [...filteredTransactions];

    sorted.sort((a, b) => {
      let aVal, bVal;

      switch (sortConfig.key) {
        case 'date':
          aVal = new Date(a.date).getTime();
          bVal = new Date(b.date).getTime();
          break;
        case 'description':
          aVal = a.description || '';
          bVal = b.description || '';
          break;
        case 'category':
          aVal = a.category_name || a.original_category || '';
          bVal = b.category_name || b.original_category || '';
          break;
        case 'card_number':
          aVal = a.card_number || '';
          bVal = b.card_number || '';
          break;
        case 'card_holder_name':
          aVal = a.card_holder_name || '';
          bVal = b.card_holder_name || '';
          break;
        case 'amount':
          aVal = a.amount;
          bVal = b.amount;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string') {
        const comparison = aVal.localeCompare(bVal, 'he');
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      if (sortConfig.direction === 'asc') {
        return aVal - bVal;
      }
      return bVal - aVal;
    });

    return sorted;
  }, [filteredTransactions, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRows(new Set(sortedTransactions.map(t => t.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const SortIndicator = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <span style={{ opacity: 0.3, marginRight: '4px' }}>↕</span>;
    }
    return (
      <span style={{ marginRight: '4px' }}>
        {sortConfig.direction === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  return (
    <div className="transactions-page">
      <div className="page-header">
        <h1 className="page-title">עסקאות</h1>
        <input
          type="text"
          className="search-input"
          placeholder="חיפוש עסקאות..."
          value={filters.search}
          onChange={handleSearch}
        />
      </div>

      <div className="filters">
        <input
          type="date"
          className="filter-select"
          value={filters.startDate}
          onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          placeholder="מתאריך"
        />
        <input
          type="date"
          className="filter-select"
          value={filters.endDate}
          onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          placeholder="עד תאריך"
        />
        <select
          className="filter-select"
          value={filters.categoryId}
          onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
        >
          <option value="">כל הקטגוריות</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <select
          className="filter-select"
          value={filters.cardNumber}
          onChange={(e) => setFilters({ ...filters, cardNumber: e.target.value })}
        >
          <option value="">כל הכרטיסים</option>
          {uniqueCardNumbers.map((card) => (
            <option key={card} value={card}>*{card}</option>
          ))}
        </select>
        <button className="btn btn-secondary" onClick={() => setFilters({
          search: '',
          categoryId: '',
          accountId: '',
          cardNumber: '',
          startDate: '',
          endDate: ''
        })}>
          נקה מסננים
        </button>
      </div>

      {/* Bulk actions bar */}
      {selectedRows.size > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          background: 'var(--primary)',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          <span style={{ color: 'white', fontWeight: '500' }}>
            {selectedRows.size} עסקאות נבחרו
          </span>
          <select
            className="filter-select"
            value={bulkTagId}
            onChange={(e) => setBulkTagId(e.target.value)}
            style={{ background: 'white', color: 'black' }}
          >
            <option value="">בחר תג...</option>
            <option value="none">ללא תג</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </select>
          <button
            className="btn"
            style={{ background: 'white', color: 'var(--primary)' }}
            onClick={handleBulkTag}
            disabled={!bulkTagId}
          >
            החל תג
          </button>
          <button
            className="btn"
            style={{ background: 'transparent', color: 'white', border: '1px solid white' }}
            onClick={() => setSelectedRows(new Set())}
          >
            בטל בחירה
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      ) : sortedTransactions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <h3>אין עסקאות</h3>
          <p>הוסף חשבון כרטיס אשראי כדי להתחיל לעקוב אחר ההוצאות שלך</p>
        </div>
      ) : (
        <div className="card">
          {/* Summary stats */}
          <div style={{ display: 'flex', gap: '24px', marginBottom: '20px', padding: '16px', background: 'var(--bg-darker)', borderRadius: '8px' }}>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>סה"כ עסקאות: </span>
              <strong>{sortedTransactions.length}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>סה"כ הוצאות: </span>
              <strong className="amount-negative">
                {formatCurrency(sortedTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0))}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>סה"כ הכנסות: </span>
              <strong className="amount-positive">
                {formatCurrency(sortedTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0))}
              </strong>
            </div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={selectedRows.size === sortedTransactions.length && sortedTransactions.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th onClick={() => handleSort('date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <SortIndicator columnKey="date" />תאריך
                  </th>
                  <th>שעה</th>
                  <th onClick={() => handleSort('description')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <SortIndicator columnKey="description" />תיאור
                  </th>
                  <th onClick={() => handleSort('category')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <SortIndicator columnKey="category" />קטגוריה
                  </th>
                  <th>תווית Max</th>
                  <th>תג</th>
                  <th onClick={() => handleSort('card_holder_name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <SortIndicator columnKey="card_holder_name" />שם בעל הכרטיס
                  </th>
                  <th onClick={() => handleSort('card_number')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <SortIndicator columnKey="card_number" />כרטיס
                  </th>
                  <th onClick={() => handleSort('amount')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <SortIndicator columnKey="amount" />סכום
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.map((txn) => (
                  <tr key={txn.id} style={{ background: selectedRows.has(txn.id) ? 'rgba(59, 130, 246, 0.1)' : undefined }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedRows.has(txn.id)}
                        onChange={() => handleSelectRow(txn.id)}
                      />
                    </td>
                    <td>{formatDate(txn.date)}</td>
                    <td>{txn.purchase_time || '-'}</td>
                    <td>{txn.description}</td>
                    <td>
                      <span
                        className="category-dot"
                        style={{ backgroundColor: txn.category_color || '#6B7280' }}
                      ></span>
                      {txn.category_name || txn.original_category || 'לא מסווג'}
                    </td>
                    <td>
                      {txn.max_label ? (
                        <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B' }}>
                          {txn.max_label}
                        </span>
                      ) : '-'}
                    </td>
                    <td>
                      {txn.tag_name ? (
                        <span
                          className="badge"
                          style={{
                            background: `${txn.tag_color}20`,
                            color: txn.tag_color
                          }}
                        >
                          {txn.tag_name}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>-</span>
                      )}
                    </td>
                    <td>{txn.card_holder_name || '-'}</td>
                    <td>{txn.card_number ? `*${txn.card_number}` : '-'}</td>
                    <td className={`amount ${txn.amount < 0 ? 'amount-negative' : 'amount-positive'}`}>
                      {formatCurrency(txn.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Transactions;
