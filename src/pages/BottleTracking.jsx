import React, { useState, useEffect } from 'react';
import { bottleTrackingApi, customersApi, deliveriesApi } from '../api';
import {
  Plus, RefreshCw, Edit2, Trash2, X, Package, AlertTriangle, CheckCircle, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';

export default function BottleTracking() {
  const [trackings, setTrackings] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ customer_id: '', total_given: 0, total_returned: 0, pending: 0 });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState({});

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [trackRes, cusRes, delRes, sumRes] = await Promise.all([
        bottleTrackingApi.getAll(),
        customersApi.getAll(),
        deliveriesApi.getAll(),
        bottleTrackingApi.getSummary(),
      ]);
      setTrackings(trackRes.data || []);
      setCustomers(cusRes.data || []);
      setDeliveries(delRes.data || []);
      setSummary(sumRes.data || null);
    } catch {
      toast.error('Failed to load bottle tracking data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const getCustomerName = (id) => {
    const c = customers.find(c => (c.customer_id || c.id) === id);
    return c ? c.name : `Customer #${id}`;
  };

  // Aggregate deliveries per customer to auto-fill totals
  const getDeliveryAggForCustomer = (customerId) => {
    const cid = Number(customerId);
    const customerDeliveries = deliveries.filter(d => d.customer_id === cid);
    const total_given = customerDeliveries.reduce((s, d) => s + (d.bottles_given || 0), 0);
    const total_returned = customerDeliveries.reduce((s, d) => s + (d.bottles_returned || 0), 0);
    const pending = total_given - total_returned;
    return { total_given, total_returned, pending: Math.max(0, pending) };
  };

  const openCreate = () => {
    const defaultCustomerId = customers[0]?.customer_id || customers[0]?.id || '';
    const agg = defaultCustomerId ? getDeliveryAggForCustomer(defaultCustomerId) : { total_given: 0, total_returned: 0, pending: 0 };
    setEditItem(null);
    setForm({ customer_id: defaultCustomerId, ...agg });
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      customer_id: item.customer_id,
      total_given: item.total_given,
      total_returned: item.total_returned,
      pending: item.pending,
    });
    setErrors({});
    setShowModal(true);
  };

  // When customer changes in modal, auto-calculate totals from deliveries
  const handleCustomerChange = (customerId) => {
    const agg = getDeliveryAggForCustomer(customerId);
    setForm(f => ({ ...f, customer_id: customerId, ...agg }));
  };

  // Allow manual override of totals; recalculate pending
  const handleGivenChange = (val) => {
    const given = Number(val);
    const returned = Number(form.total_returned);
    setForm(f => ({ ...f, total_given: val, pending: Math.max(0, given - returned) }));
  };

  const handleReturnedChange = (val) => {
    const given = Number(form.total_given);
    const returned = Number(val);
    setForm(f => ({ ...f, total_returned: val, pending: Math.max(0, given - returned) }));
  };

  const validate = () => {
    const e = {};
    if (!form.customer_id) e.customer_id = 'Select a customer';
    if (isNaN(Number(form.total_given)) || Number(form.total_given) < 0) e.total_given = 'Enter valid number';
    if (isNaN(Number(form.total_returned)) || Number(form.total_returned) < 0) e.total_returned = 'Enter valid number';
    return e;
  };

  const handleSave = async (ev) => {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const given = Number(form.total_given);
      const returned = Number(form.total_returned);
      if (editItem) {
        await bottleTrackingApi.update(editItem.id, {
          total_given: given,
          total_returned: returned,
          pending: Math.max(0, given - returned),
        });
        toast.success('Bottle record updated!');
      } else {
        await bottleTrackingApi.create({
          customer_id: Number(form.customer_id),
          total_given: given,
          total_returned: returned,
          pending: Math.max(0, given - returned),
        });
        toast.success('Bottle record created!');
      }
      setShowModal(false);
      fetchAll();
    } catch (err) {
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
          toast.error(detail.map(d => `${d.loc[d.loc.length - 1]}: ${d.msg}`).join(', '));
        } else {
          toast.error(String(detail));
        }
      } else {
        toast.error('Failed to save record');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await bottleTrackingApi.delete(confirmDelete.id);
      toast.success('Record deleted');
      setConfirmDelete(null);
      fetchAll();
    } catch {
      toast.error('Failed to delete record');
    } finally {
      setDeleting(false);
    }
  };

  // Calculate quick-sync function: auto upsert tracking from deliveries for a customer
  const handleAutoSync = async () => {
    if (customers.length === 0) { toast.error('No customers found'); return; }
    const loadingId = toast.loading('Syncing bottle data from deliveries...');
    let success = 0;
    try {
      for (const customer of customers) {
        const cid = customer.customer_id || customer.id;
        const agg = getDeliveryAggForCustomer(cid);
        if (agg.total_given === 0 && agg.total_returned === 0) continue;

        const existing = trackings.find(t => t.customer_id === cid);
        if (existing) {
          await bottleTrackingApi.update(existing.id, {
            total_given: agg.total_given,
            total_returned: agg.total_returned,
            pending: agg.pending,
          });
        } else {
          await bottleTrackingApi.create({
            customer_id: cid,
            total_given: agg.total_given,
            total_returned: agg.total_returned,
            pending: agg.pending,
          });
        }
        success++;
      }
      toast.success(`Synced ${success} customer(s) from deliveries`, { id: loadingId });
      fetchAll();
    } catch {
      toast.error('Sync failed', { id: loadingId });
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Bottle Tracking</h2>
        <p>Track bottle distribution and returns per customer</p>
      </div>

      {/* Summary Banner */}
      {summary && (
        <div className="bt-summary-row">
          <div className="bt-summary-card primary">
            <Package size={20} />
            <div>
              <div className="bt-summary-value">{summary.total_given ?? '—'}</div>
              <div className="bt-summary-label">Total Given</div>
            </div>
          </div>
          <div className="bt-summary-card success">
            <CheckCircle size={20} />
            <div>
              <div className="bt-summary-value">{summary.total_returned ?? '—'}</div>
              <div className="bt-summary-label">Total Returned</div>
            </div>
          </div>
          <div className="bt-summary-card warning">
            <AlertTriangle size={20} />
            <div>
              <div className="bt-summary-value">{summary.pending ?? '—'}</div>
              <div className="bt-summary-label">Pending</div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="actions-row">
        <div className="spacer" />
        <button className="btn btn-secondary" onClick={handleAutoSync} id="bt-autosync-btn" title="Auto-sync totals from delivery records">
          <Zap size={15} />
          Sync from Deliveries
        </button>
        <button className="btn btn-secondary btn-sm" onClick={fetchAll} id="bt-refresh-btn">
          <RefreshCw size={14} />
        </button>
        <button className="btn btn-primary" onClick={openCreate} id="bt-add-btn" disabled={customers.length === 0}>
          <Plus size={16} />
          Add Record
        </button>
      </div>

      {customers.length === 0 && !loading && (
        <div className="alert-banner">⚠️ Please add at least one <strong>Customer</strong> before tracking bottles.</div>
      )}

      {/* Content */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading bottle records...</p>
        </div>
      ) : trackings.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🍼</div>
            <h3>No bottle records yet</h3>
            <p>Click "Sync from Deliveries" to auto-populate from delivery data, or add manually.</p>
            {customers.length > 0 && (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                <button className="btn btn-secondary" onClick={handleAutoSync} id="bt-sync-empty-btn">
                  <Zap size={15} /> Sync from Deliveries
                </button>
                <button className="btn btn-primary" onClick={openCreate} id="bt-add-first-btn">
                  <Plus size={16} /> Add Manually
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bt-grid">
          {trackings.map(item => {
            const pct = item.total_given > 0 ? Math.round((item.total_returned / item.total_given) * 100) : 0;
            const statusColor = item.pending === 0 ? 'var(--success)' : item.pending > 3 ? 'var(--error)' : 'var(--warning)';
            return (
              <div key={item.id} className="bt-card">
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
                    <button className="btn btn-secondary btn-icon btn-sm" onClick={() => openEdit(item)} id={`bt-edit-${item.id}`}>
                      <Edit2 size={14} />
                    </button>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => setConfirmDelete(item)} id={`bt-delete-${item.id}`}>
                      <Trash2 size={14} />
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
                    <div className="bt-progress-fill" style={{ width: `${pct}%`, background: pct === 100 ? 'var(--success)' : 'var(--primary)' }} />
                  </div>
                  <span className="bt-progress-label">{pct}% returned</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{editItem ? 'Edit Bottle Record' : 'Add Bottle Record'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)} id="bt-modal-close">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {!editItem && (
                  <div className="form-group">
                    <label className="form-label">Customer <span>*</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                        (totals auto-filled from deliveries)
                      </span>
                    </label>
                    <select
                      id="bt-customer-select"
                      className="form-select"
                      value={form.customer_id}
                      onChange={e => handleCustomerChange(e.target.value)}
                    >
                      <option value="">Select Customer</option>
                      {customers.map(c => (
                        <option key={c.customer_id || c.id} value={c.customer_id || c.id}>{c.name}</option>
                      ))}
                    </select>
                    {errors.customer_id && <p className="form-error">{errors.customer_id}</p>}
                  </div>
                )}

                {editItem && (
                  <div className="form-group">
                    <label className="form-label">Customer</label>
                    <input className="form-input" value={getCustomerName(editItem.customer_id)} disabled />
                  </div>
                )}

                <div className="bt-agg-info">
                  <Zap size={13} />
                  <span>Auto-calculated from delivery records — you can adjust manually below.</span>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Total Given <span>*</span></label>
                    <input
                      id="bt-given-input"
                      className="form-input"
                      type="number" min="0"
                      value={form.total_given}
                      onChange={e => handleGivenChange(e.target.value)}
                    />
                    {errors.total_given && <p className="form-error">{errors.total_given}</p>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Total Returned <span>*</span></label>
                    <input
                      id="bt-returned-input"
                      className="form-input"
                      type="number" min="0"
                      value={form.total_returned}
                      onChange={e => handleReturnedChange(e.target.value)}
                    />
                    {errors.total_returned && <p className="form-error">{errors.total_returned}</p>}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Pending (auto-calculated)</label>
                  <input
                    className="form-input"
                    type="number" min="0"
                    value={form.pending}
                    readOnly
                    style={{ opacity: 0.7, cursor: 'not-allowed' }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} id="bt-cancel-btn">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} id="bt-save-btn">
                  {saving ? (
                    <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Saving...</>
                  ) : (
                    editItem ? 'Update Record' : 'Create Record'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete Bottle Record"
        message={`Delete bottle tracking for "${getCustomerName(confirmDelete?.customer_id)}"?`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
        loading={deleting}
      />

      <style>{`
        .bt-summary-row {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 24px;
        }

        .bt-summary-card {
          flex: 1;
          min-width: 140px;
          display: flex;
          align-items: center;
          gap: 14px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 16px 20px;
        }

        .bt-summary-card.primary svg { color: var(--primary); }
        .bt-summary-card.success svg { color: var(--success); }
        .bt-summary-card.warning svg { color: var(--warning); }

        .bt-summary-value {
          font-size: 26px;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1;
        }

        .bt-summary-label {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 4px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }

        .bt-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .bt-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          transition: all var(--transition);
        }

        .bt-card:hover {
          border-color: var(--border-light);
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }

        .bt-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 18px;
          border-bottom: 1px solid var(--border);
        }

        .bt-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--accent));
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 700;
          font-size: 17px;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(59,130,246,0.3);
        }

        .bt-card-info {
          flex: 1;
          min-width: 0;
        }

        .bt-card-info h3 {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 4px;
        }

        .bt-metrics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0;
          border-bottom: 1px solid var(--border);
        }

        .bt-metric {
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          border-right: 1px solid var(--border);
        }

        .bt-metric:last-child { border-right: none; }

        .bt-progress-wrap {
          padding: 12px 18px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .bt-progress-bar {
          flex: 1;
          height: 6px;
          background: var(--bg-elevated);
          border-radius: 100px;
          overflow: hidden;
        }

        .bt-progress-fill {
          height: 100%;
          border-radius: 100px;
          transition: width 0.4s ease;
        }

        .bt-progress-label {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 600;
          white-space: nowrap;
        }

        .bt-agg-info {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--primary);
          background: rgba(59,130,246,0.08);
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: var(--radius-sm);
          padding: 8px 12px;
          margin-bottom: 16px;
        }

        .alert-banner {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: var(--radius-md);
          padding: 12px 16px;
          color: var(--warning);
          font-size: 14px;
          margin-bottom: 16px;
        }

        @media (max-width: 480px) {
          .bt-grid { grid-template-columns: 1fr; }
          .bt-summary-row { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
