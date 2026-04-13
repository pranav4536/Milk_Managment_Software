import React, { useState, useEffect } from 'react';
import { vendorsApi } from '../api';
import { Plus, Search, Edit2, Trash2, X, Phone, MapPin, Truck, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';

const MILK_TYPES = [
  'Gir Cow Milk',
  'Buffalo Milk',
  'Jersey Cow Milk',
  'HF Cow Milk',
  'Mixed Milk',
  'Other',
];

const emptyForm = {
  name: '', address: '', phone: '', milk_type: 'Gir Cow Milk', capacity: ''
};

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editVendor, setEditVendor] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState({});

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const res = await vendorsApi.getAll();
      setVendors(res.data || []);
    } catch {
      toast.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVendors(); }, []);

  const openCreate = () => {
    setEditVendor(null);
    setForm(emptyForm);
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (v) => {
    setEditVendor(v);
    setForm({
      name: v.name || '',
      address: v.address || '',
      phone: v.phone || '',
      milk_type: v.milk_type || 'Gir Cow Milk',
      capacity: v.capacity || '',
    });
    setErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.address.trim()) e.address = 'Address is required';
    if (!form.phone.trim()) e.phone = 'Phone is required';
    else if (!/^[6-9]\d{9}$/.test(form.phone)) e.phone = 'Enter a valid 10-digit phone number';
    if (!form.capacity || form.capacity <= 0) e.capacity = 'Enter a valid capacity';
    return e;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const payload = { ...form, capacity: Number(form.capacity) };
      if (editVendor) {
        await vendorsApi.update(editVendor.id, payload);
        toast.success('Vendor updated successfully!');
      } else {
        await vendorsApi.create(payload);
        toast.success('Vendor created successfully!');
      }
      setShowModal(false);
      fetchVendors();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save vendor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await vendorsApi.delete(confirmDelete.id);
      toast.success('Vendor deleted');
      setConfirmDelete(null);
      fetchVendors();
    } catch {
      toast.error('Failed to delete vendor');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = vendors.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.address.toLowerCase().includes(search.toLowerCase()) ||
    v.phone.includes(search) ||
    v.milk_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <h2>Vendors</h2>
        <p>Manage your milk supplier vendors</p>
      </div>

      {/* Actions Row */}
      <div className="actions-row">
        <div className="search-bar">
          <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            id="vendor-search-input"
            type="text"
            placeholder="Search vendors..."
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
        <button className="btn btn-secondary btn-sm" onClick={fetchVendors} id="vendor-refresh-btn">
          <RefreshCw size={14} />
        </button>
        <button className="btn btn-primary" onClick={openCreate} id="vendor-add-btn">
          <Plus size={16} />
          Add Vendor
        </button>
      </div>

      {/* Table / Cards */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading vendors...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🏪</div>
            <h3>{search ? 'No vendors found' : 'No vendors yet'}</h3>
            <p>{search ? 'Try a different search term' : 'Add your first vendor to get started'}</p>
            {!search && (
              <button className="btn btn-primary" onClick={openCreate} id="vendor-add-first-btn">
                <Plus size={16} />
                Add First Vendor
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Mobile cards on small screens */}
          <div className="vendor-cards-grid">
            {filtered.map(v => (
              <div key={v.vendor_id} className="vendor-card">
                <div className="vendor-card-header">
                  <div className="vendor-avatar">{v.name.charAt(0).toUpperCase()}</div>
                  <div className="vendor-card-info">
                    <h3>{v.name}</h3>
                    <span className="badge badge-cyan">{v.milk_type}</span>
                  </div>
                  <div className="vendor-card-actions">
                    <button
                      className="btn btn-secondary btn-icon btn-sm"
                      onClick={() => openEdit(v)}
                      title="Edit"
                      id={`vendor-edit-btn-${v.id}`}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      className="btn btn-danger btn-icon btn-sm"
                      onClick={() => setConfirmDelete(v)}
                      title="Delete"
                      id={`vendor-delete-btn-${v.id}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="vendor-card-body">
                  <div className="vendor-detail-row">
                    <MapPin size={13} />
                    <span>{v.address}</span>
                  </div>
                  <div className="vendor-detail-row">
                    <Phone size={13} />
                    <span>{v.phone}</span>
                  </div>
                  <div className="vendor-detail-row">
                    <Truck size={13} />
                    <span>Capacity: <strong>{v.capacity} L</strong></span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Also show table on large screens */}
          <div className="card" style={{ display: 'none' }} className="vendor-table-card">
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Milk Type</th>
                    <th>Address</th>
                    <th>Phone</th>
                    <th>Capacity</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v, i) => (
                    <tr key={v.id}>
                      <td className="td-muted">{i + 1}</td>
                      <td><strong>{v.name}</strong></td>
                      <td><span className="badge badge-cyan">{v.milk_type}</span></td>
                      <td className="td-muted">{v.address}</td>
                      <td>{v.phone}</td>
                      <td>{v.capacity} L</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
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

      {/* Vendor Form Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">
                {editVendor ? 'Edit Vendor' : 'Add New Vendor'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)} id="vendor-modal-close-btn">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Vendor Name <span>*</span></label>
                  <input
                    id="vendor-name-input"
                    className="form-input"
                    type="text"
                    placeholder="e.g. Yamuna Dairy"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                  {errors.name && <p className="form-error">{errors.name}</p>}
                </div>

                <div className="form-group">
                  <label className="form-label">Address <span>*</span></label>
                  <input
                    id="vendor-address-input"
                    className="form-input"
                    type="text"
                    placeholder="e.g. Sewagram, Wardha"
                    value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                  />
                  {errors.address && <p className="form-error">{errors.address}</p>}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Phone <span>*</span></label>
                    <input
                      id="vendor-phone-input"
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
                    <label className="form-label">Capacity (Liters) <span>*</span></label>
                    <input
                      id="vendor-capacity-input"
                      className="form-input"
                      type="number"
                      placeholder="e.g. 500"
                      value={form.capacity}
                      onChange={e => setForm({ ...form, capacity: e.target.value })}
                      min="1"
                    />
                    {errors.capacity && <p className="form-error">{errors.capacity}</p>}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Milk Type <span>*</span></label>
                  <select
                    id="vendor-milktype-select"
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
                  id="vendor-form-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  id="vendor-form-save-btn"
                >
                  {saving ? (
                    <>
                      <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                      Saving...
                    </>
                  ) : (
                    editVendor ? 'Update Vendor' : 'Create Vendor'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete Vendor"
        message={`Are you sure you want to delete "${confirmDelete?.name}"? This will also remove all associated milk collections.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
        loading={deleting}
      />

      <style>{`
        .vendor-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .vendor-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          transition: all var(--transition);
        }

        .vendor-card:hover {
          border-color: var(--border-light);
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }

        .vendor-card-header {
          padding: 16px 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid var(--border);
        }

        .vendor-avatar {
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

        .vendor-card-info {
          flex: 1;
          min-width: 0;
        }

        .vendor-card-info h3 {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 4px;
        }

        .vendor-card-actions {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }

        .vendor-card-body {
          padding: 14px 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .vendor-detail-row {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-secondary);
          font-size: 13px;
        }

        .vendor-detail-row svg {
          color: var(--text-muted);
          flex-shrink: 0;
        }

        @media (max-width: 480px) {
          .vendor-cards-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
