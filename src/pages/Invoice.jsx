import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { customersApi, deliveriesApi } from '../api';
import { Printer, MessageCircle, ArrowLeft, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import html2pdf from 'html2pdf.js';
import logo from '../assets/logo.png';

export default function Invoice() {
  const { customerId } = useParams();
  const navigate = useNavigate();

  // Date range defaults to current month
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [fromDate, setFromDate] = useState(startOfMonth.toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(today.toISOString().split('T')[0]);

  const [customer, setCustomer] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoiceData = async () => {
    setLoading(true);
    try {
      // Fetch customer
      const custRes = await customersApi.getById(customerId);
      setCustomer(custRes.data);

      // Fetch deliveries within date range
      // The API supports customer_id, from_date, to_date in getAll, or we can use getByCustomer and filter
      // getByCustomer doesn't have from/to date natively in the wrapper we saw, so let's just use it and filter locally,
      // or we can use getAll with params. Let's use getAll since it has from_date and to_date.
      const delRes = await deliveriesApi.getAll(0, 1000, customerId, fromDate, toDate);

      // We might need to filter locally if the API didn't perfectly filter it
      let fetchedDeliveries = delRes.data || [];

      // Fallback local filtering just to be safe
      fetchedDeliveries = fetchedDeliveries.filter(d => {
        if (d.customer_id !== Number(customerId)) return false;
        const dDate = new Date(d.date);
        const fDate = new Date(fromDate);
        const tDate = new Date(toDate);
        return dDate >= fDate && dDate <= tDate;
      });

      // Sort by date ascending
      fetchedDeliveries.sort((a, b) => new Date(a.date) - new Date(b.date));
      setDeliveries(fetchedDeliveries);
    } catch (err) {
      toast.error('Failed to load invoice data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      fetchInvoiceData();
    }
  }, [customerId, fromDate, toDate]);

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = async () => {
    if (!customer || !customer.phone) {
      toast.error('Customer phone number not available');
      return;
    }

    const toastId = toast.loading('Generating PDF...');

    try {
      const totalAmount = deliveries.reduce((s, d) => s + (d.price || 0), 0);
      const totalPaid = deliveries.reduce((s, d) => s + (d.paid_amount || 0), 0);
      const balance = totalAmount - totalPaid;

      let text = `*Invoice: Geetai Farm Fresh* 🥛\n\n` +
        `*Customer:* ${customer.name}\n` +
        `*Period:* ${fromDate} to ${toDate}\n\n` +
        `Please find your detailed invoice PDF attached to this chat.\n\n` +
        `*Summary:*\n` +
        `*Total Bill:* ₹${totalAmount}\n` +
        `*Pending Balance:* ₹${balance}\n\n`;

      if (balance > 0) {
        const qrData = encodeURIComponent(`upi://pay?pa=9309116214@postbank&pn=RESHMA ATUL SHINDE&am=${balance}`);
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${qrData}`;
        text += `Please pay the pending balance of *₹${balance}* to:\n` +
          `*UPI ID:* 9309116214@postbank\n\n` +
          `You can click the link below to view the payment QR code:\n` +
          `${qrCodeUrl}\n\n` +
          `*Kindly share a screenshot of the payment here once done.*\n\n`;
      }

      text += `Thank you for choosing Geetai Farm Fresh!`;

      // 1. Generate PDF configuration
      const element = document.querySelector('.a4-page');
      const filename = `Invoice_${customer.name.replace(/\s+/g, '_')}_${fromDate}_to_${toDate}.pdf`;
      const opt = {
        margin: 0,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      const pdfWorker = html2pdf().set(opt).from(element);
      const pdfBlob = await pdfWorker.output('blob');
      const file = new File([pdfBlob], filename, { type: 'application/pdf' });

      let filesToShare = [file];
      let qrBlobUrl = null;

      if (balance > 0) {
        try {
          const qrData = encodeURIComponent(`upi://pay?pa=9309116214@postbank&pn=RESHMA ATUL SHINDE&am=${balance}`);
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${qrData}`;
          const qrResponse = await fetch(qrUrl);
          const qrBlob = await qrResponse.blob();
          const qrFile = new File([qrBlob], `Payment_QR_${customer.name.replace(/\s+/g, '_')}.png`, { type: 'image/png' });
          filesToShare.push(qrFile);
          qrBlobUrl = URL.createObjectURL(qrBlob);
        } catch (e) {
          console.error("Failed to fetch QR code blob", e);
        }
      }

      // 2. Try to use Web Share API (Works mainly on Mobile / Supported browsers)
      if (navigator.canShare && navigator.canShare({ files: filesToShare })) {
        try {
          await navigator.share({
            files: filesToShare,
            title: `Invoice for ${customer.name}`,
            text: text
          });
          toast.success('Invoice & QR Code shared successfully!', { id: toastId });
          if (qrBlobUrl) URL.revokeObjectURL(qrBlobUrl);
          return; // Exit if share was successful
        } catch (shareError) {
          console.log('Share was cancelled or failed:', shareError);
          if (shareError.name === 'AbortError') {
            toast.dismiss(toastId);
            if (qrBlobUrl) URL.revokeObjectURL(qrBlobUrl);
            return;
          }
        }
      }

      // 3. Fallback for Desktop / Unsupported Browsers
      await html2pdf().set(opt).from(element).save();

      if (qrBlobUrl) {
        const link = document.createElement('a');
        link.href = qrBlobUrl;
        link.download = `Payment_QR_${customer.name.replace(/\s+/g, '_')}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(qrBlobUrl);
      }

      toast.success(balance > 0 ? 'PDF and QR Code downloaded! Please attach them to the WhatsApp chat.' : 'PDF downloaded! Please attach it to the WhatsApp chat.', { id: toastId, duration: 5000 });

      const encodedText = encodeURIComponent(text);
      const cleanPhone = customer.phone.replace(/\D/g, '');
      const phoneWithCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

      setTimeout(() => {
        window.open(`https://wa.me/${phoneWithCode}?text=${encodedText}`, '_blank');
      }, 1000);

    } catch (error) {
      console.error(error);
      toast.error('Failed to process WhatsApp share', { id: toastId });
    }
  };

  if (loading) {
    return (
      <div className="page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  const totalQty = deliveries.reduce((s, d) => s + (d.quantity || 0), 0);
  const totalAmount = deliveries.reduce((s, d) => s + (d.price || 0), 0);
  const totalPaid = deliveries.reduce((s, d) => s + (d.paid_amount || 0), 0);
  const totalBottlesGiven = deliveries.reduce((s, d) => s + (d.bottles_given || 0), 0);
  const totalBottlesReturned = deliveries.reduce((s, d) => s + (d.bottles_returned || 0), 0);
  const balance = totalAmount - totalPaid;

  return (
    <div className="invoice-wrapper">
      {/* Controls (Hidden during print) */}
      <div className="invoice-controls no-print">
        <button className="btn btn-secondary" onClick={() => navigate('/deliveries')}>
          <ArrowLeft size={16} /> Back to Deliveries
        </button>

        <div className="invoice-filters">
          <div className="date-filter">
            <Calendar size={14} className="text-muted" />
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            <span>to</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        </div>

        <div className="invoice-actions">
          <button className="btn btn-success" onClick={handleWhatsApp} style={{ background: '#25D366', borderColor: '#25D366', color: '#fff' }}>
            <MessageCircle size={16} /> Send WhatsApp
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>
            <Printer size={16} /> Print Invoice
          </button>
        </div>
      </div>

      {/* A4 Invoice Container */}
      <div className="a4-page">
        {/* Header */}
        <div className="invoice-header">
          <div className="invoice-brand" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img src={logo} alt="Geetai Farm Fresh Logo" style={{ height: '90px', objectFit: 'contain' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '26px', color: '#1a365d' }}>Geetai Farm Fresh</h1>
              <p style={{ margin: 0, fontSize: '13px', color: '#4a5568' }}>Pure & Fresh Milk Delivery</p>
            </div>
          </div>
          <div className="invoice-meta">
            <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
            <p><strong>GSTIN:</strong> 27ADFPW3629M1ZW</p>
          </div>
        </div>

        <div className="invoice-address">
          <p>Near Meher Clinic, New Arts College Road</p>
          <p>Wardha, Maharashtra</p>
        </div>

        <hr className="invoice-divider" />

        {/* Customer Info */}
        <div className="invoice-customer-info">
          <div>
            <h3>Bill To:</h3>
            <p className="customer-name">{customer?.name}</p>
            <p>{customer?.address}</p>
            <p>Phone: {customer?.phone}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p><strong>Billing Period:</strong></p>
            <p>{new Date(fromDate).toLocaleDateString()} to {new Date(toDate).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Deliveries Table */}
        <div className="invoice-table-container">
          <table className="invoice-table">
            <thead>
              <tr>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Qty (L)</th>
                <th style={{ textAlign: 'center' }}>Bottles (Out/In)</th>
                <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                <th style={{ textAlign: 'right' }}>Paid (₹)</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>No deliveries found for this period.</td>
                </tr>
              ) : (
                deliveries.map(d => (
                  <tr key={d.delivery_id || d.id}>
                    <td>{new Date(d.date).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'right' }}>{d.quantity}</td>
                    <td style={{ textAlign: 'center' }}>{d.bottles_given} / {d.bottles_returned}</td>
                    <td style={{ textAlign: 'right' }}>{(d.price || 0).toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>{(d.paid_amount || 0).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
            {deliveries.length > 0 && (
              <tfoot>
                <tr>
                  <th>Total</th>
                  <th style={{ textAlign: 'right' }}>{totalQty} L</th>
                  <th style={{ textAlign: 'center' }}>{totalBottlesGiven} / {totalBottlesReturned}</th>
                  <th style={{ textAlign: 'right' }}>₹{totalAmount.toLocaleString()}</th>
                  <th style={{ textAlign: 'right' }}>₹{totalPaid.toLocaleString()}</th>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Payment & Totals Summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '20px', marginBottom: '40px' }}>

          {/* Payment Info */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', background: '#f7fafc', maxWidth: '350px' }}>
            <h4 style={{ marginBottom: '12px', color: '#4a5568', fontSize: '14px' }}>Payment Details</h4>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ width: '100px', height: '100px', background: '#fff', border: '1px solid #cbd5e0', padding: '4px', borderRadius: '4px' }}>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=upi://pay?pa=9309116214@postbank&pn=RESHMA%20ATUL%20SHINDE&am=${balance > 0 ? balance : ''}`} alt="Payment QR" style={{ width: '100%', height: '100%' }} />
              </div>
              <div style={{ fontSize: '12px', color: '#4a5568', lineHeight: '1.6' }}>
                <p><strong>Bank:</strong> India Post Payment Bank</p>
                <p><strong>A/C Name:</strong> Reshma Atul Shinde</p>
                <p><strong>A/C No:</strong> 034910251165</p>
                <p><strong>IFSC:</strong> IPOS0000001</p>
                <p><strong>UPI ID:</strong> 9309116214@postbank</p>
              </div>
            </div>
          </div>

          {/* Totals Summary */}
          <div className="summary-box">
            <div className="summary-row">
              <span>Total Amount:</span>
              <span>₹{totalAmount.toLocaleString()}</span>
            </div>
            <div className="summary-row">
              <span>Total Paid:</span>
              <span style={{ color: 'green' }}>- ₹{totalPaid.toLocaleString()}</span>
            </div>
            <div className="summary-row total-row">
              <span>Pending Balance:</span>
              <span style={{ color: balance > 0 ? 'red' : 'inherit' }}>₹{balance.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="invoice-footer">
          <p>Thank you for your business!</p>
          <p className="small-text">This is a computer-generated invoice.</p>
        </div>
      </div>
    </div>
  );
}
