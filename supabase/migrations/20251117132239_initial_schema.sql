/*
  # Initial Schema for Personal Accounting Application

  ## Overview
  This migration creates the complete database schema for a personal accounting app
  focused on bank transaction management with AI-powered automation.

  ## New Tables

  ### 1. profiles
  - `id` (uuid, primary key) - Links to auth.users
  - `email` (text) - User email
  - `full_name` (text) - User's full name
  - `gemini_api_key` (text, encrypted) - User's Gemini API key
  - `phone` (text) - Phone number for notifications
  - `created_at` (timestamptz) - Account creation time
  - `updated_at` (timestamptz) - Last update time

  ### 2. banks
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key) - Owner of the bank account
  - `bank_name` (text) - Name of the bank
  - `account_number` (text) - Account number (last 4 digits)
  - `account_type` (text) - Savings, Current, etc.
  - `opening_balance` (decimal) - Starting balance
  - `current_balance` (decimal) - Current balance
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz)

  ### 3. ledgers
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key)
  - `ledger_name` (text) - Name of the ledger
  - `ledger_type` (text) - Asset, Liability, Expense, Income, etc.
  - `current_balance` (decimal) - Current balance
  - `description` (text) - Optional description
  - `created_at` (timestamptz)

  ### 4. transactions
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key)
  - `bank_id` (uuid, foreign key, nullable) - For bank transactions
  - `transaction_date` (date)
  - `transaction_type` (text) - DEBIT, CREDIT
  - `amount` (decimal)
  - `particulars` (text) - Original bank statement description
  - `narration` (text) - User/AI provided narration
  - `ledger_id` (uuid, foreign key)
  - `is_cash` (boolean) - Cash transaction flag
  - `balance_after` (decimal) - Balance after transaction
  - `reference_number` (text) - Transaction reference
  - `is_confirmed` (boolean) - User confirmation status
  - `ai_suggested` (boolean) - Was this AI suggested
  - `created_at` (timestamptz)
  - `created_by` (text) - upload or manual

  ### 5. transaction_mappings
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key)
  - `particulars_pattern` (text) - Pattern to match
  - `ledger_id` (uuid, foreign key) - Suggested ledger
  - `narration_template` (text) - Suggested narration
  - `confidence_score` (decimal) - AI confidence
  - `usage_count` (integer) - Times used
  - `last_used_at` (timestamptz)
  - `created_at` (timestamptz)

  ### 6. shared_transactions
  - `id` (uuid, primary key)
  - `transaction_id` (uuid, foreign key) - Main transaction
  - `created_by_user_id` (uuid) - User who created
  - `shared_with_user_id` (uuid) - User to share with
  - `split_amount` (decimal) - Amount for this user
  - `split_percentage` (decimal) - Percentage split
  - `status` (text) - pending, confirmed, rejected
  - `affects_bank` (boolean) - Does this affect bank balance
  - `notes` (text)
  - `created_at` (timestamptz)
  - `confirmed_at` (timestamptz)

  ### 7. reminders
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key)
  - `related_transaction_id` (uuid, foreign key, nullable)
  - `reminder_type` (text) - debt, receivable, payment_due
  - `contact_name` (text)
  - `contact_email` (text)
  - `contact_phone` (text)
  - `contact_whatsapp` (text)
  - `amount` (decimal)
  - `due_date` (date)
  - `reminder_date` (date)
  - `notification_methods` (text[]) - email, sms, whatsapp
  - `status` (text) - pending, sent, completed
  - `notes` (text)
  - `created_at` (timestamptz)

  ### 8. uploaded_files
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key)
  - `bank_id` (uuid, foreign key)
  - `file_name` (text)
  - `file_type` (text) - pdf, excel, txt, csv
  - `upload_date` (timestamptz)
  - `processed` (boolean)
  - `transactions_count` (integer)
  - `storage_path` (text)

  ## Security
  - RLS enabled on all tables
  - Users can only access their own data
  - Policies for authenticated users on all operations

  ## Notes
  - All monetary values use decimal for precision
  - Timestamps use timestamptz for timezone awareness
  - Comprehensive indexing for performance
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  gemini_api_key text,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create banks table
CREATE TABLE IF NOT EXISTS banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  account_type text DEFAULT 'Savings',
  opening_balance decimal(15,2) DEFAULT 0,
  current_balance decimal(15,2) DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create ledgers table
CREATE TABLE IF NOT EXISTS ledgers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ledger_name text NOT NULL,
  ledger_type text NOT NULL,
  current_balance decimal(15,2) DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank_id uuid REFERENCES banks(id) ON DELETE SET NULL,
  transaction_date date NOT NULL,
  transaction_type text NOT NULL,
  amount decimal(15,2) NOT NULL,
  particulars text,
  narration text,
  ledger_id uuid REFERENCES ledgers(id) ON DELETE SET NULL,
  is_cash boolean DEFAULT false,
  balance_after decimal(15,2),
  reference_number text,
  is_confirmed boolean DEFAULT false,
  ai_suggested boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'manual'
);

-- Create transaction_mappings table
CREATE TABLE IF NOT EXISTS transaction_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  particulars_pattern text NOT NULL,
  ledger_id uuid REFERENCES ledgers(id) ON DELETE CASCADE,
  narration_template text,
  confidence_score decimal(3,2) DEFAULT 0.5,
  usage_count integer DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create shared_transactions table
CREATE TABLE IF NOT EXISTS shared_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES transactions(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shared_with_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  split_amount decimal(15,2) NOT NULL,
  split_percentage decimal(5,2),
  status text DEFAULT 'pending',
  affects_bank boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  confirmed_at timestamptz
);

-- Create reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  related_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  reminder_type text NOT NULL,
  contact_name text NOT NULL,
  contact_email text,
  contact_phone text,
  contact_whatsapp text,
  amount decimal(15,2) NOT NULL,
  due_date date,
  reminder_date date NOT NULL,
  notification_methods text[] DEFAULT ARRAY['email'],
  status text DEFAULT 'pending',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create uploaded_files table
CREATE TABLE IF NOT EXISTS uploaded_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank_id uuid REFERENCES banks(id) ON DELETE SET NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  upload_date timestamptz DEFAULT now(),
  processed boolean DEFAULT false,
  transactions_count integer DEFAULT 0,
  storage_path text
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Banks policies
CREATE POLICY "Users can view own banks"
  ON banks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own banks"
  ON banks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own banks"
  ON banks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own banks"
  ON banks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Ledgers policies
CREATE POLICY "Users can view own ledgers"
  ON ledgers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ledgers"
  ON ledgers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ledgers"
  ON ledgers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own ledgers"
  ON ledgers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Transaction mappings policies
CREATE POLICY "Users can view own mappings"
  ON transaction_mappings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mappings"
  ON transaction_mappings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mappings"
  ON transaction_mappings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own mappings"
  ON transaction_mappings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Shared transactions policies
CREATE POLICY "Users can view shared transactions"
  ON shared_transactions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = created_by_user_id OR 
    auth.uid() = shared_with_user_id
  );

CREATE POLICY "Users can insert shared transactions"
  ON shared_transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Users can update shared transactions"
  ON shared_transactions FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by_user_id OR 
    auth.uid() = shared_with_user_id
  )
  WITH CHECK (
    auth.uid() = created_by_user_id OR 
    auth.uid() = shared_with_user_id
  );

-- Reminders policies
CREATE POLICY "Users can view own reminders"
  ON reminders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminders"
  ON reminders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminders"
  ON reminders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminders"
  ON reminders FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Uploaded files policies
CREATE POLICY "Users can view own uploaded files"
  ON uploaded_files FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own uploaded files"
  ON uploaded_files FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own uploaded files"
  ON uploaded_files FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_banks_user_id ON banks(user_id);
CREATE INDEX IF NOT EXISTS idx_ledgers_user_id ON ledgers(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_bank_id ON transactions(bank_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transaction_mappings_user_id ON transaction_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_transactions_created_by ON shared_transactions(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_transactions_shared_with ON shared_transactions(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON reminders(due_date);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_user_id ON uploaded_files(user_id);