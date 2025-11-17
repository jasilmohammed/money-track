import { useState } from 'react';
import { Upload, Coins } from 'lucide-react';
import EnhancedTransactionUpload from './EnhancedTransactionUpload';
import CashTransactions from './CashTransactions';

export default function TransactionModule({ onComplete }: { onComplete?: () => void }) {
  const [mode, setMode] = useState<'menu' | 'upload' | 'cash'>('menu');

  if (mode === 'upload') {
    return (
      <EnhancedTransactionUpload
        onComplete={() => {
          setMode('menu');
          onComplete?.();
        }}
      />
    );
  }

  if (mode === 'cash') {
    return <CashTransactions />;
  }

  return (
    <div className="p-5 space-y-4">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Transaction Management</h2>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setMode('upload')}
          className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-3xl p-8 hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 shadow-lg group"
        >
          <Upload className="w-10 h-10 mb-3 group-hover:scale-110 transition-transform mx-auto" />
          <div className="font-semibold text-base">Upload Statement</div>
          <div className="text-xs opacity-90 mt-1">PDF with AI extraction</div>
        </button>

        <button
          onClick={() => setMode('cash')}
          className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-3xl p-8 hover:from-cyan-600 hover:to-blue-700 transition-all duration-200 shadow-lg group"
        >
          <Coins className="w-10 h-10 mb-3 group-hover:scale-110 transition-transform mx-auto" />
          <div className="font-semibold text-base">Cash Transaction</div>
          <div className="text-xs opacity-90 mt-1">Manual entry</div>
        </button>
      </div>

      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl p-5 border-2 border-purple-200">
        <div className="text-sm text-gray-700">
          <p className="font-semibold text-purple-700 mb-2">AI-Powered PDF Extraction</p>
          <ul className="space-y-1 text-xs">
            <li>Automatically extracts bank name and account number</li>
            <li>Recognizes existing banks or creates new ones</li>
            <li>Enhanced narrations using Gemini AI</li>
            <li>Auto-fills based on previous transactions</li>
            <li>One-by-one review with edit capability</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
