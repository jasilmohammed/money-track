import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Reminder {
  id: string;
  reminder_type: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  amount: number;
  due_date: string | null;
  reminder_date: string;
  notification_methods: string[];
  status: string;
  notes: string | null;
}

export default function Reminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    reminder_type: 'receivable',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    contact_whatsapp: '',
    amount: '',
    due_date: '',
    reminder_date: '',
    notification_methods: ['email'] as string[],
    notes: '',
  });
  const { user } = useAuth();

  useEffect(() => {
    loadReminders();
  }, []);

  const loadReminders = async () => {
    const { data } = await supabase
      .from('reminders')
      .select('*')
      .order('reminder_date', { ascending: true });

    if (data) setReminders(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await supabase.from('reminders').insert({
      user_id: user!.id,
      reminder_type: formData.reminder_type,
      contact_name: formData.contact_name,
      contact_email: formData.contact_email || null,
      contact_phone: formData.contact_phone || null,
      contact_whatsapp: formData.contact_whatsapp || null,
      amount: parseFloat(formData.amount),
      due_date: formData.due_date || null,
      reminder_date: formData.reminder_date,
      notification_methods: formData.notification_methods,
      notes: formData.notes || null,
    });

    setFormData({
      reminder_type: 'receivable',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      contact_whatsapp: '',
      amount: '',
      due_date: '',
      reminder_date: '',
      notification_methods: ['email'],
      notes: '',
    });
    setShowAddForm(false);
    loadReminders();
  };

  const deleteReminder = async (id: string) => {
    if (confirm('Delete this reminder?')) {
      await supabase.from('reminders').delete().eq('id', id);
      loadReminders();
    }
  };

  const markAsCompleted = async (id: string) => {
    await supabase
      .from('reminders')
      .update({ status: 'completed' })
      .eq('id', id);
    loadReminders();
  };

  const toggleNotificationMethod = (method: string) => {
    setFormData({
      ...formData,
      notification_methods: formData.notification_methods.includes(method)
        ? formData.notification_methods.filter(m => m !== method)
        : [...formData.notification_methods, method],
    });
  };

  const pendingReminders = reminders.filter(r => r.status === 'pending');
  const completedReminders = reminders.filter(r => r.status === 'completed');

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">Reminders</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-emerald-600 text-white p-3 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {showAddForm && (
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-3xl p-5 shadow-lg border-2 border-blue-200">
          <h3 className="font-semibold text-gray-900 mb-4">New Reminder</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Reminder Type
              </label>
              <select
                value={formData.reminder_type}
                onChange={(e) => setFormData({ ...formData, reminder_type: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="receivable">Receivable (Money to Collect)</option>
                <option value="debt">Debt (Money to Pay)</option>
                <option value="payment_due">Payment Due</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Contact Name
              </label>
              <input
                type="text"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Amount
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Reminder Date
                </label>
                <input
                  type="date"
                  value={formData.reminder_date}
                  onChange={(e) => setFormData({ ...formData, reminder_date: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact Details (Optional)
              </label>
              <div className="space-y-2">
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm"
                  placeholder="Email"
                />
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm"
                  placeholder="Phone"
                />
                <input
                  type="tel"
                  value={formData.contact_whatsapp}
                  onChange={(e) => setFormData({ ...formData, contact_whatsapp: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm"
                  placeholder="WhatsApp"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notification Methods
              </label>
              <div className="flex flex-wrap gap-2">
                {['email', 'sms', 'whatsapp'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => toggleNotificationMethod(method)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      formData.notification_methods.includes(method)
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {method.charAt(0).toUpperCase() + method.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                rows={2}
                placeholder="Additional notes..."
              />
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="submit"
                className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 transition-all"
              >
                Create Reminder
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-300 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {pendingReminders.length > 0 && (
        <>
          <h3 className="font-semibold text-gray-900">Pending</h3>
          <div className="space-y-3">
            {pendingReminders.map((reminder) => (
              <div
                key={reminder.id}
                className="bg-white rounded-3xl p-5 shadow-lg border-2 border-yellow-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 rounded-2xl bg-yellow-100">
                      <Bell className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{reminder.contact_name}</h3>
                      <p className="text-sm text-gray-500 capitalize">
                        {reminder.reminder_type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteReminder(reminder.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 mb-3">
                  <div className="text-2xl font-bold text-emerald-600 mb-1">
                    ₹{Number(reminder.amount).toFixed(2)}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-1" />
                    <span>Reminder: {new Date(reminder.reminder_date).toLocaleDateString()}</span>
                  </div>
                  {reminder.due_date && (
                    <div className="text-sm text-gray-500 mt-1">
                      Due: {new Date(reminder.due_date).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {reminder.notes && (
                  <div className="text-sm text-gray-600 mb-3 p-3 bg-gray-50 rounded-xl">
                    {reminder.notes}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mb-3">
                  {reminder.notification_methods.map((method) => (
                    <span
                      key={method}
                      className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-lg"
                    >
                      {method}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => markAsCompleted(reminder.id)}
                  className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 transition-all"
                >
                  Mark as Completed
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {completedReminders.length > 0 && (
        <>
          <h3 className="font-semibold text-gray-900 mt-6">Completed</h3>
          <div className="space-y-3">
            {completedReminders.map((reminder) => (
              <div
                key={reminder.id}
                className="bg-white rounded-2xl p-4 shadow-md border border-gray-200 opacity-60"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{reminder.contact_name}</div>
                    <div className="text-sm text-gray-500">₹{Number(reminder.amount).toFixed(2)}</div>
                  </div>
                  <button
                    onClick={() => deleteReminder(reminder.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {reminders.length === 0 && !showAddForm && (
        <div className="text-center py-12">
          <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No reminders yet</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-emerald-700 transition-all"
          >
            Create Your First Reminder
          </button>
        </div>
      )}
    </div>
  );
}
