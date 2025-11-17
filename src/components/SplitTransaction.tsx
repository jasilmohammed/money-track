import { useState, useEffect } from 'react';
import { Search, X, Check, Percent } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Transaction {
  id: string;
  transaction_date: string;
  amount: number;
  narration: string;
  particulars: string;
}

interface SplitTransactionProps {
  transaction: Transaction;
  onComplete: () => void;
  onCancel: () => void;
}

interface UserSearchResult {
  id: string;
  email: string;
  full_name: string;
}

export default function SplitTransaction({
  transaction,
  onComplete,
  onCancel,
}: SplitTransactionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Array<{
    userId: string;
    userName: string;
    userEmail: string;
    amount: string;
    percentage: string;
  }>>([]);
  const [affectsBank, setAffectsBank] = useState(false);
  const [notes, setNotes] = useState('');
  const [splitMethod, setSplitMethod] = useState<'equal' | 'manual'>('equal');
  const { user } = useAuth();

  const searchUsers = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .neq('id', user!.id)
      .or(`email.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(5);

    if (data) setSearchResults(data);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (splitMethod === 'equal' && selectedUsers.length > 0) {
      const splitAmount = Number(transaction.amount) / (selectedUsers.length + 1);
      setSelectedUsers(
        selectedUsers.map((u) => ({
          ...u,
          amount: splitAmount.toFixed(2),
          percentage: ((splitAmount / Number(transaction.amount)) * 100).toFixed(2),
        }))
      );
    }
  }, [splitMethod, selectedUsers.length]);

  const addUser = (userResult: UserSearchResult) => {
    if (selectedUsers.find((u) => u.userId === userResult.id)) return;

    const splitAmount =
      splitMethod === 'equal'
        ? Number(transaction.amount) / (selectedUsers.length + 2)
        : 0;

    setSelectedUsers([
      ...selectedUsers,
      {
        userId: userResult.id,
        userName: userResult.full_name || userResult.email,
        userEmail: userResult.email,
        amount: splitAmount.toFixed(2),
        percentage: splitMethod === 'equal'
          ? ((splitAmount / Number(transaction.amount)) * 100).toFixed(2)
          : '0',
      },
    ]);

    setSearchQuery('');
    setSearchResults([]);
  };

  const removeUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter((u) => u.userId !== userId));
  };

  const updateUserAmount = (userId: string, amount: string) => {
    const numAmount = parseFloat(amount) || 0;
    const percentage = ((numAmount / Number(transaction.amount)) * 100).toFixed(2);

    setSelectedUsers(
      selectedUsers.map((u) =>
        u.userId === userId ? { ...u, amount, percentage } : u
      )
    );
  };

  const handleSubmit = async () => {
    const totalSplit = selectedUsers.reduce(
      (sum, u) => sum + parseFloat(u.amount),
      0
    );

    if (totalSplit > Number(transaction.amount)) {
      alert('Total split amount cannot exceed transaction amount');
      return;
    }

    try {
      for (const splitUser of selectedUsers) {
        await supabase.from('shared_transactions').insert({
          transaction_id: transaction.id,
          created_by_user_id: user!.id,
          shared_with_user_id: splitUser.userId,
          split_amount: parseFloat(splitUser.amount),
          split_percentage: parseFloat(splitUser.percentage),
          status: 'pending',
          affects_bank: affectsBank,
          notes,
        });
      }

      onComplete();
    } catch (error) {
      console.error('Failed to split transaction:', error);
      alert('Failed to split transaction');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="bg-white rounded-t-3xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Split Transaction</h2>
          <button
            onClick={onCancel}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-gray-50 rounded-2xl p-4">
            <div className="text-sm text-gray-600 mb-1">
              {new Date(transaction.transaction_date).toLocaleDateString()}
            </div>
            <div className="font-medium text-gray-900 mb-2">
              {transaction.narration || transaction.particulars}
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              ₹{Number(transaction.amount).toFixed(2)}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Split Method
            </label>
            <div className="flex space-x-2">
              <button
                onClick={() => setSplitMethod('equal')}
                className={`flex-1 py-2 rounded-xl font-medium text-sm transition-all ${
                  splitMethod === 'equal'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Equal Split
              </button>
              <button
                onClick={() => setSplitMethod('manual')}
                className={`flex-1 py-2 rounded-xl font-medium text-sm transition-all ${
                  splitMethod === 'manual'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Manual
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Users
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                placeholder="Search by name or email..."
              />
            </div>

            {searchResults.length > 0 && (
              <div className="mt-2 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-lg">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => addUser(result)}
                    className="w-full p-3 text-left hover:bg-gray-50 transition-all border-b border-gray-100 last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">
                      {result.full_name || result.email}
                    </div>
                    <div className="text-xs text-gray-500">{result.email}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedUsers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Split With ({selectedUsers.length} users)
              </label>
              <div className="space-y-2">
                {selectedUsers.map((splitUser) => (
                  <div
                    key={splitUser.userId}
                    className="bg-white border-2 border-emerald-200 rounded-2xl p-3"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm">
                          {splitUser.userName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {splitUser.userEmail}
                        </div>
                      </div>
                      <button
                        onClick={() => removeUser(splitUser.userId)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {splitMethod === 'manual' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            Amount
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={splitUser.amount}
                            onChange={(e) =>
                              updateUserAmount(splitUser.userId, e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            Percentage
                          </label>
                          <div className="flex items-center space-x-1 px-3 py-2 bg-gray-50 rounded-lg">
                            <span className="text-sm font-medium text-gray-700">
                              {splitUser.percentage}
                            </span>
                            <Percent className="w-3 h-3 text-gray-500" />
                          </div>
                        </div>
                      </div>
                    )}

                    {splitMethod === 'equal' && (
                      <div className="bg-emerald-50 rounded-lg p-2 text-center">
                        <span className="text-sm font-bold text-emerald-700">
                          ₹{splitUser.amount} ({splitUser.percentage}%)
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={affectsBank}
                onChange={(e) => setAffectsBank(e.target.checked)}
                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700">
                This affects their bank account
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              rows={2}
              placeholder="Add any additional notes..."
            />
          </div>

          <div className="flex space-x-2 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-300 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={selectedUsers.length === 0}
              className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
            >
              <Check className="w-5 h-5" />
              <span>Split Transaction</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
