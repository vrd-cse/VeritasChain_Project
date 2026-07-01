import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Layout } from '../components/Layout';
import {
  GlassmorphicCard,
  GlassmorphicInput,
  GlassmorphicButton,
  GlassmorphicSelect,
  GlassmorphicTextarea,
  LoadingSpinner,
} from '../components/ui/GlassmorphicComponents';
import { useToast } from '../hooks/useNotification';
import { orderService, channelService, channelReqsService } from '../services/api';

export function OrderCreatePage() {
  const navigate = useNavigate();
  const { error, success } = useToast();

  const [user,            setUser]            = useState(null);
  const [channels,        setChannels]        = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [submitting,      setSubmitting]      = useState(false);

  const [formData, setFormData] = useState({
    channel: '',
    supplierMSP: '',
    componentType: '',
    quantity: '',
    specifications: '',
    deadline: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) { navigate('/login'); return; }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    channelService.getChannels(parsedUser.id)
      .then(res => {
        // Only show channels where the current user is in the manufacturer slot
        const mfgChannels = (res.data || []).filter(c =>
          c.status === 'active' &&
          c.manufacturerOrgId._id?.toString() === parsedUser.id?.toString()
        );
        setChannels(mfgChannels);
      })
      .catch(() => error('Failed to load channels'))
      .finally(() => setLoadingChannels(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const validate = () => {
    const e = {};
    if (!formData.channel)               e.channel       = 'Please select a channel';
    if (!formData.componentType.trim())  e.componentType = 'Component type is required';
    if (!formData.quantity || formData.quantity <= 0) e.quantity = 'Quantity must be > 0';
    if (!formData.specifications.trim()) e.specifications = 'Specifications are required';
    if (!formData.deadline)              e.deadline      = 'Deadline is required';
    if (formData.deadline && new Date(formData.deadline) <= new Date())
      e.deadline = 'Deadline must be in the future';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate() || !user) return;

    setSubmitting(true);
    try {
      // Gate: requirements must exist before order creation
      const reqsRes = await channelReqsService.get(formData.channel);
      if (!reqsRes.data || !reqsRes.data.params?.length) {
        error('Set channel requirements before creating an order. Go to Requirements first.');
        setSubmitting(false);
        return;
      }

      const selectedChannel = channels.find(c => c._id === formData.channel);
      const orderData = {
        manufacturerMSP: user.mspId,
        supplierMSP:     selectedChannel.supplierOrgId.mspId,
        componentType:   formData.componentType,
        quantity:        parseInt(formData.quantity),
        specifications:  formData.specifications,
        deadline:        formData.deadline,
        channel:         selectedChannel.channelName,
      };

      const response = await orderService.createOrder(orderData);
      success('Order created successfully!');
      navigate('/orders', { state: { createdOrderId: response.data.orderID } });
    } catch (err) {
      error(err.response?.data?.error || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  if (loadingChannels) {
    return (
      <Layout user={user} onLogout={() => localStorage.removeItem('user')}>
        <div className="flex justify-center items-center h-96"><LoadingSpinner /></div>
      </Layout>
    );
  }

  const selectedChannelData = channels.find(c => c._id === formData.channel);

  return (
    <Layout user={user} onLogout={() => localStorage.removeItem('user')}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <GlassmorphicCard className="elevated mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Create New Order</h1>
          <p className="text-white/70">You must have set channel requirements before submitting an order.</p>
        </GlassmorphicCard>

        {channels.length === 0 ? (
          <GlassmorphicCard className="p-8 text-center">
            <p className="text-white/70 mb-4">
              You have no active channels where you are the manufacturer.
              Only the org that initiated the channel connection can create orders.
            </p>
            <GlassmorphicButton onClick={() => navigate('/channels')}>Go to Channels</GlassmorphicButton>
          </GlassmorphicCard>
        ) : (
          <GlassmorphicCard className="elevated">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Channel Selection */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">Channel *</label>
                <GlassmorphicSelect
                  value={formData.channel}
                  onChange={e => setFormData(p => ({ ...p, channel: e.target.value, supplierMSP: '' }))}
                  options={channels.map(c => ({
                    value: c._id,
                    label: `${c.channelName} → supplier: ${c.supplierOrgId?.name}`,
                  }))}
                  error={!!errors.channel}
                  errorMessage={errors.channel}
                />
              </div>

              {/* Supplier display (auto-filled from channel) */}
              {selectedChannelData && (
                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">Supplier</label>
                  <div className="bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white/70">
                    {selectedChannelData.supplierOrgId?.name} ({selectedChannelData.supplierOrgId?.mspId})
                  </div>
                </div>
              )}

              {/* Component Type */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">Component Type *</label>
                <GlassmorphicInput
                  type="text"
                  placeholder="e.g. Lithium Battery, Semiconductor"
                  value={formData.componentType}
                  onChange={e => { setFormData(p => ({ ...p, componentType: e.target.value })); setErrors(p => ({ ...p, componentType: '' })); }}
                  error={!!errors.componentType}
                  errorMessage={errors.componentType}
                />
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">Quantity *</label>
                <GlassmorphicInput
                  type="number" min="1"
                  placeholder="Enter quantity"
                  value={formData.quantity}
                  onChange={e => { setFormData(p => ({ ...p, quantity: e.target.value })); setErrors(p => ({ ...p, quantity: '' })); }}
                  error={!!errors.quantity}
                  errorMessage={errors.quantity}
                />
              </div>

              {/* Specifications */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">Specifications *</label>
                <GlassmorphicTextarea
                  placeholder="Detailed specifications, requirements, standards…"
                  value={formData.specifications}
                  onChange={e => { setFormData(p => ({ ...p, specifications: e.target.value })); setErrors(p => ({ ...p, specifications: '' })); }}
                  error={!!errors.specifications}
                  errorMessage={errors.specifications}
                  rows={4}
                />
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-white/80 text-sm font-medium mb-2">Deadline *</label>
                <GlassmorphicInput
                  type="date"
                  value={formData.deadline}
                  onChange={e => { setFormData(p => ({ ...p, deadline: e.target.value })); setErrors(p => ({ ...p, deadline: '' })); }}
                  error={!!errors.deadline}
                  errorMessage={errors.deadline}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <GlassmorphicButton type="button" variant="secondary" onClick={() => navigate('/dashboard')} className="flex-1">
                  Cancel
                </GlassmorphicButton>
                <GlassmorphicButton type="submit" disabled={submitting} loading={submitting} className="flex-1">
                  Create Order
                </GlassmorphicButton>
              </div>
            </form>
          </GlassmorphicCard>
        )}
      </motion.div>
    </Layout>
  );
}

