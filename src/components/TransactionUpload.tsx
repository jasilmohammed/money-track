import { useState, useEffect } from 'react';
import { Upload, FileText, AlertCircle, Loader, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { extractTransactionsWithAI } from '../services/geminiService';
import TransactionReview from './TransactionReview';

interface Bank {
  id: string;
  bank_name: string;
  account_number: string;
}

interface ExtractedTransaction {
  date: string;
  description: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  balance?: number;
  reference?: string;
}

interface TransactionUploadProps {
  onComplete: () => void;
}

export default function TransactionUpload({ onComplete }: TransactionUploadProps) {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [transactions, setTransactions] = useState<ExtractedTransaction[]>([]);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<'upload' | 'extract' | 'review' | 'reviewing'>('upload');
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    loadBanks();
  }, []);

  const loadBanks = async () => {
    const { data } = await supabase
      .from('banks')
      .select('id, bank_name, account_number')
      .eq('is_active', true);

    if (data) setBanks(data);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  };

  const readFileContent = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleExtract = async () => {
    if (!file || !selectedBank) {
      setError('Please select a bank and upload a file');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      let content = '';

      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        content = await readFileContent(file);
      } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        content = await readFileContent(file);
      } else {
        setError('Please upload a text or CSV file. For PDF/Excel, please copy the content to a text file.');
        setProcessing(false);
        return;
      }


      const { data: profile } = await supabase
        .from('profiles')
        .select('gemini_api_key')
        .eq('id', user!.id)
        .single();

      if (!profile?.gemini_api_key) {
        setError('Please configure your Gemini API key in Settings');
        setProcessing(false);
        return;
      }

      const extracted = await extractTransactionsWithAI(content, profile.gemini_api_key);
      setTransactions(extracted);
      setStep('reviewing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract transactions');
    } finally {
      setProcessing(false);
    }
  };


  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center space-x-2 mb-4">
        <Sparkles className="w-6 h-6 text-emerald-600" />
        <h2 className="text-xl font-bold text-gray-900">Upload Bank Statement</h2>
      </div>

      {step === 'upload' && (
        <>
          <div className="bg-white rounded-3xl p-5 shadow-lg border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Bank Account
            </label>
            <select
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
            >
              <option value="">Choose a bank...</option>
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.bank_name} - {bank.account_number}
                </option>
              ))}
            </select>

            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Statement File
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-emerald-500 transition-all duration-200">
              <input
                type="file"
                onChange={handleFileChange}
                accept=".txt,.csv,.pdf,.xls,.xlsx"
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="w-12 h-12 text-emerald-600 mb-3" />
                <span className="text-gray-700 font-medium mb-1">
                  {file ? file.name : 'Tap to upload'}
                </span>
                <span className="text-sm text-gray-500">
                  TXT, CSV, PDF, or Excel files
                </span>
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
            onClick={handleExtract}
            disabled={!file || !selectedBank || processing}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 rounded-2xl font-semibold hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2"
          >
            {processing ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Processing with AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Extract Transactions</span>
              </>
            )}
          </button>

          <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-4 border-2 border-cyan-200">
            <div className="flex items-start space-x-3">
              <FileText className="w-5 h-5 text-cyan-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-700">
                <p className="font-medium mb-1">Tips for best results:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Use text or CSV files for best accuracy</li>
                  <li>Ensure transactions are in a clear format</li>
                  <li>Include date, description, and amount</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 'reviewing' && (
        <TransactionReview
          transactions={transactions}
          bankId={selectedBank}
          onComplete={() => {
            onComplete();
            setStep('upload');
            setFile(null);
            setSelectedBank('');
            setTransactions([]);
          }}
          onCancel={() => {
            setStep('upload');
            setTransactions([]);
          }}
        />
      )}
    </div>
  );
}
