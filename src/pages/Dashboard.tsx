import { useState, useEffect } from 'react';
import {
  Home, Upload, Wallet, TrendingUp, Settings,
  ArrowUpRight, ArrowDownLeft, DollarSign, PiggyBank,
  Calendar, Coins, Users
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

import BankManagement from '../components/BankManagement';
import TransactionUpload from '../components/TransactionUpload';
import TransactionList from '../components/TransactionList';
import FinancialSummary from '../components/FinancialSummary';
import Reminders from '../components/Reminders';
import SettingsPage from '../components/SettingsPage';
import DailySummary from '../components/DailySummary';
import CashTransactions from '../components/CashTransactions';
import SharedTransactions from '../components/SharedTransactions';

type TabType = 'home' | 'upload' | 'banks' | 'reports' | 'reminders' | 'settings' | 'daily' | 'cash' | 'shared';

interface DashboardStats {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  pendingReminders: number;
  pendingSharedTransactions: number;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [stats, setStats] = useState<DashboardStats>({
    totalBalance: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    pendingReminders: 0,
    pendingSharedTransactions: 0,
  });
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data: banks } = await supabase
      .from('banks')
      .select('current_balance')
      .eq('is_active', true);

    const totalBalance = banks?.reduce((sum, bank) => sum + Number(bank.current_balance), 0) || 0;

    const { data: transactions } = await supabase
      .from('transactions')
      .select('transaction_type, amount')
      .gte('transaction_date', firstDay)
      .lte('transaction_date', lastDay)
      .eq('is_confirmed', true);

    const monthlyIncome = transactions
      ?.filter(t => t.transaction_type === 'CREDIT')
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    const monthlyExpenses = transactions
      ?.filter(t => t.transaction_type === 'DEBIT')
      .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    const { count: pendingReminders } = await supabase
      .from('reminders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: pendingShared } = await supabase
      .from('shared_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('shared_with_user_id', user!.id)
      .eq('status', 'pending');

    setStats({
      totalBalance,
      monthlyIncome,
      monthlyExpenses,
      pendingReminders: pendingReminders || 0,
      pendingSharedTransactions: pendingShared || 0,
    });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-5 text-white shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm opacity-90">Total Balance</span>
                  <DollarSign className="w-5 h-5" />
                </div>
                <div className="text-2xl font-bold">₹{stats.totalBalance.toFixed(2)}</div>
                <div className="text-xs opacity-75 mt-1">Across all banks</div>
              </div>

              <div className="bg-white rounded-3xl p-5 shadow-lg border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-600">This Month</span>
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  ₹{(stats.monthlyIncome - stats.monthlyExpenses).toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-1">Net income</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
                <div className="flex items-center space-x-2 mb-2">
                  <ArrowDownLeft className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-gray-600">Income</span>
                </div>
                <div className="text-lg font-bold text-gray-900">₹{stats.monthlyIncome.toFixed(2)}</div>
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-md border border-gray-100">
                <div className="flex items-center space-x-2 mb-2">
                  <ArrowUpRight className="w-4 h-4 text-red-600" />
                  <span className="text-xs text-gray-600">Expenses</span>
                </div>
                <div className="text-lg font-bold text-gray-900">₹{stats.monthlyExpenses.toFixed(2)}</div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Quick Actions</h3>
                <Wallet className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setActiveTab('upload')}
                  className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl p-4 hover:from-emerald-100 hover:to-teal-100 transition-all duration-200 group"
                >
                  <Upload className="w-6 h-6 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-sm font-medium text-gray-900">Upload Statement</div>
                </button>

                <button
                  onClick={() => setActiveTab('cash')}
                  className="bg-gradient-to-br from-cyan-50 to-blue-50 border-2 border-cyan-200 rounded-2xl p-4 hover:from-cyan-100 hover:to-blue-100 transition-all duration-200 group"
                >
                  <Coins className="w-6 h-6 text-cyan-600 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-sm font-medium text-gray-900">Cash Transaction</div>
                </button>

                <button
                  onClick={() => setActiveTab('daily')}
                  className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-2xl p-4 hover:from-purple-100 hover:to-pink-100 transition-all duration-200 group"
                >
                  <Calendar className="w-6 h-6 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-sm font-medium text-gray-900">Daily Summary</div>
                </button>

                <button
                  onClick={() => setActiveTab('shared')}
                  className="bg-gradient-to-br from-orange-50 to-yellow-50 border-2 border-orange-200 rounded-2xl p-4 hover:from-orange-100 hover:to-yellow-100 transition-all duration-200 group relative"
                >
                  <Users className="w-6 h-6 text-orange-600 mb-2 group-hover:scale-110 transition-transform" />
                  <div className="text-sm font-medium text-gray-900">Split Transaction</div>
                  {stats.pendingSharedTransactions > 0 && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                      {stats.pendingSharedTransactions}
                    </div>
                  )}
                </button>
              </div>
            </div>

            <TransactionList limit={5} />
          </div>
        );
      case 'upload':
        return <TransactionUpload onComplete={loadStats} />;
      case 'banks':
        return <BankManagement />;
      case 'reports':
        return <FinancialSummary />;
      case 'reminders':
        return <Reminders />;
      case 'settings':
        return <SettingsPage />;
      case 'daily':
        return <DailySummary />;
      case 'cash':
        return <CashTransactions />;
      case 'shared':
        return <SharedTransactions />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-20">
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-5 pt-6 pb-8 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">MoneyTrack</h1>
            <p className="text-emerald-100 text-sm mt-0.5">Smart Accounting</p>
          </div>
          <button className="bg-white/20 backdrop-blur-sm p-3 rounded-2xl hover:bg-white/30 transition-all duration-200">
            <PiggyBank className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      <div className="px-4 -mt-4">
        <div className="bg-white rounded-3xl shadow-xl p-1 mb-4">
          {renderContent()}
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-3 shadow-2xl">
        <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center py-2 rounded-2xl transition-all duration-200 ${
              activeTab === 'home'
                ? 'bg-emerald-50 text-emerald-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Home className={`w-6 h-6 mb-1 ${activeTab === 'home' ? 'scale-110' : ''} transition-transform`} />
            <span className="text-xs font-medium">Home</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`flex flex-col items-center justify-center py-2 rounded-2xl transition-all duration-200 ${
              activeTab === 'upload'
                ? 'bg-emerald-50 text-emerald-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Upload className={`w-6 h-6 mb-1 ${activeTab === 'upload' ? 'scale-110' : ''} transition-transform`} />
            <span className="text-xs font-medium">Upload</span>
          </button>

          <button
            onClick={() => setActiveTab('banks')}
            className={`flex flex-col items-center justify-center py-2 rounded-2xl transition-all duration-200 ${
              activeTab === 'banks'
                ? 'bg-emerald-50 text-emerald-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Wallet className={`w-6 h-6 mb-1 ${activeTab === 'banks' ? 'scale-110' : ''} transition-transform`} />
            <span className="text-xs font-medium">Banks</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center justify-center py-2 rounded-2xl transition-all duration-200 ${
              activeTab === 'reports'
                ? 'bg-emerald-50 text-emerald-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <TrendingUp className={`w-6 h-6 mb-1 ${activeTab === 'reports' ? 'scale-110' : ''} transition-transform`} />
            <span className="text-xs font-medium">Reports</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center py-2 rounded-2xl transition-all duration-200 ${
              activeTab === 'settings'
                ? 'bg-emerald-50 text-emerald-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Settings className={`w-6 h-6 mb-1 ${activeTab === 'settings' ? 'scale-110' : ''} transition-transform`} />
            <span className="text-xs font-medium">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
