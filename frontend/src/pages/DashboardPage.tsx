import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Send, Mail, TrendingUp, Sparkles, Activity, Filter, Info, LogOut } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { getSendStatus, getGmailStatus, getSenders } from '../api';
import SendProgress from '../components/SendProgress';
import ConnectGoogleButton from '../components/ConnectGoogleButton';
import type { SendStatusResponse } from '../types';
import { motion } from 'framer-motion';

const statVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.05, duration: 0.4 },
  }),
};

const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [status, setStatus] = useState<SendStatusResponse | null>(null);
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'last_batch' | 'total_sent'>('all');
  const [senderEmails, setSenderEmails] = useState<string[]>([]);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    loadStatus();
    checkGmailConnection();
    // Poll status periodically
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, [user]);

  // Fetch organization sender emails on load/update to isolate batches
  useEffect(() => {
    if (user?.role === 'organization') {
      getSenders(user.id).then((res) => {
        const emails = (res.data.senders || []).map((s: any) => s.email.toLowerCase().trim());
        setSenderEmails(emails);
      }).catch((e) => console.error('Error fetching senders:', e));
    }
  }, [user]);

  // Check if OAuth redirect param is present
  useEffect(() => {
    if (searchParams.get('gmail_connected') === '1') {
      setGmailConnected(true);
    }
  }, [searchParams]);

  const loadStatus = async () => {
    try {
      const res = await getSendStatus();
      setStatus(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const checkGmailConnection = async () => {
    if (user?.role === 'individual' && user?.email) {
      try {
        const res = await getGmailStatus(user.email);
        setGmailConnected(res.connected);
      } catch (e) {
        console.error('Error fetching Gmail status', e);
      }
    }
  };

  // ── USER-ISOLATED DATA EXTRACTION ──────────────────────────────────────────
  
  // Filter jobs by logged-in user
  const userJobs = (status?.jobs || []).filter((job: any) => {
    if (!user) return false;
    const jobEmail = (job.from_email || '').toLowerCase().trim();
    if (user.role === 'individual') {
      return jobEmail === user.email.toLowerCase().trim();
    } else {
      return senderEmails.includes(jobEmail);
    }
  });

  // Filter last_batch by logged-in user
  const userLastBatch = status?.last_batch && user && (
    (user.role === 'individual' && status.last_batch.from_email?.toLowerCase().trim() === user.email.toLowerCase().trim()) ||
    (user.role === 'organization' && senderEmails.includes(status.last_batch.from_email?.toLowerCase().trim()))
  ) ? status.last_batch : null;

  // Build cumulative list of all user batches/jobs (merging userJobs and userLastBatch to handle restarts gracefully)
  const allCalculatedJobs: any[] = [...userJobs];
  if (userLastBatch && !userJobs.some((j: any) => j.job_id === userLastBatch.job_id)) {
    allCalculatedJobs.push({
      job_id: userLastBatch.job_id,
      from_email: userLastBatch.from_email,
      subject: userLastBatch.subject,
      in_progress: false,
      started_at: userLastBatch.at,
      completed_at: userLastBatch.at,
      total: userLastBatch.total,
      processed: userLastBatch.processed,
      delivered: userLastBatch.delivered,
      failed: userLastBatch.failed,
      skipped: userLastBatch.skipped || 0,
      bounced: userLastBatch.bounced || 0,
      current_email: null
    });
  }

  // Find the actual latest job/campaign belonging to this user by sorting by timestamp descending
  const newestJob = [...allCalculatedJobs].sort((a: any, b: any) => {
    const timeA = a.started_at ? new Date(a.started_at).getTime() : 0;
    const timeB = b.started_at ? new Date(b.started_at).getTime() : 0;
    return timeB - timeA;
  })[0] || null;

  // Compute stats according to selected filter
  let statDelivered = 0;
  let statFailed = 0;
  let statBounced = 0;
  let statProcessed = 0;

  if (activeFilter === 'all' || activeFilter === 'total_sent') {
    statDelivered = allCalculatedJobs.reduce((acc, j) => acc + (j.delivered || 0), 0);
    statFailed = allCalculatedJobs.reduce((acc, j) => acc + (j.failed || 0), 0);
    statBounced = allCalculatedJobs.reduce((acc, j) => acc + (j.bounced || 0), 0);
    statProcessed = allCalculatedJobs.reduce((acc, j) => acc + (j.processed || 0), 0);
  } else if (activeFilter === 'last_batch') {
    statDelivered = newestJob?.delivered || 0;
    statFailed = newestJob?.failed || 0;
    statBounced = newestJob?.bounced || 0;
    statProcessed = newestJob?.processed || 0;
  }

  const stats = [
    { label: 'Delivered', value: statDelivered, icon: Send, color: 'from-emerald-500 to-teal-500', bg: 'emerald' },
    { label: 'Failed', value: statFailed, icon: Mail, color: 'from-rose-500 to-pink-500', bg: 'rose' },
    { label: 'Bounced', value: statBounced, icon: TrendingUp, color: 'from-amber-500 to-orange-500', bg: 'amber' },
    { label: 'Processed', value: statProcessed, icon: Activity, color: 'from-indigo-500 to-purple-500', bg: 'indigo' },
  ];

  // Construct status object to render in SendProgress panel
  const statusToRender: SendStatusResponse | null = allCalculatedJobs.length > 0 ? {
    success: true,
    send_in_progress: activeFilter === 'last_batch' ? (newestJob?.in_progress || false) : (status?.send_in_progress || false),
    stop_requested: status?.stop_requested || false,
    progress: {
      total: activeFilter === 'last_batch' ? (newestJob?.total || 0) : allCalculatedJobs.reduce((acc, j) => acc + (j.total || 0), 0),
      processed: activeFilter === 'last_batch' ? (newestJob?.processed || 0) : allCalculatedJobs.reduce((acc, j) => acc + (j.processed || 0), 0),
      delivered: activeFilter === 'last_batch' ? (newestJob?.delivered || 0) : allCalculatedJobs.reduce((acc, j) => acc + (j.delivered || 0), 0),
      failed: activeFilter === 'last_batch' ? (newestJob?.failed || 0) : allCalculatedJobs.reduce((acc, j) => acc + (j.failed || 0), 0),
      skipped: activeFilter === 'last_batch' ? (newestJob?.skipped || 0) : allCalculatedJobs.reduce((acc, j) => acc + (j.skipped || 0), 0),
      bounced: activeFilter === 'last_batch' ? (newestJob?.bounced || 0) : allCalculatedJobs.reduce((acc, j) => acc + (j.bounced || 0), 0),
      current_emails_summary: status?.progress.current_emails_summary || '',
      active_job_count: status?.progress.active_job_count || 0
    },
    jobs: activeFilter === 'last_batch' ? (newestJob ? [newestJob] : []) : allCalculatedJobs,
    active_job_count: status?.active_job_count || 0,
    last_batch: userLastBatch,
    smtp_configured: status?.smtp_configured || false,
    delivery_note: status?.delivery_note || ''
  } : null;

  // 1. Google OAuth Onboarding View for Individual users
  if (user?.role === 'individual' && gmailConnected === false) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[75vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-8 w-full border border-slate-200/50 dark:border-slate-700/50 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none" />
          
          <div className="text-center mb-8 relative">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-xl shadow-indigo-500/25 mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent mb-2">
              Connect Google Account
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Connect your Gmail account to begin sending personalized bulk emails.
            </p>
          </div>

          <div className="space-y-4">
            <ConnectGoogleButton
              targetEmail={user.email}
              title="Gmail API Integration"
              description="Authorise application to send emails on your behalf."
              returnPath="/dashboard"
            />
            
            <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-xl p-4 text-xs space-y-2 mt-4">
              <div className="flex gap-2 text-slate-500 dark:text-slate-400">
                <Info size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                <span>Individual accounts only require connecting a Google account. No complex SMTP setup or App Passwords required.</span>
              </div>
            </div>

            <button
              onClick={logout}
              className="mt-6 flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-880 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition-all"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Welcome Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Welcome back, {user?.name?.split(' ')[0]}!
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Here's your email campaign overview
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Link
            to="/send-emails"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-indigo-600/10"
          >
            Send Emails
          </Link>
          {user?.role === 'organization' && (
            <Link
              to="/senders"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold border border-slate-200/50 dark:border-slate-700/50 transition-all"
            >
              Manage Senders
            </Link>
          )}
        </div>
      </motion.div>

      {/* Main Dashboard Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Left Sidebar containing Filters and Last Batch Card */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-6">
          
          {/* Filters Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/50"
          >
            <div className="flex items-center gap-2 mb-4 text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
              <Filter size={16} />
              <span>FILTERS</span>
            </div>
            
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setActiveFilter('all')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeFilter === 'all'
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-l-4 border-indigo-500 pl-2.5'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                All Batches
              </button>
              
              <button
                onClick={() => setActiveFilter('last_batch')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeFilter === 'last_batch'
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-l-4 border-indigo-500 pl-2.5'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                Last Batch
              </button>
              
              <button
                onClick={() => setActiveFilter('total_sent')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeFilter === 'total_sent'
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-l-4 border-indigo-500 pl-2.5'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                Total Sent
              </button>
            </div>
          </motion.div>

          {/* Last Batch Summary Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/50 space-y-4"
          >
            <div className="font-semibold text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Last Batch Summary
            </div>
            
            {newestJob ? (
              <div className="space-y-3.5">
                <div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">From</div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300 break-all">{newestJob.from_email}</div>
                </div>
                
                <div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mb-0.5">Subject</div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300 line-clamp-2">{newestJob.subject}</div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">{newestJob.delivered} delivered</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-rose-600 dark:text-rose-400 font-medium">{newestJob.failed} failed</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-600 dark:text-amber-400 font-medium">{(newestJob.bounced || 0)} bounced</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-500 dark:text-slate-400 text-sm py-2">
                No recent campaigns sent yet.
              </div>
            )}
          </motion.div>
        </div>

        {/* Right Main Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          
          {/* Stats Grid */}
          <motion.div initial="hidden" animate="visible" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                custom={i}
                variants={statVariants}
                className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div
                  className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-5 rounded-bl-[3rem]`}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</span>
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${stat.color} bg-opacity-10 flex items-center justify-center`}>
                      <stat.icon size={16} className={`text-slate-700 dark:text-slate-200`} />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Send Progress Panel */}
          {statusToRender && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <SendProgress status={statusToRender} />
            </motion.div>
          )}

        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
