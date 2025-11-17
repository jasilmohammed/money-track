import { useState, useEffect } from 'react';
import { ArrowUpRight, ArrowDownLeft, Check, X, ChevronRight, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import SplitTransaction from './SplitTransaction';

interface Transaction {
  id: string;
  transaction_date: string;
  transaction_type: string;
  amount: number;
  particulars: string;
  narration: string;
  is_confirmed: boolean;
  ai_suggested: boolean;
  ledgers?: {
    ledger_name: string;
  };
  banks?: {
    bank_name: string;
  };
}

interface TransactionListProps {
  limit?: number;
}

export default function TransactionList({ limit }: TransactionListProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed'>('all');
  const [splitTransaction, setSplitTransaction] = useState<Transaction | null>(null);
  useAuth();

  useEffect(() => {
    loadTransactions();
  }, [filter]);

  const loadTransactions = async () => {
    let query = supabase
      .from('transactions')
      .select(`
        *,
        ledgers(ledger_name),
        banks(bank_name)
      `)
      .order('transaction_date', { ascending: false });

    if (filter === 'pending') {
      query = query.eq('is_confirmed', false);
    } else if (filter === 'confirmed') {
      query = query.eq('is_confirmed', true);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data } = await query;
    if (data) setTransactions(data);
  };

  const confirmTransaction = async (id: string) => {
    await supabase
      .from('transactions')
      .update({ is_confirmed: true })
      .eq('id', id);
    loadTransactions();
  };

  const deleteTransaction = async (id: string) => {
    if (confirm('Delete this transaction?')) {
      await supabase.from('transactions').delete().eq('id', id);
      loadTransactions();
    }
  };

  return (
    <div className="space-y-4">
      {!limit && (
        <>
          <div className="flex items-center justify-between px-5">
            <h2 className="text-xl font-bold text-gray-900">Transactions</h2>
          </div>

          <div className="flex space-x-2 px-5">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                filter === 'all'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                filter === 'pending'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilter('confirmed')}
              className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                filter === 'confirmed'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Confirmed
            </button>
          </div>
        </>
      )}

      {limit && (
        <div className="flex items-center justify-between px-5">
          <h3 className="font-semibold text-gray-900">Recent Transactions</h3>
          <button className="text-emerald-600 text-sm font-medium flex items-center">
            View All
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      )}

      <div className="space-y-2 px-5">
        {transactions.map((txn) => (
          <div
            key={txn.id}
            className={`bg-white rounded-2xl p-4 shadow-md border-2 transition-all duration-200 ${
              txn.is_confirmed
                ? 'border-gray-100'
                : 'border-yellow-200 bg-yellow-50/30'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-start space-x-3 flex-1">
                <div className={`p-2 rounded-xl ${
                  txn.transaction_type === 'CREDIT'
                    ? 'bg-green-100'
                    : 'bg-red-100'
                }`}>
                  {txn.transaction_type === 'CREDIT' ? (
                    <ArrowDownLeft className="w-5 h-5 text-green-600" />
                  ) : (
                    <ArrowUpRight className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 mb-1 truncate">
                    {txn.narration || txn.particulars}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>{new Date(txn.transaction_date).toLocaleDateString()}</span>
                    {txn.banks?.bank_name && (
                      <>
                        <span>•</span>
                        <span>{txn.banks.bank_name}</span>
                      </>
                    )}
                    {txn.ledgers?.ledger_name && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-600">{txn.ledgers.ledger_name}</span>
                      </>
                    )}
                  </div>
                  {txn.ai_suggested && !txn.is_confirmed && (
                    <div className="mt-2 inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-lg">
                      AI Suggested
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right ml-3">
                <div className={`font-bold text-lg ${
                  txn.transaction_type === 'CREDIT'
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  {txn.transaction_type === 'CREDIT' ? '+' : '-'}₹{Number(txn.amount).toFixed(2)}
                </div>
              </div>
            </div>

            {!txn.is_confirmed && (
              <div className="flex space-x-2 mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => confirmTransaction(txn.id)}
                  className="flex-1 bg-emerald-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-all flex items-center justify-center space-x-1"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm</span>
                </button>
                <button
                  onClick={() => deleteTransaction(txn.id)}
                  className="px-4 bg-red-100 text-red-600 py-2 rounded-xl text-sm font-medium hover:bg-red-200 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {txn.is_confirmed && (
              <div className="flex space-x-2 mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={() => setSplitTransaction(txn)}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-yellow-500 text-white py-2 rounded-xl text-sm font-medium hover:from-orange-600 hover:to-yellow-600 transition-all flex items-center justify-center space-x-1"
                >
                  <Users className="w-4 h-4" />
                  <span>Split</span>
                </button>
              </div>
            )}
          </div>
        ))}

        {transactions.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">No transactions found</div>
            <div className="text-sm text-gray-500">
              Upload a bank statement to get started
            </div>
          </div>
        )}
      </div>

      {splitTransaction && (
        <SplitTransaction
          transaction={splitTransaction}
          onComplete={() => {
            setSplitTransaction(null);
            alert('Transaction split successfully! Waiting for confirmation from other users.');
          }}
          onCancel={() => setSplitTransaction(null)}
        />
      )}
    </div>
  );
}
