import { useState, useRef } from 'react';
import { Upload, Plus, ChevronRight, ChevronLeft, X, Check, Pause } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { extractTransactionsFromPDF, extractTransactionsFromExcel } from '../services/fileExtractionService';
import { suggestLedgerAndNarration } from '../services/geminiService';

interface ExtractedTransaction {
  date: string;
  particulars: string;
  amount: number;
  transactionType: 'DEBIT' | 'CREDIT';
}

interface ProcessingTransaction extends ExtractedTransaction {
  ledgerName: string;
  aiNarration: string;
  confidence: number;
  bankId?: string;
}

export default function TransactionModule({ onComplete }: { onComplete?: () => void }) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'upload' | 'processing' | null>(null);
  const [transactions, setTransactions] = useState<ProcessingTransaction[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [banks, setBanks] = useState<any[]>([]);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [editingTransaction, setEditingTransaction] = useState(false);
  const [editValues, setEditValues] = useState<ProcessingTransaction | null>(null);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [processingError, setProcessingError] = useState('');

  const loadBanksAndLedgers = async () => {
    if (!user) return;
    const [{ data: banksData }, { data: ledgersData }] = await Promise.all([
      supabase.from('banks').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('ledgers').select('*').eq('user_id', user.id)
    ]);
    setBanks(banksData || []);
    setLedgers(ledgersData || []);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setLoading(true);
    setProcessingError('');

    try {
      let extracted: ExtractedTransaction[] = [];

      if (file.name.toLowerCase().endsWith('.pdf')) {
        extracted = await extractTransactionsFromPDF(file);
      } else if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
        extracted = await extractTransactionsFromExcel(file);
      } else {
        setProcessingError('Please upload a PDF or Excel file');
        setLoading(false);
        return;
      }

      if (extracted.length === 0) {
        setProcessingError('No transactions found in the file');
        setLoading(false);
        return;
      }

      await loadBanksAndLedgers();

      const processed = await Promise.all(
        extracted.map(async (txn) => {
          try {
            const profileRes = await supabase
              .from('profiles')
              .select('gemini_api_key')
              .eq('user_id', user.id)
              .maybeSingle();

            const apiKey = profileRes.data?.gemini_api_key;
            let suggestion = { ledger: 'Uncategorized', narration: txn.particulars, confidence: 0.5 };

            if (apiKey) {
              suggestion = await suggestLedgerAndNarration(
                txn.particulars,
                txn.amount,
                txn.transactionType,
                apiKey
              );
            }

            return {
              ...txn,
              ledgerName: suggestion.ledger,
              aiNarration: suggestion.narration,
              confidence: suggestion.confidence
            };
          } catch (err) {
            console.error('Error suggesting ledger:', err);
            return {
              ...txn,
              ledgerName: 'Uncategorized',
              aiNarration: txn.particulars,
              confidence: 0
            };
          }
        })
      );

      setTransactions(processed);
      setCurrentIndex(0);
      setUploadMode('processing');
      if (!selectedBankId && banks.length > 0) {
        setSelectedBankId(banks[0].id);
      }
    } catch (error) {
      console.error('Error processing file:', error);
      setProcessingError('Error processing file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualEntry = () => {
    setUploadMode('processing');
    setTransactions([{
      date: new Date().toISOString().split('T')[0],
      particulars: '',
      amount: 0,
      transactionType: 'DEBIT',
      ledgerName: 'Uncategorized',
      aiNarration: '',
      confidence: 0
    }]);
    setCurrentIndex(0);
  };

  const saveTransaction = async () => {
    if (!user || !selectedBankId) return;

    const txn = editingTransaction && editValues ? editValues : transactions[currentIndex];

    try {
      let ledgerId = null;
      const existingLedger = ledgers.find(l => l.name === txn.ledgerName);

      if (!existingLedger) {
        const { data: newLedger } = await supabase
          .from('ledgers')
          .insert({
            user_id: user.id,
            name: txn.ledgerName,
            type: txn.transactionType === 'DEBIT' ? 'EXPENSE' : 'INCOME',
            description: ''
          })
          .select('id')
          .maybeSingle();
        ledgerId = newLedger?.id;
      } else {
        ledgerId = existingLedger.id;
      }

      await supabase.from('transactions').insert({
        user_id: user.id,
        bank_id: selectedBankId,
        ledger_id: ledgerId,
        transaction_date: txn.date,
        particulars: txn.particulars,
        narration: txn.aiNarration,
        amount: txn.amount,
        transaction_type: txn.transactionType,
        transaction_mode: 'BANK',
        is_confirmed: true,
        is_ai_suggested: txn.confidence > 0.5
      });

      if (editingTransaction) {
        setEditingTransaction(false);
        setEditValues(null);
      } else {
        if (currentIndex < transactions.length - 1) {
          setCurrentIndex(currentIndex + 1);
        } else {
          setUploadMode(null);
          setTransactions([]);
          onComplete?.();
        }
      }
    } catch (error) {
      console.error('Error saving transaction:', error);
      setProcessingError('Error saving transaction');
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setEditingTransaction(false);
      setEditValues(null);
    }
  };

  const goToNext = () => {
    if (currentIndex < transactions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setEditingTransaction(false);
      setEditValues(null);
    }
  };

  const startEdit = () => {
    setEditingTransaction(true);
    setEditValues({ ...transactions[currentIndex] });
  };

  const cancelEdit = () => {
    setEditingTransaction(false);
    setEditValues(null);
  };

  const updateEditValue = (key: keyof ProcessingTransaction, value: any) => {
    if (editValues) {
      setEditValues({ ...editValues, [key]: value });
    }
  };

  if (uploadMode === null) {
    return (
      <div className="p-4 space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Transaction Management</h2>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl p-6 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 transition-all duration-200 shadow-lg group"
          >
            <Upload className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-medium text-sm">Upload Statement</div>
            <div className="text-xs opacity-75 mt-1">PDF or Excel</div>
          </button>

          <button
            onClick={handleManualEntry}
            className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-2xl p-6 hover:from-cyan-600 hover:to-blue-700 transition-all duration-200 shadow-lg group"
          >
            <Plus className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
            <div className="font-medium text-sm">Manual Entry</div>
            <div className="text-xs opacity-75 mt-1">Bank or Cash</div>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.xlsx,.xls"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="bg-white rounded-2xl p-4 border-l-4 border-emerald-500">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-emerald-700">Upload Bank Statement:</span> Extract transactions from your bank's PDF or Excel statement. The AI will automatically suggest ledger accounts and narrations based on your transaction history.
          </p>
        </div>
      </div>
    );
  }

  if (uploadMode === 'processing' && transactions.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-600">No transactions to process</p>
      </div>
    );
  }

  const currentTxn = editingTransaction && editValues ? editValues : transactions[currentIndex];

  return (
    <div className="p-4 pb-20">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Review Transactions</h2>
          <p className="text-sm text-gray-600 mt-1">
            {currentIndex + 1} of {transactions.length}
          </p>
        </div>
        <button
          onClick={() => {
            setUploadMode(null);
            setTransactions([]);
          }}
          className="text-gray-600 hover:text-gray-900"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="w-full bg-emerald-200 h-1 rounded-full mb-4">
        <div
          className="bg-emerald-600 h-1 rounded-full transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / transactions.length) * 100}%` }}
        />
      </div>

      <div className="space-y-4">
        {processingError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {processingError}
          </div>
        )}

        {editingTransaction ? (
          <div className="bg-white rounded-2xl p-4 border-2 border-emerald-500 space-y-3">
            <h3 className="font-semibold text-gray-900">Edit Transaction</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={editValues?.date || ''}
                onChange={(e) => updateEditValue('date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bank Particulars</label>
              <input
                type="text"
                value={editValues?.particulars || ''}
                onChange={(e) => updateEditValue('particulars', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">AI Generated Narration</label>
              <input
                type="text"
                value={editValues?.aiNarration || ''}
                onChange={(e) => updateEditValue('aiNarration', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ledger Account</label>
              <select
                value={editValues?.ledgerName || ''}
                onChange={(e) => updateEditValue('ledgerName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select or type ledger</option>
                {ledgers.map(l => (
                  <option key={l.id} value={l.name}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                value={editValues?.amount || 0}
                onChange={(e) => updateEditValue('amount', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex space-x-2">
              <button
                onClick={saveTransaction}
                className="flex-1 bg-emerald-500 text-white py-2 rounded-lg hover:bg-emerald-600 transition-all flex items-center justify-center space-x-2"
              >
                <Check className="w-5 h-5" />
                <span>Save</span>
              </button>
              <button
                onClick={cancelEdit}
                className="flex-1 bg-gray-300 text-gray-900 py-2 rounded-lg hover:bg-gray-400 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-4 border border-gray-200 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Date</span>
                <p className="font-semibold text-gray-900 mt-0.5">{currentTxn.date}</p>
              </div>
              <div>
                <span className="text-gray-600">Amount</span>
                <p className="font-semibold text-gray-900 mt-0.5">₹{currentTxn.amount.toFixed(2)}</p>
              </div>
            </div>

            <div>
              <span className="text-sm text-gray-600">Bank Statement Particulars</span>
              <p className="font-medium text-gray-900 mt-0.5 bg-gray-50 p-2 rounded">{currentTxn.particulars}</p>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">AI Generated Narration</span>
                <div className="flex items-center space-x-1 bg-emerald-50 px-2 py-1 rounded text-xs">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-emerald-700 font-medium">
                    {Math.round(currentTxn.confidence * 100)}% confidence
                  </span>
                </div>
              </div>
              <p className="font-medium text-gray-900 mt-0.5 bg-emerald-50 p-2 rounded">{currentTxn.aiNarration}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-sm text-gray-600">Ledger Account</span>
                <p className="font-semibold text-gray-900 mt-0.5 bg-blue-50 p-2 rounded">{currentTxn.ledgerName}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Type</span>
                <p className={`font-semibold mt-0.5 p-2 rounded ${
                  currentTxn.transactionType === 'DEBIT'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-green-50 text-green-700'
                }`}>
                  {currentTxn.transactionType}
                </p>
              </div>
            </div>

            <button
              onClick={startEdit}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 py-2 rounded-lg font-medium transition-all"
            >
              Edit Details
            </button>
          </div>
        )}

        {!editingTransaction && (
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                setUploadMode(null);
                setTransactions([]);
              }}
              className="bg-gray-200 hover:bg-gray-300 text-gray-900 py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center space-x-1"
            >
              <Pause className="w-4 h-4" />
              <span className="text-sm">Stop</span>
            </button>

            <button
              onClick={saveTransaction}
              disabled={loading}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center space-x-1"
            >
              <Check className="w-4 h-4" />
              <span className="text-sm">Confirm</span>
            </button>

            <button
              onClick={goToNext}
              disabled={currentIndex >= transactions.length - 1}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center space-x-1"
            >
              <ChevronRight className="w-4 h-4" />
              <span className="text-sm">Skip</span>
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={goToPrevious}
            disabled={currentIndex === 0}
            className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>

          <span className="text-sm text-gray-600">
            {currentIndex + 1} / {transactions.length}
          </span>

          <button
            onClick={goToNext}
            disabled={currentIndex >= transactions.length - 1}
            className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50 transition-all"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
