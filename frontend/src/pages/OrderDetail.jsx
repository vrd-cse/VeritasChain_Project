import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock3, ClipboardList, ShieldCheck, ShieldX, Upload } from 'lucide-react';
import { Layout } from '../components/Layout';
import {
  GlassmorphicCard,
  GlassmorphicButton,
  GlassmorphicInput,
  GlassmorphicTextarea,
  LoadingSpinner,
} from '../components/ui/GlassmorphicComponents';
import { useToast } from '../hooks/useNotification';
import { orderService, channelService } from '../services/api';

function formatDate(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}


export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { error, success } = useToast();

  const [user, setUser] = useState(null);
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fulfillState, setFulfillState] = useState({ batchID: '', proofFile: null, publicFile: null });
  const [fulfilling, setFulfilling] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [runningVerify, setRunningVerify] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      navigate('/login');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);

    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await channelService.getChannels(parsedUser.id);
        const availableChannels = response.data || [];
        setChannels(availableChannels);

        let foundOrder = null;
        let foundChannel = null;

        for (const channel of availableChannels) {
          try {
            const orderResponse = await orderService.getOrder(id, channel.channelName, parsedUser.mspId);
            const orderData = orderResponse.data;
            if (orderData && !orderData.error) {
              foundOrder = orderData;
              foundChannel = channel;
              break;
            }
          } catch (_err) {
            // try next channel
          }
        }

        if (!foundOrder) {
          error('Order not found in your channels.');
          return;
        }

        setOrder(foundOrder);
        setSelectedChannel(foundChannel);

      } catch (err) {
        error(err.response?.data?.error || err.message || 'Unable to load order details.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate, error]);

  const orderChannelName = selectedChannel?.channelName || order?.channel || '';

  const handleFileChange = (field) => (event) => {
    const file = event.target.files?.[0] || null;
    setFulfillState((prev) => ({ ...prev, [field]: file }));
  };

  const handleFulfillSubmit = async (event) => {
    event.preventDefault();
    if (!order || !selectedChannel || !user) return;
    const { batchID, proofFile, publicFile } = fulfillState;

    if (!proofFile || !publicFile) {
      error('Please upload both files: .proof and .public.json');
      return;
    }

    setFulfilling(true);
    try {
      const formData = new FormData();
      formData.append('channel', orderChannelName);
      formData.append('mspId', user.mspId);
      if (batchID) formData.append('batchID', batchID);
      formData.append('proofFile',  proofFile);
      formData.append('publicFile', publicFile);

      await orderService.fulfillOrder(order.orderID, formData);
      success('Order fulfillment submitted.');
      setFulfillState({ batchID: '', proofFile: null, publicFile: null });
      refreshOrder();
    } catch (err) {
      error(err.response?.data?.error || err.message || 'Fulfillment failed.');
    } finally {
      setFulfilling(false);
    }
  };

  const handleRunVerify = async () => {
    if (!order || !selectedChannel || !user) return;
    setRunningVerify(true);
    try {
      const response = await orderService.runVerify(order.orderID, {
        channel: orderChannelName,
        mspId: user.mspId,
      });
      const result = response.data;
      setVerifyResult(result);
      if (result.valid) {
        success('Proof verified — batch is within spec.');
      } else if (result.violations?.length) {
        success('Proof is cryptographically valid but batch is out of specification.');
      } else {
        error('Proof is cryptographically invalid.');
      }
    } catch (err) {
      error(err.response?.data?.error || err.message || 'Verification failed.');
    } finally {
      setRunningVerify(false);
    }
  };

  const handleAccept = async () => {
    if (!order || !selectedChannel || !user) return;
    setSubmittingReject(true);
    try {
      await orderService.verifyOrder(order.orderID, {
        channel: orderChannelName,
        mspId: user.mspId,
      });
      success('Order accepted successfully.');
      refreshOrder();
    } catch (err) {
      error(err.response?.data?.error || err.message || 'Accept failed.');
    } finally {
      setSubmittingReject(false);
    }
  };

  const handleReject = async () => {
    if (!order || !selectedChannel || !user) return;
    if (!rejectReason.trim()) {
      error('Please provide a rejection reason.');
      return;
    }
    setSubmittingReject(true);
    try {
      await orderService.rejectOrder(order.orderID, {
        channel: orderChannelName,
        mspId: user.mspId,
        reason: rejectReason,
      });
      success('Order rejected successfully.');
      refreshOrder();
    } catch (err) {
      error(err.response?.data?.error || err.message || 'Reject failed.');
    } finally {
      setSubmittingReject(false);
    }
  };

  const refreshOrder = async () => {
    if (!order || !selectedChannel || !user) return;
    try {
      const response = await orderService.getOrder(order.orderID, orderChannelName, user.mspId);
      setOrder(response.data);
    } catch (_err) {
      // ignore refresh failures
    }
  };

  if (loading) {
    return (
      <Layout user={user} onLogout={() => localStorage.removeItem('user')}>
        <div className="flex justify-center items-center h-96">
          <LoadingSpinner />
        </div>
      </Layout>
    );
  }

  if (!order) {
    return (
      <Layout user={user} onLogout={() => localStorage.removeItem('user')}>
        <div className="space-y-6 py-16 text-center">
          <p className="text-white/70">Order details could not be loaded.</p>
          <GlassmorphicButton onClick={() => navigate('/orders')}>
            Back to Orders
          </GlassmorphicButton>
        </div>
      </Layout>
    );
  }

  const isManufacturer = user?.mspId === order.manufacturerMSP;
  const isSupplier = user?.mspId === order.supplierMSP;

  return (
    <Layout user={user} onLogout={() => localStorage.removeItem('user')}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="inline-flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors mb-3"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Orders
            </button>
            <h1 className="text-3xl font-bold text-white">Order Details</h1>
            <p className="text-white/50 text-sm font-mono mt-1">{order.orderID}</p>
          </div>
          <GlassmorphicButton onClick={refreshOrder} variant="secondary" size="sm">
            Refresh
          </GlassmorphicButton>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <GlassmorphicCard className="p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-sm text-white/70 uppercase tracking-[0.2em]">Summary</p>
                  <h2 className="text-2xl font-bold text-white">{order.componentType}</h2>
                </div>
                <span className="rounded-full px-3 py-1 text-xs uppercase tracking-[0.16em] bg-white/10 text-white/80">
                  {order.status}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-white/70 mb-6">
                <div>
                  <p className="font-semibold text-white">Quantity</p>
                  <p>{order.quantity}</p>
                </div>
                <div>
                  <p className="font-semibold text-white">Deadline</p>
                  <p>{formatDate(order.deadline)}</p>
                </div>
                <div>
                  <p className="font-semibold text-white">Manufacturer</p>
                  <p>{order.manufacturerMSP}</p>
                </div>
                <div>
                  <p className="font-semibold text-white">Supplier</p>
                  <p>{order.supplierMSP}</p>
                </div>
              </div>

              <div className="space-y-3 text-sm text-white/70">
                <div>
                  <p className="font-semibold text-white">Specifications</p>
                  <p className="whitespace-pre-line">{order.specifications}</p>
                </div>
                <div>
                  <p className="font-semibold text-white">Created</p>
                  <p>{formatDate(order.createdAt)}</p>
                </div>
                {order.fulfilledAt && (
                  <div>
                    <p className="font-semibold text-white">Fulfilled</p>
                    <p>{formatDate(order.fulfilledAt)}</p>
                  </div>
                )}
                {order.verifiedAt && (
                  <div>
                    <p className="font-semibold text-white">Verified</p>
                    <p>{formatDate(order.verifiedAt)}</p>
                  </div>
                )}
              </div>
            </GlassmorphicCard>


          </div>

          <div className="space-y-6">
            <GlassmorphicCard className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <ClipboardList className="w-5 h-5 text-blue-300" />
                <h3 className="text-lg font-semibold text-white">Actions</h3>
              </div>

              {isSupplier && order.status === 'PENDING' && (
                <form onSubmit={handleFulfillSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm text-white/70 mb-2">Batch ID</label>
                    <GlassmorphicInput
                      value={fulfillState.batchID}
                      onChange={(e) => setFulfillState((prev) => ({ ...prev, batchID: e.target.value }))}
                      placeholder="Optional batch reference"
                    />
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs font-mono mb-2">
                    <p className="text-white/40 mb-1 not-italic text-[10px] uppercase tracking-widest">CLI — generate proof</p>
                    <p className="text-emerald-300/80 break-all">vc-quickprove --csv data.csv --order {order?.orderID?.substring(0,8)} --out ./out/ --pk circuit.pk</p>
                  </div>

                  <FilePickerField
                    label="Proof file"
                    hint=".proof"
                    accept=".proof"
                    file={fulfillState.proofFile}
                    onChange={handleFileChange('proofFile')}
                  />
                  <FilePickerField
                    label="Public signals"
                    hint=".public.json"
                    accept=".json,.public.json"
                    file={fulfillState.publicFile}
                    onChange={handleFileChange('publicFile')}
                  />

                  <GlassmorphicButton type="submit" loading={fulfilling} className="w-full">
                    Submit Fulfillment
                  </GlassmorphicButton>
                </form>
              )}

              {isManufacturer && order.status === 'FULFILLED' && (
                <div className="space-y-4">
                  <GlassmorphicButton
                    onClick={handleRunVerify}
                    loading={runningVerify}
                    className="w-full"
                  >
                    Run ZK Verification
                  </GlassmorphicButton>

                  {verifyResult && (() => {
                    const isOutOfSpec = !verifyResult.valid && verifyResult.violations?.length > 0;
                    const boxClass = verifyResult.valid
                      ? 'bg-emerald-500/10 border border-emerald-400/20'
                      : isOutOfSpec
                        ? 'bg-amber-500/10 border border-amber-400/30'
                        : 'bg-rose-500/10 border border-rose-400/20';
                    const labelClass = verifyResult.valid
                      ? 'text-emerald-300'
                      : isOutOfSpec
                        ? 'text-amber-300'
                        : 'text-rose-300';
                    const label = verifyResult.valid
                      ? 'PROOF VALID — WITHIN SPEC'
                      : isOutOfSpec
                        ? 'PROOF VALID — BATCH OUT OF SPEC'
                        : 'PROOF INVALID';
                    return (
                      <div className={`rounded-2xl p-4 text-sm ${boxClass}`}>
                        <p className={`font-bold mb-2 ${labelClass}`}>{label}</p>
                        {isOutOfSpec && verifyResult.violations && (
                          <ul className="space-y-1">
                            {verifyResult.violations.map((v, i) => (
                              <li key={i} className="text-amber-200/80 text-xs font-mono">⚠ {v}</li>
                            ))}
                          </ul>
                        )}
                        {!isOutOfSpec && verifyResult.output && (
                          <pre className="text-white/50 text-xs whitespace-pre-wrap font-mono mt-1">
                            {verifyResult.output}
                          </pre>
                        )}
                      </div>
                    );
                  })()}

                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <GlassmorphicButton onClick={handleAccept} loading={submittingReject} className="w-full">
                      <ShieldCheck className="w-4 h-4 inline mr-2" /> Accept Fulfillment
                    </GlassmorphicButton>

                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 space-y-3">
                      <p className="text-xs text-rose-300/70 uppercase tracking-widest font-semibold">Reject</p>
                      <GlassmorphicTextarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason for rejection…"
                        rows={3}
                      />
                      <GlassmorphicButton
                        onClick={handleReject}
                        loading={submittingReject}
                        variant="secondary"
                        className="w-full border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                      >
                        <ShieldX className="w-4 h-4 inline mr-2" /> Reject Fulfillment
                      </GlassmorphicButton>
                    </div>
                  </div>
                </div>
              )}

              {(!isSupplier || order.status !== 'PENDING') && (!isManufacturer || order.status !== 'FULFILLED') && (
                <p className="text-white/60 text-sm">No actions are available for this order at the moment.</p>
              )}
            </GlassmorphicCard>

            <GlassmorphicCard className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Clock3 className="w-5 h-5 text-blue-300" />
                <h3 className="text-lg font-semibold text-white">Channel</h3>
              </div>
              <p className="text-white/70 mb-2">{orderChannelName}</p>
              <GlassmorphicButton onClick={() => navigate('/channels')} variant="secondary" className="w-full">
                View My Channels
              </GlassmorphicButton>
            </GlassmorphicCard>
          </div>
        </div>
      </motion.div>
    </Layout>
  );
}

function FilePickerField({ label, hint, accept, file, onChange }) {
  const inputId = `file-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label className="block text-sm text-white/70 mb-1.5">
        {label} <span className="text-white/30 text-xs">{hint}</span>
      </label>
      <label
        htmlFor={inputId}
        className="flex items-center gap-3 w-full cursor-pointer rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 px-4 py-2.5 transition-all"
      >
        <Upload className="w-4 h-4 text-white/40 shrink-0" />
        <span className="text-sm text-white/50 truncate">
          {file ? file.name : `Choose ${hint} file…`}
        </span>
        <input id={inputId} type="file" accept={accept} onChange={onChange} className="sr-only" />
      </label>
    </div>
  );
}

