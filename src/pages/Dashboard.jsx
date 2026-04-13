import React, { useEffect, useState } from 'react';
import { vendorsApi, milkCollectionApi } from '../api';
import { Users, Milk, Droplets, TrendingUp, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const [stats, setStats] = useState({
    vendors: 0,
    collections: 0,
    totalLiters: 0,
    totalRevenue: 0,
  });
  const [recentCollections, setRecentCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vendorsRes, collectionsRes] = await Promise.all([
        vendorsApi.getAll(),
        milkCollectionApi.getAll(),
      ]);
      const vList = vendorsRes.data || [];
      const cList = collectionsRes.data || [];
      const totalLiters = cList.reduce((s, c) => s + (c.quantity || 0), 0);
      const totalRevenue = cList.reduce((s, c) => s + (c.price || 0), 0);

      setVendors(vList);
      setStats({
        vendors: vList.length,
        collections: cList.length,
        totalLiters,
        totalRevenue,
      });
      // Recent 5 collections
      const sorted = [...cList].sort((a, b) => new Date(b.date) - new Date(a.date));
      setRecentCollections(sorted.slice(0, 6));
    } catch (e) {
      toast.error('Failed to load dashboard data. Is the API running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getVendorName = (id) => {
    const v = vendors.find(v => v.vendor_id === id);
    return v ? v.name : `Vendor #${id}`;
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>Dashboard</h2>
          <p>Welcome to your Milk Management System</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading} id="dashboard-refresh-btn">
          <RefreshCw size={14} className={loading ? 'spin-anim' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Users size={22} /></div>
          <div className="stat-info">
            <h3>{loading ? '—' : stats.vendors}</h3>
            <p>Total Vendors</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon cyan"><Milk size={22} /></div>
          <div className="stat-info">
            <h3>{loading ? '—' : stats.collections}</h3>
            <p>Collections</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Droplets size={22} /></div>
          <div className="stat-info">
            <h3>{loading ? '—' : `${stats.totalLiters}L`}</h3>
            <p>Total Liters</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><TrendingUp size={22} /></div>
          <div className="stat-info">
            <h3>{loading ? '—' : `₹${stats.totalRevenue.toLocaleString()}`}</h3>
            <p>Total Revenue</p>
          </div>
        </div>
      </div>

      {/* Two column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Recent Collections */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header">
            <span className="card-title">Recent Collections</span>
            <span className="badge badge-cyan">{recentCollections.length} records</span>
          </div>
          {loading ? (
            <div className="loading-container" style={{ padding: 40 }}>
              <div className="spinner" />
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading...</p>
            </div>
          ) : recentCollections.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🥛</div>
              <h3>No collections yet</h3>
              <p>Start by adding milk collection records</p>
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Vendor</th>
                    <th>Quantity (L)</th>
                    <th>Amount (₹)</th>
                    <th>Rate/L</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCollections.map((c, i) => (
                    <tr key={c.id}>
                      <td className="td-muted">{i + 1}</td>
                      <td>{c.date}</td>
                      <td>
                        <span className="badge badge-blue">{getVendorName(c.vendor_id)}</span>
                      </td>
                      <td><strong>{c.quantity}</strong></td>
                      <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                        ₹{(c.price || 0).toLocaleString()}
                      </td>
                      <td className="td-muted">
                        {c.quantity > 0 ? `₹${((c.price || 0) / c.quantity).toFixed(1)}/L` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Vendor Quick View */}
      {!loading && vendors.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <span className="card-title">Active Vendors</span>
            <span className="badge badge-blue">{vendors.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, padding: 20 }}>
            {vendors.map(v => (
              <div key={v.id} style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0,
                  }}>
                    {v.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{v.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v.milk_type}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  📍 {v.address} • Cap: {v.capacity}L
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`.spin-anim { animation: spin 0.8s linear infinite; }`}</style>
    </div>
  );
}
