import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { confirmCredentialChange } from '../api';
import { useAuth } from '../AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { ShieldCheck, ShieldAlert, Loader2, Moon, Sun, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const ConfirmCredentialChangePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const { logout } = useAuth();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    if (!token) {
      setError('Credential change token is missing from the verification link.');
      setLoading(false);
      return;
    }

    const confirm = async () => {
      try {
        await confirmCredentialChange(token);
        setSuccess(true);
        logout(); // Terminate frontend session because backend session is invalidated
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Verification failed. The link may have expired or been used already.');
      } finally {
        setLoading(false);
      }
    };

    confirm();
  }, [token, logout]);

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Animated background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -30, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-20 -right-20 w-72 h-72 bg-gradient-to-br from-indigo-300/20 to-purple-300/20 dark:from-indigo-500/10 dark:to-purple-500/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -20, 0], y: [0, 20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-20 -left-20 w-80 h-80 bg-gradient-to-br from-pink-300/20 to-rose-300/20 dark:from-pink-500/10 dark:to-rose-500/10 rounded-full blur-3xl"
        />
      </div>

      {/* Theme toggle */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={toggle}
        className="fixed top-4 right-4 w-10 h-10 rounded-xl bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-center z-10 shadow-lg"
      >
        {theme === 'light' ? <Moon size={16} className="text-indigo-600" /> : <Sun size={16} className="text-amber-400" />}
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-xl shadow-indigo-500/25 mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
            Mail X
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Security Verification</p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl p-8 text-center">
          {loading && (
            <div className="space-y-4 py-6">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Verifying Request</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Confirming and committing your account credential change. Please wait...
              </p>
            </div>
          )}

          {!loading && success && (
            <div className="space-y-4 py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50 mb-2">
                <ShieldCheck size={28} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Verification Complete</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Your credentials have been successfully updated. For security, your session has been cleared. Please sign back in with your updated details.
              </p>
              <div className="pt-4">
                <Link
                  to="/"
                  className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg shadow-indigo-500/25"
                >
                  Sign In
                </Link>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="space-y-4 py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-800/50 mb-2">
                <ShieldAlert size={28} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Verification Failed</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {error}
              </p>
              <div className="pt-4">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ConfirmCredentialChangePage;
