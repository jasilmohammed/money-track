import { useState, useEffect } from 'react';
import { Users, Check, X, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SharedTransaction {
  id: string;
  split_amount: number;
  status: string;
  affects_bank: boolean;
  notes: string;
  created_at: string;
  created_by_user_id: string;
  shared_with_user_id: string;
  transaction_id: string;
  created_by: {
    full_name: string;
    email: string;
  };
  shared_with: {
    full_name: string;
    email: string;
  };
  transactions?: {
    transaction_date: string;
    amount: number;
    narration: string;
    particulars: string;
  };
}

export default function SharedTransactions() {
  const [pendingReceived, setPendingReceived] = useState<SharedTransaction[]>([]);
  const [pendingSent, setPendingSent] = useState<SharedTransaction[]>([]);
  const [confirmed, setConfirmed] = useState<SharedTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<'received' | 'sent' | 'history'>('received');
  const { user } = useAuth();

  useEffect(() => {
    loadSharedTransactions();
  }, []);

  const loadSharedTransactions = async () => {
    const { data: received } = await supabase
      .from('shared_transactions')
      .select(`
        *,
        created_by:profiles!shared_transactions_created_by_user_id_fkey(full_name, email),
        shared_with:profiles!shared_transactions_shared_with_user_id_fkey(full_name, email),
        transactions(transaction_date, amount, narration, particulars)
      `)
      .eq('shared_with_user_id', user!.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    const { data: sent } = await supabase
      .from('shared_transactions')
      .select(`
        *,
        created_by:profiles!shared_transactions_created_by_user_id_fkey(full_name, email),
        shared_with:profiles!shared_transactions_shared_with_user_id_fkey(full_name, email),
        transactions(transaction_date, amount, narration, particulars)
      `)
      .eq('created_by_user_id', user!.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    const { data: history } = await supabase
      .from('shared_transactions')
      .select(`
        *,
        created_by:profiles!shared_transactions_created_by_user_id_fkey(full_name, email),
        shared_with:profiles!shared_transactions_shared_with_user_id_fkey(full_name, email),
        transactions(transaction_date, amount, narration, particulars)
      `)
      .or(`created_by_user_id.eq.${user!.id},shared_with_user_id.eq.${user!.id}`)
      .in('status', ['confirmed', 'rejected'])
      .order('confirmed_at', { ascending: false })
      .limit(20);

    if (received) setPendingReceived(received as any);
    if (sent) setPendingSent(sent as any);
    if (history) setConfirmed(history as any);
  };

  const handleConfirm = async (sharedTxnId: string) => {
    const { error } = await supabase
      .from('shared_transactions')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', sharedTxnId);

    if (!error) {
      loadSharedTransactions();
    }
  };

  const handleReject = async (sharedTxnId: string) => {
    if (confirm('Reject this shared transaction?')) {
      const { error } = await supabase
        .from('shared_transactions')
        .update({
          status: 'rejected',
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', sharedTxnId);

      if (!error) {
        loadSharedTransactions();
      }
    }
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Shared Transactions</h2>
        <Users className="w-6 h-6 text-emerald-600" />
      </div>

      <div className="flex space-x-2">
        <button
          onClick={() => setActiveTab('received')}
          className={`flex-1 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'received'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Received ({pendingReceived.length})
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`flex-1 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'sent'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Sent ({pendingSent.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
            activeTab === 'history'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          History
        </button>
      </div>

      {activeTab === 'received' && (
        <div className="space-y-3">
          {pendingReceived.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No pending shared transactions</p>
            </div>
          ) : (
            pendingReceived.map((shared) => (
              <div
                key={shared.id}
                className="bg-white rounded-3xl p-5 shadow-lg border-2 border-yellow-200"
              >
                <div className="mb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <UserPlus className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-gray-600">
                      From: <span className="font-medium text-gray-900">{shared.created_by?.full_name}</span>
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">{shared.created_by?.email}</div>
                </div>

                {shared.transactions && (
                  <div className="bg-gray-50 rounded-2xl p-4 mb-4">
                    <div className="text-sm text-gray-600 mb-1">
                      {new Date(shared.transactions.transaction_date).toLocaleDateString()}
                    </div>
                    <div className="font-medium text-gray-900 mb-1">
                      {shared.transactions.narration || shared.transactions.particulars}
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      Total: ₹{Number(shared.transactions.amount).toFixed(2)}
                    </div>
                  </div>
                )}

                <div className="bg-emerald-50 rounded-2xl p-4 mb-3">
                  <div className="text-sm text-emerald-600 mb-1">Your Share</div>
                  <div className="text-2xl font-bold text-emerald-700">
                    ₹{Number(shared.split_amount).toFixed(2)}
                  </div>
                </div>

                {shared.affects_bank && (
                  <div className="bg-blue-50 rounded-xl p-3 mb-3 text-sm text-blue-700">
                    This transaction affects your bank account
                  </div>
                )}

                {shared.notes && (
                  <div className="bg-gray-50 rounded-xl p-3 mb-3 text-sm text-gray-700">
                    {shared.notes}
                  </div>
                )}

                <div className="flex space-x-2">
                  <button
                    onClick={() => handleConfirm(shared.id)}
                    className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 transition-all flex items-center justify-center space-x-2"
                  >
                    <Check className="w-5 h-5" />
                    <span>Confirm</span>
                  </button>
                  <button
                    onClick={() => handleReject(shared.id)}
                    className="px-4 bg-red-100 text-red-600 py-3 rounded-xl font-medium hover:bg-red-200 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'sent' && (
        <div className="space-y-3">
          {pendingSent.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No pending sent transactions</p>
            </div>
          ) : (
            pendingSent.map((shared) => (
              <div
                key={shared.id}
                className="bg-white rounded-3xl p-5 shadow-lg border-2 border-blue-200"
              >
                <div className="mb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <UserPlus className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-gray-600">
                      To: <span className="font-medium text-gray-900">{shared.shared_with?.full_name}</span>
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">{shared.shared_with?.email}</div>
                </div>

                {shared.transactions && (
                  <div className="bg-gray-50 rounded-2xl p-4 mb-4">
                    <div className="font-medium text-gray-900 mb-1">
                      {shared.transactions.narration || shared.transactions.particulars}
                    </div>
                    <div className="text-xs text-gray-500">
                      Their Share: ₹{Number(shared.split_amount).toFixed(2)}
                    </div>
                  </div>
                )}

                <div className="bg-yellow-50 rounded-xl p-3 text-sm text-yellow-700">
                  Waiting for confirmation
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-3">
          {confirmed.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No transaction history</p>
            </div>
          ) : (
            confirmed.map((shared) => (
              <div
                key={shared.id}
                className={`bg-white rounded-2xl p-4 shadow-md border ${
                  shared.status === 'confirmed'
                    ? 'border-green-200 opacity-70'
                    : 'border-red-200 opacity-50'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-medium text-gray-900">
                      {shared.created_by_user_id === user!.id
                        ? shared.shared_with?.full_name
                        : shared.created_by?.full_name}
                    </div>
                    <div className="text-xs text-gray-500">
                      ₹{Number(shared.split_amount).toFixed(2)}
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-lg text-xs font-medium ${
                      shared.status === 'confirmed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {shared.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
