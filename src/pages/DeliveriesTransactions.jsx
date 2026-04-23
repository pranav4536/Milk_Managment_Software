import React, { useState, useEffect, useCallback } from 'react';
import {
  deliveriesApi, customersApi, customerTransactionsApi
} from '../api';
import {
  Plus, Search, Edit2, Trash2, X, RefreshCw,
  Droplets, Calendar, DollarSign, CheckCircle,
  MessageCircle, ChevronDown, ChevronUp, Receipt,
  Truck, CreditCard, Banknote, TrendingUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';

/* ─── helpers ───────────────────────────────────────────────────────────────── */
const today = () => new Date().toISOString().split('T')[0];

const emptyDeliveryForm = {
  customer_id: '',
  date: today(),
  quantity: '',
  price: '',
  bottles_given: 0,
  bottles_returned: 0,
};

const emptyPayForm = {
  paid_amount: '',
  payment_mode: 'cash',
  notes: '',
};

const STATUS_COLOR = {
  Paid:    { bg: 'rgba(16,185,129,0.12)',  text: '#10b981', border: 'rgba(16,185,129,0.3)'  },
  Partial: { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b', border: 'rgba(245,158,11,0.3)'  },
  Pending: { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444', border: 'rgba(239,68,68,0.3)'   },
};

/* ─── main component ─────────────────────────────────────────────────────────── */
export default function DeliveriesTransactions() {
  /* data */
  const [customers,     setCustomers]     = useState([]);
  const [deliveries,    setDeliveries]    = useState([]);
  const [transactions,  setTransactions]  = useState([]);
  const [loading,       setLoading]       = useState(true);

  /* UI state */
  const [search,        setSearch]        = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [expandedCust,  setExpandedCust]  = useState(null); // customer id

  /* delivery modal */
  const [showDelModal,  setShowDelModal]  = useState(false);
  const [editDelivery,  setEditDelivery]  = useState(null);
  const [delForm,       setDelForm]       = useState(emptyDeliveryForm);
  const [delErrors,     setDelErrors]     = useState({});
  const [savingDel,     setSavingDel]     = useState(false);

  /* payment modal */
  const [showPayModal,  setShowPayModal]  = useState(false);
  const [payForCust,    setPayForCust]    = useState(null);
  const [payForm,       setPayForm]       = useState(emptyPayForm);
  const [savingPay,     setSavingPay]     = useState(false);

  /* confirm delete */
  const [confirmDel,    setConfirmDel]    = useState(null);
  const [deleting,      setDeleting]      = useState(false);

  /* ─── fetch all data ───────────────────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cusRes, delRes, txnRes] = await Promise.all([
        customersApi.getAll(0, 1000),
        deliveriesApi.getAll(0, 5000),
        customerTransactionsApi.getAll(0, 5000),
      ]);
      setCustomers(cusRes.data  || []);
      setDeliveries(delRes.data || []);
      setTransactions(txnRes.data || []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ─── per-customer helpers ─────────────────────────────────────────────────── */
  const custDels  = (cid) => deliveries.filter(d => d.customer_id === cid);
  const custTxns  = (cid) => transactions.filter(t => t.customer_id === cid);

  const custStats = (cid) => {
    const dels = custDels(cid);
    const txns = custTxns(cid);
    const totalDelivered = dels.reduce((s, d) => s + (d.price || 0), 0);
    const totalPaid      = txns.reduce((s, t) => s + (t.paid_amount || 0), 0);
    const totalPending   = Math.max(0, totalDelivered - totalPaid);
    const status = totalPending === 0 && totalDelivered > 0 ? 'Paid'
                 : totalPaid > 0 ? 'Partial' : 'Pending';
    return { totalDelivered, totalPaid, totalPending, status, delCount: dels.length };
  };

  /* ─── auto-sync transaction after delivery change ──────────────────────────── */
  const syncTransaction = async (custId) => {
    if (!custId) return;
    try {
      const [delRes, txnRes] = await Promise.all([
        deliveriesApi.getByCustomer(custId, 0, 10000),
        customerTransactionsApi.getByCustomer(custId),
      ]);
      const dels     = delRes.data || [];
      const txns     = txnRes.data || [];
      const newTotal = dels.reduce((s, d) => s + (d.price || 0), 0);
      if (dels.length === 0) return;

      const toUpdate = txns.find(t => t.status === 'Pending' || t.status === 'Partial');
      if (toUpdate) {
        await customerTransactionsApi.update(toUpdate.transaction_id || toUpdate.id, {
          customer_id:  custId,
          date:         toUpdate.date,
          total_amount: newTotal,
          paid_amount:  toUpdate.paid_amount || 0,
          payment_mode: toUpdate.payment_mode || 'cash',
          notes:        toUpdate.notes || '',
        });
      } else {
        await customerTransactionsApi.create({
          customer_id:  custId,
          date:         today(),
          total_amount: newTotal,
          paid_amount:  0,
          payment_mode: 'cash',
          notes:        'Auto-generated from deliveries',
        });
      }
    } catch { /* silent */ }
  };

  /* ─── delivery CRUD ────────────────────────────────────────────────────────── */
  const openAddDelivery = (custId) => {
    setEditDelivery(null);
    setDelForm({ ...emptyDeliveryForm, customer_id: String(custId) });
    setDelErrors({});
    setShowDelModal(true);
  };

  const openEditDelivery = (d) => {
    setEditDelivery(d);
    setDelForm({
      customer_id:      String(d.customer_id),
      date:             d.date || '',
      quantity:         d.quantity ?? '',
      price:            d.price ?? '',
      bottles_given:    d.bottles_given ?? 0,
      bottles_returned: d.bottles_returned ?? 0,
    });
    setDelErrors({});
    setShowDelModal(true);
  };

  const validateDel = () => {
    const e = {};
    if (!delForm.customer_id)                                                        e.customer_id = 'Select customer';
    if (!delForm.date)                                                               e.date        = 'Select date';
    if (delForm.quantity === '' || isNaN(+delForm.quantity) || +delForm.quantity<0)  e.quantity    = 'Enter valid quantity';
    if (delForm.price    === '' || isNaN(+delForm.price)    || +delForm.price<0)     e.price       = 'Enter valid price';
    return e;
  };

  const handleSaveDelivery = async (ev) => {
    ev.preventDefault();
    const errs = validateDel();
    if (Object.keys(errs).length) { setDelErrors(errs); return; }
    setSavingDel(true);
    try {
      const payload = {
        customer_id:      Number(delForm.customer_id),
        date:             delForm.date,
        quantity:         Number(delForm.quantity),
        price:            Number(delForm.price),
        bottles_given:    Number(delForm.bottles_given),
        bottles_returned: Number(delForm.bottles_returned),
      };
      if (editDelivery) {
        const { date: _d, ...rest } = payload;
        await deliveriesApi.update(editDelivery.delivery_id || editDelivery.id, rest);
        toast.success('Delivery updated!');
      } else {
        await deliveriesApi.create(payload);
        toast.success('Delivery added!');
      }
      setShowDelModal(false);
      await fetchAll();
      await syncTransaction(Number(delForm.customer_id));
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : detail || 'Failed to save');
    } finally {
      setSavingDel(false);
    }
  };

  const handleDeleteDelivery = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    const custId = confirmDel.customer_id;
    try {
      await deliveriesApi.delete(confirmDel.delivery_id || confirmDel.id);
      toast.success('Delivery deleted');
      setConfirmDel(null);
      await fetchAll();
      await syncTransaction(custId);
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  /* ─── payment recording ────────────────────────────────────────────────────── */
  const openPayModal = (cust) => {
    setPayForCust(cust);
    setPayForm(emptyPayForm);
    setShowPayModal(true);
  };

  const handleSavePayment = async (ev) => {
    ev.preventDefault();
    if (!payForm.paid_amount || isNaN(+payForm.paid_amount) || +payForm.paid_amount <= 0) {
      toast.error('Enter a valid paid amount');
      return;
    }
    setSavingPay(true);
    const custId = payForCust.customer_id || payForCust.id;
    try {
      const txns     = custTxns(custId);
      const toUpdate = txns.find(t => t.status === 'Pending' || t.status === 'Partial');
      const dels     = custDels(custId);
      const totalBill = dels.reduce((s, d) => s + (d.price || 0), 0);

      if (toUpdate) {
        const newPaid = (toUpdate.paid_amount || 0) + Number(payForm.paid_amount);
        await customerTransactionsApi.update(toUpdate.transaction_id || toUpdate.id, {
          customer_id:  custId,
          date:         today(),
          total_amount: totalBill,
          paid_amount:  newPaid,
          payment_mode: payForm.payment_mode,
          notes:        payForm.notes || toUpdate.notes || '',
        });
      } else {
        await customerTransactionsApi.create({
          customer_id:  custId,
          date:         today(),
          total_amount: totalBill,
          paid_amount:  Number(payForm.paid_amount),
          payment_mode: payForm.payment_mode,
          notes:        payForm.notes || '',
        });
      }
      toast.success('Payment recorded! ✅');
      setShowPayModal(false);
      fetchAll();
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(Array.isArray(detail) ? detail.map(d => d.msg).join(', ') : detail || 'Failed to save payment');
    } finally {
      setSavingPay(false);
    }
  };

  /* ─── whatsapp bill ────────────────────────────────────────────────────────── */
  const sendBill = (cust) => {
    const phone = cust.phone;
    if (!phone) { toast.error('No phone number for this customer'); return; }
    const stats  = custStats(cust.customer_id || cust.id);
    const num    = phone.toString().replace(/\D/g, '');
    const full   = num.length === 10 ? `91${num}` : num;
    const msg    = `Hello ${cust.name} 👋\n\n🥛 *Milk Delivery Summary*\n📦 Deliveries: ${stats.delCount}\n💰 Total Bill: ₹${stats.totalDelivered.toLocaleString()}\n✅ Paid: ₹${stats.totalPaid.toLocaleString()}\n⏳ Pending: ₹${stats.totalPending.toLocaleString()}\n\nKindly pay the pending amount at your earliest convenience.\n\nThank you! 🙏`;
    window.open(`https://wa.me/${full}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  /* ─── filter ───────────────────────────────────────────────────────────────── */
  const filteredCustomers = customers.filter(c => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search);
    const stats = custStats(c.customer_id || c.id);
    const matchStatus = !filterStatus || stats.status === filterStatus;
    return matchSearch && matchStatus;
  });

  /* ─── summary totals ───────────────────────────────────────────────────────── */
  const grandTotal    = deliveries.reduce((s, d) => s + (d.price || 0), 0);
  const grandPaid     = transactions.reduce((s, t) => s + (t.paid_amount || 0), 0);
  const grandPending  = Math.max(0, grandTotal - grandPaid);
  const grandQty      = deliveries.reduce((s, d) => s + (d.quantity || 0), 0);

  /* ═══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="page-container">

      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg,#3b82f6,#06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(59,130,246,0.4)'
          }}>
            <Truck size={22} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Deliveries & Transactions</h2>
            <p style={{ margin: 0, marginTop: 2, fontSize: 13, color: 'var(--text-muted)' }}>
              Delivery records with auto-synced payment tracking per customer
            </p>
          </div>
        </div>
      </div>

      {/* ─── 4 Stat Cards ────────────────────────────────────────────────────── */}
      <div className="dt-stats">
        {[
          { label: 'Total Milk',    value: `${grandQty} L`,                       icon: <Droplets size={18}/>,     color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
          { label: 'Total Billed',  value: `₹${grandTotal.toLocaleString()}`,      icon: <Receipt size={18}/>,      color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
          { label: 'Collected',     value: `₹${grandPaid.toLocaleString()}`,        icon: <CheckCircle size={18}/>,  color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
          { label: 'Pending',       value: `₹${grandPending.toLocaleString()}`,     icon: <DollarSign size={18}/>,   color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
        ].map(s => (
          <div key={s.label} className="dt-stat-card">
            <div style={{ width: 40, height: 40, borderRadius: 10, background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {grandTotal > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>
            <span>Collection Progress</span>
            <span style={{ color: grandPending > grandPaid ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
              {Math.round((grandPaid / grandTotal) * 100)}% collected · {Math.round((grandPending / grandTotal) * 100)}% pending
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${Math.round((grandPaid / grandTotal) * 100)}%`,
              background: 'linear-gradient(90deg,#10b981,#06b6d4)',
              transition: 'width 0.6s ease'
            }} />
          </div>
        </div>
      )}

      {/* ─── Filters ─────────────────────────────────────────────────────────── */}
      <div className="dt-filter-row">
        <div className="search-bar" style={{ flex: 1, maxWidth: '100%' }}>
          <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search customer or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
              <X size={13} />
            </button>
          )}
        </div>
        <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 'auto', minWidth: 130 }}>
          <option value="">All Status</option>
          <option value="Paid">✅ Paid</option>
          <option value="Partial">🔶 Partial</option>
          <option value="Pending">🔴 Pending</option>
        </select>
        <button className="btn btn-secondary btn-sm" onClick={fetchAll} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* ─── Customer Cards ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🥛</div>
            <h3>{search || filterStatus ? 'No results' : 'No customers yet'}</h3>
            <p>Add customers first to track deliveries &amp; payments</p>
          </div>
        </div>
      ) : (
        <div className="dt-customer-list">
          {filteredCustomers.map(cust => {
            const cid    = cust.customer_id || cust.id;
            const stats  = custStats(cid);
            const dels   = custDels(cid);
            const txns   = custTxns(cid);
            const isOpen = expandedCust === cid;
            const sc     = STATUS_COLOR[stats.status] || STATUS_COLOR.Pending;
            const pct    = stats.totalDelivered > 0 ? Math.round((stats.totalPaid / stats.totalDelivered) * 100) : 0;

            return (
              <div key={cid} className="dt-cust-card">
                {/* Status stripe */}
                <div className="dt-stripe" style={{ background: sc.text }} />

                {/* Customer header */}
                <div className="dt-cust-header">
                  <div className="dt-cust-left">
                    <div className="dt-avatar">{cust.name?.charAt(0).toUpperCase()}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="dt-cust-name">{cust.name}</div>
                      {cust.phone && <div className="dt-cust-phone">📱 {cust.phone}</div>}
                    </div>
                  </div>
                  <div className="dt-cust-right">
                    <span className="dt-status-badge" style={{ background: sc.bg, color: sc.text, borderColor: sc.border }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.text, display: 'inline-block' }} />
                      {stats.status}
                    </span>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => openAddDelivery(cid)}
                      title="Add Delivery"
                    >
                      <Plus size={13} /> Add Delivery
                    </button>
                    <button
                      className="btn btn-sm dt-toggle-btn"
                      onClick={() => setExpandedCust(isOpen ? null : cid)}
                      title={isOpen ? 'Collapse' : 'Expand'}
                    >
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Amount metrics */}
                <div className="dt-metrics">
                  <div className="dt-metric">
                    <span className="dt-metric-lbl">DELIVERIES</span>
                    <span className="dt-metric-val" style={{ color: 'var(--accent)' }}>{stats.delCount}</span>
                  </div>
                  <div className="dt-metric-div" />
                  <div className="dt-metric">
                    <span className="dt-metric-lbl">TOTAL BILL</span>
                    <span className="dt-metric-val">₹{stats.totalDelivered.toLocaleString()}</span>
                  </div>
                  <div className="dt-metric-div" />
                  <div className="dt-metric">
                    <span className="dt-metric-lbl">PAID</span>
                    <span className="dt-metric-val" style={{ color: '#10b981' }}>₹{stats.totalPaid.toLocaleString()}</span>
                  </div>
                  <div className="dt-metric-div" />
                  <div className="dt-metric">
                    <span className="dt-metric-lbl">PENDING</span>
                    <span className="dt-metric-val" style={{ color: stats.totalPending > 0 ? '#ef4444' : '#10b981' }}>
                      ₹{stats.totalPending.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Mini progress bar */}
                <div style={{ padding: '6px 16px 10px' }}>
                  <div style={{ height: 4, borderRadius: 99, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: 'linear-gradient(90deg,#10b981,#06b6d4)', transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                    <span>{pct}% paid</span>
                    <span>{100 - pct}% pending</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="dt-cust-footer">
                  <button className="dt-foot-btn dt-pay-btn" onClick={() => openPayModal(cust)}>
                    <CreditCard size={13} /> Record Payment
                  </button>
                  <button className="dt-foot-btn dt-wa-btn" onClick={() => sendBill(cust)}>
                    <MessageCircle size={13} /> Send Bill
                  </button>
                  <button
                    className={`dt-foot-btn dt-view-btn ${isOpen ? 'dt-view-btn--active' : ''}`}
                    onClick={() => setExpandedCust(isOpen ? null : cid)}
                  >
                    <Truck size={13} /> {isOpen ? 'Hide' : 'View'} Details
                    {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>

                {/* ── Expanded Panel ──────────────────────────────────── */}
                {isOpen && (
                  <div className="dt-expanded">
                    {/* Deliveries Section */}
                    <div className="dt-section">
                      <div className="dt-section-head">
                        <Droplets size={14} style={{ color: 'var(--accent)' }} />
                        <span>Delivery Records</span>
                        <span className="dt-section-count">{dels.length}</span>
                      </div>
                      {dels.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>
                          No deliveries yet
                        </p>
                      ) : (
                        <>
                          <div className="dt-table-head dt-del-cols">
                            <span>Date</span><span>Qty</span><span>Amount</span><span>Bottles</span><span></span>
                          </div>
                          <div className="dt-scroll">
                            {dels.slice().sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1).map(d => (
                              <div key={d.delivery_id || d.id} className="dt-table-row dt-del-cols">
                                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                                  <Calendar size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                                  {d.date}
                                </span>
                                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{d.quantity} L</span>
                                <span style={{ color: 'var(--success)', fontWeight: 600 }}>₹{d.price}</span>
                                <span style={{ color: 'var(--warning)', fontSize: 12 }}>{d.bottles_given}/{d.bottles_returned}</span>
                                <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                  <button className="btn btn-secondary btn-icon btn-sm" onClick={() => openEditDelivery(d)} title="Edit">
                                    <Edit2 size={11} />
                                  </button>
                                  <button className="btn btn-danger btn-icon btn-sm" onClick={() => setConfirmDel(d)} title="Delete">
                                    <Trash2 size={11} />
                                  </button>
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="dt-table-total dt-del-cols">
                            <span>Total · {dels.length} days</span>
                            <span style={{ color: 'var(--accent)' }}>{dels.reduce((s, d) => s + (d.quantity || 0), 0)} L</span>
                            <span style={{ color: 'var(--success)' }}>₹{dels.reduce((s, d) => s + (d.price || 0), 0).toLocaleString()}</span>
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                            <span></span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Payments / Transactions Section */}
                    <div className="dt-section" style={{ borderTop: '1px dashed var(--border)' }}>
                      <div className="dt-section-head">
                        <Receipt size={14} style={{ color: '#3b82f6' }} />
                        <span>Payment History</span>
                        <span className="dt-section-count">{txns.length}</span>
                      </div>
                      {txns.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0', textAlign: 'center' }}>
                          No payment records yet — click <strong>Record Payment</strong> to add one
                        </p>
                      ) : (
                        <>
                          <div className="dt-table-head dt-txn-cols">
                            <span>Date</span><span>Total Bill</span><span>Paid</span><span>Pending</span><span>Mode</span><span>Status</span>
                          </div>
                          <div className="dt-scroll">
                            {txns.slice().sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1).map(t => {
                              const tsc = STATUS_COLOR[t.status] || STATUS_COLOR.Pending;
                              return (
                                <div key={t.transaction_id || t.id} className="dt-table-row dt-txn-cols">
                                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.date}</span>
                                  <span style={{ fontWeight: 600 }}>₹{(t.total_amount || 0).toLocaleString()}</span>
                                  <span style={{ color: '#10b981', fontWeight: 600 }}>₹{(t.paid_amount || 0).toLocaleString()}</span>
                                  <span style={{ color: (t.pending_amount || 0) > 0 ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                                    ₹{(t.pending_amount || 0).toLocaleString()}
                                  </span>
                                  <span style={{ fontSize: 12, textTransform: 'capitalize', color: 'var(--text-muted)' }}>
                                    {t.payment_mode === 'cash' ? '💵' : '💳'} {t.payment_mode}
                                  </span>
                                  <span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: tsc.bg, color: tsc.text, border: `1px solid ${tsc.border}` }}>
                                      {t.status}
                                    </span>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ Delivery Modal ═══════════════════════════════════════════════════════ */}
      {showDelModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#06b6d4,#3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Droplets size={16} color="#fff" />
                </div>
                {editDelivery ? 'Edit Delivery' : 'Add Delivery'}
              </h2>
              <button className="modal-close" onClick={() => setShowDelModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleSaveDelivery}>
              <div className="modal-body" style={{ paddingTop: 20 }}>
                {/* Customer */}
                <div className="form-group">
                  <label className="form-label">Customer <span>*</span></label>
                  <select className="form-select" value={delForm.customer_id}
                    onChange={e => setDelForm({ ...delForm, customer_id: e.target.value })}
                    disabled={!!editDelivery}>
                    <option value="">Select customer…</option>
                    {customers.map(c => (
                      <option key={c.customer_id || c.id} value={c.customer_id || c.id}>{c.name}</option>
                    ))}
                  </select>
                  {delErrors.customer_id && <p className="form-error">{delErrors.customer_id}</p>}
                </div>

                {/* Date */}
                <div className="form-group">
                  <label className="form-label">Delivery Date <span>*</span></label>
                  <input className="form-input" type="date" value={delForm.date}
                    onChange={e => setDelForm({ ...delForm, date: e.target.value })} disabled={!!editDelivery} />
                  {delErrors.date && <p className="form-error">{delErrors.date}</p>}
                </div>

                {/* Qty + Price */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Quantity (L) <span>*</span></label>
                    <input className="form-input" type="number" step="0.5" min="0" placeholder="e.g. 2"
                      value={delForm.quantity} onChange={e => setDelForm({ ...delForm, quantity: e.target.value })} />
                    {delErrors.quantity && <p className="form-error">{delErrors.quantity}</p>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Price (₹) <span>*</span></label>
                    <input className="form-input" type="number" step="0.01" min="0" placeholder="e.g. 60"
                      value={delForm.price} onChange={e => setDelForm({ ...delForm, price: e.target.value })} />
                    {delErrors.price && <p className="form-error">{delErrors.price}</p>}
                  </div>
                </div>

                {/* Bottles */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Bottles Given</label>
                    <input className="form-input" type="number" min="0"
                      value={delForm.bottles_given} onChange={e => setDelForm({ ...delForm, bottles_given: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Bottles Returned</label>
                    <input className="form-input" type="number" min="0"
                      value={delForm.bottles_returned} onChange={e => setDelForm({ ...delForm, bottles_returned: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDelModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingDel} style={{ minWidth: 140 }}>
                  {savingDel ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Saving…</> : editDelivery ? 'Update Delivery' : 'Add Delivery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Payment Modal ═══════════════════════════════════════════════════════ */}
      {showPayModal && payForCust && (() => {
        const cid   = payForCust.customer_id || payForCust.id;
        const stats = custStats(cid);
        return (
          <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: 440 }}>
              <div className="modal-header">
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#10b981,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CreditCard size={16} color="#fff" />
                  </div>
                  Record Payment — {payForCust.name}
                </h2>
                <button className="modal-close" onClick={() => setShowPayModal(false)}><X size={16} /></button>
              </div>
              <form onSubmit={handleSavePayment}>
                <div className="modal-body" style={{ paddingTop: 20 }}>
                  {/* Pending summary */}
                  <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                    <div style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>TOTAL BILL</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>₹{stats.totalDelivered.toLocaleString()}</div>
                    </div>
                    <div style={{ flex: 1, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>PENDING</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>₹{stats.totalPending.toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Amount Paid (₹) <span>*</span></label>
                    <input className="form-input" type="number" step="0.01" min="0"
                      placeholder={`Max ₹${stats.totalPending}`}
                      value={payForm.paid_amount}
                      onChange={e => setPayForm({ ...payForm, paid_amount: e.target.value })}
                      autoFocus />
                    {payForm.paid_amount && (
                      <p style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>
                        Remaining after this: ₹{Math.max(0, stats.totalPending - Number(payForm.paid_amount)).toFixed(2)}
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Payment Mode</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {['cash', 'online'].map(mode => (
                        <label key={mode} onClick={() => setPayForm({ ...payForm, payment_mode: mode })}
                          style={{
                            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                            padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                            border: `2px solid ${payForm.payment_mode === mode ? 'var(--primary)' : 'var(--border)'}`,
                            background: payForm.payment_mode === mode ? 'rgba(59,130,246,0.08)' : 'transparent',
                            transition: 'all 0.15s', fontSize: 14, fontWeight: 600,
                            color: payForm.payment_mode === mode ? 'var(--text-primary)' : 'var(--text-secondary)'
                          }}>
                          <span style={{ fontSize: 18 }}>{mode === 'cash' ? '💵' : '💳'}</span>
                          <span style={{ textTransform: 'capitalize' }}>{mode}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Notes (optional)</label>
                    <input className="form-input" type="text" placeholder="e.g. cleared April dues"
                      value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowPayModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={savingPay} style={{ minWidth: 160 }}>
                    {savingPay ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Saving…</> : '✅ Confirm Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Confirm delete delivery */}
      <ConfirmDialog
        isOpen={!!confirmDel}
        title="Delete Delivery"
        message={`Delete delivery for "${customers.find(c => (c.customer_id||c.id) === confirmDel?.customer_id)?.name || ''}" on ${confirmDel?.date}?`}
        onConfirm={handleDeleteDelivery}
        onCancel={() => setConfirmDel(null)}
        loading={deleting}
      />

      {/* ─── Scoped Styles ─────────────────────────────────────────────────────── */}
      <style>{`
        /* ── Stats ────────────────────────────────────────── */
        .dt-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 14px;
        }
        .dt-stat-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 14px 16px;
          display: flex; align-items: center; gap: 12px;
          transition: all 0.2s;
        }
        .dt-stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }

        /* ── Filters ──────────────────────────────────────── */
        .dt-filter-row {
          display: flex; align-items: center; gap: 10px;
          flex-wrap: wrap; margin-bottom: 18px;
        }

        /* ── Customer list ────────────────────────────────── */
        .dt-customer-list { display: flex; flex-direction: column; gap: 14px; }

        .dt-cust-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          transition: all 0.2s;
        }
        .dt-cust-card:hover { border-color: var(--border-light); box-shadow: 0 6px 24px rgba(0,0,0,0.3); }

        .dt-stripe { height: 3px; width: 100%; }

        .dt-cust-header {
          padding: 14px 16px 12px;
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          border-bottom: 1px solid var(--border);
          flex-wrap: wrap;
        }
        .dt-cust-left  { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
        .dt-cust-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }

        .dt-avatar {
          width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, var(--primary), var(--accent));
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-weight: 700; font-size: 17px;
          box-shadow: 0 3px 10px rgba(59,130,246,0.35);
        }
        .dt-cust-name  { font-weight: 700; font-size: 15px; color: var(--text-primary); }
        .dt-cust-phone { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

        .dt-status-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;
          border: 1px solid;
        }

        .dt-toggle-btn {
          width: 34px; height: 34px; padding: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--bg-elevated); border: 1px solid var(--border);
          border-radius: 8px; cursor: pointer; color: var(--text-secondary);
          transition: all 0.2s;
        }
        .dt-toggle-btn:hover { background: var(--border); color: var(--text-primary); }

        /* ── Metrics bar ──────────────────────────────────── */
        .dt-metrics {
          display: flex; border-bottom: 1px solid var(--border);
        }
        .dt-metric {
          flex: 1; padding: 10px 14px;
          display: flex; flex-direction: column; gap: 2px;
        }
        .dt-metric-lbl { font-size: 9px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.07em; }
        .dt-metric-val { font-size: 15px; font-weight: 700; color: var(--text-primary); }
        .dt-metric-div { width: 1px; background: var(--border); flex-shrink: 0; }

        /* ── Footer actions ───────────────────────────────── */
        .dt-cust-footer {
          padding: 10px 12px;
          display: flex; gap: 8px;
        }
        .dt-foot-btn {
          display: flex; align-items: center; gap: 5px;
          flex: 1; justify-content: center;
          border-radius: var(--radius-md);
          padding: 8px 10px; font-size: 12px; font-weight: 600; cursor: pointer;
          transition: all 0.15s; border: 1px solid;
        }
        .dt-pay-btn {
          background: rgba(16,185,129,0.12); color: #10b981; border-color: rgba(16,185,129,0.3);
        }
        .dt-pay-btn:hover { background: rgba(16,185,129,0.22); }
        .dt-wa-btn {
          background: rgba(37,211,102,0.12); color: #25D366; border-color: rgba(37,211,102,0.3);
        }
        .dt-wa-btn:hover { background: rgba(37,211,102,0.22); }
        .dt-view-btn {
          background: var(--bg-elevated); color: var(--text-secondary); border-color: var(--border);
        }
        .dt-view-btn:hover, .dt-view-btn--active {
          background: rgba(6,182,212,0.12); color: var(--accent); border-color: var(--accent);
        }

        /* ── Expanded panel ───────────────────────────────── */
        .dt-expanded {
          border-top: 1px dashed var(--border);
          background: var(--bg-elevated);
          animation: slideDown 0.2s ease;
        }
        @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:none} }

        .dt-section { padding: 14px; }
        .dt-section-head {
          display: flex; align-items: center; gap: 7px;
          font-size: 12px; font-weight: 700; color: var(--text-secondary);
          margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em;
        }
        .dt-section-count {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 20px; padding: 1px 8px; font-size: 10px;
          color: var(--text-muted); margin-left: 2px;
        }

        .dt-table-head {
          display: grid; gap: 6px; padding: 6px 10px;
          font-size: 9px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.07em;
          border-bottom: 1px solid var(--border);
          background: rgba(255,255,255,0.02);
        }
        .dt-scroll { max-height: 200px; overflow-y: auto; }
        .dt-table-row {
          display: grid; gap: 6px; padding: 7px 10px;
          font-size: 12px; border-bottom: 1px solid rgba(51,65,85,0.4);
          transition: background 0.1s; align-items: center;
        }
        .dt-table-row:hover { background: rgba(255,255,255,0.03); }
        .dt-table-total {
          display: grid; gap: 6px; padding: 7px 10px;
          font-size: 12px; font-weight: 700;
          background: rgba(59,130,246,0.06);
          border-top: 1px solid var(--border);
        }

        .dt-del-cols { grid-template-columns: 1.4fr 0.6fr 0.8fr 0.6fr 0.7fr; }
        .dt-txn-cols { grid-template-columns: 1fr 1fr 1fr 1fr 0.9fr 0.9fr; }

        /* ── Responsive ─────────────────────────────────────── */
        @media (max-width: 900px) {
          .dt-stats { grid-template-columns: 1fr 1fr; }
          .dt-del-cols { grid-template-columns: 1.2fr 0.6fr 0.8fr 0.6fr 0.6fr; }
          .dt-txn-cols { grid-template-columns: 0.8fr 1fr 1fr 1fr 0.8fr 0.8fr; }
        }
        @media (max-width: 640px) {
          .dt-stats { grid-template-columns: 1fr 1fr; gap: 8px; }
          .dt-cust-header { gap: 8px; }
          .dt-cust-right { gap: 6px; }
          .dt-metrics { flex-wrap: wrap; }
          .dt-metric { min-width: 50%; }
          .dt-del-cols { grid-template-columns: 1fr 0.5fr 0.7fr 0.5fr 0.5fr; font-size: 11px; }
          .dt-txn-cols { grid-template-columns: 0.8fr 1fr 1fr 1fr 0fr 0.8fr; }
          .dt-txn-cols span:nth-child(5) { display: none; }
        }
      `}</style>
    </div>
  );
}
