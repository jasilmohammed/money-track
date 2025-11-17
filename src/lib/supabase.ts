import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          gemini_api_key: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          gemini_api_key?: string | null;
          phone?: string | null;
        };
        Update: {
          full_name?: string | null;
          gemini_api_key?: string | null;
          phone?: string | null;
        };
      };
      banks: {
        Row: {
          id: string;
          user_id: string;
          bank_name: string;
          account_number: string;
          account_type: string;
          opening_balance: number;
          current_balance: number;
          is_active: boolean;
          created_at: string;
        };
      };
      ledgers: {
        Row: {
          id: string;
          user_id: string;
          ledger_name: string;
          ledger_type: string;
          current_balance: number;
          description: string | null;
          created_at: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          bank_id: string | null;
          transaction_date: string;
          transaction_type: string;
          amount: number;
          particulars: string | null;
          narration: string | null;
          ledger_id: string | null;
          is_cash: boolean;
          balance_after: number | null;
          reference_number: string | null;
          is_confirmed: boolean;
          ai_suggested: boolean;
          created_at: string;
          created_by: string;
        };
      };
    };
  };
}
