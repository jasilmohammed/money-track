import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Calendar, Sparkles, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateFinancialInsights } from '../services/geminiService';

interface LedgerBalance {
  ledger_name: string;
  ledger_type: string;
  balance: number;
}

export default function FinancialSummary() {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [ledgerBalances, setLedgerBalances] = useState<LedgerBalance[]>([]);
  const [insights, setInsights] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadLedgerBalances();
  }, [period]);

  const loadLedgerBalances = async () => {
    const { data } = await supabase
      .from('ledgers')
      .select('ledger_name, ledger_type, current_balance')
      .order('current_balance', { ascending: false });

    if (data) {
      setLedgerBalances(data.map(l => ({
        ...l,
        balance: Number(l.current_balance)
      })));
    }
  };

  const generateInsights = async () => {
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('gemini_api_key')
        .eq('id', user!.id)
        .single();

      if (!profile?.gemini_api_key) {
        setInsights('Please configure your Gemini API key in Settings to get AI-powered insights.');
        return;
      }

      const result = await generateFinancialInsights(user!.id, profile.gemini_api_key, period);
      setInsights(result);
    } catch (error) {
      setInsights('Failed to generate insights. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const expenses = ledgerBalances.filter(l => l.ledger_type === 'Expense');
  const income = ledgerBalances.filter(l => l.ledger_type === 'Income');
  const assets = ledgerBalances.filter(l => l.ledger_type === 'Asset');
  const liabilities = ledgerBalances.filter(l => l.ledger_type === 'Liability');

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Financial Reports</h2>
        <Calendar className="w-6 h-6 text-emerald-600" />
      </div>

      <div className="flex space-x-2">
        {(['month', 'quarter', 'year'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-all capitalize ${
              period === p
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">Total Income</span>
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="text-2xl font-bold">
            ₹{income.reduce((sum, l) => sum + Math.abs(l.balance), 0).toFixed(2)}
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-pink-600 rounded-3xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm opacity-90">Total Expenses</span>
            <TrendingDown className="w-5 h-5" />
          </div>
          <div className="text-2xl font-bold">
            ₹{expenses.reduce((sum, l) => sum + Math.abs(l.balance), 0).toFixed(2)}
          </div>
        </div>
      </div>

      {expenses.length > 0 && (
        <div className="bg-white rounded-3xl p-5 shadow-lg border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">Top Expenses</h3>
          <div className="space-y-3">
            {expenses.slice(0, 5).map((ledger, idx) => {
              const total = expenses.reduce((sum, l) => sum + Math.abs(l.balance), 0);
              const percentage = total > 0 ? (Math.abs(ledger.balance) / total) * 100 : 0;

              return (
                <div key={idx}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">{ledger.ledger_name}</span>
                    <span className="text-sm font-bold text-gray-900">
                      ₹{Math.abs(ledger.balance).toFixed(2)}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{percentage.toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(assets.length > 0 || liabilities.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {assets.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
              <div className="text-sm text-gray-600 mb-2">Assets</div>
              <div className="text-xl font-bold text-emerald-600">
                ₹{assets.reduce((sum, l) => sum + Math.abs(l.balance), 0).toFixed(2)}
              </div>
            </div>
          )}
          {liabilities.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
              <div className="text-sm text-gray-600 mb-2">Liabilities</div>
              <div className="text-xl font-bold text-red-600">
                ₹{liabilities.reduce((sum, l) => sum + Math.abs(l.balance), 0).toFixed(2)}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl p-5 shadow-lg border-2 border-purple-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">AI Financial Insights</h3>
          </div>
        </div>

        {!insights ? (
          <button
            onClick={generateInsights}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-2xl font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Analyzing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Generate Insights</span>
              </>
            )}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl p-4 text-sm text-gray-700 whitespace-pre-wrap">
              {insights}
            </div>
            <button
              onClick={generateInsights}
              disabled={loading}
              className="w-full bg-purple-600 text-white py-2.5 rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 transition-all text-sm"
            >
              Refresh Insights
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-lg border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">All Ledgers</h3>
        <div className="space-y-2">
          {ledgerBalances.map((ledger, idx) => (
            <div
              key={idx}
              className="flex justify-between items-center p-3 bg-gray-50 rounded-xl"
            >
              <div>
                <div className="font-medium text-gray-900">{ledger.ledger_name}</div>
                <div className="text-xs text-gray-500">{ledger.ledger_type}</div>
              </div>
              <div className={`font-bold ${
                ledger.balance >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                ₹{Math.abs(ledger.balance).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
