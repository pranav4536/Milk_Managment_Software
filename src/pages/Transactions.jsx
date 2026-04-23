import React, { useState, useEffect } from 'react';
import { customerTransactionsApi, customersApi, deliveriesApi } from '../api';
import {
  Plus, Search, X, Edit2, Trash2, RefreshCw,
  MessageCircle, ChevronDown, ChevronUp,
  DollarSign, Calendar, Truck, CheckCircle, Receipt
} from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';

const STATUS_META = {
  Paid:    { cls: 'badge-paid',    dot: '#10b981' },
  Partial: { cls: 'badge-partial', dot: '#f59e0b' },
  Pending: { cls: 'badge-pending', dot: '#ef4444' },
};

const emptyForm = {
  customer_id: '',
  date: new Date().toISOString().split('T')[0],
  total_amount: '',
  paid_amount: '',
  payment_mode: 'cash',
  notes: '',
};

export default function Transactions() {
  const [transactions,      setTransactions]      = useState([]);
  const [customers,         setCustomers]          = useState([]);
  const [loading,           setLoading]            = useState(true);
  const [showModal,         setShowModal]          = useState(false);
  const [editItem,          setEditItem]           = useState(null);
  const [form,              setForm]               = useState(emptyForm);
  const [saving,            setSaving]             = useState(false);
  const [search,            setSearch]             = useState('');
  const [filterCustomer,    setFilterCustomer]     = useState('');
  const [filterStatus,      setFilterStatus]       = useState('');
  const [filterFrom,        setFilterFrom]         = useState('');
  const [filterTo,          setFilterTo]           = useState('');
  const [confirmDelete,     setConfirmDelete]      = useState(null);
  const [deleting,          setDeleting]           = useState(false);
  const [errors,            setErrors]             = useState({});
  const [expandedTxn,       setExpandedTxn]        = useState(null);
  const [expandDeliveries,  setExpandDeliveries]   = useState({});
  const [custDeliveries,    setCustDeliveries]     = useState({});
  const [loadingDel,        setLoadingDel]         = useState({});

  // ─── Data ────────────────────────────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    try {
      const [txRes, cusRes] = await Promise.all([
        customerTransactionsApi.getAll(0, 1000),
        customersApi.getAll(0, 1000),
      ]);
      setTransactions(txRes.data || []);
      setCustomers(cusRes.data || []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchAll(); }, []);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const getCustomer = (id) => customers.find(c => (c.customer_id || c.id) === id);
  const getCustomerName  = (id) => getCustomer(id)?.name  || `Customer #${id}`;
  const getCustomerPhone = (id) => getCustomer(id)?.phone || '';

  // ─── Toggle deliveries panel ─────────────────────────────────────────────────
  const toggleDeliveries = async (txnId, custId) => {
    const key = `${txnId}`;
    if (expandDeliveries[key]) {
      setExpandDeliveries(p => ({ ...p, [key]: false }));
      return;
    }
    setExpandDeliveries(p => ({ ...p, [key]: true }));
    if (custDeliveries[custId]) return; // cached
    setLoadingDel(p => ({ ...p, [key]: true }));
    try {
      const res = await deliveriesApi.getByCustomer(custId);
      setCustDeliveries(p => ({ ...p, [custId]: res.data || [] }));
    } catch { toast.error('Failed to load deliveries'); }
    finally { setLoadingDel(p => ({ ...p, [key]: false })); }
  };

  // ─── Auto-fill total from deliveries ─────────────────────────────────────────
  const handleCustomerChange = async (cid) => {
    setForm(f => ({ ...f, customer_id: cid, total_amount: '' }));
    if (!cid) return;
    try {
      const res = await deliveriesApi.getByCustomer(cid);
      const total = (res.data || []).reduce((s, d) => s + (d.price || 0), 0);
      setForm(f => ({ ...f, customer_id: cid, total_amount: total.toFixed(2) }));
    } catch { /* ignore */ }
  };

  // ─── CRUD ─────────────────────────────────────────────────────────────────────
  const openCreate = () => { setEditItem(null); setForm({...emptyForm}); setErrors({}); setShowModal(true); };
  const openEdit   = (t) => {
    setEditItem(t);
    setForm({ customer_id: t.customer_id, date: t.date||'',
              total_amount: t.total_amount??'', paid_amount: t.paid_amount??'',
              payment_mode: t.payment_mode||'cash', notes: t.notes||'' });
    setErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const e = {};
    if (!form.customer_id) e.customer_id = 'Select a customer';
    if (!form.date) e.date = 'Select date';
    if (form.total_amount===''||isNaN(+form.total_amount)||+form.total_amount<0) e.total_amount='Enter valid total';
    if (form.paid_amount===''||isNaN(+form.paid_amount)||+form.paid_amount<0)   e.paid_amount='Enter valid paid amount';
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
        total_amount: parseFloat(form.total_amount),
        paid_amount:  parseFloat(form.paid_amount),
        payment_mode: form.payment_mode,
        notes: form.notes,
      };
      if (editItem) {
        await customerTransactionsApi.update(editItem.transaction_id||editItem.id, payload);
        toast.success('Transaction updated!');
      } else {
        await customerTransactionsApi.create(payload);
        toast.success('Transaction added!');
      }
      setShowModal(false);
      fetchAll();
    } catch (err) {
      const d = err.response?.data?.detail;
      toast.error(Array.isArray(d) ? d.map(x=>x.msg).join(', ') : d||'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await customerTransactionsApi.delete(confirmDelete.transaction_id||confirmDelete.id);
      toast.success('Deleted'); setConfirmDelete(null); fetchAll();
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(false); }
  };

  // ─── WhatsApp ────────────────────────────────────────────────────────────────
  const sendBill = (t) => {
    const phone = getCustomerPhone(t.customer_id);
    if (!phone) { toast.error('No phone number'); return; }
    const name = getCustomerName(t.customer_id);
    const msg = `Hello ${name} 👋\n\n🥛 *Milk Delivery Bill*\n📅 Date: ${t.date}\n💰 Total: ₹${t.total_amount}\n✅ Paid: ₹${t.paid_amount}\n⏳ Pending: ₹${t.pending_amount}\n📊 Status: ${t.status}\n\nKindly pay the pending amount at your earliest convenience.\n\nThank you! 🙏`;
    const num = phone.toString().replace(/\D/g,'');
    const full = num.length===10 ? `91${num}` : num;
    window.open(`https://wa.me/${full}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // ─── Filter & Stats ───────────────────────────────────────────────────────────
  const filtered = transactions.filter(t => {
    const name = getCustomerName(t.customer_id).toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) ||
      (t.date||'').includes(search) || String(t.total_amount).includes(search);
    const matchCust   = !filterCustomer || String(t.customer_id) === filterCustomer;
    const matchStatus = !filterStatus   || t.status === filterStatus;
    const matchFrom   = !filterFrom || (t.date || '') >= filterFrom;
    const matchTo     = !filterTo   || (t.date || '') <= filterTo;
    return matchSearch && matchCust && matchStatus && matchFrom && matchTo;
  });

  const totalBilled  = filtered.reduce((s,t)=>s+(t.total_amount||0),0);
  const totalPaid    = filtered.reduce((s,t)=>s+(t.paid_amount||0),0);
  const totalPending = filtered.reduce((s,t)=>s+(t.pending_amount||0),0);
  const pendingPct   = totalBilled > 0 ? Math.round((totalPending/totalBilled)*100) : 0;

  const pendingAmt = form.total_amount!==''&&form.paid_amount!==''
    ? Math.max(0, Number(form.total_amount)-Number(form.paid_amount)) : null;

  return (
    <div className="page-container">
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:42, height:42, borderRadius:12,
            background:'linear-gradient(135deg,#3b82f6,#06b6d4)',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 4px 14px rgba(59,130,246,0.4)', flexShrink:0 }}>
            <Receipt size={20} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin:0 }}>Transactions</h2>
            <p style={{ margin:0, marginTop:2, fontSize:13, color:'var(--text-muted)' }}>
              Billing &amp; payment tracking
            </p>
          </div>
        </div>
      </div>

      {/* ─── 4 Stat Cards ───────────────────────────────────────────────────── */}
      <div className="t-stats">
        {[
          { label:'Total Billed',  value:`₹${totalBilled.toLocaleString()}`,  icon:<DollarSign size={18}/>, color:'#3b82f6',  bg:'rgba(59,130,246,0.12)' },
          { label:'Collected',     value:`₹${totalPaid.toLocaleString()}`,     icon:<CheckCircle size={18}/>, color:'#10b981', bg:'rgba(16,185,129,0.12)' },
          { label:'Pending',       value:`₹${totalPending.toLocaleString()}`,  icon:<Calendar size={18}/>,   color:'#ef4444',  bg:'rgba(239,68,68,0.12)'  },
          { label:'Records',       value:filtered.length,                      icon:<Receipt size={18}/>,     color:'#8b5cf6',  bg:'rgba(139,92,246,0.12)' },
        ].map(s => (
          <div key={s.label} className="t-stat-card">
            <div className="t-stat-icon" style={{ background:s.bg, color:s.color }}>{s.icon}</div>
            <div>
              <div className="t-stat-lbl">{s.label}</div>
              <div className="t-stat-val" style={{ color: s.color===''?undefined:undefined }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Pending progress bar */}
      {totalBilled>0 && (
        <div style={{ marginBottom:18 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text-muted)', marginBottom:6 }}>
            <span>Collection Progress</span>
            <span style={{ color: pendingPct>50?'var(--danger)':'var(--success)', fontWeight:600 }}>
              {100-pendingPct}% collected · {pendingPct}% pending
            </span>
          </div>
          <div style={{ height:6, borderRadius:99, background:'var(--bg-elevated)', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${100-pendingPct}%`, borderRadius:99,
              background:'linear-gradient(90deg,#10b981,#06b6d4)', transition:'width 0.6s ease' }} />
          </div>
        </div>
      )}

      {/* ─── Filters Row ────────────────────────────────────────────────────── */}
      <div className="t-filter-row">
        <div className="search-bar" style={{ flex:1, maxWidth:'100%' }}>
          <Search size={15} style={{ color:'var(--text-muted)', flexShrink:0 }} />
          <input
            type="text"
            placeholder="Search customer, date, amount…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}>
              <X size={13} />
            </button>
          )}
        </div>
        <select className="form-select t-filter-sel"
          value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)}>
          <option value="">All Customers</option>
          {customers.map(c => (
            <option key={c.customer_id||c.id} value={c.customer_id||c.id}>{c.name}</option>
          ))}
        </select>
        <select className="form-select t-filter-sel"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="Paid">✅ Paid</option>
          <option value="Partial">🔶 Partial</option>
          <option value="Pending">🔴 Pending</option>
        </select>
        {/* Date range */}
        <input
          type="date"
          className="form-input t-date-filter"
          value={filterFrom}
          onChange={e => setFilterFrom(e.target.value)}
          title="From date"
          placeholder="From"
          style={{ width: 148 }}
        />
        <input
          type="date"
          className="form-input t-date-filter"
          value={filterTo}
          onChange={e => setFilterTo(e.target.value)}
          title="To date"
          placeholder="To"
          style={{ width: 148 }}
        />
        {(filterFrom || filterTo) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setFilterFrom(''); setFilterTo(''); }}
            title="Clear date filter"
          >
            <X size={13} />
          </button>
        )}
        <button className="btn btn-secondary btn-sm" onClick={fetchAll} title="Refresh">
          <RefreshCw size={14} />
        </button>
        <button className="btn btn-primary" onClick={openCreate} id="txn-add-btn">
          <Plus size={16} /> <span className="t-btn-label">Add Transaction</span>
        </button>
      </div>

      {/* ─── Cards Grid ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="loading-container"><div className="spinner" />
          <p style={{ color:'var(--text-muted)', fontSize:14 }}>Loading transactions…</p></div>
      ) : filtered.length === 0 ? (
        <div className="card"><div className="empty-state">
          <div className="empty-state-icon">💸</div>
          <h3>{search||filterCustomer||filterStatus ? 'No results' : 'No transactions yet'}</h3>
          <p>{search||filterCustomer||filterStatus ? 'Try adjusting your filters' : 'Record your first payment transaction'}</p>
          {!search&&!filterCustomer&&!filterStatus&&(
            <button className="btn btn-primary" onClick={openCreate}>
              <Plus size={16} /> Add Transaction
            </button>
          )}
        </div></div>
      ) : (
        <div className="t-cards-grid">
          {filtered.map(t => {
            const txnKey = String(t.transaction_id||t.id);
            const custId = t.customer_id;
            const statusMeta = STATUS_META[t.status] || STATUS_META.Pending;
            const isExpanded = !!expandDeliveries[txnKey];
            const dels = custDeliveries[custId] || [];
            const isLoadingDel = !!loadingDel[txnKey];
            const pct = t.total_amount>0 ? Math.round((t.paid_amount/t.total_amount)*100) : 0;

            return (
              <div key={txnKey} className="t-card">
                {/* Status stripe */}
                <div className="t-card-stripe" style={{ background: statusMeta.dot }} />

                {/* Card top */}
                <div className="t-card-top">
                  <div className="t-card-left">
                    <div className="t-avatar">
                      {getCustomerName(custId).charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <div className="t-cust-name">{getCustomerName(custId)}</div>
                      <div className="t-cust-date">
                        <Calendar size={11} /> {t.date}
                      </div>
                    </div>
                  </div>
                  <div className="t-card-right">
                    <span className={`t-status-badge t-${t.status?.toLowerCase()}`}>
                      <span className="t-status-dot" style={{ background: statusMeta.dot }} />
                      {t.status}
                    </span>
                    <button className="btn btn-secondary btn-icon btn-sm" onClick={() => openEdit(t)} title="Edit">
                      <Edit2 size={13} />
                    </button>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => setConfirmDelete(t)} title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Amount metrics */}
                <div className="t-metrics">
                  <div className="t-metric">
                    <span className="t-metric-lbl">TOTAL</span>
                    <span className="t-metric-val">₹{(t.total_amount||0).toLocaleString()}</span>
                  </div>
                  <div className="t-metric-div" />
                  <div className="t-metric">
                    <span className="t-metric-lbl">PAID</span>
                    <span className="t-metric-val" style={{ color:'#10b981' }}>₹{(t.paid_amount||0).toLocaleString()}</span>
                  </div>
                  <div className="t-metric-div" />
                  <div className="t-metric">
                    <span className="t-metric-lbl">PENDING</span>
                    <span className="t-metric-val" style={{ color: (t.pending_amount||0)>0?'#ef4444':'#10b981' }}>
                      ₹{(t.pending_amount||0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Mini progress bar */}
                <div style={{ padding:'0 16px 10px' }}>
                  <div style={{ height:4, borderRadius:99, background:'var(--bg-elevated)', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, borderRadius:99,
                      background:'linear-gradient(90deg,#10b981,#06b6d4)', transition:'width 0.5s' }} />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:10,
                    color:'var(--text-muted)', marginTop:4 }}>
                    <span>{pct}% paid</span>
                    {t.payment_mode && (
                      <span style={{ textTransform:'capitalize' }}>
                        {t.payment_mode==='online'?'💳':'💵'} {t.payment_mode}
                      </span>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {t.notes && (
                  <div style={{ padding:'0 16px 10px', fontSize:12, color:'var(--text-muted)',
                    display:'flex', alignItems:'center', gap:5 }}>
                    {t.notes === 'Auto-generated from deliveries' ? (
                      <span style={{
                        display:'inline-flex', alignItems:'center', gap:4,
                        background:'rgba(6,182,212,0.1)', color:'var(--accent)',
                        border:'1px solid rgba(6,182,212,0.25)',
                        borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:600
                      }}>
                        🔄 Auto-synced from deliveries
                      </span>
                    ) : (
                      <><span>📝</span>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.notes}</span></>
                    )}
                  </div>
                )}

                {/* Footer actions */}
                <div className="t-card-footer">
                  <button
                    className={`btn btn-sm t-del-btn ${isExpanded?'t-del-btn--active':''}`}
                    onClick={() => toggleDeliveries(txnKey, custId)}
                  >
                    <Truck size={13} />
                    Deliveries
                    {isExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                  </button>
                  <button
                    className="btn btn-sm t-wa-btn"
                    onClick={() => sendBill(t)}
                    title="Send WhatsApp Bill"
                  >
                    <MessageCircle size={13} />
                    Send Bill
                  </button>
                </div>

                {/* Deliveries Expandable Panel */}
                {isExpanded && (
                  <div className="t-del-panel">
                    {isLoadingDel ? (
                      <div style={{ padding:16, textAlign:'center' }}>
                        <div className="spinner" style={{ width:20,height:20,borderWidth:2,margin:'0 auto' }}/>
                      </div>
                    ) : dels.length===0 ? (
                      <p style={{ fontSize:13,color:'var(--text-muted)',textAlign:'center',padding:'14px 0' }}>
                        No deliveries found
                      </p>
                    ) : (
                      <>
                        <div className="t-del-head">
                          <span>Date</span><span>Qty</span><span>Amount</span><span>Btl</span>
                        </div>
                        <div className="t-del-scroll">
                          {dels.map(d => (
                            <div key={d.delivery_id||d.id} className="t-del-row">
                              <span>{d.date}</span>
                              <span style={{ color:'var(--accent)',fontWeight:600 }}>{d.quantity}L</span>
                              <span style={{ color:'var(--success)',fontWeight:600 }}>₹{d.price}</span>
                              <span style={{ color:'var(--warning)' }}>{d.bottles_given}/{d.bottles_returned}</span>
                            </div>
                          ))}
                        </div>
                        <div className="t-del-total">
                          <span>Total · {dels.length} days</span>
                          <span style={{ color:'var(--accent)' }}>{dels.reduce((s,d)=>s+(d.quantity||0),0)}L</span>
                          <span style={{ color:'var(--success)' }}>₹{dels.reduce((s,d)=>s+(d.price||0),0).toLocaleString()}</span>
                          <span>—</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Modal ──────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth:480 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display:'flex',alignItems:'center',gap:10 }}>
                <div style={{ width:32,height:32,borderRadius:8,
                  background:'linear-gradient(135deg,#3b82f6,#06b6d4)',
                  display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <Receipt size={16} color="#fff"/>
                </div>
                {editItem ? 'Edit Transaction' : 'New Transaction'}
              </h2>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={16}/></button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ paddingTop:20 }}>
                {/* Customer */}
                <div className="form-group">
                  <label className="form-label">Customer <span>*</span></label>
                  <select className="form-select" value={form.customer_id}
                    onChange={e => handleCustomerChange(e.target.value)} disabled={!!editItem}>
                    <option value="">Select customer…</option>
                    {customers.map(c => (
                      <option key={c.customer_id||c.id} value={c.customer_id||c.id}>{c.name}</option>
                    ))}
                  </select>
                  {errors.customer_id && <p className="form-error">{errors.customer_id}</p>}
                </div>

                {/* Date */}
                <div className="form-group">
                  <label className="form-label">Date <span>*</span></label>
                  <input className="form-input" type="date" value={form.date}
                    onChange={e => setForm({...form,date:e.target.value})}/>
                  {errors.date && <p className="form-error">{errors.date}</p>}
                </div>

                {/* Amounts */}
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Total Bill (₹) <span>*</span></label>
                    <input className="form-input" type="number" step="0.01" min="0" placeholder="e.g. 500"
                      value={form.total_amount} onChange={e => setForm({...form,total_amount:e.target.value})}/>
                    {form.customer_id&&!editItem&&(
                      <p style={{ fontSize:11,color:'var(--accent)',marginTop:4 }}>⚡ Auto-filled from deliveries</p>
                    )}
                    {errors.total_amount && <p className="form-error">{errors.total_amount}</p>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Paid (₹) <span>*</span></label>
                    <input className="form-input" type="number" step="0.01" min="0" placeholder="e.g. 300"
                      value={form.paid_amount} onChange={e => setForm({...form,paid_amount:e.target.value})}/>
                    {errors.paid_amount && <p className="form-error">{errors.paid_amount}</p>}
                  </div>
                </div>

                {/* Live pending preview */}
                {pendingAmt !== null && (
                  <div className="t-pending-preview">
                    <span>Pending (auto-calculated)</span>
                    <span style={{ color: pendingAmt>0?'#ef4444':'#10b981', fontWeight:700, fontSize:16 }}>
                      ₹{pendingAmt.toFixed(2)}
                    </span>
                  </div>
                )}

                {/* Payment mode */}
                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <div className="t-mode-row">
                    {['cash','online'].map(mode => (
                      <label key={mode} className={`t-mode-opt ${form.payment_mode===mode?'t-mode-opt--active':''}`}
                        onClick={() => setForm({...form,payment_mode:mode})}>
                        <span style={{ fontSize:20 }}>{mode==='cash'?'💵':'💳'}</span>
                        <span style={{ fontWeight:600, textTransform:'capitalize' }}>{mode}</span>
                        {form.payment_mode===mode && <span className="t-mode-check">✓</span>}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label className="form-label">Notes (optional)</label>
                  <input className="form-input" type="text" placeholder="e.g. Cleared April dues"
                    value={form.notes} onChange={e => setForm({...form,notes:e.target.value})}/>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ minWidth:160 }}>
                  {saving ? (
                    <><span className="spinner" style={{ width:16,height:16,borderWidth:2 }}/> Saving…</>
                  ) : (
                    editItem ? 'Update Transaction' : 'Create Transaction'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete Transaction"
        message={`Delete transaction for "${getCustomerName(confirmDelete?.customer_id)}" on ${confirmDelete?.date}?`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
        loading={deleting}
      />

      {/* ─── Scoped Styles ───────────────────────────────────────────────────── */}
      <style>{`
        /* ── Stat cards ─────────────────────────────────── */
        .t-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 14px;
        }
        .t-stat-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 14px 16px;
          display: flex; align-items: center; gap: 12px;
          transition: all 0.2s;
        }
        .t-stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
        .t-stat-icon {
          width: 40px; height: 40px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .t-stat-lbl { font-size: 11px; color: var(--text-muted); margin-bottom: 2px; }
        .t-stat-val { font-size: 20px; font-weight: 700; color: var(--text-primary); }

        /* ── Filters ─────────────────────────────────────── */
        .t-filter-row {
          display: flex; align-items: center; gap: 10px;
          flex-wrap: wrap; margin-bottom: 18px;
        }
        .t-filter-sel { width: auto; min-width: 120px; }
        .t-btn-label {}

        /* ── Cards grid ──────────────────────────────────── */
        .t-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 14px;
        }
        .t-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          transition: all 0.2s;
          position: relative;
        }
        .t-card:hover {
          border-color: var(--border-light);
          box-shadow: 0 6px 24px rgba(0,0,0,0.35);
          transform: translateY(-2px);
        }
        .t-card-stripe {
          height: 3px; width: 100%;
        }
        .t-card-top {
          padding: 14px 16px 12px;
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          border-bottom: 1px solid var(--border);
        }
        .t-card-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
        .t-card-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .t-avatar {
          width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, var(--primary), var(--accent));
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-weight: 700; font-size: 16px;
          box-shadow: 0 3px 10px rgba(59,130,246,0.35);
        }
        .t-cust-name {
          font-weight: 600; font-size: 14px; color: var(--text-primary);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .t-cust-date {
          display: flex; align-items: center; gap: 4px;
          font-size: 11px; color: var(--text-muted); margin-top: 2px;
        }
        .t-status-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
          background: var(--bg-elevated); color: var(--text-secondary);
          border: 1px solid var(--border);
        }
        .t-status-dot { width: 6px; height: 6px; border-radius: 50%; }

        /* ── Amount metrics ───────────────────────────────── */
        .t-metrics {
          display: flex; border-bottom: 1px solid var(--border);
        }
        .t-metric {
          flex: 1; padding: 12px 14px;
          display: flex; flex-direction: column; gap: 3px;
        }
        .t-metric-lbl { font-size: 9px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.07em; }
        .t-metric-val { font-size: 15px; font-weight: 700; color: var(--text-primary); }
        .t-metric-div { width: 1px; background: var(--border); flex-shrink: 0; }

        /* ── Footer ──────────────────────────────────────── */
        .t-card-footer {
          padding: 10px 12px;
          display: flex; gap: 8px;
        }
        .t-del-btn {
          display: flex; align-items: center; gap: 5px;
          flex: 1; justify-content: center;
          background: var(--bg-elevated);
          color: var(--text-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 8px 10px; font-size: 12px; font-weight: 600; cursor: pointer;
          transition: all 0.15s;
        }
        .t-del-btn:hover, .t-del-btn--active {
          background: rgba(6,182,212,0.12); color: var(--accent); border-color: var(--accent);
        }
        .t-wa-btn {
          display: flex; align-items: center; gap: 5px;
          flex: 1; justify-content: center;
          background: rgba(37,211,102,0.12);
          color: #25D366; border: 1px solid rgba(37,211,102,0.3);
          border-radius: var(--radius-md);
          padding: 8px 10px; font-size: 12px; font-weight: 600; cursor: pointer;
          transition: all 0.15s;
        }
        .t-wa-btn:hover { background: rgba(37,211,102,0.22); }

        /* ── Deliveries panel ────────────────────────────── */
        .t-del-panel {
          border-top: 1px dashed var(--border);
          background: var(--bg-elevated);
          animation: slideDown 0.2s ease;
        }
        @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:none} }
        .t-del-head {
          display: grid; grid-template-columns: 1.2fr 0.6fr 0.8fr 0.5fr;
          gap: 6px; padding: 8px 14px;
          font-size: 9px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.07em;
          border-bottom: 1px solid var(--border);
        }
        .t-del-scroll { max-height: 180px; overflow-y: auto; }
        .t-del-row {
          display: grid; grid-template-columns: 1.2fr 0.6fr 0.8fr 0.5fr;
          gap: 6px; padding: 7px 14px;
          font-size: 12px; color: var(--text-secondary);
          border-bottom: 1px solid rgba(51,65,85,0.5);
          transition: background 0.1s;
        }
        .t-del-row:hover { background: rgba(255,255,255,0.03); }
        .t-del-total {
          display: grid; grid-template-columns: 1.2fr 0.6fr 0.8fr 0.5fr;
          gap: 6px; padding: 8px 14px;
          font-size: 12px; font-weight: 700; color: var(--text-primary);
          background: rgba(59,130,246,0.06);
        }

        /* ── Modal extras ────────────────────────────────── */
        .t-pending-preview {
          display: flex; justify-content: space-between; align-items: center;
          background: var(--bg-body); border: 1px solid var(--border);
          border-radius: 10px; padding: 10px 16px; margin-bottom: 16px;
          font-size: 13px; color: var(--text-muted);
        }
        .t-mode-row { display: flex; gap: 10px; }
        .t-mode-opt {
          flex: 1; display: flex; align-items: center; gap: 8px; position: relative;
          padding: 11px 14px; border: 2px solid var(--border); border-radius: 10px;
          cursor: pointer; transition: all 0.15s; background: transparent;
          font-size: 14px; color: var(--text-secondary);
        }
        .t-mode-opt:hover { border-color: var(--border-light); }
        .t-mode-opt--active {
          border-color: var(--primary); background: rgba(59,130,246,0.08);
          color: var(--text-primary);
        }
        .t-mode-check {
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          width: 18px; height: 18px; border-radius: 50%;
          background: var(--primary); color: #fff;
          display: flex; align-items: center; justify-content: center; font-size: 10px;
        }

        /* ── Date filter inputs ───────────────────────────────── */
        .t-date-filter {
          padding: 7px 10px;
          font-size: 13px;
          height: 36px;
        }
        @media (max-width: 900px) {
          .t-stats { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 640px) {
          .t-cards-grid { grid-template-columns: 1fr; }
          .t-filter-row { gap: 8px; }
          .t-filter-sel { min-width: unset; font-size: 13px; }
          .t-btn-label { display: none; }
        }
        @media (max-width: 380px) {
          .t-stats { grid-template-columns: 1fr 1fr; gap: 8px; }
          .t-stat-val { font-size: 16px; }
        }
      `}</style>
    </div>
  );
}
