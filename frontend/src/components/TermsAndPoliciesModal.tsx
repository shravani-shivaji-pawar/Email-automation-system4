import React, { useState } from 'react';
import { acceptConsent } from '../api';
import { useAuth } from '../AuthContext';
import { ShieldCheck, Loader2, AlertCircle, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TermsAndPoliciesModal: React.FC = () => {
  const { user, acceptTerms } = useAuth();
  const [isChecked, setIsChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If user has accepted terms or no user is logged in, do not render modal
  if (!user || user.has_accepted_terms) {
    return null;
  }

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isChecked) return;

    setLoading(true);
    setError('');

    try {
      await acceptConsent();
      acceptTerms(); // Reactively updates the AuthContext state
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to register your consent. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3 }}
          className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-800/30">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-none">
                Terms of Use & Data Processing Consent
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                Please review and accept our policies to access your dashboard.
              </p>
            </div>
          </div>

          {/* Policy content */}
          <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-b border-slate-100 dark:border-slate-800 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
            <div className="flex gap-2 text-indigo-600 dark:text-indigo-400 items-start">
              <FileText size={18} className="shrink-0 mt-0.5" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">Data Processing Information</span>
            </div>
            
            <p>
              Imported recipient lists and mailing indexes are processed only for requested email automation activities. 
              The system operates strictly under your command to format, draft, and deliver your messages.
            </p>

            <p>
              Background automation workers may process uploaded recipient information, email content, attachments, 
              sender configuration, and automated sending actions required to perform requested campaigns.
            </p>

            <p>
              The system should only process information necessary for requested automation tasks. We do not sell, 
              redistribute, or reuse your recipient files for any other purpose.
            </p>

            <p>
              Relevant user actions and automation activities may be associated with the authenticated account for 
              operational, security, and audit purposes, ensuring system integrity and reliability.
            </p>

            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200/30 dark:border-amber-800/20 flex gap-3 text-amber-800 dark:text-amber-300">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p className="text-xs leading-normal">
                <strong>User Responsibility:</strong> Users are responsible for ensuring they have the appropriate authorization 
                to upload recipient information and send emails to their intended recipients.
              </p>
            </div>
          </div>

          {/* Footer Form */}
          <form onSubmit={handleAccept} className="p-6 bg-slate-50 dark:bg-slate-900/30 flex flex-col gap-4">
            {error && (
              <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 px-4 py-2.5 rounded-xl text-sm border border-rose-200/50 dark:border-rose-800/50">
                <AlertCircle size={16} className="shrink-0" />
                <span className="text-xs leading-none">{error}</span>
              </div>
            )}

            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
                className="mt-0.5 w-4.5 h-4.5 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500/30 dark:bg-slate-800"
                required
              />
              <span className="text-xs text-slate-500 dark:text-slate-400 select-none group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                I confirm that I have read and agree to the Terms of Use and consent to the processing of my data as described above.
              </span>
            </label>

            <div className="flex items-center justify-end pt-2">
              <button
                type="submit"
                disabled={!isChecked || loading}
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving Acceptance...
                  </>
                ) : (
                  'Accept & Continue'
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TermsAndPoliciesModal;
