import { useState, useEffect } from 'react';
import { Upload, Loader, CheckCircle, Edit2, ChevronLeft, ChevronRight, AlertCircle, Building2, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface BankInfo {
  bankName: string;
  accountNumber: string;
  ifscCode?: string;
  statementPeriod?: string;
}

interface ExtractedTransaction {
  date: string;
  particulars: string;
  narration: string;
  amount: number;
  transactionType: 'DEBIT' | 'CREDIT';
  balance?: number;
  reference?: string;
  ledgerSuggestion?: string;
  confidence: number;
  autoMatched?: boolean;
}

interface Bank {
  id: string;
  bank_name: string;
  account_number: string;
}

interface Ledger {
  id: string;
  ledger_name: string;
  ledger_type: string;
}

export default function EnhancedTransactionUpload({ onComplete }: { onComplete?: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState<'upload' | 'bank-confirm' | 'review'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [transactions, setTransactions] = useState<ExtractedTransaction[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState('');

  const [existingBanks, setExistingBanks] = useState<Bank[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [editingBankInfo, setEditingBankInfo] = useState(false);
  const [editedBankInfo, setEditedBankInfo] = useState<BankInfo | null>(null);

  const [editingTransaction, setEditingTransaction] = useState(false);
  const [editedTransaction, setEditedTransaction] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadExistingBanks();
    loadLedgers();
  }, []);

  const loadExistingBanks = async () => {
    const { data } = await supabase
      .from('banks')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (data) setExistingBanks(data);
  };

  const loadLedgers = async () => {
    const { data } = await supabase
      .from('ledgers')
      .select('*')
      .eq('user_id', user!.id)
      .order('ledger_name');

    if (data) setLedgers(data);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  };

  const handleExtractPDF = async () => {
    if (!file) return;

    setExtracting(true);
    setError('');

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('gemini_api_key')
        .eq('id', user!.id)
        .single();

      if (!profile?.gemini_api_key) {
        setError('Please configure your Gemini API key in Settings');
        setExtracting(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError('Please sign in to upload statements');
        setExtracting(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('geminiApiKey', profile.gemini_api_key);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-bank-statement`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'X-Client-Info': 'supabase-js/2.39.0',
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract data');
      }

      const result = await response.json();

      setEditedBankInfo(result.bankInfo);
      setTransactions(result.transactions);

      const matchingBank = existingBanks.find(
        (bank) =>
          bank.account_number === result.bankInfo.accountNumber ||
          (bank.bank_name.toLowerCase().includes(result.bankInfo.bankName.toLowerCase()) &&
           bank.account_number.includes(result.bankInfo.accountNumber.slice(-4)))
      );

      if (matchingBank) {
        setSelectedBankId(matchingBank.id);
      }

      setStep('bank-confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract PDF');
    } finally {
      setExtracting(false);
    }
  };

  const handleBankConfirm = async () => {
    if (!selectedBankId && editedBankInfo) {
      const { data: newBank, error: bankError } = await supabase
        .from('banks')
        .insert({
          user_id: user!.id,
          bank_name: `${editedBankInfo.bankName} - ${editedBankInfo.accountNumber.slice(-4)}`,
          account_number: editedBankInfo.accountNumber,
          account_type: 'Savings',
          opening_balance: transactions[0]?.balance || 0,
          current_balance: transactions[0]?.balance || 0,
          is_active: true,
        })
        .select()
        .single();

      if (bankError) {
        setError('Failed to create bank account');
        return;
      }

      setSelectedBankId(newBank.id);
    }

    setStep('review');
    setCurrentIndex(0);
  };

  const findOrCreateLedger = async (ledgerName: string, txnType: string): Promise<string> => {
    const existing = ledgers.find(
      (l) => l.ledger_name.toLowerCase() === ledgerName.toLowerCase()
    );

    if (existing) return existing.id;

    const { data: newLedger } = await supabase
      .from('ledgers')
      .insert({
        user_id: user!.id,
        ledger_name: ledgerName,
        ledger_type: txnType === 'DEBIT' ? 'Expense' : 'Income',
        current_balance: 0,
      })
      .select()
      .single();

    if (newLedger) {
      await loadLedgers();
      return newLedger.id;
    }

    return '';
  };

  const handleSaveTransaction = async () => {
    setSaving(true);
    try {
      const txn = editingTransaction ? editedTransaction : transactions[currentIndex];

      let ledgerId = '';
      if (txn.ledgerSuggestion) {
        ledgerId = await findOrCreateLedger(txn.ledgerSuggestion, txn.transactionType);
      }

      const { error: txnError } = await supabase.from('transactions').insert({
        user_id: user!.id,
        bank_id: selectedBankId,
        transaction_date: txn.date,
        transaction_type: txn.transactionType,
        amount: txn.amount,
        particulars: txn.particulars,
        narration: txn.narration,
        ledger_id: ledgerId || null,
        balance_after: txn.balance,
        reference_number: txn.reference,
        is_confirmed: true,
        ai_suggested: true,
        created_by: 'pdf_upload',
      });

      if (txnError) throw txnError;

      if (ledgerId) {
        await supabase.rpc('update_ledger_balance', {
          ledger_id: ledgerId,
          amount: txn.transactionType === 'DEBIT' ? -txn.amount : txn.amount,
        });
      }

      if (currentIndex < transactions.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setEditingTransaction(false);
        setEditedTransaction(null);
      } else {
        onComplete?.();
        resetUpload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      for (let i = currentIndex; i < transactions.length; i++) {
        const txn = transactions[i];

        let ledgerId = '';
        if (txn.ledgerSuggestion) {
          ledgerId = await findOrCreateLedger(txn.ledgerSuggestion, txn.transactionType);
        }

        await supabase.from('transactions').insert({
          user_id: user!.id,
          bank_id: selectedBankId,
          transaction_date: txn.date,
          transaction_type: txn.transactionType,
          amount: txn.amount,
          particulars: txn.particulars,
          narration: txn.narration,
          ledger_id: ledgerId || null,
          balance_after: txn.balance,
          reference_number: txn.reference,
          is_confirmed: true,
          ai_suggested: true,
          created_by: 'pdf_upload',
        });

        if (ledgerId) {
          await supabase.rpc('update_ledger_balance', {
            ledger_id: ledgerId,
            amount: txn.transactionType === 'DEBIT' ? -txn.amount : txn.amount,
          });
        }
      }

      onComplete?.();
      resetUpload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transactions');
    } finally {
      setSaving(false);
    }
  };

  const resetUpload = () => {
    setStep('upload');
    setFile(null);
    setEditedBankInfo(null);
    setTransactions([]);
    setCurrentIndex(0);
    setSelectedBankId('');
    setEditingTransaction(false);
    setEditedTransaction(null);
  };

  if (step === 'upload') {
    return (
      <div className="p-5 space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Upload Bank Statement</h2>

        <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select PDF Statement
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-emerald-500 transition-all">
            <input
              type="file"
              onChange={handleFileSelect}
              accept=".pdf"
              className="hidden"
              id="pdf-upload"
            />
            <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center">
              <Upload className="w-12 h-12 text-emerald-600 mb-3" />
              <span className="text-gray-700 font-medium mb-1">
                {file ? file.name : 'Tap to upload PDF'}
              </span>
              <span className="text-sm text-gray-500">PDF bank statements only</span>
            </label>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span className="text-red-600 text-sm">{error}</span>
          </div>
        )}

        <button
          onClick={handleExtractPDF}
          disabled={!file || extracting}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-2xl font-semibold hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center space-x-2"
        >
          {extracting ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              <span>Extracting with AI...</span>
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              <span>Extract & Analyze</span>
            </>
          )}
        </button>
      </div>
    );
  }

  if (step === 'bank-confirm' && editedBankInfo) {
    return (
      <div className="p-5 space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Confirm Bank Details</h2>

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-6 shadow-lg border-2 border-emerald-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Building2 className="w-6 h-6 text-emerald-600" />
              <h3 className="font-semibold text-gray-900">Detected Bank</h3>
            </div>
            <button
              onClick={() => setEditingBankInfo(!editingBankInfo)}
              className="p-2 hover:bg-white rounded-xl transition-all"
            >
              <Edit2 className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {editingBankInfo ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank Name</label>
                <input
                  type="text"
                  value={editedBankInfo.bankName}
                  onChange={(e) =>
                    setEditedBankInfo({ ...editedBankInfo, bankName: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Account Number
                </label>
                <input
                  type="text"
                  value={editedBankInfo.accountNumber}
                  onChange={(e) =>
                    setEditedBankInfo({ ...editedBankInfo, accountNumber: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Bank:</span>
                <span className="font-semibold text-gray-900">{editedBankInfo.bankName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Account:</span>
                <span className="font-semibold text-gray-900">{editedBankInfo.accountNumber}</span>
              </div>
              {editedBankInfo.ifscCode && (
                <div className="flex justify-between">
                  <span className="text-gray-600">IFSC:</span>
                  <span className="font-semibold text-gray-900">{editedBankInfo.ifscCode}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {existingBanks.length > 0 && (
          <div className="bg-white rounded-3xl p-5 shadow-lg border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-3">Or Select Existing Bank</h3>
            <div className="space-y-2">
              {existingBanks.map((bank) => (
                <button
                  key={bank.id}
                  onClick={() => setSelectedBankId(bank.id)}
                  className={`w-full p-4 rounded-xl text-left transition-all ${
                    selectedBankId === bank.id
                      ? 'bg-emerald-100 border-2 border-emerald-500'
                      : 'bg-gray-50 border-2 border-gray-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{bank.bank_name}</div>
                  <div className="text-sm text-gray-500">{bank.account_number}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-blue-50 rounded-2xl p-4 text-sm text-blue-700">
          <strong>{transactions.length}</strong> transactions found in this statement
        </div>

        <button
          onClick={handleBankConfirm}
          className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-semibold hover:bg-emerald-700 transition-all shadow-lg"
        >
          Continue to Review Transactions
        </button>
      </div>
    );
  }

  if (step === 'review' && transactions.length > 0) {
    const txn = editingTransaction ? editedTransaction : transactions[currentIndex];

    return (
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            Transaction {currentIndex + 1} of {transactions.length}
          </h2>
          <button
            onClick={() => setEditingTransaction(!editingTransaction)}
            className={`p-3 rounded-2xl transition-all ${
              editingTransaction ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Edit2 className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-white rounded-2xl p-2">
          <div className="flex items-center justify-between mb-1 text-sm text-gray-600">
            <span>Progress</span>
            <span>{Math.round(((currentIndex + 1) / transactions.length) * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / transactions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-lg border-2 border-emerald-200 space-y-4">
          {txn.autoMatched && (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3 flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-700 font-medium">
                Auto-matched from previous transactions
              </span>
            </div>
          )}

          {editingTransaction ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                <input
                  type="date"
                  value={editedTransaction.date}
                  onChange={(e) =>
                    setEditedTransaction({ ...editedTransaction, date: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Bank Particulars
                </label>
                <textarea
                  value={editedTransaction.particulars}
                  onChange={(e) =>
                    setEditedTransaction({ ...editedTransaction, particulars: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  AI Enhanced Narration
                </label>
                <textarea
                  value={editedTransaction.narration}
                  onChange={(e) =>
                    setEditedTransaction({ ...editedTransaction, narration: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                  <select
                    value={editedTransaction.transactionType}
                    onChange={(e) =>
                      setEditedTransaction({
                        ...editedTransaction,
                        transactionType: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="DEBIT">Debit</option>
                    <option value="CREDIT">Credit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editedTransaction.amount}
                    onChange={(e) =>
                      setEditedTransaction({
                        ...editedTransaction,
                        amount: parseFloat(e.target.value),
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Ledger Account
                </label>
                <select
                  value={editedTransaction.ledgerSuggestion || ''}
                  onChange={(e) =>
                    setEditedTransaction({
                      ...editedTransaction,
                      ledgerSuggestion: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select ledger...</option>
                  {ledgers.map((ledger) => (
                    <option key={ledger.id} value={ledger.ledger_name}>
                      {ledger.ledger_name} ({ledger.ledger_type})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-600 mb-1">Date</div>
                  <div className="font-medium text-gray-900">
                    {new Date(txn.date).toLocaleDateString()}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-600 mb-1">Amount</div>
                  <div
                    className={`font-bold ${
                      txn.transactionType === 'CREDIT' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {txn.transactionType === 'CREDIT' ? '+' : '-'}₹{txn.amount.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3">
                <div className="text-xs text-gray-600 mb-1">Bank Statement Particulars</div>
                <div className="text-sm text-gray-900">{txn.particulars}</div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-3 border-2 border-purple-200">
                <div className="text-xs text-purple-600 mb-1 flex items-center justify-between">
                  <span>AI Enhanced Narration</span>
                  <span className="bg-purple-100 px-2 py-0.5 rounded-full font-medium">
                    {Math.round(txn.confidence * 100)}% confident
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-900">{txn.narration}</div>
              </div>

              {txn.ledgerSuggestion && (
                <div className="bg-blue-50 rounded-xl p-3 border-2 border-blue-200">
                  <div className="text-xs text-blue-600 mb-1">Suggested Ledger</div>
                  <div className="text-sm font-medium text-gray-900">{txn.ledgerSuggestion}</div>
                </div>
              )}

              {txn.reference && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-xs text-gray-600 mb-1">Reference</div>
                  <div className="text-sm text-gray-900">{txn.reference}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="flex space-x-2">
          <button
            onClick={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>

          <button
            onClick={handleSaveTransaction}
            disabled={saving}
            className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
          >
            {saving ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                <span>{currentIndex < transactions.length - 1 ? 'Save & Next' : 'Save & Finish'}</span>
              </>
            )}
          </button>

          <button
            onClick={() =>
              currentIndex < transactions.length - 1 && setCurrentIndex(currentIndex + 1)
            }
            disabled={currentIndex === transactions.length - 1}
            className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-all"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-medium hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
        >
          <CheckCircle className="w-5 h-5" />
          <span>Save All Remaining ({transactions.length - currentIndex})</span>
        </button>

        <button
          onClick={resetUpload}
          className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-300 transition-all flex items-center justify-center space-x-2"
        >
          <X className="w-5 h-5" />
          <span>Cancel</span>
        </button>
      </div>
    );
  }

  return null;
}
