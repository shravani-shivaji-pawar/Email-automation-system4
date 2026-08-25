import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api';
import { useTheme } from '../contexts/ThemeContext';
import { Mail, ArrowLeft, Sparkles, Moon, Sun, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { theme, toggle } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const res = await forgotPassword(email);
      setMessage(res.data.message || 'If an account exists for this email, a password reset link has been sent.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
          <p className="text-slate-500 dark:text-slate-400 mt-2">Recover your password</p>
        </div>

        {/* Card */}
        <div className="glass-card rounded-2xl p-8">
          {message ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50">
                <CheckCircle size={24} />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Check your email</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {message}
              </p>
              <div className="pt-4">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                >
                  <ArrowLeft size={16} />
                  Back to Sign In
                </Link>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Enter your email address and we'll send you a secure link to reset your password.
              </p>

              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 px-4 py-3 rounded-xl text-sm border border-rose-200/50 dark:border-rose-800/50"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  {error}
                </motion.div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:text-white transition-all outline-none"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                    Sending link...
                  </span>
                ) : 'Send Reset Link'}
              </motion.button>

              <div className="text-center pt-2">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                >
                  <ArrowLeft size={16} />
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;
