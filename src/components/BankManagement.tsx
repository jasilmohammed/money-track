import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Building2, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Bank {
  id: string;
  bank_name: string;
  account_number: string;
  account_type: string;
  current_balance: number;
  is_active: boolean;
}

export default function BankManagement() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    bank_name: '',
    account_number: '',
    account_type: 'Savings',
    opening_balance: '',
  });
  const { user } = useAuth();

  useEffect(() => {
    loadBanks();
  }, []);

  const loadBanks = async () => {
    const { data } = await supabase
      .from('banks')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setBanks(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const balance = parseFloat(formData.opening_balance) || 0;

    if (editingId) {
      await supabase
        .from('banks')
        .update({
          bank_name: formData.bank_name,
          account_number: formData.account_number,
          account_type: formData.account_type,
        })
        .eq('id', editingId);
    } else {
      await supabase.from('banks').insert({
        user_id: user!.id,
        bank_name: formData.bank_name,
        account_number: formData.account_number,
        account_type: formData.account_type,
        opening_balance: balance,
        current_balance: balance,
      });
    }

    setFormData({ bank_name: '', account_number: '', account_type: 'Savings', opening_balance: '' });
    setShowAddForm(false);
    setEditingId(null);
    loadBanks();
  };

  const handleEdit = (bank: Bank) => {
    setFormData({
      bank_name: bank.bank_name,
      account_number: bank.account_number,
      account_type: bank.account_type,
      opening_balance: bank.current_balance.toString(),
    });
    setEditingId(bank.id);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this bank account?')) {
      await supabase.from('banks').delete().eq('id', id);
      loadBanks();
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await supabase.from('banks').update({ is_active: !isActive }).eq('id', id);
    loadBanks();
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">My Banks</h2>
        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            setEditingId(null);
            setFormData({ bank_name: '', account_number: '', account_type: 'Savings', opening_balance: '' });
          }}
          className="bg-emerald-600 text-white p-3 rounded-2xl hover:bg-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {showAddForm && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-5 shadow-lg border-2 border-emerald-200 animate-fadeIn">
          <h3 className="font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit Bank Account' : 'Add New Bank'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Bank Name
              </label>
              <input
                type="text"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                placeholder="e.g., HDFC Bank"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Account Number (Last 4 digits)
              </label>
              <input
                type="text"
                value={formData.account_number}
                onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                placeholder="xxxx1234"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Account Type
              </label>
              <select
                value={formData.account_type}
                onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="Savings">Savings</option>
                <option value="Current">Current</option>
                <option value="Credit Card">Credit Card</option>
              </select>
            </div>

            {!editingId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Opening Balance
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.opening_balance}
                  onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  placeholder="0.00"
                />
              </div>
            )}

            <div className="flex space-x-2 pt-2">
              <button
                type="submit"
                className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <Check className="w-5 h-5" />
                <span>{editingId ? 'Update' : 'Add Bank'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingId(null);
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-300 transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <X className="w-5 h-5" />
                <span>Cancel</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {banks.map((bank) => (
          <div
            key={bank.id}
            className={`bg-white rounded-3xl p-5 shadow-lg border-2 transition-all duration-200 ${
              bank.is_active ? 'border-emerald-200' : 'border-gray-200 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className={`p-3 rounded-2xl ${
                  bank.is_active ? 'bg-emerald-100' : 'bg-gray-100'
                }`}>
                  <Building2 className={`w-6 h-6 ${
                    bank.is_active ? 'text-emerald-600' : 'text-gray-400'
                  }`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{bank.bank_name}</h3>
                  <p className="text-sm text-gray-500">
                    {bank.account_type} • {bank.account_number}
                  </p>
                </div>
              </div>
              <div className="flex space-x-1">
                <button
                  onClick={() => handleEdit(bank)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(bank.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500 mb-1">Current Balance</div>
                <div className="text-2xl font-bold text-gray-900">
                  ₹{bank.current_balance.toFixed(2)}
                </div>
              </div>
              <button
                onClick={() => toggleActive(bank.id, bank.is_active)}
                className={`px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200 ${
                  bank.is_active
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {bank.is_active ? 'Active' : 'Inactive'}
              </button>
            </div>
          </div>
        ))}

        {banks.length === 0 && !showAddForm && (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No banks added yet</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-emerald-700 transition-all"
            >
              Add Your First Bank
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
