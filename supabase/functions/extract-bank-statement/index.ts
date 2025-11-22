import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const geminiApiKey = formData.get('geminiApiKey') as string;

    if (!file || !geminiApiKey) {
      console.error('Missing file or API key');
      return new Response(
        JSON.stringify({ error: 'File and Gemini API key are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing file:', file.name, 'Type:', file.type, 'Size:', file.size);

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

Return ONLY valid JSON in this exact structure (no markdown, no code blocks):
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
      "amount": 100.50,
      "transactionType": "DEBIT",
      "balance": 1000.00,
      "reference": "REF123",
      "ledgerSuggestion": "Office Expenses",
      "confidence": 0.85
    }
  ]
}

Rules:
- Extract ALL transactions
- Clean and standardize descriptions
- Use consistent date format (YYYY-MM-DD)
- Positive amounts only
- Suggest appropriate ledger categories
- High confidence for clear patterns
- Return pure JSON only, no markdown formatting
`;

    console.log('Calling Gemini API...');

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
                  mime_type: file.type === 'application/pdf' ? 'application/pdf' : file.type,
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
        JSON.stringify({
          error: 'Failed to process PDF with Gemini',
          details: errorText,
          status: geminiResponse.status
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini response received');

    let extractedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!extractedText) {
      console.error('No text extracted from Gemini response');
      return new Response(
        JSON.stringify({ error: 'No content extracted from PDF' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    extractedText = extractedText.trim();
    if (extractedText.startsWith('```json')) {
      extractedText = extractedText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    } else if (extractedText.startsWith('```')) {
      extractedText = extractedText.replace(/```\n?/g, '');
    }

    console.log('Parsing extracted JSON...');

    let extractedData;
    try {
      extractedData = JSON.parse(extractedText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Extracted text:', extractedText.substring(0, 500));
      return new Response(
        JSON.stringify({
          error: 'Failed to parse extracted data',
          details: parseError.message,
          sample: extractedText.substring(0, 200)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!extractedData.bankInfo || !extractedData.transactions) {
      console.error('Invalid data structure:', extractedData);
      return new Response(
        JSON.stringify({ error: 'Invalid data structure in extracted content' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    let userId = null;

    try {
      const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': supabaseAnonKey,
        }
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        userId = userData.id;
        console.log('User authenticated:', userId);
      }
    } catch (authError) {
      console.error('Auth check failed:', authError);
    }

    let enhancedTransactions = extractedData.transactions;

    if (userId) {
      try {
        const txnResponse = await fetch(
          `${supabaseUrl}/rest/v1/transactions?user_id=eq.${userId}&select=particulars,narration,ledger_id,ledgers(ledger_name)&order=created_at.desc&limit=100`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'apikey': supabaseAnonKey,
              'Content-Type': 'application/json',
            }
          }
        );

        if (txnResponse.ok) {
          const previousTransactions = await txnResponse.json();
          console.log('Found previous transactions:', previousTransactions.length);

          enhancedTransactions = extractedData.transactions.map((txn: ExtractedTransaction) => {
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
        }
      } catch (dbError) {
        console.error('Database query failed:', dbError);
      }
    }

    console.log('Successfully processed', enhancedTransactions.length, 'transactions');

    return new Response(
      JSON.stringify({
        bankInfo: extractedData.bankInfo,
        transactions: enhancedTransactions,
        totalTransactions: enhancedTransactions.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        stack: error.stack || 'No stack trace'
      }),
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
