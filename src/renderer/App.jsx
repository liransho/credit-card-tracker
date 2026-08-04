import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Accounts from './pages/Accounts';
import Settings from './pages/Settings';
import Alerts from './pages/Alerts';

function App() {
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (window.electronAPI) {
      const cleanup = window.electronAPI.onNotification((data) => {
        setNotification(data);
        setTimeout(() => setNotification(null), 5000);
      });
      return cleanup;
    }
  }, []);

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="logo">
          <h1>Credit Tracker</h1>
        </div>
        <ul className="nav-links">
          <li>
            <NavLink to="/" end>
              <span className="icon">📊</span>
              <span>דשבורד</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/transactions">
              <span className="icon">💳</span>
              <span>עסקאות</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/accounts">
              <span className="icon">🏦</span>
              <span>חשבונות</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/alerts">
              <span className="icon">🔔</span>
              <span>התראות</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/settings">
              <span className="icon">⚙️</span>
              <span>הגדרות</span>
            </NavLink>
          </li>
        </ul>
      </nav>

      <main className="content">
        {notification && (
          <div className="notification">
            <strong>{notification.title}</strong>
            <p>{notification.body}</p>
          </div>
        )}

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
