import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check, Edit2, Sparkles, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { suggestLedgerAndNarration } from '../services/geminiService';

interface ExtractedTransaction {
  date: string;
  description: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  balance?: number;
  reference?: string;
}

interface Ledger {
  id: string;
  ledger_name: string;
  ledger_type: string;
}

interface TransactionReviewProps {
  transactions: ExtractedTransaction[];
  bankId: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function TransactionReview({
  transactions,
  bankId,
  onComplete,
  onCancel,
}: TransactionReviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const { user } = useAuth();

  const [editedTransaction, setEditedTransaction] = useState({
    date: '',
    type: 'DEBIT' as 'DEBIT' | 'CREDIT',
    amount: '',
    particulars: '',
    narration: '',
    ledger_id: '',
    balance: '',
  });

  useEffect(() => {
    loadLedgers();
  }, []);

  useEffect(() => {
    const txn = transactions[currentIndex];
    if (txn) {
      setEditedTransaction({
        date: txn.date,
        type: txn.type,
        amount: txn.amount.toString(),
        particulars: txn.description,
        narration: txn.description,
        ledger_id: '',
        balance: txn.balance?.toString() || '',
      });
      autoSuggest(txn.description);
    }
  }, [currentIndex]);

  const loadLedgers = async () => {
    const { data } = await supabase
      .from('ledgers')
      .select('*')
      .order('ledger_name');

    if (data) setLedgers(data);
  };

  const autoSuggest = async (description: string) => {
    setAiLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('gemini_api_key')
        .eq('id', user!.id)
        .single();

      if (profile?.gemini_api_key) {
        const suggestion = await suggestLedgerAndNarration(
          description,
          profile.gemini_api_key,
          user!.id
        );

        setEditedTransaction((prev) => ({
          ...prev,
          narration: suggestion.narration,
          ledger_id: suggestion.ledgerId || '',
        }));

        if (!suggestion.ledgerId && suggestion.suggestedLedgerName) {
          const { data: newLedger } = await supabase
            .from('ledgers')
            .insert({
              user_id: user!.id,
              ledger_name: suggestion.suggestedLedgerName,
              ledger_type: editedTransaction.type === 'DEBIT' ? 'Expense' : 'Income',
              current_balance: 0,
            })
            .select()
            .single();

          if (newLedger) {
            setEditedTransaction((prev) => ({ ...prev, ledger_id: newLedger.id }));
            loadLedgers();
          }
        }
      }
    } catch (error) {
      console.error('AI suggestion failed:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < transactions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setEditMode(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setEditMode(false);
    }
  };

  const handleImportCurrent = async () => {
    setImporting(true);
    try {
      await supabase.from('transactions').insert({
        user_id: user!.id,
        bank_id: bankId,
        transaction_date: editedTransaction.date,
        transaction_type: editedTransaction.type,
        amount: parseFloat(editedTransaction.amount),
        particulars: editedTransaction.particulars,
        narration: editedTransaction.narration,
        ledger_id: editedTransaction.ledger_id || null,
        balance_after: editedTransaction.balance ? parseFloat(editedTransaction.balance) : null,
        is_confirmed: false,
        ai_suggested: true,
        created_by: 'upload',
      });

      if (editedTransaction.ledger_id) {
        await supabase.rpc('update_ledger_balance', {
          ledger_id: editedTransaction.ledger_id,
          amount: editedTransaction.type === 'DEBIT'
            ? -parseFloat(editedTransaction.amount)
            : parseFloat(editedTransaction.amount),
        });
      }

      if (currentIndex < transactions.length - 1) {
        handleNext();
      } else {
        onComplete();
      }
    } catch (error) {
      console.error('Import failed:', error);
    } finally {
      setImporting(false);
    }
  };

  const handleImportAll = async () => {
    setImporting(true);
    try {
      for (let i = currentIndex; i < transactions.length; i++) {
        const txn = transactions[i];

        const { data: profile } = await supabase
          .from('profiles')
          .select('gemini_api_key')
          .eq('id', user!.id)
          .single();

        const suggestion = profile?.gemini_api_key
          ? await suggestLedgerAndNarration(txn.description, profile.gemini_api_key, user!.id)
          : null;

        let ledgerId = suggestion?.ledgerId;

        if (!ledgerId && suggestion?.suggestedLedgerName) {
          const { data: newLedger } = await supabase
            .from('ledgers')
            .insert({
              user_id: user!.id,
              ledger_name: suggestion.suggestedLedgerName,
              ledger_type: txn.type === 'DEBIT' ? 'Expense' : 'Income',
              current_balance: 0,
            })
            .select()
            .single();

          ledgerId = newLedger?.id;
        }

        await supabase.from('transactions').insert({
          user_id: user!.id,
          bank_id: bankId,
          transaction_date: txn.date,
          transaction_type: txn.type,
          amount: txn.amount,
          particulars: txn.description,
          narration: suggestion?.narration || txn.description,
          ledger_id: ledgerId,
          balance_after: txn.balance,
          is_confirmed: false,
          ai_suggested: true,
          created_by: 'upload',
        });

        if (ledgerId) {
          await supabase.rpc('update_ledger_balance', {
            ledger_id: ledgerId,
            amount: txn.type === 'DEBIT' ? -txn.amount : txn.amount,
          });
        }
      }

      onComplete();
    } catch (error) {
      console.error('Import all failed:', error);
    } finally {
      setImporting(false);
    }
  };

  const currentTxn = transactions[currentIndex];
  if (!currentTxn) return null;

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">
          Review Transaction {currentIndex + 1} of {transactions.length}
        </h2>
        <button
          onClick={() => setEditMode(!editMode)}
          className={`p-3 rounded-2xl transition-all ${
            editMode ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          <Edit2 className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-lg border-2 border-emerald-200">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Progress</span>
            <span className="text-sm font-medium text-gray-900">
              {Math.round(((currentIndex + 1) / transactions.length) * 100)}%
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / transactions.length) * 100}%` }}
            />
          </div>
        </div>

        {!editMode ? (
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="text-sm text-gray-500 mb-1">Date</div>
              <div className="font-medium text-gray-900">
                {new Date(editedTransaction.date).toLocaleDateString()}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-2xl p-4">
                <div className="text-sm text-gray-500 mb-1">Type</div>
                <div className={`font-bold ${
                  editedTransaction.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {editedTransaction.type}
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4">
                <div className="text-sm text-gray-500 mb-1">Amount</div>
                <div className="font-bold text-gray-900">₹{editedTransaction.amount}</div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="text-sm text-gray-500 mb-1">Description</div>
              <div className="font-medium text-gray-900">{editedTransaction.particulars}</div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 border-2 border-purple-200">
              <div className="flex items-center space-x-2 mb-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <div className="text-sm text-purple-600">AI Suggested</div>
              </div>
              <div className="font-medium text-gray-900 mb-2">{editedTransaction.narration}</div>
              {editedTransaction.ledger_id && (
                <div className="text-sm text-gray-600">
                  Ledger: {ledgers.find(l => l.id === editedTransaction.ledger_id)?.ledger_name}
                </div>
              )}
            </div>

            {aiLoading && (
              <div className="flex items-center justify-center space-x-2 text-purple-600">
                <Loader className="w-4 h-4 animate-spin" />
                <span className="text-sm">AI is analyzing...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
              <input
                type="date"
                value={editedTransaction.date}
                onChange={(e) =>
                  setEditedTransaction({ ...editedTransaction, date: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
              <select
                value={editedTransaction.type}
                onChange={(e) =>
                  setEditedTransaction({ ...editedTransaction, type: e.target.value as any })
                }
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="DEBIT">Debit (Expense)</option>
                <option value="CREDIT">Credit (Income)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount</label>
              <input
                type="number"
                step="0.01"
                value={editedTransaction.amount}
                onChange={(e) =>
                  setEditedTransaction({ ...editedTransaction, amount: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Description
              </label>
              <input
                type="text"
                value={editedTransaction.particulars}
                onChange={(e) =>
                  setEditedTransaction({ ...editedTransaction, particulars: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Narration
              </label>
              <textarea
                value={editedTransaction.narration}
                onChange={(e) =>
                  setEditedTransaction({ ...editedTransaction, narration: e.target.value })
                }
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Ledger</label>
              <select
                value={editedTransaction.ledger_id}
                onChange={(e) =>
                  setEditedTransaction({ ...editedTransaction, ledger_id: e.target.value })
                }
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
          </div>
        )}

        <div className="flex space-x-2 mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Previous</span>
          </button>

          <button
            onClick={handleImportCurrent}
            disabled={importing}
            className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
          >
            {importing ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Importing...</span>
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                <span>Import & Next</span>
              </>
            )}
          </button>

          <button
            onClick={handleNext}
            disabled={currentIndex === transactions.length - 1}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <span>Skip</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={handleImportAll}
          disabled={importing}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-medium hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition-all flex items-center justify-center space-x-2 mt-2"
        >
          <Sparkles className="w-5 h-5" />
          <span>Import All Remaining ({transactions.length - currentIndex})</span>
        </button>
      </div>

      <button
        onClick={onCancel}
        className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-300 transition-all"
      >
        Cancel
      </button>
    </div>
  );
}
