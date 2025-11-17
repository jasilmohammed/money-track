import { supabase } from '../lib/supabase';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

async function callGeminiAPI(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.4,
        topK: 32,
        topP: 1,
        maxOutputTokens: 4096,
      },
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to call Gemini API');
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

export async function extractTransactionsWithAI(
  statementText: string,
  apiKey: string
): Promise<Array<{
  date: string;
  description: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  balance?: number;
  reference?: string;
}>> {
  const prompt = `
You are a bank statement parser. Extract all transactions from the following bank statement text.
Return ONLY a valid JSON array with this exact structure, no other text:

[
  {
    "date": "YYYY-MM-DD",
    "description": "transaction description",
    "type": "DEBIT" or "CREDIT",
    "amount": numeric_value,
    "balance": numeric_value (optional),
    "reference": "reference_number" (optional)
  }
]

Rules:
- Extract ALL transactions found
- Use ISO date format (YYYY-MM-DD)
- Type must be either "DEBIT" or "CREDIT"
- Amount should be positive number
- Include balance if available
- Description should be clean and readable
- Return valid JSON only, no markdown or additional text

Bank Statement Text:
${statementText}
`;

  const result = await callGeminiAPI(prompt, apiKey);

  let jsonText = result.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```\n?/g, '');
  }

  const transactions = JSON.parse(jsonText);
  return transactions;
}

export async function suggestLedgerAndNarration(
  particulars: string,
  apiKey: string,
  userId: string
): Promise<{
  ledgerId: string | null;
  suggestedLedgerName: string;
  narration: string;
  confidence: number;
}> {
  const { data: existingMappings } = await supabase
    .from('transaction_mappings')
    .select('*, ledgers(ledger_name)')
    .eq('user_id', userId)
    .order('usage_count', { ascending: false })
    .limit(10);

  const { data: allLedgers } = await supabase
    .from('ledgers')
    .select('id, ledger_name, ledger_type')
    .eq('user_id', userId);

  const prompt = `
You are an accounting assistant. Based on the transaction description, suggest the most appropriate ledger account and a clear narration.

Transaction Description: "${particulars}"

${allLedgers && allLedgers.length > 0 ? `
Available Ledgers:
${allLedgers.map((l: { ledger_name: string; ledger_type: string }) => `- ${l.ledger_name} (${l.ledger_type})`).join('\n')}
` : ''}

${existingMappings && existingMappings.length > 0 ? `
Previous Mappings:
${existingMappings.map((m: { particulars_pattern: string; ledgers?: { ledger_name: string } }) =>
  `- "${m.particulars_pattern}" → ${m.ledgers?.ledger_name || 'Unknown'}`
).join('\n')}
` : ''}

Return ONLY a valid JSON object with this structure:
{
  "ledgerName": "exact ledger name from available ledgers OR suggest a new one",
  "narration": "clear, concise narration for this transaction",
  "confidence": 0.0 to 1.0
}

Rules:
- Use existing ledger if suitable, otherwise suggest a descriptive new ledger name
- Narration should be clear and professional
- Confidence based on how well the ledger matches
- Return valid JSON only
`;

  const result = await callGeminiAPI(prompt, apiKey);

  let jsonText = result.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```\n?/g, '');
  }

  const suggestion = JSON.parse(jsonText);

  const matchingLedger = allLedgers?.find(
    (l: { ledger_name: string }) =>
      l.ledger_name.toLowerCase() === suggestion.ledgerName.toLowerCase()
  );

  if (matchingLedger) {
    await supabase
      .from('transaction_mappings')
      .upsert({
        user_id: userId,
        particulars_pattern: particulars,
        ledger_id: matchingLedger.id,
        narration_template: suggestion.narration,
        confidence_score: suggestion.confidence,
        usage_count: 1,
        last_used_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,particulars_pattern',
      });
  }

  return {
    ledgerId: matchingLedger?.id || null,
    suggestedLedgerName: suggestion.ledgerName,
    narration: suggestion.narration,
    confidence: suggestion.confidence,
  };
}

export async function generateFinancialInsights(
  userId: string,
  apiKey: string,
  period: 'month' | 'quarter' | 'year' = 'month'
): Promise<string> {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'quarter':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const { data: transactions } = await supabase
    .from('transactions')
    .select(`
      *,
      ledgers(ledger_name, ledger_type)
    `)
    .eq('user_id', userId)
    .gte('transaction_date', startDate.toISOString().split('T')[0])
    .eq('is_confirmed', true)
    .order('transaction_date', { ascending: false });

  if (!transactions || transactions.length === 0) {
    return 'Not enough data to generate insights.';
  }

  const totalIncome = transactions
    .filter((t: { transaction_type: string }) => t.transaction_type === 'CREDIT')
    .reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0);

  const totalExpenses = transactions
    .filter((t: { transaction_type: string }) => t.transaction_type === 'DEBIT')
    .reduce((sum: number, t: { amount: number }) => sum + Number(t.amount), 0);

  const expenseByCategory: Record<string, number> = {};
  transactions
    .filter((t: { transaction_type: string }) => t.transaction_type === 'DEBIT')
    .forEach((t: { ledgers?: { ledger_name: string }; amount: number }) => {
      const category = t.ledgers?.ledger_name || 'Uncategorized';
      expenseByCategory[category] = (expenseByCategory[category] || 0) + Number(t.amount);
    });

  const prompt = `
You are a financial advisor. Analyze the following financial data and provide insights, recommendations, and actionable advice.

Period: Last ${period}
Total Income: ₹${totalIncome.toFixed(2)}
Total Expenses: ₹${totalExpenses.toFixed(2)}
Net Savings: ₹${(totalIncome - totalExpenses).toFixed(2)}

Expense Breakdown:
${Object.entries(expenseByCategory)
  .sort(([, a], [, b]) => b - a)
  .map(([category, amount]) => `- ${category}: ₹${amount.toFixed(2)} (${((amount / totalExpenses) * 100).toFixed(1)}%)`)
  .join('\n')}

Provide:
1. Overall financial health assessment
2. Spending pattern analysis
3. Top 3 areas to improve
4. Specific actionable recommendations
5. Budget suggestions for next ${period}

Keep the response clear, concise, and actionable. Use bullet points and be encouraging.
`;

  const insights = await callGeminiAPI(prompt, apiKey);
  return insights;
}

export async function suggestReminderDetails(
  transactionDescription: string,
  amount: number,
  apiKey: string
): Promise<{
  contactName: string;
  suggestedDate: string;
  notes: string;
}> {
  const prompt = `
Based on this transaction, suggest reminder details:

Transaction: "${transactionDescription}"
Amount: ₹${amount}

Return ONLY valid JSON:
{
  "contactName": "extracted or suggested contact name",
  "suggestedDate": "YYYY-MM-DD (suggest appropriate due date)",
  "notes": "helpful reminder note"
}
`;

  const result = await callGeminiAPI(prompt, apiKey);

  let jsonText = result.trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```\n?/g, '');
  }

  return JSON.parse(jsonText);
}
