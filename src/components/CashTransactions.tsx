import { useState, useEffect } from 'react';
import { Wallet, Plus, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { suggestLedgerAndNarration } from '../services/geminiService';

interface Ledger {
  id: string;
  ledger_name: string;
  ledger_type: string;
}

export default function CashTransactions() {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    transaction_type: 'DEBIT',
    amount: '',
    particulars: '',
    narration: '',
    ledger_id: '',
  });
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadLedgers();
  }, []);

  const loadLedgers = async () => {
    const { data } = await supabase
      .from('ledgers')
      .select('*')
      .order('ledger_name');

    if (data) setLedgers(data);
  };

  const handleAISuggest = async () => {
    if (!formData.particulars) return;

    setAiSuggesting(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('gemini_api_key')
        .eq('id', user!.id)
        .single();

      if (!profile?.gemini_api_key) {
        alert('Please configure your Gemini API key in Settings');
        return;
      }

      const suggestion = await suggestLedgerAndNarration(
        formData.particulars,
        profile.gemini_api_key,
        user!.id
      );

      setFormData({
        ...formData,
        narration: suggestion.narration,
        ledger_id: suggestion.ledgerId || '',
      });

      if (!suggestion.ledgerId && suggestion.suggestedLedgerName) {
        const shouldCreate = confirm(
          `No matching ledger found. Create "${suggestion.suggestedLedgerName}"?`
        );

        if (shouldCreate) {
          const { data: newLedger } = await supabase
            .from('ledgers')
            .insert({
              user_id: user!.id,
              ledger_name: suggestion.suggestedLedgerName,
              ledger_type: formData.transaction_type === 'DEBIT' ? 'Expense' : 'Income',
              current_balance: 0,
            })
            .select()
            .single();

          if (newLedger) {
            setFormData({ ...formData, ledger_id: newLedger.id });
            loadLedgers();
          }
        }
      }
    } catch (error) {
      console.error('AI suggestion failed:', error);
    } finally {
      setAiSuggesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase.from('transactions').insert({
      user_id: user!.id,
      bank_id: null,
      transaction_date: formData.transaction_date,
      transaction_type: formData.transaction_type,
      amount: parseFloat(formData.amount),
      particulars: formData.particulars,
      narration: formData.narration,
      ledger_id: formData.ledger_id || null,
      is_cash: true,
      is_confirmed: true,
      created_by: 'manual',
    });

    if (!error) {
      if (formData.ledger_id) {
        await supabase.rpc('update_ledger_balance', {
          ledger_id: formData.ledger_id,
          amount: formData.transaction_type === 'DEBIT'
            ? -parseFloat(formData.amount)
            : parseFloat(formData.amount),
        });
      }

      setFormData({
        transaction_date: new Date().toISOString().split('T')[0],
        transaction_type: 'DEBIT',
        amount: '',
        particulars: '',
        narration: '',
        ledger_id: '',
      });
      setShowForm(false);
      alert('Cash transaction recorded successfully!');
    }
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Cash Transactions</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-emerald-600 text-white p-3 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {showForm && (
        <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-3xl p-5 shadow-lg border-2 border-teal-200">
          <h3 className="font-semibold text-gray-900 mb-4">Record Cash Transaction</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={formData.transaction_date}
                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Type
              </label>
              <select
                value={formData.transaction_type}
                onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="DEBIT">Cash Out (Expense)</option>
                <option value="CREDIT">Cash In (Income)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Amount
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Description
              </label>
              <input
                type="text"
                value={formData.particulars}
                onChange={(e) => setFormData({ ...formData, particulars: e.target.value })}
                onBlur={handleAISuggest}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                placeholder="What was this transaction for?"
                required
              />
              {aiSuggesting && (
                <div className="text-xs text-purple-600 mt-1">AI is suggesting details...</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Ledger Account
              </label>
              <select
                value={formData.ledger_id}
                onChange={(e) => setFormData({ ...formData, ledger_id: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="">Select ledger...</option>
                {ledgers.map((ledger) => (
                  <option key={ledger.id} value={ledger.id}>
                    {ledger.ledger_name} ({ledger.ledger_type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Narration (Notes)
              </label>
              <textarea
                value={formData.narration}
                onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                rows={2}
                placeholder="Additional details..."
              />
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="submit"
                className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 transition-all flex items-center justify-center space-x-2"
              >
                <Check className="w-5 h-5" />
                <span>Record Transaction</span>
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-300 transition-all flex items-center justify-center space-x-2"
              >
                <X className="w-5 h-5" />
                <span>Cancel</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 border-2 border-blue-200">
        <div className="flex items-start space-x-3">
          <Wallet className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-700">
            <p className="font-medium mb-1">Cash transactions are not linked to bank accounts</p>
            <p className="text-xs">Record your daily cash expenses and income separately from bank transactions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
