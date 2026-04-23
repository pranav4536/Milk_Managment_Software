import React, { useState, useEffect } from 'react';
import { milkCollectionApi, vendorsApi } from '../api';
import { Plus, Search, Edit2, Trash2, X, Filter, RefreshCw, Droplets, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';

const emptyForm = {
  vendor_id: '',
  date: new Date().toISOString().split('T')[0],
  quantity: '',
  price: '',
};

export default function MilkCollection() {
  const [collections, setCollections] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState({});
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'

  const fetchData = async () => {
    setLoading(true);
    try {
      const [colRes, venRes] = await Promise.all([
        milkCollectionApi.getAll(),
        vendorsApi.getAll(),
      ]);
      setCollections(colRes.data || []);
      setVendors(venRes.data || []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getVendorName = (id) => {
    const v = vendors.find(v => v.vendor_id === id);
    return v ? v.name : `Vendor #${id}`;
  };

  const openCreate = () => {
    setEditItem(null);
    setForm({ ...emptyForm, vendor_id: vendors[0]?.vendor_id || '' });
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditItem(c);
    // Ensure date is in YYYY-MM-DD format
    let dateStr = c.date || '';
    if (dateStr && dateStr.includes('T')) {
      dateStr = dateStr.split('T')[0];
    }
    setForm({
      vendor_id: c.vendor_id || '',
      date: dateStr,
      quantity: c.quantity ?? '',
      price: c.price ?? '',
    });
    setErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const e = {};
    if (!form.vendor_id) {
      e.vendor_id = 'Please select a vendor';
    } else if (!Number.isInteger(Number(form.vendor_id))) {
      e.vendor_id = 'vender id must be integer';
    }
    if (!form.date) e.date = 'Select date';
    if (form.quantity === '' || isNaN(Number(form.quantity)) || Number(form.quantity) < 0) e.quantity = 'Enter valid quantity';
    if (form.price === '' || isNaN(Number(form.price)) || Number(form.price) < 0) e.price = 'Enter valid price';
    return e;
  };

  const handleSave = async (ev) => {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const payload = {
        vendor_id: Number(form.vendor_id),
        date: form.date || new Date().toISOString().split('T')[0],
        quantity: Number(form.quantity),
        price: Number(form.price),
      };
      if (editItem) {
        await milkCollectionApi.update(editItem.id, payload);
        toast.success('Collection record updated!');
      } else {
        await milkCollectionApi.create(payload);
        toast.success('Collection record added!');
      }
      setShowModal(false);
      fetchData();
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
      await milkCollectionApi.delete(confirmDelete.id);
      toast.success('Record deleted');
      setConfirmDelete(null);
      fetchData();
    } catch {
      toast.error('Failed to delete record');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = collections.filter(c => {
    const vendorName = getVendorName(c.vendor_id).toLowerCase();
    const matchSearch =
      vendorName.includes(search.toLowerCase()) ||
      (c.date || '').includes(search) ||
      String(c.quantity).includes(search);
    const matchVendor = !filterVendor || String(c.vendor_id) === filterVendor;
    return matchSearch && matchVendor;
  });

  const totalLiters = filtered.reduce((s, c) => s + (c.quantity || 0), 0);
  const totalRevenue = filtered.reduce((s, c) => s + (c.price || 0), 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Milk Collection</h2>
        <p>Track daily milk collection from vendors</p>
      </div>

      {/* Summary Chips */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div className="summary-chip">
          <Droplets size={14} />
          <span>Total: <strong>{totalLiters} L</strong></span>
        </div>
        <div className="summary-chip">
          <span>💰</span>
          <span>Revenue: <strong>₹{totalRevenue.toLocaleString()}</strong></span>
        </div>
        <div className="summary-chip">
          <span>📋</span>
          <span>Records: <strong>{filtered.length}</strong></span>
        </div>
      </div>

      {/* Actions Row */}
      <div className="actions-row">
        <div className="search-bar">
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            id="collection-search-input"
            type="text"
            placeholder="Search by vendor, date..."
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

        {vendors.length > 0 && (
          <select
            id="collection-vendor-filter"
            className="form-select"
            value={filterVendor}
            onChange={e => setFilterVendor(e.target.value)}
            style={{ width: 'auto', minWidth: 150 }}
          >
            <option value="">All Vendors</option>
            {vendors.map(v => (
              <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>
            ))}
          </select>
        )}

        <div className="spacer" />

        <button className="btn btn-secondary btn-sm" onClick={fetchData} id="collection-refresh-btn">
          <RefreshCw size={14} />
        </button>
        <button className="btn btn-primary" onClick={openCreate} id="collection-add-btn" disabled={vendors.length === 0}>
          <Plus size={16} />
          Add Collection
        </button>
      </div>

      {vendors.length === 0 && !loading && (
        <div className="alert-banner">
          ⚠️ Please add at least one <strong>Vendor</strong> before recording milk collections.
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading records...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🥛</div>
            <h3>{search || filterVendor ? 'No records found' : 'No collections yet'}</h3>
            <p>{search || filterVendor ? 'Try changing your search/filter' : 'Add your first milk collection record'}</p>
            {!search && !filterVendor && vendors.length > 0 && (
              <button className="btn btn-primary" onClick={openCreate} id="collection-add-first-btn">
                <Plus size={16} />
                Add First Record
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="collection-cards-grid">
            {filtered.map(c => (
              <div key={c.id} className="collection-card">
                <div className="collection-card-top">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span className="badge badge-blue">{getVendorName(c.vendor_id)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 13 }}>
                      <Calendar size={13} />
                      {c.date}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-secondary btn-icon btn-sm"
                      onClick={() => openEdit(c)}
                      id={`collection-edit-btn-${c.id}`}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      className="btn btn-danger btn-icon btn-sm"
                      onClick={() => setConfirmDelete(c)}
                      id={`collection-delete-btn-${c.id}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="collection-card-metrics">
                  <div className="collection-metric">
                    <span className="metric-label">Quantity</span>
                    <span className="metric-value cyan">{c.quantity} L</span>
                  </div>
                  <div className="collection-metric">
                    <span className="metric-label">Amount</span>
                    <span className="metric-value green">₹{(c.price || 0).toLocaleString()}</span>
                  </div>
                  <div className="collection-metric">
                    <span className="metric-label">Rate/L</span>
                    <span className="metric-value amber">
                      {c.quantity > 0 ? `₹${((c.price || 0) / c.quantity).toFixed(1)}` : '—'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editItem ? 'Edit Collection Record' : 'Add Milk Collection'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)} id="collection-modal-close-btn">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Vendor <span>*</span></label>
                  <select
                    id="collection-vendor-select"
                    className="form-select"
                    value={form.vendor_id}
                    onChange={e => setForm({ ...form, vendor_id: e.target.value })}
                  >
                    <option value="">Select Vendor</option>
                    {vendors.map(v => (
                      <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>
                    ))}
                  </select>
                  {errors.vendor_id && <p className="form-error">{errors.vendor_id}</p>}
                </div>

                <div className="form-group">
                  <label className="form-label">Collection Date <span>*</span></label>
                  <input
                    id="collection-date-input"
                    className="form-input"
                    type="date"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                  />
                  {errors.date && <p className="form-error">{errors.date}</p>}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Quantity (Liters) <span>*</span></label>
                    <input
                      id="collection-quantity-input"
                      className="form-input"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="e.g. 50"
                      value={form.quantity}
                      onChange={e => setForm({ ...form, quantity: e.target.value })}
                    />
                    {errors.quantity && <p className="form-error">{errors.quantity}</p>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Total Price (₹) <span>*</span></label>
                    <input
                      id="collection-price-input"
                      className="form-input"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 2000"
                      value={form.price}
                      onChange={e => setForm({ ...form, price: e.target.value })}
                    />
                    {errors.price && <p className="form-error">{errors.price}</p>}
                  </div>
                </div>

                {/* Rate preview */}
                {form.quantity > 0 && form.price > 0 && (
                  <div className="rate-preview">
                    <span>💡 Rate per liter:</span>
                    <strong>₹{(form.price / form.quantity).toFixed(2)}/L</strong>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  id="collection-form-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  id="collection-form-save-btn"
                >
                  {saving ? (
                    <>
                      <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                      Saving...
                    </>
                  ) : (
                    editItem ? 'Update Record' : 'Add Record'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete Collection Record"
        message={`Delete collection record for "${getVendorName(confirmDelete?.vendor_id)}" on ${confirmDelete?.date}?`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
        loading={deleting}
      />

      <style>{`
        .summary-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 6px 14px;
          font-size: 13px;
          color: var(--text-secondary);
        }

        .summary-chip strong {
          color: var(--text-primary);
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

        .collection-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .collection-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          transition: all var(--transition);
        }

        .collection-card:hover {
          border-color: var(--border-light);
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }

        .collection-card-top {
          padding: 16px 18px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          border-bottom: 1px solid var(--border);
          gap: 12px;
        }

        .collection-card-metrics {
          padding: 14px 18px;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }

        .collection-metric {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .metric-label {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }

        .metric-value {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .metric-value.cyan { color: var(--accent); }
        .metric-value.green { color: var(--success); }
        .metric-value.amber { color: var(--warning); }

        .rate-preview {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(59,130,246,0.08);
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: var(--radius-md);
          padding: 10px 14px;
          font-size: 14px;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        .rate-preview strong {
          color: var(--primary-light);
          font-size: 16px;
        }

        @media (max-width: 480px) {
          .collection-cards-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
