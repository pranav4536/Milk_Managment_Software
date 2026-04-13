import React, { useState, useEffect } from 'react';
import { customersApi } from '../api';
import { Plus, Search, Edit2, Trash2, X, Phone, MapPin, Truck, RefreshCw, Navigation, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';
import CustomerTransactionsModal from '../components/CustomerTransactionsModal';

const MILK_TYPES = [
  'Gir Cow Milk',
  'Buffalo Milk',
  'Jersey Cow Milk',
  'HF Cow Milk',
  'Mixed Milk',
  'Other',
];

const emptyForm = {
  name: '', address: '', phone: '', milk_type: 'Gir Cow Milk', daily_qty: '', lat: 0, long: 0
};

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState({});
  const [showTransactionsFor, setShowTransactionsFor] = useState(null);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await customersApi.getAll();
      setCustomers(res.data || []);
    } catch {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const openCreate = () => {
    setEditCustomer(null);
    setForm(emptyForm);
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (v) => {
    setEditCustomer(v);
    setForm({
      name: v.name || '',
      address: v.address || '',
      phone: v.phone || '',
      milk_type: v.milk_type || 'Gir Cow Milk',
      daily_qty: v.daily_qty || '',
      lat: v.lat || 0,
      long: v.long || 0,
    });
    setErrors({});
    setShowModal(true);
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    
    const loadingToast = toast.loading('Fetching location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm({
          ...form,
          lat: position.coords.latitude.toFixed(6),
          long: position.coords.longitude.toFixed(6)
        });
        toast.success('Location updated', { id: loadingToast });
      },
      (error) => {
        console.error(error);
        toast.error('Unable to fetch location. Please allow permissions.', { id: loadingToast });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.address.trim()) e.address = 'Address is required';
    if (!form.phone.trim()) e.phone = 'Phone is required';
    else if (!/^[6-9]\d{9}$/.test(form.phone)) e.phone = 'Enter a valid 10-digit phone number';
    if (!form.daily_qty || form.daily_qty <= 0) e.daily_qty = 'Enter a valid quantity';
    return e;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const payload = { 
        ...form, 
        daily_qty: Number(form.daily_qty), 
        lat: Number(form.lat), 
        long: Number(form.long) 
      };
      if (editCustomer) {
        // Assume customer_id or id is returned as id
        await customersApi.update(editCustomer.customer_id || editCustomer.id, payload);
        toast.success('Customer updated successfully!');
      } else {
        await customersApi.create(payload);
        toast.success('Customer created successfully!');
      }
      setShowModal(false);
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await customersApi.delete(confirmDelete.customer_id || confirmDelete.id);
      toast.success('Customer deleted');
      setConfirmDelete(null);
      fetchCustomers();
    } catch {
      toast.error('Failed to delete customer');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = customers.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.address.toLowerCase().includes(search.toLowerCase()) ||
    v.phone.includes(search) ||
    v.milk_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Customers</h2>
        <p>Manage your customers and their milk consumption</p>
      </div>

      {/* Actions Row */}
      <div className="actions-row">
        <div className="search-bar">
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            id="customer-search-input"
            type="text"
            placeholder="Search customers..."
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
        <button className="btn btn-secondary btn-sm" onClick={fetchCustomers} id="customer-refresh-btn">
          <RefreshCw size={14} />
        </button>
        <button className="btn btn-primary" onClick={openCreate} id="customer-add-btn">
          <Plus size={16} />
          Add Customer
        </button>
      </div>

      {/* Table / Cards */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading customers...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <h3>{search ? 'No customers found' : 'No customers yet'}</h3>
            <p>{search ? 'Try a different search term' : 'Add your first customer to get started'}</p>
            {!search && (
              <button className="btn btn-primary" onClick={openCreate} id="customer-add-first-btn">
                <Plus size={16} />
                Add First Customer
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Mobile cards on small screens */}
          <div className="customer-cards-grid">
            {filtered.map(v => (
              <div key={v.customer_id || v.id} className="customer-card">
                <div className="customer-card-header">
                  <div className="customer-avatar">{v.name.charAt(0).toUpperCase()}</div>
                  <div className="customer-card-info">
                    <h3>{v.name}</h3>
                    <span className="badge badge-cyan">{v.milk_type}</span>
                  </div>
                  <div className="customer-card-actions">
                    <button
                      className="btn btn-success btn-icon btn-sm"
                      onClick={() => setShowTransactionsFor(v)}
                      title="Transactions & Billing"
                      style={{ background: '#25D366', borderColor: '#25D366', color: '#fff' }}
                    >
                      <DollarSign size={14} />
                    </button>
                    <button
                      className="btn btn-secondary btn-icon btn-sm"
                      onClick={() => openEdit(v)}
                      title="Edit"
                      id={`customer-edit-btn-${v.customer_id || v.id}`}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      className="btn btn-danger btn-icon btn-sm"
                      onClick={() => setConfirmDelete(v)}
                      title="Delete"
                      id={`customer-delete-btn-${v.customer_id || v.id}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="customer-card-body">
                  <div className="customer-detail-row">
                    <MapPin size={13} />
                    <span>{v.address}</span>
                  </div>
                  <div className="customer-detail-row">
                    <Phone size={13} />
                    <span>{v.phone}</span>
                  </div>
                  <div className="customer-detail-row">
                    <Truck size={13} />
                    <span>Daily Qty: <strong>{v.daily_qty} L</strong></span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Also show table on large screens */}
          <div className="card" style={{ display: 'none' }} className="customer-table-card">
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Milk Type</th>
                    <th>Address</th>
                    <th>Phone</th>
                    <th>Daily Qty</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v, i) => (
                    <tr key={v.customer_id || v.id}>
                      <td className="td-muted">{i + 1}</td>
                      <td><strong>{v.name}</strong></td>
                      <td><span className="badge badge-cyan">{v.milk_type}</span></td>
                      <td className="td-muted">{v.address}</td>
                      <td>{v.phone}</td>
                      <td>{v.daily_qty} L</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button 
                            className="btn btn-success btn-icon btn-sm" 
                            onClick={() => setShowTransactionsFor(v)}
                            title="Transactions & Billing"
                            style={{ background: '#25D366', borderColor: '#25D366', color: '#fff' }}
                          >
                            <DollarSign size={14} />
                          </button>
                          <button className="btn btn-secondary btn-icon btn-sm" onClick={() => openEdit(v)}>
                            <Edit2 size={14} />
                          </button>
                          <button className="btn btn-danger btn-icon btn-sm" onClick={() => setConfirmDelete(v)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* customer Form Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)} id="customer-modal-close-btn">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Customer Name <span>*</span></label>
                  <input
                    id="customer-name-input"
                    className="form-input"
                    type="text"
                    placeholder="e.g. Jeevan Urkude"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                  {errors.name && <p className="form-error">{errors.name}</p>}
                </div>

                <div className="form-group">
                  <label className="form-label">Address <span>*</span></label>
                  <input
                    id="customer-address-input"
                    className="form-input"
                    type="text"
                    placeholder="e.g. Shiv Nagar, Wardha"
                    value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                  />
                  {errors.address && <p className="form-error">{errors.address}</p>}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Latitude</span>
                      <button 
                        type="button" 
                        onClick={handleGetLocation}
                        title="Get current location"
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '600' }}
                      >
                        <Navigation size={12} /> Get Current
                      </button>
                    </label>
                    <input
                      className="form-input"
                      type="number" step="any"
                      value={form.lat}
                      onChange={e => setForm({ ...form, lat: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Longitude</label>
                    <input
                      className="form-input"
                      type="number" step="any"
                      value={form.long}
                      onChange={e => setForm({ ...form, long: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Phone <span>*</span></label>
                    <input
                      id="customer-phone-input"
                      className="form-input"
                      type="tel"
                      placeholder="10-digit number"
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      maxLength={10}
                    />
                    {errors.phone && <p className="form-error">{errors.phone}</p>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Daily Qty (Liters) <span>*</span></label>
                    <input
                      id="customer-daily-qty-input"
                      className="form-input"
                      type="number"
                      step="0.5"
                      placeholder="e.g. 2"
                      value={form.daily_qty}
                      onChange={e => setForm({ ...form, daily_qty: e.target.value })}
                      min="0.5"
                    />
                    {errors.daily_qty && <p className="form-error">{errors.daily_qty}</p>}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Milk Type <span>*</span></label>
                  <select
                    id="customer-milktype-select"
                    className="form-select"
                    value={form.milk_type}
                    onChange={e => setForm({ ...form, milk_type: e.target.value })}
                  >
                    {MILK_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  id="customer-form-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  id="customer-form-save-btn"
                >
                  {saving ? (
                    <>
                      <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                      Saving...
                    </>
                  ) : (
                    editCustomer ? 'Update Customer' : 'Create Customer'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTransactionsFor && (
        <CustomerTransactionsModal
          customer={showTransactionsFor}
          onClose={() => setShowTransactionsFor(null)}
        />
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete Customer"
        message={`Are you sure you want to delete "${confirmDelete?.name}"?`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
        loading={deleting}
      />

      <style>{`
        .customer-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .customer-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          transition: all var(--transition);
        }

        .customer-card:hover {
          border-color: var(--border-light);
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }

        .customer-card-header {
          padding: 16px 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid var(--border);
        }

        .customer-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--accent));
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 700;
          font-size: 18px;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(59,130,246,0.35);
        }

        .customer-card-info {
          flex: 1;
          min-width: 0;
        }

        .customer-card-info h3 {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 4px;
        }

        .customer-card-actions {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }

        .customer-card-body {
          padding: 14px 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .customer-detail-row {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-secondary);
          font-size: 13px;
        }

        .customer-detail-row svg {
          color: var(--text-muted);
          flex-shrink: 0;
        }

        @media (max-width: 480px) {
          .customer-cards-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
