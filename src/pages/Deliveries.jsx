import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { deliveriesApi, customersApi } from '../api';
import { Plus, Search, Edit2, Trash2, X, Filter, RefreshCw, Droplets, Calendar, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';

const emptyForm = {
  customer_id: '',
  date: new Date().toISOString().split('T')[0],
  quantity: '',
  price: '',
  bottles_given: 0,
  bottles_returned: 0,
  paid_amount: '',
  payment_mode: 'cash',
  notes: '',
};

export default function Deliveries() {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [colRes, cusRes] = await Promise.all([
        deliveriesApi.getAll(),
        customersApi.getAll(),
      ]);
      setDeliveries(colRes.data || []);
      setCustomers(cusRes.data || []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getCustomerName = (id) => {
    const c = customers.find(c => c.customer_id === id || c.id === id);
    return c ? c.name : `Customer #${id}`;
  };

  const openCreate = () => {
    setEditItem(null);
    setForm({ ...emptyForm, customer_id: customers[0]?.customer_id || customers[0]?.id || '' });
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditItem(c);
    setForm({
      customer_id: c.customer_id || '',
      date: c.date || '',
      quantity: c.quantity ?? '',
      price: c.price ?? '',
      bottles_given: c.bottles_given ?? 0,
      bottles_returned: c.bottles_returned ?? 0,
      paid_amount: c.paid_amount ?? '',
      payment_mode: c.payment_mode || 'cash',
      notes: c.notes || '',
    });
    setErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const e = {};
    if (!form.customer_id) {
      e.customer_id = 'Please select a customer';
    } else if (!Number.isInteger(Number(form.customer_id))) {
      e.customer_id = 'customer id must be integer';
    }
    if (!form.date) e.date = 'Select date';
    if (form.quantity === '' || isNaN(Number(form.quantity)) || Number(form.quantity) < 0) e.quantity = 'Enter valid quantity';
    if (form.price === '' || isNaN(Number(form.price)) || Number(form.price) < 0) e.price = 'Enter valid price';
    if (isNaN(Number(form.bottles_given)) || Number(form.bottles_given) < 0) e.bottles_given = 'Enter valid given amount';
    if (isNaN(Number(form.bottles_returned)) || Number(form.bottles_returned) < 0) e.bottles_returned = 'Enter valid return amount';
    if (form.paid_amount !== '' && (isNaN(Number(form.paid_amount)) || Number(form.paid_amount) < 0)) e.paid_amount = 'Enter valid paid amount';
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
        quantity: Number(form.quantity),
        price: Number(form.price),
        bottles_given: Number(form.bottles_given),
        bottles_returned: Number(form.bottles_returned),
        paid_amount: form.paid_amount !== '' ? Number(form.paid_amount) : 0,
        payment_mode: form.payment_mode,
        notes: form.notes,
      };
      if (editItem) {
        const updatePayload = { ...payload };
        delete updatePayload.date;
        await deliveriesApi.update(editItem.delivery_id || editItem.id, updatePayload);
        toast.success('Delivery record updated!');
      } else {
        await deliveriesApi.create(payload);
        toast.success('Delivery record added!');
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
    const custId = confirmDelete.customer_id;
    try {
      await deliveriesApi.delete(confirmDelete.delivery_id || confirmDelete.id);
      toast.success('Record deleted');
      setConfirmDelete(null);
      fetchData();
    } catch {
      toast.error('Failed to delete record');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = deliveries.filter(c => {
    const customerName = getCustomerName(c.customer_id).toLowerCase();
    const matchSearch =
      customerName.includes(search.toLowerCase()) ||
      (c.date || '').includes(search) ||
      String(c.quantity).includes(search);
    const matchCustomer = !filterCustomer || String(c.customer_id) === filterCustomer;
    return matchSearch && matchCustomer;
  });

  const totalDelivered = filtered.reduce((s, c) => s + (c.quantity || 0), 0);
  const totalRevenue = filtered.reduce((s, c) => s + (c.price || 0), 0);
  const totalBottlesGiven = filtered.reduce((s, c) => s + (c.bottles_given || 0), 0);
  const totalBottlesReturned = filtered.reduce((s, c) => s + (c.bottles_returned || 0), 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Deliveries</h2>
        <p>Track daily milk deliveries to customers</p>
      </div>

      {/* Summary Chips */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div className="summary-chip">
          <Droplets size={14} />
          <span>Total: <strong>{totalDelivered} L</strong></span>
        </div>
        <div className="summary-chip">
          <span>💰</span>
          <span>Value: <strong>₹{totalRevenue.toLocaleString()}</strong></span>
        </div>
        <div className="summary-chip">
          <span>🍼</span>
          <span>Bottles Out: <strong>{totalBottlesGiven}</strong></span>
        </div>
        <div className="summary-chip">
          <span>🔄</span>
          <span>Returned: <strong>{totalBottlesReturned}</strong></span>
        </div>
      </div>

      {/* Actions Row */}
      <div className="actions-row">
        <div className="search-bar">
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            id="delivery-search-input"
            type="text"
            placeholder="Search by customer, date..."
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

        {customers.length > 0 && (
          <select
            id="delivery-customer-filter"
            className="form-select"
            value={filterCustomer}
            onChange={e => setFilterCustomer(e.target.value)}
            style={{ width: 'auto', minWidth: 150 }}
          >
            <option value="">All Customers</option>
            {customers.map(c => (
              <option key={c.customer_id || c.id} value={c.customer_id || c.id}>{c.name}</option>
            ))}
          </select>
        )}

        <div className="spacer" />

        {filterCustomer && (
          <button className="btn btn-success" onClick={() => navigate(`/invoice/${filterCustomer}`)} style={{ background: '#25D366', borderColor: '#25D366', color: '#fff' }}>
            <Receipt size={16} />
            Generate Invoice
          </button>
        )}

        <button className="btn btn-secondary btn-sm" onClick={fetchData} id="delivery-refresh-btn">
          <RefreshCw size={14} />
        </button>
        <button className="btn btn-primary" onClick={openCreate} id="delivery-add-btn" disabled={customers.length === 0}>
          <Plus size={16} />
          Add Delivery
        </button>
      </div>

      {customers.length === 0 && !loading && (
        <div className="alert-banner">
          ⚠️ Please add at least one <strong>Customer</strong> before recording deliveries.
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
            <div className="empty-state-icon">🚚</div>
            <h3>{search || filterCustomer ? 'No records found' : 'No deliveries yet'}</h3>
            <p>{search || filterCustomer ? 'Try changing your search/filter' : 'Add your first delivery record'}</p>
            {!search && !filterCustomer && customers.length > 0 && (
              <button className="btn btn-primary" onClick={openCreate} id="delivery-add-first-btn">
                <Plus size={16} />
                Add First Record
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Qty (L)</th>
                  <th>Amount (₹)</th>
                  <th>Paid (₹)</th>
                  <th>Mode</th>
                  <th>Bottles (Out/In)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.delivery_id || c.id}>
                    <td data-label="Customer">
                      <strong>{getCustomerName(c.customer_id)}</strong>
                    </td>
                    <td data-label="Date" className="td-muted">{c.date}</td>
                    <td data-label="Qty (L)" style={{ color: 'var(--accent)', fontWeight: 600 }}>{c.quantity}</td>
                    <td data-label="Amount (₹)">{(c.price || 0).toLocaleString()}</td>
                    <td data-label="Paid (₹)" style={{ color: 'var(--success)', fontWeight: 600 }}>{(c.paid_amount || 0).toLocaleString()}</td>
                    <td data-label="Mode" style={{ textTransform: 'capitalize' }}>{c.payment_mode || 'cash'}</td>
                    <td data-label="Bottles (Out/In)" style={{ color: 'var(--warning)', fontWeight: 600 }}>{c.bottles_given || 0} / {c.bottles_returned || 0}</td>
                    <td data-label="Actions">
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary btn-icon btn-sm"
                          onClick={() => openEdit(c)}
                          id={`delivery-edit-btn-${c.delivery_id || c.id}`}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="btn btn-danger btn-icon btn-sm"
                          onClick={() => setConfirmDelete(c)}
                          id={`delivery-delete-btn-${c.delivery_id || c.id}`}
                        >
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
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editItem ? 'Edit Delivery Record' : 'Add Delivery'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)} id="delivery-modal-close-btn">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Customer <span>*</span></label>
                  <select
                    id="delivery-customer-select"
                    className="form-select"
                    value={form.customer_id}
                    onChange={e => setForm({ ...form, customer_id: e.target.value })}
                  >
                    <option value="">Select Customer</option>
                    {customers.map(c => (
                      <option key={c.customer_id || c.id} value={c.customer_id || c.id}>{c.name}</option>
                    ))}
                  </select>
                  {errors.customer_id && <p className="form-error">{errors.customer_id}</p>}
                </div>

                <div className="form-group">
                  <label className="form-label">Delivery Date <span>*</span></label>
                  <input
                    id="delivery-date-input"
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
                      id="delivery-quantity-input"
                      className="form-input"
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="e.g. 2"
                      value={form.quantity}
                      onChange={e => setForm({ ...form, quantity: e.target.value })}
                    />
                    {errors.quantity && <p className="form-error">{errors.quantity}</p>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Total Price (₹) <span>*</span></label>
                    <input
                      id="delivery-price-input"
                      className="form-input"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 100"
                      value={form.price}
                      onChange={e => setForm({ ...form, price: e.target.value })}
                    />
                    {errors.price && <p className="form-error">{errors.price}</p>}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Bottles Given <span>*</span></label>
                    <input
                      id="delivery-bottles-given-input"
                      className="form-input"
                      type="number"
                      min="0"
                      value={form.bottles_given}
                      onChange={e => setForm({ ...form, bottles_given: e.target.value })}
                    />
                    {errors.bottles_given && <p className="form-error">{errors.bottles_given}</p>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Bottles Returned <span>*</span></label>
                    <input
                      id="delivery-bottles-returned-input"
                      className="form-input"
                      type="number"
                      min="0"
                      value={form.bottles_returned}
                      onChange={e => setForm({ ...form, bottles_returned: e.target.value })}
                    />
                    {errors.bottles_returned && <p className="form-error">{errors.bottles_returned}</p>}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Paid Amount (₹)</label>
                    <input
                      id="delivery-paid-amount-input"
                      className="form-input"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 50"
                      value={form.paid_amount}
                      onChange={e => setForm({ ...form, paid_amount: e.target.value })}
                    />
                    {errors.paid_amount && <p className="form-error">{errors.paid_amount}</p>}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Payment Mode</label>
                    <select
                      id="delivery-payment-mode-select"
                      className="form-select"
                      value={form.payment_mode}
                      onChange={e => setForm({ ...form, payment_mode: e.target.value })}
                    >
                      <option value="cash">Cash</option>
                      <option value="online">Online</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input
                    id="delivery-notes-input"
                    className="form-input"
                    type="text"
                    placeholder="e.g. Partial payment"
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  id="delivery-form-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  id="delivery-form-save-btn"
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
        title="Delete Delivery Record"
        message={`Delete delivery record for "${getCustomerName(confirmDelete?.customer_id)}" on ${confirmDelete?.date}?`}
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

        .delivery-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .delivery-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          transition: all var(--transition);
        }

        .delivery-card:hover {
          border-color: var(--border-light);
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }

        .delivery-card-top {
          padding: 16px 18px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          border-bottom: 1px solid var(--border);
          gap: 12px;
        }

        .delivery-card-metrics {
          padding: 14px 18px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .delivery-metric {
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

        @media (max-width: 768px) {
          .table-wrapper table, 
          .table-wrapper thead, 
          .table-wrapper tbody, 
          .table-wrapper th, 
          .table-wrapper td, 
          .table-wrapper tr {
            display: block;
          }
          .table-wrapper thead tr {
            display: none;
          }
          .table-wrapper tr {
            margin-bottom: 16px;
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            padding: 12px;
            background: var(--bg-card);
          }
          .table-wrapper td {
            border: none;
            padding: 6px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .table-wrapper td::before {
            content: attr(data-label);
            font-weight: 600;
            color: var(--text-muted);
            font-size: 12px;
            text-transform: uppercase;
          }
          .table-wrapper td:last-child {
            padding-bottom: 0;
            margin-top: 8px;
            border-top: 1px dashed var(--border);
            padding-top: 12px;
          }
        }
      `}</style>
    </div>
  );
}
