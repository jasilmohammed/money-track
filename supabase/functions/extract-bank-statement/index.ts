import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ExtractedBankInfo {
  bankName: string;
  accountNumber: string;
  ifscCode?: string;
  statementPeriod?: string;
}

interface ExtractedTransaction {
  date: string;
  particulars: string;
  narration: string;
  amount: number;
  transactionType: 'DEBIT' | 'CREDIT';
  balance?: number;
  reference?: string;
  ledgerSuggestion?: string;
  confidence: number;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const geminiApiKey = formData.get('geminiApiKey') as string;

    if (!file || !geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'File and Gemini API key are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileBuffer = await file.arrayBuffer();
    const base64File = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));

    const extractionPrompt = `
You are a bank statement analyzer. Extract the following information from this bank statement:

1. Bank Information:
   - Bank Name
   - Account Number (full number)
   - IFSC Code (if available)
   - Statement Period

2. All Transactions with:
   - Date (YYYY-MM-DD format)
   - Original bank particulars/description
   - Enhanced narration (clean, professional description)
   - Amount (positive number)
   - Transaction Type (DEBIT or CREDIT)
   - Balance after transaction (if available)
   - Reference number (if available)
   - Suggested ledger account category
   - Confidence score (0.0 to 1.0)

Return ONLY valid JSON in this exact structure:
{
  "bankInfo": {
    "bankName": "string",
    "accountNumber": "string",
    "ifscCode": "string or null",
    "statementPeriod": "string or null"
  },
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "particulars": "original bank description",
      "narration": "enhanced description",
      "amount": number,
      "transactionType": "DEBIT or CREDIT",
      "balance": number or null,
      "reference": "string or null",
      "ledgerSuggestion": "suggested category",
      "confidence": number
    }
  ]
}

Rules:
- Extract ALL transactions
- Clean and standardize descriptions
- Use consistent date format
- Positive amounts only
- Suggest appropriate ledger categories
- High confidence for clear patterns
`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: extractionPrompt },
              {
                inline_data: {
                  mime_type: file.type,
                  data: base64File
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.2,
            topK: 32,
            topP: 1,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to process PDF with Gemini', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiResponse.json();
    let extractedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    extractedText = extractedText.trim();
    if (extractedText.startsWith('```json')) {
      extractedText = extractedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (extractedText.startsWith('```')) {
      extractedText = extractedText.replace(/```\n?/g, '');
    }

    const extractedData = JSON.parse(extractedText);

    const { data: previousTransactions } = await supabaseClient
      .from('transactions')
      .select('particulars, narration, ledger_id, ledgers(ledger_name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    const enhancedTransactions = extractedData.transactions.map((txn: any) => {
      const similarTxn = previousTransactions?.find((prev: any) => {
        const similarity = calculateSimilarity(
          txn.particulars.toLowerCase(),
          prev.particulars.toLowerCase()
        );
        return similarity > 0.7;
      });

      if (similarTxn) {
        return {
          ...txn,
          narration: similarTxn.narration || txn.narration,
          ledgerSuggestion: similarTxn.ledgers?.ledger_name || txn.ledgerSuggestion,
          confidence: Math.max(txn.confidence, 0.95),
          autoMatched: true
        };
      }

      return { ...txn, autoMatched: false };
    });

    return new Response(
      JSON.stringify({
        bankInfo: extractedData.bankInfo,
        transactions: enhancedTransactions,
        totalTransactions: enhancedTransactions.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}
