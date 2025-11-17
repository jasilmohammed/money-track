/*
  # Add Update Ledger Balance Function

  1. Functions
    - `update_ledger_balance` - Updates ledger balance atomically
  
  2. Purpose
    - Safely update ledger balances when transactions are created
    - Prevent race conditions with atomic updates
*/

CREATE OR REPLACE FUNCTION update_ledger_balance(
  ledger_id uuid,
  amount decimal
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE ledgers
  SET current_balance = current_balance + amount
  WHERE id = ledger_id;
END;
$$;
