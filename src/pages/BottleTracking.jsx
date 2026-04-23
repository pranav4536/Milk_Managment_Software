import React, { useState, useEffect } from 'react';
import { customersApi, deliveriesApi } from '../api';
import {
  Plus, RefreshCw, X, Package, AlertTriangle, CheckCircle, List, Search
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function BottleTracking() {
  const [customers, setCustomers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ customer_id: '', date: new Date().toISOString().split('T')[0], bottles_given: 0, bottles_returned: 0, notes: 'Bottle Update' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [viewDetailsCustomer, setViewDetailsCustomer] = useState(null);
  const [search, setSearch] = useState('');
  const [showPendingOnly, setShowPendingOnly] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Fetch 5000 deliveries to ensure we have all history for calculations
      const [cusRes, delRes] = await Promise.all([
        customersApi.getAll(),
        deliveriesApi.getAll(0, 5000),
      ]);
      setCustomers(cusRes.data || []);
      setDeliveries(delRes.data || []);
    } catch {
      toast.error('Failed to load bottle data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const getCustomerName = (id) => {
    const c = customers.find(c => (c.customer_id || c.id) === id);
    return c ? c.name : `Customer #${id}`;
  };

  // Calculate Aggregations directly from Deliveries
  const aggregatedData = customers.map(c => {
    const cid = c.customer_id || c.id;
    const customerDels = deliveries.filter(d => d.customer_id === cid);
    const total_given = customerDels.reduce((s, d) => s + (d.bottles_given || 0), 0);
    const total_returned = customerDels.reduce((s, d) => s + (d.bottles_returned || 0), 0);
    const pending = Math.max(0, total_given - total_returned);
    return {
      customer_id: cid,
      total_given,
      total_returned,
      pending
    };
  }).filter(data => data.total_given > 0 || data.total_returned > 0); // Only show customers with bottle history

  const globalSummary = aggregatedData.reduce((acc, curr) => {
    acc.total_given += curr.total_given;
    acc.total_returned += curr.total_returned;
    acc.pending += curr.pending;
    return acc;
  }, { total_given: 0, total_returned: 0, pending: 0 });

  const openCreate = () => {
    setForm({ 
      customer_id: customers[0]?.customer_id || customers[0]?.id || '', 
      date: new Date().toISOString().split('T')[0], 
      bottles_given: 0, 
      bottles_returned: 0, 
      notes: 'Bottle Update' 
    });
    setErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const e = {};
    if (!form.customer_id) e.customer_id = 'Select a customer';
    if (!form.date) e.date = 'Select a date';
    if (form.bottles_given < 0) e.bottles_given = 'Enter valid number';
    if (form.bottles_returned < 0) e.bottles_returned = 'Enter valid number';
    return e;
  };

  const handleSave = async (ev) => {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const payload = {
        customer_id: Number(form.customer_id),
        date: form.date,
        quantity: 0, // This is explicitly a bottle update, so 0 milk
        price: 0,
        bottles_given: Number(form.bottles_given),
        bottles_returned: Number(form.bottles_returned),
        paid_amount: 0,
        payment_mode: "none",
        notes: form.notes
      };

      await deliveriesApi.create(payload);
      toast.success('Bottle record added successfully!');
      setShowModal(false);
      fetchAll();
    } catch (err) {
      toast.error('Failed to save record');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const filteredData = aggregatedData.filter(item => {
    const matchesSearch = getCustomerName(item.customer_id).toLowerCase().includes(search.toLowerCase());
    const matchesPending = showPendingOnly ? item.pending > 0 : true;
    return matchesSearch && matchesPending;
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Bottles History</h2>
        <p>Real-time bottle tracking calculated directly from delivery records</p>
      </div>

      {/* Summary Banner */}
      {!loading && (
        <div className="bt-summary-row">
          <div className="bt-summary-card primary">
            <Package size={20} />
            <div>
              <div className="bt-summary-value">{globalSummary.total_given}</div>
              <div className="bt-summary-label">Total Given</div>
            </div>
          </div>
          <div className="bt-summary-card success">
            <CheckCircle size={20} />
            <div>
              <div className="bt-summary-value">{globalSummary.total_returned}</div>
              <div className="bt-summary-label">Total Returned</div>
            </div>
          </div>
          <div 
            className="bt-summary-card warning"
            style={{ cursor: 'pointer', border: showPendingOnly ? '2px solid var(--warning)' : '1px solid var(--border)' }}
            onClick={() => setShowPendingOnly(!showPendingOnly)}
            title="Click to toggle pending customers"
          >
            <AlertTriangle size={20} />
            <div>
              <div className="bt-summary-value">{globalSummary.pending}</div>
              <div className="bt-summary-label">Pending Across All</div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="actions-row">
        <div className="search-bar">
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search by customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="spacer" />
        <button className="btn btn-secondary btn-sm" onClick={fetchAll} id="bt-refresh-btn">
          <RefreshCw size={14} />
        </button>
        <button className="btn btn-primary" onClick={openCreate} id="bt-add-btn" disabled={customers.length === 0}>
          <Plus size={16} />
          Add Bottle Update
        </button>
      </div>

      {customers.length === 0 && !loading && (
        <div className="alert-banner">⚠️ Please add at least one <strong>Customer</strong>.</div>
      )}

      {/* Content */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading bottle records...</p>
        </div>
      ) : aggregatedData.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🍼</div>
            <h3>No bottle records yet</h3>
            <p>Bottle history is automatically generated from your delivery records.</p>
            {customers.length > 0 && (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                <button className="btn btn-primary" onClick={openCreate} id="bt-add-first-btn">
                  <Plus size={16} /> Add First Bottle Record
                </button>
              </div>
            )}
          </div>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🍼</div>
            <h3>No matching records</h3>
            <p>Try changing your search or filter.</p>
          </div>
        </div>
      ) : (
        <div className="bt-grid">
          {filteredData.map(item => {
            const pct = item.total_given > 0 ? Math.round((item.total_returned / item.total_given) * 100) : 0;
            const statusColor = item.pending === 0 ? 'var(--success)' : item.pending > 3 ? 'var(--danger)' : 'var(--warning)';
            return (
              <div key={item.customer_id} className="bt-card">
                <div className="bt-card-header">
                  <div className="bt-avatar">{getCustomerName(item.customer_id).charAt(0).toUpperCase()}</div>
                  <div className="bt-card-info">
                    <h3>{getCustomerName(item.customer_id)}</h3>
                    <span
                      className="badge"
                      style={{
                        background: item.pending === 0 ? 'rgba(16,185,129,0.15)' : item.pending > 3 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                        color: statusColor,
                        border: `1px solid ${statusColor}40`,
                      }}
                    >
                      {item.pending === 0 ? '✓ All Returned' : `${item.pending} Pending`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setViewDetailsCustomer(item.customer_id)} title="View Bottle History">
                      <List size={14} />
                    </button>
                  </div>
                </div>

                <div className="bt-metrics">
                  <div className="bt-metric">
                    <span className="metric-label">Given</span>
                    <span className="metric-value" style={{ color: 'var(--accent)' }}>{item.total_given}</span>
                  </div>
                  <div className="bt-metric">
                    <span className="metric-label">Returned</span>
                    <span className="metric-value" style={{ color: 'var(--success)' }}>{item.total_returned}</span>
                  </div>
                  <div className="bt-metric">
                    <span className="metric-label">Pending</span>
                    <span className="metric-value" style={{ color: statusColor }}>{item.pending}</span>
                  </div>
                </div>

                <div className="bt-progress-wrap">
                  <div className="bt-progress-bar">
                    <div className="bt-progress-fill" style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--success)' : 'var(--primary)' }} />
                  </div>
                  <span className="bt-progress-label">{pct}% returned</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for creating a bottle-only record */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Log Bottle Exchange</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="alert-banner" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', borderColor: 'rgba(59,130,246,0.2)' }}>
                  ℹ️ This will create a delivery record with 0L milk just to log these bottles.
                </div>
                <div className="form-group">
                  <label className="form-label">Customer <span>*</span></label>
                  <select
                    className="form-select"
                    value={form.customer_id}
                    onChange={e => setForm({ ...form, customer_id: e.target.value })}
                  >
                    {customers.map(c => (
                      <option key={c.customer_id || c.id} value={c.customer_id || c.id}>{c.name}</option>
                    ))}
                  </select>
                  {errors.customer_id && <p className="form-error">{errors.customer_id}</p>}
                </div>

                <div className="form-group">
                  <label className="form-label">Date <span>*</span></label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                  />
                  {errors.date && <p className="form-error">{errors.date}</p>}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Bottles Given <span>*</span></label>
                    <input
                      className="form-input"
                      type="number" min="0"
                      value={form.bottles_given}
                      onChange={e => setForm({ ...form, bottles_given: e.target.value })}
                    />
                    {errors.bottles_given && <p className="form-error">{errors.bottles_given}</p>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bottles Returned <span>*</span></label>
                    <input
                      className="form-input"
                      type="number" min="0"
                      value={form.bottles_returned}
                      onChange={e => setForm({ ...form, bottles_returned: e.target.value })}
                    />
                    {errors.bottles_returned && <p className="form-error">{errors.bottles_returned}</p>}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input
                    className="form-input"
                    type="text"
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="e.g. Returned empty bottles"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Log Bottles'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal (Bottle History) */}
      {viewDetailsCustomer && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Bottle History: {getCustomerName(viewDetailsCustomer)}</h2>
              <button className="modal-close" onClick={() => setViewDetailsCustomer(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Quantity (L)</th>
                      <th style={{ textAlign: 'center' }}>Bottles Given</th>
                      <th style={{ textAlign: 'center' }}>Bottles Returned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.filter(d => d.customer_id === viewDetailsCustomer).length === 0 ? (
                      <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>No bottle history found.</td></tr>
                    ) : deliveries.filter(d => d.customer_id === viewDetailsCustomer && (d.bottles_given > 0 || d.bottles_returned > 0))
                        .sort((a, b) => new Date(b.date) - new Date(a.date)) // newest first
                        .map(d => (
                      <tr key={d.delivery_id || d.id}>
                        <td>{new Date(d.date).toLocaleDateString()}</td>
                        <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{d.quantity}</td>
                        <td style={{ color: 'var(--warning)', fontWeight: 600, textAlign: 'center' }}>{d.bottles_given || 0}</td>
                        <td style={{ color: 'var(--success)', fontWeight: 600, textAlign: 'center' }}>{d.bottles_returned || 0}</td>
                      </tr>
                    ))}
                    {deliveries.filter(d => d.customer_id === viewDetailsCustomer && (d.bottles_given > 0 || d.bottles_returned > 0)).length === 0 && (
                      <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>No bottle history found for this customer.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .bt-summary-row { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
        .bt-summary-card { flex: 1; min-width: 140px; display: flex; align-items: center; gap: 14px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 16px 20px; }
        .bt-summary-card.primary svg { color: var(--primary); }
        .bt-summary-card.success svg { color: var(--success); }
        .bt-summary-card.warning svg { color: var(--warning); }
        .bt-summary-value { font-size: 26px; font-weight: 800; color: var(--text-primary); line-height: 1; }
        .bt-summary-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        .bt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
        .bt-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; transition: all var(--transition); }
        .bt-card:hover { border-color: var(--border-light); box-shadow: var(--shadow-md); transform: translateY(-2px); }
        .bt-card-header { display: flex; align-items: center; gap: 12px; padding: 16px 18px; border-bottom: 1px solid var(--border); }
        .bt-avatar { width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--accent)); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 17px; flex-shrink: 0; box-shadow: 0 4px 12px rgba(59,130,246,0.3); }
        .bt-card-info { flex: 1; min-width: 0; }
        .bt-card-info h3 { font-size: 14px; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; }
        .bt-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border-bottom: 1px solid var(--border); }
        .bt-metric { padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; border-right: 1px solid var(--border); }
        .bt-metric:last-child { border-right: none; }
        .bt-progress-wrap { padding: 12px 18px; display: flex; align-items: center; gap: 10px; }
        .bt-progress-bar { flex: 1; height: 6px; background: var(--bg-elevated); border-radius: 100px; overflow: hidden; }
        .bt-progress-fill { height: 100%; border-radius: 100px; transition: width 0.4s ease; }
        .bt-progress-label { font-size: 11px; color: var(--text-muted); font-weight: 600; white-space: nowrap; }
        .alert-banner { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-md); padding: 12px 16px; color: var(--warning); font-size: 14px; margin-bottom: 16px; }
        @media (max-width: 480px) { .bt-grid { grid-template-columns: 1fr; } .bt-summary-row { flex-direction: column; } }
      `}</style>
    </div>
  );
}
