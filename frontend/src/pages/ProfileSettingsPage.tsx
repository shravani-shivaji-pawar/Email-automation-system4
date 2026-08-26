import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { updateUserProfile, requestCredentialChange } from '../api';
import { User, Phone, Mail, Lock, Edit2, Check, X, ShieldAlert, AlertCircle, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface FieldState {
  value: string;
  isEditing: boolean;
  loading: boolean;
  error: string;
  successMessage: string;
}

const ProfileSettingsPage: React.FC = () => {
  const { user, updateUser } = useAuth();

  // Field states
  const [nameField, setNameField] = useState<FieldState>({
    value: user?.name || '',
    isEditing: false,
    loading: false,
    error: '',
    successMessage: '',
  });

  const [phoneField, setPhoneField] = useState<FieldState>({
    value: user?.phone || '',
    isEditing: false,
    loading: false,
    error: '',
    successMessage: '',
  });

  const [emailField, setEmailField] = useState<FieldState>({
    value: '',
    isEditing: false,
    loading: false,
    error: '',
    successMessage: '',
  });

  const [passwordField, setPasswordField] = useState<FieldState>({
    value: '',
    isEditing: false,
    loading: false,
    error: '',
    successMessage: '',
  });

  if (!user) return null;

  const handleUpdateProfile = async (field: 'name' | 'phone') => {
    const isName = field === 'name';
    const state = isName ? nameField : phoneField;
    const setState = isName ? setNameField : setPhoneField;

    if (!state.value.trim()) {
      setState(prev => ({ ...prev, error: `${isName ? 'Name' : 'Phone'} cannot be empty.` }));
      return;
    }

    if (!isName && !/^\d{10}$/.test(state.value.trim())) {
      setState(prev => ({ ...prev, error: 'Phone number must be exactly 10 digits.' }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: '', successMessage: '' }));

    try {
      const newName = isName ? state.value.trim() : nameField.value.trim();
      const newPhone = isName ? phoneField.value.trim() : state.value.trim();

      const res = await updateUserProfile(newName, newPhone);
      
      // Update global context user details reactively
      updateUser({
        name: res.data.user.name,
        phone: res.data.user.phone,
      });

      setState(prev => ({
        ...prev,
        isEditing: false,
        loading: false,
        successMessage: 'Updated successfully!',
      }));

      // Clear success message after 3 seconds
      setTimeout(() => {
        setState(prev => ({ ...prev, successMessage: '' }));
      }, 3000);
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err.response?.data?.detail || 'Failed to update profile field. Please try again.',
      }));
    }
  };

  const handleRequestCredentialChange = async (type: 'email' | 'password') => {
    const isEmail = type === 'email';
    const state = isEmail ? emailField : passwordField;
    const setState = isEmail ? setEmailField : setPasswordField;

    if (!state.value.trim()) {
      setState(prev => ({ ...prev, error: `${isEmail ? 'Email' : 'Password'} cannot be empty.` }));
      return;
    }

    if (isEmail && !/^[\w\.-]+@[\w\.-]+\.\w+$/.test(state.value.trim())) {
      setState(prev => ({ ...prev, error: 'Invalid email format.' }));
      return;
    }

    if (!isEmail && state.value.trim().length < 6) {
      setState(prev => ({ ...prev, error: 'Password must be at least 6 characters.' }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: '', successMessage: '' }));

    try {
      const res = await requestCredentialChange(type, state.value.trim());

      setState(prev => ({
        ...prev,
        value: '', // clear input field
        isEditing: false,
        loading: false,
        successMessage: res.data.message || 'Confirmation link sent successfully to your current registered email.',
      }));
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err.response?.data?.detail || 'Failed to request change. Please try again.',
      }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Brand & Heading */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
          <User className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent leading-none">
            Profile Settings
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            Manage your personal information and security credentials.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Direct Account Details Card */}
        <div className="glass-card rounded-2xl p-6 md:p-8 space-y-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            Personal Profile Info
          </h2>

          {/* Full Name field */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 items-center pb-5 border-b border-slate-100 dark:border-slate-800/40">
            <div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <User size={16} className="text-slate-400" />
                Full Name
              </span>
            </div>
            <div className="md:col-span-2 flex flex-col gap-2">
              {nameField.isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameField.value}
                    onChange={e => setNameField(prev => ({ ...prev, value: e.target.value }))}
                    className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/30 dark:text-white outline-none"
                    disabled={nameField.loading}
                    placeholder="Enter your name"
                  />
                  <button
                    onClick={() => handleUpdateProfile('name')}
                    disabled={nameField.loading}
                    className="p-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg transition-all"
                    title="Save"
                  >
                    {nameField.loading ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                    ) : <Check size={16} />}
                  </button>
                  <button
                    onClick={() => setNameField(prev => ({ ...prev, isEditing: false, value: user.name, error: '' }))}
                    disabled={nameField.loading}
                    className="p-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
                    title="Cancel"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20 px-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800/30">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{user.name}</span>
                  <button
                    onClick={() => setNameField(prev => ({ ...prev, isEditing: true, error: '' }))}
                    className="p-1.5 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-lg text-indigo-600 dark:text-indigo-400 transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              )}
              {nameField.error && <span className="text-xs text-rose-500 font-medium flex items-center gap-1"><AlertCircle size={12} /> {nameField.error}</span>}
              {nameField.successMessage && <span className="text-xs text-emerald-500 font-medium flex items-center gap-1"><Check size={12} /> {nameField.successMessage}</span>}
            </div>
          </div>

          {/* Phone Number field */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 items-center pb-2">
            <div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Phone size={16} className="text-slate-400" />
                Phone Number
              </span>
            </div>
            <div className="md:col-span-2 flex flex-col gap-2">
              {phoneField.isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={phoneField.value}
                    onChange={e => setPhoneField(prev => ({ ...prev, value: e.target.value }))}
                    className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/30 dark:text-white outline-none"
                    disabled={phoneField.loading}
                    placeholder="10-digit phone number"
                  />
                  <button
                    onClick={() => handleUpdateProfile('phone')}
                    disabled={phoneField.loading}
                    className="p-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg transition-all"
                    title="Save"
                  >
                    {phoneField.loading ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                    ) : <Check size={16} />}
                  </button>
                  <button
                    onClick={() => setPhoneField(prev => ({ ...prev, isEditing: false, value: user.phone || '', error: '' }))}
                    disabled={phoneField.loading}
                    className="p-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
                    title="Cancel"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20 px-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800/30">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{user.phone || 'Not set'}</span>
                  <button
                    onClick={() => setPhoneField(prev => ({ ...prev, isEditing: true, error: '' }))}
                    className="p-1.5 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-lg text-indigo-600 dark:text-indigo-400 transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              )}
              {phoneField.error && <span className="text-xs text-rose-500 font-medium flex items-center gap-1"><AlertCircle size={12} /> {phoneField.error}</span>}
              {phoneField.successMessage && <span className="text-xs text-emerald-500 font-medium flex items-center gap-1"><Check size={12} /> {phoneField.successMessage}</span>}
            </div>
          </div>
        </div>

        {/* Security & Credentials Card */}
        <div className="glass-card rounded-2xl p-6 md:p-8 space-y-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            Security & Login Credentials
          </h2>

          <div className="p-4 bg-indigo-50/30 dark:bg-indigo-950/20 rounded-xl border border-indigo-200/20 dark:border-indigo-800/20 text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed flex gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p>
              Email and Password updates require absolute validation. To process a change, a secure confirmation link will be delivered to your currently verified email address: <strong>{user.email}</strong>. The change will not take effect until confirmed.
            </p>
          </div>

          {/* Email field */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 items-start pb-5 border-b border-slate-100 dark:border-slate-800/40">
            <div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Mail size={16} className="text-slate-400" />
                Email Address
              </span>
            </div>
            <div className="md:col-span-2 flex flex-col gap-2">
              {emailField.isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={emailField.value}
                    onChange={e => setEmailField(prev => ({ ...prev, value: e.target.value }))}
                    className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/30 dark:text-white outline-none"
                    disabled={emailField.loading}
                    placeholder="new@example.com"
                  />
                  <button
                    onClick={() => handleRequestCredentialChange('email')}
                    disabled={emailField.loading}
                    className="p-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg transition-all"
                    title="Send Confirmation"
                  >
                    {emailField.loading ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                    ) : <Check size={16} />}
                  </button>
                  <button
                    onClick={() => setEmailField(prev => ({ ...prev, isEditing: false, value: '', error: '' }))}
                    disabled={emailField.loading}
                    className="p-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
                    title="Cancel"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20 px-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800/30">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{user.email}</span>
                  <button
                    onClick={() => setEmailField(prev => ({ ...prev, isEditing: true, error: '' }))}
                    className="p-1.5 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-lg text-indigo-600 dark:text-indigo-400 transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              )}
              {emailField.error && <span className="text-xs text-rose-500 font-medium flex items-center gap-1"><AlertCircle size={12} /> {emailField.error}</span>}
              {emailField.successMessage && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs rounded-xl border border-emerald-200/20 dark:border-emerald-800/20 flex gap-2 animate-fade-in">
                  <Check size={16} className="shrink-0" />
                  <span>{emailField.successMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* Password field */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 items-start pb-2">
            <div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Lock size={16} className="text-slate-400" />
                Password
              </span>
            </div>
            <div className="md:col-span-2 flex flex-col gap-2">
              {passwordField.isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={passwordField.value}
                    onChange={e => setPasswordField(prev => ({ ...prev, value: e.target.value }))}
                    className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/30 dark:text-white outline-none"
                    disabled={passwordField.loading}
                    placeholder="Min. 6 characters"
                  />
                  <button
                    onClick={() => handleRequestCredentialChange('password')}
                    disabled={passwordField.loading}
                    className="p-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg transition-all"
                    title="Send Confirmation"
                  >
                    {passwordField.loading ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                    ) : <Check size={16} />}
                  </button>
                  <button
                    onClick={() => setPasswordField(prev => ({ ...prev, isEditing: false, value: '', error: '' }))}
                    disabled={passwordField.loading}
                    className="p-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl transition-all"
                    title="Cancel"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20 px-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800/30">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">••••••••••••</span>
                  <button
                    onClick={() => setPasswordField(prev => ({ ...prev, isEditing: true, error: '' }))}
                    className="p-1.5 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-lg text-indigo-600 dark:text-indigo-400 transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              )}
              {passwordField.error && <span className="text-xs text-rose-500 font-medium flex items-center gap-1"><AlertCircle size={12} /> {passwordField.error}</span>}
              {passwordField.successMessage && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs rounded-xl border border-emerald-200/20 dark:border-emerald-800/20 flex gap-2 animate-fade-in">
                  <Check size={16} className="shrink-0" />
                  <span>{passwordField.successMessage}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettingsPage;
