import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Network, AlertCircle, CheckCircle, XCircle, Link2, Building2, Zap, Clock, Search } from 'lucide-react';
import { Layout } from '../components/Layout';
import {
  GlassmorphicCard,
  GlassmorphicButton,
  LoadingSpinner,
} from '../components/ui/GlassmorphicComponents';
import { useToast } from '../hooks/useNotification';
import { orgService, channelService } from '../services/api';
import '../styles/dashboard.css';

export function DashboardPage() {
  const navigate = useNavigate();
  const { error, success } = useToast();

  const [user, setUser] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orgSearch, setOrgSearch] = useState('');

  const loadData = useCallback(async (parsedUser) => {
    try {
      setLoading(true);
      const [orgsRes, chRes] = await Promise.all([
        orgService.getAll(),
        channelService.getChannels(parsedUser.id),
      ]);
      setOrgs(orgsRes.data);
      setChannels(chRes.data || []);
    } catch (err) {
      error(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) { navigate('/login'); return; }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    loadData(parsedUser);
  }, []); // run once on mount

  // Incoming requests: pending channels where the current user's slot hasn't accepted yet
  const pendingIncoming = channels.filter(c => {
    if (c.status !== 'pending') return false;
    const myId = user?.id?.toString();
    const isMfg  = c.manufacturerOrgId?._id?.toString() === myId;
    const isSplr = c.supplierOrgId?._id?.toString()     === myId;
    if (isMfg)  return !c.requestedByMfg;
    if (isSplr) return !c.requestedBySplr;
    return false;
  });

  const activeChannels = channels.filter(c => c.status === 'active');

  const handleAccept = async (channel) => {
    const myId   = user.id.toString();
    const isMfg  = channel.manufacturerOrgId._id.toString() === myId;
    const other  = isMfg ? channel.supplierOrgId : channel.manufacturerOrgId;
    try {
      await channelService.requestChannel(user.id, other._id);
      success(`Channel accepted! Provisioning with ${other.name}...`);
      loadData(user);
    } catch (err) {
      error(err.response?.data?.error || 'Failed to accept channel');
    }
  };

  const handleDecline = async (channelId) => {
    try {
      await channelService.declineChannel(channelId);
      success('Channel request declined.');
      loadData(user);
    } catch (err) {
      error(err.response?.data?.error || 'Failed to decline channel');
    }
  };

  const handleConnect = async (targetOrgId) => {
    try {
      await channelService.requestChannel(user.id, targetOrgId);
      success('Channel request sent!');
      loadData(user);
    } catch (err) {
      error(err.response?.data?.error || 'Failed to send channel request');
    }
  };

  if (!user) return null;

  return (
    <Layout
      user={user}
      onLogout={() => localStorage.removeItem('user')}
      sidebarContent={
        <div className="sidebar-content-section">
          <h3 className="text-white/80 text-xs uppercase font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <GlassmorphicButton onClick={() => navigate('/orders/create')} size="sm" className="w-full">
              <Plus className="w-4 h-4 inline mr-2" />
              Create Order
            </GlassmorphicButton>
            <GlassmorphicButton onClick={() => navigate('/channels')} variant="secondary" size="sm" className="w-full">
              <Network className="w-4 h-4 inline mr-2" />
              Channels
            </GlassmorphicButton>
          </div>

          <h3 className="text-white/80 text-xs uppercase font-semibold mt-6 mb-3">Active Channels</h3>
          {activeChannels.length === 0 ? (
            <p className="text-white/60 text-xs">No active channels yet</p>
          ) : (
            <div className="space-y-2">
              {activeChannels.map((channel) => (
                <div key={channel._id} className="p-3 bg-white/5 border border-white/10 rounded-lg text-xs">
                  <p className="text-white font-semibold mb-1">{channel.channelName}</p>
                  <p className="text-white/60 text-xs">Status: <span className="text-green-400">{channel.status}</span></p>
                </div>
              ))}
            </div>
          )}
        </div>
      }
    >
      <AnimatePresence>
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex justify-center items-center h-96">
            <LoadingSpinner />
          </motion.div>
        ) : (
          <motion.div key="content" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>

            {/* ── Incoming channel requests ────────────────────────────────── */}
            {pendingIncoming.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-white mb-3">
                  Incoming Channel Requests
                  <span className="ml-2 text-xs bg-yellow-500/30 text-yellow-200 px-2 py-0.5 rounded-full">
                    {pendingIncoming.length}
                  </span>
                </h2>
                <div className="space-y-3">
                  {pendingIncoming.map((ch) => {
                    const myId  = user.id.toString();
                    const isMfg = ch.manufacturerOrgId._id.toString() === myId;
                    const requester = isMfg ? ch.supplierOrgId : ch.manufacturerOrgId;
                    return (
                      <GlassmorphicCard key={ch._id} className="p-4">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div>
                            <p className="text-white font-semibold">{requester.name}</p>
                            <p className="text-white/60 text-xs capitalize">{requester.type} · wants to open a channel with you</p>
                          </div>
                          <div className="flex gap-2">
                            <GlassmorphicButton size="sm" onClick={() => handleAccept(ch)}>
                              <CheckCircle className="w-4 h-4 inline mr-1" /> Accept
                            </GlassmorphicButton>
                            <GlassmorphicButton size="sm" variant="secondary" onClick={() => handleDecline(ch._id)}>
                              <XCircle className="w-4 h-4 inline mr-1" /> Decline
                            </GlassmorphicButton>
                          </div>
                        </div>
                      </GlassmorphicCard>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Stats ───────────────────────────────────────────────────── */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Welcome, {user.name}!</h1>
              <p className="text-white/70">Manage your organization and discover partners</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <StatCard title="Active Channels"     value={activeChannels.length} icon={<Link2 className="w-6 h-6" />} color="text-indigo-300" />
              <StatCard title="Organizations"       value={orgs.length}           icon={<Building2 className="w-6 h-6" />} color="text-blue-300" />
              <StatCard
                title="Network Status"
                value={user.fabricStatus === 'active' ? 'Active' : 'Setting Up'}
                icon={user.fabricStatus === 'active' ? <Zap className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                color={user.fabricStatus === 'active' ? 'text-emerald-300' : 'text-yellow-300'}
              />
            </div>

            {/* ── Organizations Grid ───────────────────────────────────────── */}
            <div className="mb-8">
              {/* header + search */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h2 className="text-2xl font-bold text-white">Available Organizations</h2>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    placeholder="Search by name or type…"
                    value={orgSearch}
                    onChange={e => setOrgSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/15 text-sm text-white placeholder-white/30 focus:outline-none focus:border-indigo-400/50"
                  />
                </div>
              </div>

              {(() => {
                const myId = user.id?.toString();
                // exclude self and banned; apply search
                const otherOrgs = orgs.filter(org => {
                  if (org._id?.toString() === myId) return false;
                  if (org.fabricStatus === 'banned') return false;
                  if (!orgSearch.trim()) return true;
                  const q = orgSearch.toLowerCase();
                  return (
                    org.name?.toLowerCase().includes(q) ||
                    org.type?.toLowerCase().includes(q) ||
                    org.mspId?.toLowerCase().includes(q) ||
                    org.whatTheyMake?.toLowerCase().includes(q)
                  );
                });

                if (orgs.length === 0) return (
                  <GlassmorphicCard>
                    <div className="text-center py-8">
                      <AlertCircle className="w-12 h-12 text-white/50 mx-auto mb-4" />
                      <p className="text-white/70">No organizations found</p>
                    </div>
                  </GlassmorphicCard>
                );

                if (otherOrgs.length === 0) return (
                  <GlassmorphicCard>
                    <div className="text-center py-8">
                      <Search className="w-10 h-10 text-white/20 mx-auto mb-3" />
                      <p className="text-white/60 text-sm">No organizations match <span className="text-white/80">"{orgSearch}"</span></p>
                      <button onClick={() => setOrgSearch('')} className="mt-3 text-xs text-indigo-300 hover:text-indigo-200">
                        Clear search
                      </button>
                    </div>
                  </GlassmorphicCard>
                );

                return (
                  <>
                    {orgSearch && (
                      <p className="text-xs text-white/30 mb-3">{otherOrgs.length} result{otherOrgs.length !== 1 ? 's' : ''} for "{orgSearch}"</p>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {otherOrgs.map(org => {
                        const relatedChannel = channels.find(c =>
                          (c.manufacturerOrgId._id?.toString() === org._id?.toString() ||
                           c.supplierOrgId._id?.toString()     === org._id?.toString()) &&
                          c.status !== 'declined'
                        );
                        const isActive  = relatedChannel?.status === 'active';
                        const isPending = relatedChannel?.status === 'pending';
                        let isOutgoing  = false;
                        if (relatedChannel && isPending) {
                          const iMfg  = relatedChannel.manufacturerOrgId._id?.toString() === myId;
                          const iSplr = relatedChannel.supplierOrgId._id?.toString()     === myId;
                          isOutgoing  = (iMfg && relatedChannel.requestedByMfg) || (iSplr && relatedChannel.requestedBySplr);
                        }
                        return (
                          <OrgCard
                            key={org._id}
                            org={org}
                            isActive={isActive}
                            isPending={isPending}
                            isOutgoing={isOutgoing}
                            onConnect={() => handleConnect(org._id)}
                          />
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}

function StatCard({ title, value, icon, color = 'text-white/60' }) {
  return (
    <GlassmorphicCard hoverable className="text-center">
      <div className={`flex justify-center mb-3 ${color}`}>{icon}</div>
      <p className="text-white/60 text-xs uppercase tracking-widest mb-1">{title}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
    </GlassmorphicCard>
  );
}

function OrgCard({ org, isActive, isPending, isOutgoing, onConnect }) {
  let btnLabel    = 'Connect';
  let btnDisabled = false;
  let btnVariant  = 'primary';

  if (isActive)  { btnLabel = 'Connected';    btnDisabled = true; btnVariant = 'secondary'; }
  if (isOutgoing){ btnLabel = 'Request Sent'; btnDisabled = true; btnVariant = 'secondary'; }

  return (
    <GlassmorphicCard hoverable>
      <div className="mb-3">
        <h3 className="text-white font-semibold text-lg truncate mb-1">{org.name}</h3>
        <p className="text-white/70 text-sm capitalize">{org.type}</p>
      </div>
      <div className="space-y-2 mb-4">
        <InfoLine label="Status" value={org.fabricStatus} />
        <InfoLine label="Description" value={org.whatTheyMake} />
      </div>
      <GlassmorphicButton
        onClick={onConnect}
        disabled={btnDisabled}
        variant={btnVariant}
        size="sm"
        className="w-full text-xs"
      >
        {btnLabel}
      </GlassmorphicButton>
    </GlassmorphicCard>
  );
}

function InfoLine({ label, value }) {
  return (
    <div className="text-xs">
      <p className="text-white/60">{label}</p>
      <p className="text-white font-mono text-xs break-words">{value}</p>
    </div>
  );
}

