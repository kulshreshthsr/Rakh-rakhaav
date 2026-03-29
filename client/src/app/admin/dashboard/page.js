'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function metricCards(stats) {
  return [
    { key: 'totalUsers', label: 'Total Users', value: stats.totalUsers || 0, tone: 'blue' },
    { key: 'activeSubscriptions', label: 'Active Subscriptions', value: stats.activeSubscriptions || 0, tone: 'green' },
    { key: 'trialUsers', label: 'Trial Users', value: stats.trialUsers || 0, tone: 'amber' },
    { key: 'expiredUsers', label: 'Expired Users', value: stats.expiredUsers || 0, tone: 'red' },
  ];
}

function rowClassName(shop) {
  if (shop.highlight === 'expired') return 'is-expired';
  if (shop.highlight === 'trial-ending') return 'is-warning';
  if (shop.highlight === 'active') return 'is-active';
  return '';
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({});
  const [shops, setShops] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams();
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
        if (search.trim()) params.set('search', search.trim());

        const [statsResponse, shopsResponse] = await Promise.all([
          fetch('/api/admin/stats', { cache: 'no-store' }),
          fetch(`/api/admin/shops?${params.toString()}`, { cache: 'no-store' }),
        ]);

        if (statsResponse.status === 401 || shopsResponse.status === 401) {
          router.push('/admin/login');
          return;
        }

        const statsData = await statsResponse.json();
        const shopsData = await shopsResponse.json();

        if (!statsResponse.ok) {
          throw new Error(statsData.message || 'Unable to load admin stats.');
        }
        if (!shopsResponse.ok) {
          throw new Error(shopsData.message || 'Unable to load shop list.');
        }

        setStats(statsData);
        setShops(shopsData.shops || []);
      } catch (fetchError) {
        setError(fetchError.message || 'Unable to load dashboard right now.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [router, search, statusFilter]);

  const cards = useMemo(() => metricCards(stats), [stats]);

  const refreshDashboard = async () => {
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
    if (search.trim()) params.set('search', search.trim());

    const [statsResponse, shopsResponse] = await Promise.all([
      fetch('/api/admin/stats', { cache: 'no-store' }),
      fetch(`/api/admin/shops?${params.toString()}`, { cache: 'no-store' }),
    ]);

    if (statsResponse.status === 401 || shopsResponse.status === 401) {
      router.push('/admin/login');
      return;
    }

    const statsData = await statsResponse.json();
    const shopsData = await shopsResponse.json();

    if (!statsResponse.ok) throw new Error(statsData.message || 'Unable to load admin stats.');
    if (!shopsResponse.ok) throw new Error(shopsData.message || 'Unable to load shop list.');

    setStats(statsData);
    setShops(shopsData.shops || []);
  };

  const handleDeleteUser = async (shop) => {
    const confirmed = window.confirm(`Remove ${shop.shopName} and all linked user data? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(shop.id);
    setError('');
    try {
      const response = await fetch(`/api/admin/shops/${shop.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to remove user.');
      await refreshDashboard();
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to remove user.');
    } finally {
      setDeletingId('');
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <div className="admin-page">
      <div className="admin-shell">
        <header className="admin-header">
          <div>
            <div className="admin-kicker">Secure Owner Console</div>
            <h1>Admin Dashboard</h1>
            <p>Track registered shops, subscription health, expiring trials and user growth from one focused control room.</p>
          </div>

          <button type="button" className="admin-logout-btn" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? 'Signing out...' : 'Logout'}
          </button>
        </header>

        <section className="admin-stats-grid">
          {cards.map((card) => (
            <article key={card.key} className={`admin-stat-card ${card.tone}`}>
              <div className="admin-stat-label">{card.label}</div>
              <div className="admin-stat-value">{card.value}</div>
            </article>
          ))}
        </section>

        <section className="admin-toolbar">
          <div className="admin-search-box">
            <span>Search</span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Shop name or phone number"
            />
          </div>

          <div className="admin-filter-group">
            <button type="button" className={statusFilter === 'all' ? 'is-active' : ''} onClick={() => setStatusFilter('all')}>All</button>
            <button type="button" className={statusFilter === 'trial' ? 'is-active' : ''} onClick={() => setStatusFilter('trial')}>Trial</button>
            <button type="button" className={statusFilter === 'active' ? 'is-active' : ''} onClick={() => setStatusFilter('active')}>Active</button>
            <button type="button" className={statusFilter === 'expired' ? 'is-active' : ''} onClick={() => setStatusFilter('expired')}>Expired</button>
          </div>
        </section>

        {error ? <div className="admin-error-banner">{error}</div> : null}

        <section className="admin-table-card">
          <div className="admin-table-head">
            <div>
              <h2>Registered Shops</h2>
              <p>Profile details, plan status, trial dates, and subscription alerts in one place.</p>
            </div>
            <div className="admin-table-count">{shops.length} shops</div>
          </div>

          {loading ? (
            <div className="admin-loading-grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="admin-loading-row" />
              ))}
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Shop</th>
                    <th>Owner</th>
                    <th>Phone</th>
                    <th>GSTIN</th>
                    <th>Address</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Trial</th>
                    <th>Subscription</th>
                    <th>Alerts</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shops.length === 0 ? (
                    <tr>
                      <td colSpan="11">
                        <div className="admin-empty-state">No shops matched the current filter.</div>
                      </td>
                    </tr>
                  ) : (
                    shops.map((shop) => (
                      <tr key={shop.id} className={rowClassName(shop)}>
                        <td>
                          <div className="shop-primary">{shop.shopName}</div>
                        </td>
                        <td>{shop.ownerName || '-'}</td>
                        <td>{shop.phoneNumber || '-'}</td>
                        <td>{shop.gstin || '-'}</td>
                        <td className="admin-address-cell">{shop.shopAddress || '-'}</td>
                        <td>
                          <span className="admin-plan-pill">{shop.subscriptionPlanLabel}</span>
                        </td>
                        <td>
                          <span className={`admin-status-pill status-${shop.subscriptionStatus}`}>{shop.subscriptionStatus}</span>
                        </td>
                        <td>
                          <div>{formatDate(shop.trial.startDate)}</div>
                          <div className="admin-subline">{formatDate(shop.trial.endDate)}</div>
                          <div className="admin-subline">{shop.trial.daysRemaining} days left</div>
                        </td>
                        <td>
                          <div>{formatDate(shop.subscription.startDate)}</div>
                          <div className="admin-subline">{formatDate(shop.subscription.endDate)}</div>
                          <div className="admin-subline">{shop.subscription.daysRemaining} days left</div>
                        </td>
                        <td>
                          <div className="admin-alert-stack">
                            {shop.alerts.expired ? <span className="admin-alert-chip alert-red">Expired</span> : null}
                            {shop.alerts.trialEndingSoon ? <span className="admin-alert-chip alert-amber">Trial ending in 3 days</span> : null}
                            {shop.alerts.highValueCustomer ? <span className="admin-alert-chip alert-green">High value</span> : null}
                            {!shop.alerts.expired && !shop.alerts.trialEndingSoon && !shop.alerts.highValueCustomer ? (
                              <span className="admin-alert-chip alert-neutral">Stable</span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="admin-delete-btn"
                            onClick={() => handleDeleteUser(shop)}
                            disabled={deletingId === shop.id}
                          >
                            {deletingId === shop.id ? 'Removing...' : 'Remove User'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!loading ? (
            <div className="admin-mobile-list">
              {shops.length === 0 ? (
                <div className="admin-empty-state">No shops matched the current filter.</div>
              ) : (
                shops.map((shop) => (
                  <article key={shop.id} className={`admin-mobile-card ${rowClassName(shop)}`}>
                    <div className="admin-mobile-top">
                      <div>
                        <div className="shop-primary">{shop.shopName}</div>
                        <div className="admin-subline">{shop.ownerName || '-'}</div>
                      </div>
                      <span className={`admin-status-pill status-${shop.subscriptionStatus}`}>{shop.subscriptionStatus}</span>
                    </div>

                    <div className="admin-mobile-grid">
                      <div><strong>Phone</strong><span>{shop.phoneNumber || '-'}</span></div>
                      <div><strong>Plan</strong><span>{shop.subscriptionPlanLabel}</span></div>
                      <div><strong>Trial</strong><span>{shop.trial.daysRemaining} days</span></div>
                      <div><strong>Subscription</strong><span>{shop.subscription.daysRemaining} days</span></div>
                    </div>

                    <div className="admin-subline">{shop.gstin || 'No GSTIN'}</div>
                    <div className="admin-subline">{shop.shopAddress || 'No address added'}</div>

                    <div className="admin-alert-stack">
                      {shop.alerts.expired ? <span className="admin-alert-chip alert-red">Expired</span> : null}
                      {shop.alerts.trialEndingSoon ? <span className="admin-alert-chip alert-amber">Trial ending in 3 days</span> : null}
                      {shop.alerts.highValueCustomer ? <span className="admin-alert-chip alert-green">High value</span> : null}
                      {!shop.alerts.expired && !shop.alerts.trialEndingSoon && !shop.alerts.highValueCustomer ? (
                        <span className="admin-alert-chip alert-neutral">Stable</span>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      className="admin-delete-btn"
                      onClick={() => handleDeleteUser(shop)}
                      disabled={deletingId === shop.id}
                    >
                      {deletingId === shop.id ? 'Removing...' : 'Remove User'}
                    </button>
                  </article>
                ))
              )}
            </div>
          ) : null}
        </section>
      </div>

      <style>{`
        .admin-page {
          min-height: 100vh;
          background: #f8fafc;
          padding: 24px;
        }

        .admin-shell {
          width: min(1400px, 100%);
          margin: 0 auto;
          display: grid;
          gap: 18px;
        }

        .admin-header,
        .admin-table-card,
        .admin-toolbar,
        .admin-stat-card {
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          background: #ffffff;
          box-shadow: 0 14px 40px rgba(15, 23, 42, 0.06);
        }

        .admin-header {
          padding: 28px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          background: #0f172a;
        }

        .admin-kicker {
          font-size: 12px;
          font-weight: 800;
          color: rgba(255,255,255,0.72);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .admin-header h1 {
          margin: 10px 0 10px;
          font-size: clamp(34px, 5vw, 48px);
          line-height: 1;
          letter-spacing: -0.06em;
          color: #ffffff;
        }

        .admin-header p {
          margin: 0;
          max-width: 720px;
          color: rgba(255,255,255,0.8);
          line-height: 1.7;
        }

        .admin-logout-btn {
          min-height: 50px;
          padding: 0 18px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.16);
          background: rgba(255,255,255,0.08);
          color: #ffffff;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
        }

        .admin-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .admin-stat-card {
          padding: 22px 22px 22px 26px;
          position: relative;
          overflow: hidden;
        }

        .admin-stat-card::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          border-radius: 20px 0 0 20px;
          background: #3730a3;
        }

        .admin-stat-card.blue::before { background: #3730a3; }
        .admin-stat-card.green::before { background: #16a34a; }
        .admin-stat-card.amber::before { background: #d97706; }
        .admin-stat-card.red::before { background: #dc2626; }

        .admin-stat-label {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .admin-stat-value {
          margin-top: 10px;
          font-size: 40px;
          line-height: 1;
          font-weight: 900;
          color: #3730a3;
          letter-spacing: -0.05em;
        }

        .admin-stat-card.green .admin-stat-value { color: #16a34a; }
        .admin-stat-card.amber .admin-stat-value { color: #d97706; }
        .admin-stat-card.red .admin-stat-value { color: #dc2626; }

        .admin-toolbar {
          padding: 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .admin-search-box {
          flex: 1;
          min-width: min(320px, 100%);
          display: grid;
          gap: 8px;
        }

        .admin-search-box span {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #475569;
        }

        .admin-search-box input {
          min-height: 52px;
          border-radius: 16px;
          border: 1px solid #cbd5e1;
          background: white;
          padding: 0 16px;
          outline: none;
          font-size: 15px;
        }

        .admin-search-box input:focus {
          border-color: #3730a3;
          box-shadow: 0 0 0 4px rgba(55, 48, 163, 0.12);
        }

        .admin-filter-group {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .admin-filter-group button {
          min-height: 48px;
          padding: 0 16px;
          border-radius: 14px;
          border: 1px solid #cbd5e1;
          background: white;
          color: #475569;
          font-weight: 800;
          cursor: pointer;
        }

        .admin-filter-group button.is-active {
          background: #3730a3;
          color: white;
          border-color: #3730a3;
        }

        .admin-error-banner {
          padding: 14px 16px;
          border-radius: 18px;
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #b91c1c;
          font-weight: 700;
        }

        .admin-table-card {
          padding: 20px;
        }

        .admin-table-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }

        .admin-table-head h2 {
          margin: 0;
          font-size: 24px;
          color: #0f172a;
        }

        .admin-table-head p {
          margin: 8px 0 0;
          color: #64748b;
        }

        .admin-table-count {
          padding: 10px 14px;
          border-radius: 999px;
          background: #eef2ff;
          color: #3730a3;
          font-weight: 800;
          white-space: nowrap;
        }

        .admin-table-wrap {
          overflow-x: auto;
        }

        .admin-mobile-list {
          display: none;
        }

        .admin-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0 10px;
          min-width: 1180px;
        }

        .admin-table th {
          padding: 0 14px 8px;
          text-align: left;
          font-size: 12px;
          color: #64748b;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .admin-table td {
          padding: 16px 14px;
          background: #ffffff;
          border-top: 1px solid #edf2f7;
          border-bottom: 1px solid #edf2f7;
          vertical-align: top;
          color: #0f172a;
        }

        .admin-table tbody tr td:first-child {
          border-left: 1px solid #edf2f7;
          border-radius: 18px 0 0 18px;
        }

        .admin-table tbody tr td:last-child {
          border-right: 1px solid #edf2f7;
          border-radius: 0 18px 18px 0;
        }

        .admin-table tbody tr.is-expired td {
          background: rgba(220, 38, 38, 0.04);
        }

        .admin-table tbody tr.is-warning td {
          background: rgba(217, 119, 6, 0.05);
        }

        .admin-table tbody tr.is-active td {
          background: rgba(22, 163, 74, 0.04);
        }

        .shop-primary {
          font-weight: 800;
          font-size: 15px;
        }

        .admin-address-cell {
          max-width: 240px;
          line-height: 1.6;
          color: #475569;
        }

        .admin-plan-pill,
        .admin-status-pill,
        .admin-alert-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 7px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .admin-plan-pill {
          background: #eef2ff;
          color: #3730a3;
        }

        .admin-status-pill.status-active {
          background: rgba(22, 163, 74, 0.12);
          color: #166534;
        }

        .admin-status-pill.status-trial {
          background: rgba(217, 119, 6, 0.14);
          color: #b45309;
        }

        .admin-status-pill.status-expired {
          background: rgba(220, 38, 38, 0.12);
          color: #b91c1c;
        }

        .admin-subline {
          margin-top: 4px;
          color: #64748b;
          font-size: 12px;
        }

        .admin-alert-stack {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .admin-delete-btn {
          min-height: 42px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1px solid rgba(55, 48, 163, 0.18);
          background: #ffffff;
          color: #3730a3;
          font-weight: 800;
          cursor: pointer;
        }

        .alert-red {
          background: rgba(220, 38, 38, 0.12);
          color: #b91c1c;
        }

        .alert-amber {
          background: rgba(217, 119, 6, 0.14);
          color: #b45309;
        }

        .alert-green {
          background: rgba(22, 163, 74, 0.12);
          color: #166534;
        }

        .alert-neutral {
          background: #e2e8f0;
          color: #334155;
        }

        .admin-loading-grid {
          display: grid;
          gap: 10px;
        }

        .admin-loading-row {
          height: 68px;
          border-radius: 18px;
          background: linear-gradient(90deg, #e2e8f0, #f8fafc, #e2e8f0);
          background-size: 220% 100%;
          animation: admin-shimmer 1.2s linear infinite;
        }

        .admin-empty-state {
          padding: 28px 0;
          text-align: center;
          color: #64748b;
          font-weight: 700;
        }

        @keyframes admin-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        @media (max-width: 1100px) {
          .admin-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .admin-page {
            padding: 14px;
          }

          .admin-header,
          .admin-table-card,
          .admin-toolbar {
            padding: 18px;
          }

          .admin-header {
            flex-direction: column;
          }

          .admin-stats-grid {
            grid-template-columns: 1fr;
          }

          .admin-search-box {
            min-width: 100%;
          }

          .admin-table-wrap {
            display: none;
          }

          .admin-mobile-list {
            display: grid;
            gap: 12px;
          }

          .admin-mobile-card {
            border: 1px solid #e2e8f0;
            border-radius: 18px;
            padding: 16px;
            background: #fff;
            display: grid;
            gap: 10px;
          }

          .admin-mobile-card.is-expired {
            background: rgba(220, 38, 38, 0.04);
          }

          .admin-mobile-card.is-warning {
            background: rgba(217, 119, 6, 0.05);
          }

          .admin-mobile-card.is-active {
            background: rgba(22, 163, 74, 0.04);
          }

          .admin-mobile-top {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: flex-start;
          }

          .admin-mobile-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .admin-mobile-grid strong {
            display: block;
            font-size: 11px;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 2px;
          }

          .admin-mobile-grid span {
            color: #0f172a;
            font-weight: 700;
            font-size: 13px;
          }
        }
      `}</style>
    </div>
  );
}
