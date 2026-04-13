import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmDialog({
  isOpen, title, message, onConfirm, onCancel, loading = false
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="confirm-dialog">
        <div className="modal-body" style={{ textAlign: 'center', padding: '32px 28px' }}>
          <div className="confirm-dialog-icon">
            <AlertTriangle size={28} />
          </div>
          <h3 style={{
            fontSize: '18px', fontWeight: 700,
            color: 'var(--text-primary)', marginBottom: '10px'
          }}>
            {title || 'Confirm Delete'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
            {message || 'Are you sure you want to delete this item? This action cannot be undone.'}
          </p>
        </div>
        <div className="modal-footer" style={{ paddingTop: 0 }}>
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading} id="confirm-cancel-btn">
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={loading} id="confirm-delete-btn">
            {loading ? (
              <>
                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
