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
            <h1>Admin Dashboard / Control Room</h1>
            <p>Registered shops, subscription health, expiring trials aur user growth ko ek focused control room se track karein.</p>
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
              placeholder="Shop name ya phone number"
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
              <p>Profile details, plan status, trial dates aur subscription alerts ek hi jagah.</p>
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
                            {shop.alerts.trialEndingSoon ? <span className="admin-alert-chip alert-amber">Trial ending within 3 days</span> : null}
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
                      {shop.alerts.trialEndingSoon ? <span className="admin-alert-chip alert-amber">Trial ending within 3 days</span> : null}
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
    </div>
  );
}
