import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ArrowRight, Wallet, TrendingUp, Bell, Sparkles } from 'lucide-react';

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = isSignUp
      ? await signUp(email, password, fullName)
      : await signIn(email, password);

    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl mb-4 shadow-lg">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">MoneyTrack</h1>
            <p className="text-gray-600">Smart accounting made simple</p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-8 mb-6">
            <div className="flex mb-6 bg-gray-100 rounded-2xl p-1">
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className={`flex-1 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                  !isSignUp
                    ? 'bg-white text-emerald-600 shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                className={`flex-1 py-2.5 rounded-xl font-medium transition-all duration-200 ${
                  isSignUp
                    ? 'bg-white text-emerald-600 shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    placeholder="Enter your name"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3.5 rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 group"
              >
                <span>{loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          </div>

          <div className="grid grid-cols-3 gap-3 px-4">
            <div className="text-center">
              <div className="bg-white rounded-2xl p-4 shadow-md mb-2">
                <Sparkles className="w-6 h-6 text-emerald-600 mx-auto" />
              </div>
              <p className="text-xs text-gray-600 font-medium">AI Powered</p>
            </div>
            <div className="text-center">
              <div className="bg-white rounded-2xl p-4 shadow-md mb-2">
                <TrendingUp className="w-6 h-6 text-teal-600 mx-auto" />
              </div>
              <p className="text-xs text-gray-600 font-medium">Smart Insights</p>
            </div>
            <div className="text-center">
              <div className="bg-white rounded-2xl p-4 shadow-md mb-2">
                <Bell className="w-6 h-6 text-cyan-600 mx-auto" />
              </div>
              <p className="text-xs text-gray-600 font-medium">Reminders</p>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center py-6 text-sm text-gray-500">
        <p>Manage your finances with AI assistance</p>
      </div>
    </div>
  );
}
