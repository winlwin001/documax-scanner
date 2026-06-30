import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, AlertCircle, Sparkles } from 'lucide-react';

interface AuthProps {
  onSuccess: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onSuccess }) => {
  const { signInWithGoogle, signInWithApple, signInWithEmail, signInAsGuest } = useAuth();
  
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');

    try {
      const { error: err } = await signInWithEmail(email);
      if (err) {
        setError(err.message || 'Failed to send login code.');
      } else {
        setOtpSent(true);
      }
    } catch (e: any) {
      setError(e.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = () => {
    signInAsGuest();
    onSuccess();
  };

  return (
    <div className="max-w-md mx-auto my-12 bg-surface border border-outline/10 rounded-3xl p-8 shadow-md">
      
      {/* Brand Header */}
      <div className="text-center space-y-2 mb-8">
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto">
          <Sparkles size={24} />
        </div>
        <h2 className="text-2xl font-bold text-on-surface">Welcome to DocuMax</h2>
        <p className="text-sm text-outline">Your ultimate cross-platform document scanner & PDF hub.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-3.5 bg-error/10 border border-error/20 rounded-2xl text-error text-xs font-semibold mb-6">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Auth Forms */}
      {otpSent ? (
        <div className="text-center space-y-4">
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
            <p className="text-sm text-on-surface font-medium">Check your email</p>
            <p className="text-xs text-outline mt-1">We sent a secure login link to <strong>{email}</strong>.</p>
          </div>
          <button
            onClick={() => setOtpSent(false)}
            className="text-xs text-primary font-bold hover:underline"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Email Sign-In Form */}
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-outline mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl bg-surface-variant/20 border border-outline/30 text-sm text-on-surface focus:outline-none focus:border-primary"
                placeholder="name@example.com"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-on-primary hover:bg-primary/95 disabled:opacity-50 rounded-full font-semibold transition text-sm flex items-center justify-center gap-2 shadow-sm"
            >
              <Mail size={16} />
              {loading ? 'Sending link...' : 'Continue with Email'}
            </button>
          </form>

          {/* Separator */}
          <div className="relative flex items-center justify-center py-2">
            <div className="absolute w-full border-t border-outline/10"></div>
            <span className="relative bg-surface px-4 text-xs font-bold text-outline uppercase tracking-wider">Or</span>
          </div>

          {/* Social Logins */}
          <div className="grid grid-cols-1 gap-3">
            {/* Google Sign-In with Custom SVG Logo */}
            <button
              onClick={async () => {
                await signInWithGoogle();
                onSuccess();
              }}
              className="flex items-center justify-center gap-3 py-3 border border-outline/30 hover:bg-surface-variant/30 text-on-surface rounded-full font-semibold text-sm transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.51 0-6.357-2.847-6.357-6.357s2.847-6.357 6.357-6.357c1.6 0 3.03.59 4.14 1.56l3.15-3.15C19.14 2.23 15.93 1 12.24 1 6.04 1 1 6.04 1 12.24s5.04 11.24 11.24 11.24c5.96 0 10.9-4.28 10.9-11.24 0-.68-.06-1.34-.17-1.96H12.24z"
                />
              </svg>
              <span>Google Sign-In</span>
            </button>
            
            {/* Apple Sign-In with Custom SVG Logo */}
            <button
              onClick={async () => {
                await signInWithApple();
                onSuccess();
              }}
              className="flex items-center justify-center gap-3 py-3 border border-outline/30 hover:bg-surface-variant/30 text-on-surface rounded-full font-semibold text-sm transition"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-.96.04-2.13.64-2.82 1.45-.6.69-1.12 1.83-.98 2.94 1.07.08 2.15-.52 2.81-1.33z" />
              </svg>
              <span>Apple Sign-In</span>
            </button>
          </div>

          {/* Guest Mode */}
          <div className="pt-4 border-t border-outline/10 text-center">
            <p className="text-xs text-outline mb-3">Don't want to create an account? Try Guest Mode.</p>
            <button
              onClick={handleGuestMode}
              className="w-full py-3 bg-secondary/10 hover:bg-secondary/20 text-primary rounded-full font-semibold text-sm transition"
            >
              Enter as Guest (Local Only)
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
