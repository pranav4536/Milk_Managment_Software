import React, { useState, useEffect } from 'react';
import { X, Plus, MessageCircle, DollarSign } from 'lucide-react';
import { customerTransactionsApi } from '../api';
import toast from 'react-hot-toast';

export default function CustomerTransactionsModal({ customer, onClose }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    total_amount: '',
    paid_amount: '',
    payment_mode: 'online',
    notes: ''
  });

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      // Assuming customer.customer_id or customer.id
      const id = customer.customer_id || customer.id;
      const res = await customerTransactionsApi.getByCustomer(id);
      setTransactions(res.data || []);
    } catch (err) {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customer) {
      fetchTransactions();
    }
  }, [customer]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.total_amount && !form.paid_amount) {
      toast.error('Please enter an amount');
      return;
    }
    
    setSaving(true);
    try {
      const payload = {
        customer_id: customer.customer_id || customer.id,
        date: form.date,
        total_amount: parseFloat(form.total_amount) || 0,
        paid_amount: parseFloat(form.paid_amount) || 0,
        payment_mode: form.payment_mode,
        notes: form.notes
      };
      
      await customerTransactionsApi.create(payload);
      toast.success('Transaction added successfully!');
      
      // Reset form and reload
      setForm({
        date: new Date().toISOString().split('T')[0],
        total_amount: '',
        paid_amount: '',
        payment_mode: 'online',
        notes: ''
      });
      setShowAddForm(false);
      fetchTransactions();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save transaction');
    } finally {
      setSaving(false);
    }
  };

  const calculateTotalPending = () => {
    return transactions.reduce((sum, txn) => sum + (txn.pending_amount || 0), 0);
  };

  const handleWhatsAppBill = () => {
    const totalPending = calculateTotalPending();
    if (totalPending <= 0) {
      toast.success('No pending amount to bill!');
      return;
    }
    
    let phoneNum = customer.phone;
    if (phoneNum && phoneNum.length === 10) {
      phoneNum = '+91' + phoneNum;
    }

    const message = `Hello ${customer.name},\n\nYour current milk delivery pending bill is Rs. ${totalPending}. Kindly arrange payment at your earliest convenience to settle the account.\n\nThank you!`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNum.replace('+', '')}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
  };

  const getStatusBadgeClass = (status) => {
    if (status === 'Paid') return 'badge badge-cyan';
    if (status === 'Partial') return 'badge badge-purple';
    return 'badge badge-red'; // Pending
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '800px', width: '100%' }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={20} />
            Transactions - {customer?.name}
          </h2>
          <button className="modal-close" onClick={onClose} id="transaction-modal-close-btn">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* Summary Cards */}
          <div className="summary-cards">
            <div className="summary-card" style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', flex: 1 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Total Pending Amount</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--danger)' }}>
                ₹{calculateTotalPending()}
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => setShowAddForm(!showAddForm)}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {showAddForm ? 'Close Form' : <><Plus size={16} /> Add Transaction</>}
              </button>
              <button 
                className="btn btn-success" 
                onClick={handleWhatsAppBill}
                style={{ width: '100%', justifyContent: 'center', background: '#25D366', color: '#fff', borderColor: '#25D366' }}
              >
                <MessageCircle size={16} /> Send WhatsApp Bill
              </button>
            </div>
          </div>

          {/* Add Transaction Form */}
          {showAddForm && (
            <div style={{ background: 'var(--bg-body)', padding: '16px', borderRadius: '8px', marginTop: '16px', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px' }}>New Transaction</h3>
              <form onSubmit={handleSave}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Date <span>*</span></label>
                    <input
                      className="form-input"
                      type="date"
                      value={form.date}
                      onChange={e => setForm({ ...form, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Total Amount (Bill) <span>*</span></label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 500"
                      value={form.total_amount}
                      onChange={e => setForm({ ...form, total_amount: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Paid Amount <span>*</span></label>
                    <input
                      className="form-input"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 200"
                      value={form.paid_amount}
                      onChange={e => setForm({ ...form, paid_amount: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Mode</label>
                    <select
                      className="form-select"
                      value={form.payment_mode}
                      onChange={e => setForm({ ...form, payment_mode: e.target.value })}
                    >
                      <option value="online">Online</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes (Optional)</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="e.g. Cleared past dues"
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Transaction'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Transactions List */}
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Transaction History</h3>
            {loading ? (
              <div className="loading-container" style={{ minHeight: '100px' }}>
                <div className="spinner" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 16px' }}>
                <div className="empty-state-icon">💸</div>
                <p>No transactions found for this customer.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Total</th>
                      <th>Paid</th>
                      <th>Pending</th>
                      <th>Mode</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.transaction_id || t.id}>
                        <td>{t.date}</td>
                        <td>₹{t.total_amount}</td>
                        <td>₹{t.paid_amount}</td>
                        <td style={{ color: t.pending_amount > 0 ? 'var(--danger)' : 'inherit', fontWeight: '500' }}>
                          ₹{t.pending_amount}
                        </td>
                        <td><span style={{ textTransform: 'capitalize' }}>{t.payment_mode}</span></td>
                        <td>
                          <span className={getStatusBadgeClass(t.status)}>{t.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <style>{`
        .summary-cards {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
        }
        @media (max-width: 600px) {
          .summary-cards {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
