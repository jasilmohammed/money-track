import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, TrendingDown, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface DailyTransaction {
  id: string;
  transaction_date: string;
  transaction_type: string;
  amount: number;
  narration: string;
  particulars: string;
  banks?: {
    bank_name: string;
  };
}

interface DailySummaryData {
  date: string;
  totalIncome: number;
  totalExpense: number;
  netFlow: number;
  transactions: DailyTransaction[];
  bankWise: {
    [bankId: string]: {
      bankName: string;
      income: number;
      expense: number;
      transactions: DailyTransaction[];
    };
  };
}

export default function DailySummary() {
  const [summaryData, setSummaryData] = useState<DailySummaryData[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set());
  useAuth();

  useEffect(() => {
    loadDailySummary();
  }, [selectedDate]);

  const loadDailySummary = async () => {
    const startDate = new Date(selectedDate);
    startDate.setDate(startDate.getDate() - 7);
    const endDate = selectedDate;

    const { data: transactions } = await supabase
      .from('transactions')
      .select(`
        *,
        banks(bank_name)
      `)
      .gte('transaction_date', startDate.toISOString().split('T')[0])
      .lte('transaction_date', endDate)
      .eq('is_confirmed', true)
      .order('transaction_date', { ascending: false });

    if (!transactions) return;

    const dailyMap: { [date: string]: DailySummaryData } = {};

    transactions.forEach((txn) => {
      const date = txn.transaction_date;

      if (!dailyMap[date]) {
        dailyMap[date] = {
          date,
          totalIncome: 0,
          totalExpense: 0,
          netFlow: 0,
          transactions: [],
          bankWise: {},
        };
      }

      const amount = Number(txn.amount);
      const bankId = txn.bank_id || 'cash';
      const bankName = txn.banks?.bank_name || 'Cash';

      if (txn.transaction_type === 'CREDIT') {
        dailyMap[date].totalIncome += amount;
      } else {
        dailyMap[date].totalExpense += amount;
      }

      dailyMap[date].netFlow = dailyMap[date].totalIncome - dailyMap[date].totalExpense;
      dailyMap[date].transactions.push(txn);

      if (!dailyMap[date].bankWise[bankId]) {
        dailyMap[date].bankWise[bankId] = {
          bankName,
          income: 0,
          expense: 0,
          transactions: [],
        };
      }

      if (txn.transaction_type === 'CREDIT') {
        dailyMap[date].bankWise[bankId].income += amount;
      } else {
        dailyMap[date].bankWise[bankId].expense += amount;
      }

      dailyMap[date].bankWise[bankId].transactions.push(txn);
    });

    setSummaryData(Object.values(dailyMap));
  };

  const toggleDate = (date: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDates(newExpanded);
  };

  const toggleBank = (key: string) => {
    const newExpanded = new Set(expandedBanks);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedBanks(newExpanded);
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Daily Summary</h2>
        <Calendar className="w-6 h-6 text-emerald-600" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Date
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
        />
      </div>

      <div className="space-y-3">
        {summaryData.map((day) => (
          <div
            key={day.date}
            className="bg-white rounded-3xl shadow-lg border-2 border-gray-100 overflow-hidden"
          >
            <button
              onClick={() => toggleDate(day.date)}
              className="w-full p-5 text-left hover:bg-gray-50 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm text-gray-500">
                    {new Date(day.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                  <div className="text-lg font-bold text-gray-900 mt-1">
                    {day.transactions.length} transactions
                  </div>
                </div>
                {expandedDates.has(day.date) ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 rounded-xl p-3">
                  <div className="flex items-center space-x-1 mb-1">
                    <TrendingUp className="w-3 h-3 text-green-600" />
                    <span className="text-xs text-green-600">Income</span>
                  </div>
                  <div className="text-sm font-bold text-green-700">
                    ₹{day.totalIncome.toFixed(2)}
                  </div>
                </div>

                <div className="bg-red-50 rounded-xl p-3">
                  <div className="flex items-center space-x-1 mb-1">
                    <TrendingDown className="w-3 h-3 text-red-600" />
                    <span className="text-xs text-red-600">Expense</span>
                  </div>
                  <div className="text-sm font-bold text-red-700">
                    ₹{day.totalExpense.toFixed(2)}
                  </div>
                </div>

                <div className={`rounded-xl p-3 ${
                  day.netFlow >= 0 ? 'bg-emerald-50' : 'bg-orange-50'
                }`}>
                  <div className="text-xs text-gray-600 mb-1">Net</div>
                  <div className={`text-sm font-bold ${
                    day.netFlow >= 0 ? 'text-emerald-700' : 'text-orange-700'
                  }`}>
                    ₹{Math.abs(day.netFlow).toFixed(2)}
                  </div>
                </div>
              </div>
            </button>

            {expandedDates.has(day.date) && (
              <div className="border-t border-gray-200 p-4 space-y-3 bg-gray-50">
                <h4 className="font-semibold text-gray-900 text-sm">Bank-wise Breakdown</h4>

                {Object.entries(day.bankWise).map(([bankId, bankData]) => {
                  const bankKey = `${day.date}-${bankId}`;
                  return (
                    <div key={bankId} className="bg-white rounded-2xl overflow-hidden">
                      <button
                        onClick={() => toggleBank(bankKey)}
                        className="w-full p-4 text-left hover:bg-gray-50 transition-all"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Building2 className="w-4 h-4 text-emerald-600" />
                            <span className="font-medium text-gray-900">{bankData.bankName}</span>
                          </div>
                          {expandedBanks.has(bankKey) ? (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>

                        <div className="flex space-x-2">
                          <div className="flex-1 bg-green-50 rounded-lg p-2">
                            <div className="text-xs text-green-600">Income</div>
                            <div className="text-sm font-bold text-green-700">
                              ₹{bankData.income.toFixed(2)}
                            </div>
                          </div>
                          <div className="flex-1 bg-red-50 rounded-lg p-2">
                            <div className="text-xs text-red-600">Expense</div>
                            <div className="text-sm font-bold text-red-700">
                              ₹{bankData.expense.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </button>

                      {expandedBanks.has(bankKey) && (
                        <div className="border-t border-gray-100 p-3 space-y-2">
                          {bankData.transactions.map((txn) => (
                            <div
                              key={txn.id}
                              className="bg-gray-50 rounded-lg p-3 text-sm"
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">
                                    {txn.narration || txn.particulars}
                                  </div>
                                </div>
                                <div className={`font-bold ml-2 ${
                                  txn.transaction_type === 'CREDIT'
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                }`}>
                                  {txn.transaction_type === 'CREDIT' ? '+' : '-'}₹{Number(txn.amount).toFixed(2)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {summaryData.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No transactions for this period</p>
          </div>
        )}
      </div>
    </div>
  );
}
