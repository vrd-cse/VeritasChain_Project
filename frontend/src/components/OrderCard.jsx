import React, { useState } from 'react';
import { api } from '../api/client';

const STATUS_BADGE = {
  PENDING:   'badge-pending',
  FULFILLED: 'badge-fulfilled',
  ACCEPTED:  'badge-accepted',
  REJECTED:  'badge-rejected',
  CANCELLED: 'badge-cancelled',
};

function fmt(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function shortId(id) {
  return id ? id.split('-').slice(-1)[0].toUpperCase() : '';
}

// Read a File object and return its text content as a Promise<string>
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result);
    reader.onerror = ()  => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsText(file);
  });
}

export default function OrderCard({ order, myOrg, channel, onUpdate, showToast }) {
  const isMfg  = myOrg.mspId === order.manufacturerMSP;
  const isSplr = myOrg.mspId === order.supplierMSP;

  const [expanded,     setExpanded]     = useState(false);
  const [showFulfill,  setShowFulfill]  = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showReject,   setShowReject]   = useState(false);
  const [loading,      setLoading]      = useState(false);

  // Verification state — holds result of Run Verifier before manufacturer decides
  const [verifyResult, setVerifyResult] = useState(null); // null | { valid: bool }
  const [verifying,    setVerifying]    = useState(false);

  async function handleRunVerify() {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const r = await api.runVerify(order.orderID, {
        channel,
        mspId: myOrg.mspId,
        manufacturerMSP: order.manufacturerMSP,
      });
      if (r.error) {
        showToast(r.error, 'error');
      } else {
        setVerifyResult(r);
        showToast(r.valid ? 'Proof verified — PASS' : 'Proof invalid — FAIL', r.valid ? 'success' : 'error');
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setVerifying(false);
    }
  }

  async function handleVerify() {
    setLoading(true);
    try {
      const r = await api.verifyOrder(order.orderID, { channel, mspId: myOrg.mspId });
      if (r.error) showToast(r.error, 'error');
      else { showToast('Order accepted!', 'success'); onUpdate(); }
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  return (
    <div className="card" style={{ transition: 'border-color 0.15s' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{
          fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)',
          background: 'var(--surface2)', padding: '2px 8px', borderRadius: 4,
        }}>
          #{shortId(order.orderID)}
        </div>

        <div style={{ fontWeight: 600, flex: 1 }}>{order.componentType}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Qty: {order.quantity}</div>

        <span className={`badge ${STATUS_BADGE[order.status] || 'badge-pending'}`}>
          {order.status}
        </span>

        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: 18, lineHeight: 1,
          }}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Timestamps row */}
      <div style={{ display: 'flex', gap: 20, marginTop: 8, flexWrap: 'wrap' }}>
        <small style={{ color: 'var(--text-muted)' }}>Created: {fmt(order.createdAt)}</small>
        {order.fulfilledAt && <small style={{ color: 'var(--text-muted)' }}>Fulfilled: {fmt(order.fulfilledAt)}</small>}
        {order.verifiedAt  && <small style={{ color: 'var(--text-muted)' }}>Verified: {fmt(order.verifiedAt)}</small>}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{
          marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <Detail label="Order ID"      value={order.orderID} mono />
          <Detail label="Manufacturer"  value={order.manufacturerMSP} />
          <Detail label="Supplier"      value={order.supplierMSP} />
          <Detail label="Specifications" value={order.specifications} />
          <Detail label="Deadline"      value={fmt(order.deadline)} />

          {order.batchID && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
              <Detail label="Batch ID"       value={order.batchID} />
              <Detail label="ZK Proof"       value={order.zkProof ? '[stored on chain]' : null} />
              <Detail label="Public Signals" value={order.publicSignals ? '[stored on chain]' : null} />
            </>
          )}

          {order.verificationResult && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
              <Detail label="Verification" value={order.verificationResult} />
              {order.rejectionReason && <Detail label="Rejection Reason" value={order.rejectionReason} />}
              <Detail label="Verified By"  value={order.verifiedBy} />
            </>
          )}

          {order.feedbackText && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
              <Detail label="Feedback"    value={order.feedbackText} />
              <Detail label="Feedback At" value={fmt(order.feedbackAt)} />
            </>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>

        {/* Supplier: Fulfill PENDING order */}
        {isSplr && order.status === 'PENDING' && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowFulfill(true)}>
            Fulfill Order
          </button>
        )}

        {/* Manufacturer: Run Verifier on FULFILLED order, then Accept / Reject */}
        {isMfg && order.status === 'FULFILLED' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Step 1: run verifier */}
            {!verifyResult && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRunVerify}
                disabled={verifying}
                style={{ alignSelf: 'flex-start' }}
              >
                {verifying
                  ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Verifying...</>
                  : 'Run ZK Verifier'}
              </button>
            )}

            {/* Step 2: show result banner */}
            {verifyResult && (
              <div style={{
                padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600,
                background: verifyResult.valid ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                color:      verifyResult.valid ? '#22c55e'              : '#ef4444',
                border:     `1px solid ${verifyResult.valid ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
                {verifyResult.valid ? '✓ Proof VALID — battery meets ZK range requirements' : '✗ Proof INVALID — proof does not satisfy requirements'}
              </div>
            )}

            {/* Step 3: Accept / Reject — enabled after verifier runs */}
            {verifyResult && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-success btn-sm" onClick={handleVerify} disabled={loading}>
                  {loading ? <span className="spinner" style={{ width: 12, height: 12 }} /> : 'Accept'}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => setShowReject(true)}>
                  Reject
                </button>
              </div>
            )}

            {/* Allow re-running verifier if already ran */}
            {verifyResult && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRunVerify}
                disabled={verifying}
                style={{ alignSelf: 'flex-start', fontSize: 11 }}
              >
                Re-run Verifier
              </button>
            )}
          </div>
        )}

        {/* Manufacturer: Feedback on ACCEPTED or REJECTED */}
        {isMfg && (order.status === 'ACCEPTED' || order.status === 'REJECTED') && !order.feedbackAt && (
          <button className="btn btn-secondary btn-sm" onClick={() => setShowFeedback(true)}>
            Add Feedback
          </button>
        )}
      </div>

      {/* Modals */}
      {showFulfill && (
        <FulfillModal
          order={order}
          channel={channel}
          myOrg={myOrg}
          onClose={() => setShowFulfill(false)}
          onDone={() => { setShowFulfill(false); onUpdate(); showToast('Order fulfilled!', 'success'); }}
          showToast={showToast}
        />
      )}
      {showReject && (
        <RejectModal
          order={order}
          channel={channel}
          myOrg={myOrg}
          onClose={() => setShowReject(false)}
          onDone={() => { setShowReject(false); onUpdate(); showToast('Order rejected.', 'info'); }}
          showToast={showToast}
        />
      )}
      {showFeedback && (
        <FeedbackModal
          order={order}
          channel={channel}
          myOrg={myOrg}
          onClose={() => setShowFeedback(false)}
          onDone={() => { setShowFeedback(false); onUpdate(); showToast('Feedback submitted!', 'success'); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ── Detail row ───────────────────────────────────────────────────────────────

function Detail({ label, value, mono }) {
  if (!value) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, alignItems: 'start' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 500, paddingTop: 1 }}>{label}</span>
      <span style={{
        fontSize: 13, wordBreak: 'break-all',
        fontFamily: mono ? 'monospace' : 'inherit',
        color: mono ? 'var(--text-muted)' : 'var(--text)',
      }}>
        {value}
      </span>
    </div>
  );
}

// ── Fulfill Modal ─────────────────────────────────────────────────────────────

function FulfillModal({ order, channel, myOrg, onClose, onDone, showToast }) {
  const [batchID,        setBatchID]        = useState('');
  const [proofFile,      setProofFile]      = useState(null);   // File object
  const [signalsFile,    setSignalsFile]    = useState(null);   // File object
  const [proofName,      setProofName]      = useState('');
  const [signalsName,    setSignalsName]    = useState('');
  const [loading,        setLoading]        = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!proofFile)   { showToast('Please upload proof.json', 'error');   return; }
    if (!signalsFile) { showToast('Please upload public.json', 'error');  return; }

    setLoading(true);
    try {
      // Read both files as text (they are plain JSON from snarkjs)
      const [zkProof, publicSignals] = await Promise.all([
        readFileAsText(proofFile),
        readFileAsText(signalsFile),
      ]);

      // Validate they are valid JSON before sending
      try { JSON.parse(zkProof); }      catch { showToast('proof.json is not valid JSON', 'error'); setLoading(false); return; }
      try { JSON.parse(publicSignals); } catch { showToast('public.json is not valid JSON', 'error'); setLoading(false); return; }

      const r = await api.fulfillOrder(order.orderID, {
        channel,
        mspId: myOrg.mspId,
        batchID,
        zkProof,
        publicSignals,
      });
      if (r.error) showToast(r.error, 'error');
      else onDone();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <h3 className="modal-title">Fulfill Order #{shortId(order.orderID)}</h3>

        <div style={{
          background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16, fontSize: 12,
          color: 'var(--text-muted)',
        }}>
          Upload the two files generated by Pranav's snarkjs prover:
          <strong style={{ color: 'var(--text)' }}> proof.json</strong> and
          <strong style={{ color: 'var(--text)' }}> public.json</strong>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Batch ID</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. BATCH-001"
              value={batchID}
              onChange={e => setBatchID(e.target.value)}
              required
            />
          </div>

          <FileUploadField
            label="ZK Proof (proof.json)"
            accept=".json,application/json"
            fileName={proofName}
            onChange={(file) => { setProofFile(file); setProofName(file ? file.name : ''); }}
          />

          <FileUploadField
            label="Public Signals (public.json)"
            accept=".json,application/json"
            fileName={signalsName}
            onChange={(file) => { setSignalsFile(file); setSignalsName(file ? file.name : ''); }}
          />

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" /> Submitting...</> : 'Submit Proof'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── File Upload Field ─────────────────────────────────────────────────────────

function FileUploadField({ label, accept, fileName, onChange }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderRadius: 'var(--radius)',
        border: '1px dashed var(--border)', cursor: 'pointer',
        background: fileName ? 'rgba(34,197,94,0.06)' : 'var(--surface2)',
        transition: 'background 0.15s',
      }}>
        <span style={{ fontSize: 18 }}>{fileName ? '✓' : '↑'}</span>
        <span style={{ fontSize: 13, color: fileName ? '#22c55e' : 'var(--text-muted)' }}>
          {fileName || 'Click to upload file'}
        </span>
        <input
          type="file"
          accept={accept}
          style={{ display: 'none' }}
          onChange={e => onChange(e.target.files[0] || null)}
        />
      </label>
    </div>
  );
}

// ── Reject Modal ──────────────────────────────────────────────────────────────

function RejectModal({ order, channel, myOrg, onClose, onDone, showToast }) {
  const [reason,  setReason]  = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.rejectOrder(order.orderID, { channel, mspId: myOrg.mspId, reason });
      if (r.error) showToast(r.error, 'error');
      else onDone();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Reject Order #{shortId(order.orderID)}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Rejection Reason</label>
            <textarea className="form-textarea"
              placeholder="Explain why this order is being rejected..."
              value={reason} onChange={e => setReason(e.target.value)} required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-danger" disabled={loading}>
              {loading ? <><span className="spinner" /> Rejecting...</> : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Feedback Modal ────────────────────────────────────────────────────────────

function FeedbackModal({ order, channel, myOrg, onClose, onDone, showToast }) {
  const [text,    setText]    = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await api.submitFeedback(order.orderID, { channel, mspId: myOrg.mspId, feedbackText: text });
      if (r.error) showToast(r.error, 'error');
      else onDone();
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Add Feedback — #{shortId(order.orderID)}</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
          Feedback is permanent and cannot be modified after submission.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Feedback</label>
            <textarea className="form-textarea" rows={4}
              placeholder="Enter your feedback about this delivery..."
              value={text} onChange={e => setText(e.target.value)} required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <><span className="spinner" /> Submitting...</> : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

