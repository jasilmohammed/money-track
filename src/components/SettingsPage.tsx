import { useState, useEffect } from 'react';
import { Settings, Key, User, LogOut, Sparkles, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function SettingsPage() {
  const [profile, setProfile] = useState({
    full_name: '',
    phone: '',
    gemini_api_key: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const { user, signOut } = useAuth();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user!.id)
      .single();

    if (data) {
      setProfile({
        full_name: data.full_name || '',
        phone: data.phone || '',
        gemini_api_key: data.gemini_api_key || '',
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
          gemini_api_key: profile.gemini_api_key,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user!.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center space-x-2 mb-4">
        <Settings className="w-6 h-6 text-emerald-600" />
        <h2 className="text-xl font-bold text-gray-900">Settings</h2>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="bg-white rounded-3xl p-5 shadow-lg border border-gray-100">
          <div className="flex items-center space-x-2 mb-4">
            <User className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Profile Information</h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Phone
              </label>
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="+91 1234567890"
              />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl p-5 shadow-lg border-2 border-purple-200">
          <div className="flex items-center space-x-2 mb-3">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Gemini AI Configuration</h3>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Connect your Google Gemini API key to enable AI-powered features like automatic transaction categorization, smart suggestions, and financial insights.
          </p>

          <div className="bg-white rounded-2xl p-4 mb-4">
            <div className="flex items-start space-x-2 mb-3">
              <Key className="w-4 h-4 text-purple-600 mt-1 flex-shrink-0" />
              <div className="text-sm text-gray-700">
                <p className="font-medium mb-2">How to get your API key:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Visit Google AI Studio</li>
                  <li>Sign in with your Google account</li>
                  <li>Click "Get API Key"</li>
                  <li>Create a new API key</li>
                  <li>Copy and paste it below</li>
                </ol>
              </div>
            </div>

            <a
              href="https://makersuite.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center space-x-2 bg-purple-600 text-white py-2.5 rounded-xl font-medium hover:bg-purple-700 transition-all text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Get API Key from Google</span>
            </a>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Gemini API Key
            </label>
            <input
              type="password"
              value={profile.gemini_api_key}
              onChange={(e) => setProfile({ ...profile, gemini_api_key: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              placeholder="AIza..."
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Your API key is encrypted and stored securely
            </p>
          </div>
        </div>

        {message.text && (
          <div className={`rounded-2xl p-4 flex items-center space-x-3 ${
            message.type === 'success'
              ? 'bg-green-50 border-2 border-green-200'
              : 'bg-red-50 border-2 border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <span className={`text-sm font-medium ${
              message.type === 'success' ? 'text-green-700' : 'text-red-700'
            }`}>
              {message.text}
            </span>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-2xl font-semibold hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
        >
          <CheckCircle className="w-5 h-5" />
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </form>

      <div className="bg-white rounded-3xl p-5 shadow-lg border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">Account Actions</h3>
        <button
          onClick={signOut}
          className="w-full bg-red-50 text-red-600 py-3 rounded-2xl font-medium hover:bg-red-100 transition-all flex items-center justify-center space-x-2 border-2 border-red-200"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 text-center">
        <p className="text-xs text-gray-500">
          MoneyTrack v1.0 • Smart Accounting for Everyone
        </p>
      </div>
    </div>
  );
}
