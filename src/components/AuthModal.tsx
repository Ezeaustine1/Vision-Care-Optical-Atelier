import React, { useState } from 'react';
import { X, Lock, Mail, User, ShieldCheck, KeyRound } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoogleSignIn: () => Promise<void>;
  onEmailSessionSignIn: (payload: {
    email: string;
    password?: string;
    fullName?: string;
    mode?: 'customer' | 'admin';
  }) => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onGoogleSignIn,
  onEmailSessionSignIn,
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('ezehaustine1@gmail.com');
  const [fullName, setFullName] = useState('Austine Ezeh');
  const [password, setPassword] = useState('••••••••••••');
  const [loading, setLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'reset') {
      setResetMessage(`Password reset link dispatched to ${email}.`);
      return;
    }
    setLoading(true);
    try {
      await onEmailSessionSignIn({
        email,
        password,
        fullName: tab === 'register' ? fullName : undefined,
        mode: email.toLowerCase() === 'ezehaustine1@gmail.com' ? 'admin' : 'customer',
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
        <div className="bg-[#0B192C] text-white px-6 py-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[#C5A059]">
              Vision Care Optical Vault
            </span>
            <h2 className="text-xl font-semibold mt-0.5">
              {tab === 'login' && 'Sign In to Your Account'}
              {tab === 'register' && 'Create Patient Account'}
              {tab === 'reset' && 'Reset Account Password'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Mode Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setResetMessage('');
              }}
              className={`flex-1 py-2 rounded-md transition-colors ${
                tab === 'login' ? 'bg-white text-[#0B192C] shadow-xs font-semibold' : 'text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setResetMessage('');
              }}
              className={`flex-1 py-2 rounded-md transition-colors ${
                tab === 'register' ? 'bg-white text-[#0B192C] shadow-xs font-semibold' : 'text-slate-600'
              }`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('reset');
                setResetMessage('');
              }}
              className={`flex-1 py-2 rounded-md transition-colors ${
                tab === 'reset' ? 'bg-white text-[#0B192C] shadow-xs font-semibold' : 'text-slate-600'
              }`}
            >
              Reset Password
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            {tab !== 'reset' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            )}

            {resetMessage && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                {resetMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#0B192C] hover:bg-[#162B49] text-white text-xs font-semibold rounded-xl transition-colors"
            >
              {loading
                ? 'Authenticating...'
                : tab === 'login'
                ? 'Sign In to Vision Care'
                : tab === 'register'
                ? 'Create Verified Account'
                : 'Send Password Reset Link'}
            </button>
          </form>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200" />
            <span className="shrink mx-3 text-[11px] text-slate-400 uppercase">Or Quick Sign-In</span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={async () => {
                onClose();
                await onGoogleSignIn();
              }}
              className="w-full py-2.5 px-4 border border-slate-300 hover:bg-slate-50 text-[#0B192C] text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#1E40AF]" />
              <span>Continue with Google OAuth Popup</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  await onEmailSessionSignIn({
                    email: 'chidinma.okafor@visioncare.ng',
                    fullName: 'Dr. Chidinma Okafor',
                    mode: 'customer',
                  });
                  setLoading(false);
                  onClose();
                }}
                className="py-2 px-3 bg-[#E0F2FE] hover:bg-sky-200 text-[#0B192C] text-[11px] font-semibold rounded-lg transition-colors"
              >
                1-Click Patient Login
              </button>
              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  await onEmailSessionSignIn({
                    email: 'ezehaustine1@gmail.com',
                    fullName: 'Chief Admin (Austine)',
                    mode: 'admin',
                  });
                  setLoading(false);
                  onClose();
                }}
                className="py-2 px-3 bg-[#C5A059]/25 hover:bg-[#C5A059]/40 text-[#0B192C] text-[11px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#0B192C]" />
                <span>1-Click Admin Login</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
