# PDF Bank Statement Extraction - Technical Guide

## Overview

The PDF extraction system uses a Supabase Edge Function powered by Google Gemini AI to extract bank statements with maximum accuracy and minimal user intervention.

## Architecture

### 1. Edge Function: `extract-bank-statement`

**Location**: Deployed as a Supabase Edge Function

**Purpose**: Server-side PDF processing with AI

**Key Features**:
- Extracts bank information (name, account number, IFSC)
- Parses all transactions with enhanced narrations
- Auto-matches with previous transactions
- Suggests ledger categories with confidence scores
- Returns structured JSON data

**Input**:
- PDF file (multipart/form-data)
- Gemini API key (from user profile)

**Output**:
```json
{
  "bankInfo": {
    "bankName": "HDFC Bank",
    "accountNumber": "1234567890",
    "ifscCode": "HDFC0001234",
    "statementPeriod": "Jan 2024 - Mar 2024"
  },
  "transactions": [
    {
      "date": "2024-01-15",
      "particulars": "NEFT CHG/263772/JOHN DOE",
      "narration": "Payment from John Doe",
      "amount": 5000,
      "transactionType": "CREDIT",
      "balance": 25000,
      "reference": "263772",
      "ledgerSuggestion": "Client Payments",
      "confidence": 0.95,
      "autoMatched": true
    }
  ]
}
```

### 2. Frontend Component: `EnhancedTransactionUpload`

**Purpose**: User interface for PDF upload and transaction review

**Flow**:

#### Step 1: Upload
- User selects PDF file
- Frontend sends to edge function
- Shows loading state with AI processing message

#### Step 2: Bank Confirmation
- Displays extracted bank information
- Auto-detects matching existing banks
- Allows editing bank name/account number
- Option to select existing bank or create new
- Shows transaction count

#### Step 3: One-by-One Review
- Progress bar showing completion percentage
- Two transaction fields:
  - **Bank Particulars**: Original text from statement
  - **AI Enhanced Narration**: Clean, professional description
- Auto-filled fields:
  - Date
  - Amount
  - Transaction type (DEBIT/CREDIT)
  - Ledger suggestion
  - Confidence score
- Visual indicators:
  - Green badge for auto-matched transactions (>95% confidence)
  - Purple badge for AI suggestions with confidence %
  - Color-coded transaction types

#### Step 4: Edit Mode
- Click edit button to modify any field
- All fields editable:
  - Date
  - Bank particulars
  - AI narration
  - Transaction type
  - Amount
  - Ledger account
- Ledger dropdown shows existing ledgers
- Auto-creates new ledgers if needed

#### Step 5: Save Options
- **Save & Next**: Save current, move to next
- **Save All Remaining**: Bulk save all pending
- **Skip**: Move to next without saving
- **Previous**: Go back to review previous transaction

## AI Features

### 1. Bank Information Extraction

Gemini AI extracts:
- Bank name with proper capitalization
- Full account number
- IFSC code (if present in statement)
- Statement period

### 2. Transaction Enhancement

**Original Particulars**:
```
NEFT CHG/263772/JOHN DOE/PAYMENT FOR INVOICE
```

**AI Enhanced Narration**:
```
Payment received from John Doe for invoice
```

### 3. Auto-Matching with Previous Transactions

The system uses **Levenshtein Distance** algorithm to find similar transactions:

```typescript
function calculateSimilarity(str1: string, str2: string): number {
  // Returns 0.0 to 1.0
  // > 0.7 = Match found
  // > 0.95 = High confidence auto-match
}
```

**Benefits**:
- Reuses narrations from similar past transactions
- Maintains consistent ledger assignments
- Reduces manual editing

### 4. Ledger Suggestions

AI suggests appropriate ledger categories based on:
- Transaction description
- Amount
- Transaction type
- Previous patterns

**Examples**:
- "ATM Withdrawal" → "Cash Withdrawals" (Expense)
- "Salary Credit" → "Salary Income" (Income)
- "Rent Payment" → "Office Rent" (Expense)
- "Client Payment" → "Client Receipts" (Income)

## Database Integration

### Tables Used

1. **profiles**
   - Stores Gemini API key
   - User authentication

2. **banks**
   - Auto-creates banks if not found
   - Matches by account number
   - Stores bank name as: "Bank Name - Last4Digits"

3. **transactions**
   - Stores both particulars and narration
   - Links to bank and ledger
   - Flags AI-suggested transactions
   - Records confidence scores

4. **ledgers**
   - Auto-creates ledgers as needed
   - Infers type from transaction type
   - Updates balances automatically

## User Experience Flow

### Complete Workflow

```
1. User clicks "Upload Statement"
   ↓
2. Selects PDF file
   ↓
3. AI extracts data (10-30 seconds)
   ↓
4. Review bank information
   - Edit if needed
   - Select existing bank OR
   - Create new bank
   ↓
5. Review transactions one-by-one
   - See both original and enhanced text
   - Edit any field if needed
   - Auto-matched transactions highlighted
   ↓
6. Save each transaction
   - Ledgers auto-created
   - Balances updated
   - Next transaction shown
   ↓
7. Complete all transactions
   - Dashboard refreshed
   - Stats updated
```

### Minimal User Intervention

For high-quality statements with previous transaction history:

**User Actions Required**:
1. Select PDF file (1 click)
2. Confirm bank (1 click)
3. Review & save each transaction (1 click each)

**Total**: 2 + N clicks (where N = number of transactions)

**AI Handles**:
- Bank name extraction
- Account number identification
- Transaction parsing
- Date standardization
- Amount extraction
- Type detection (DEBIT/CREDIT)
- Narration enhancement
- Ledger suggestion
- Auto-matching

## Error Handling

### Edge Function Errors

1. **No Gemini API Key**
   - Message: "Please configure your Gemini API key in Settings"
   - Redirects to Settings

2. **Invalid PDF**
   - Message: "Failed to process PDF with Gemini"
   - Shows error details

3. **No Transactions Found**
   - Message: "No transactions found in the file"
   - Option to retry

### Frontend Validation

1. **File Type**
   - Only accepts .pdf files
   - Shows error for other formats

2. **Bank Selection**
   - Must select or create bank before review
   - Validates bank information

3. **Transaction Data**
   - Validates required fields
   - Shows error if save fails
   - Allows retry

## Configuration

### Gemini API Setup

Users must configure their own Gemini API key:

1. Go to Settings
2. Click "Get API Key from Google"
3. Sign in to Google AI Studio
4. Create API key
5. Paste in settings
6. Save

### Edge Function Environment

Auto-configured:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

No manual configuration needed!

## Performance Optimization

### Edge Function
- Uses Gemini 1.5 Flash (fast model)
- Parallel processing of transactions
- Efficient similarity matching
- Single database query for history

### Frontend
- Progressive loading
- Optimistic updates
- Efficient state management
- Minimal re-renders

### Expected Performance

**Small Statement** (10-20 transactions):
- Extraction: 10-15 seconds
- Per transaction review: 5 seconds
- Total: ~2 minutes

**Large Statement** (100+ transactions):
- Extraction: 20-30 seconds
- Per transaction review: 5 seconds (or bulk save)
- Total: ~10 minutes (or 30 seconds with bulk save)

## Best Practices

### For Users

1. **Use clear PDF statements**
   - Text-based PDFs work best
   - Avoid scanned images

2. **Review AI suggestions**
   - Check narrations
   - Verify ledger assignments
   - Correct if needed

3. **Build transaction history**
   - More history = better auto-matching
   - Consistent patterns improve accuracy

4. **Use bulk save wisely**
   - Review first few transactions
   - If confident, bulk save rest
   - Can edit later from transaction list

### For Developers

1. **Monitor edge function logs**
   - Check for extraction errors
   - Optimize prompts if needed

2. **Update AI prompts**
   - Edge function can be redeployed
   - Improve extraction accuracy
   - Add new features

3. **Database optimization**
   - Index on user_id, date
   - Efficient similarity queries
   - Proper RLS policies

## Troubleshooting

### "Failed to extract data"
- Check Gemini API key is valid
- Verify PDF is not corrupted
- Ensure PDF has text (not scanned image)

### "No transactions found"
- PDF might be empty
- Format might be unsupported
- Try different statement format

### Low confidence scores
- Transaction descriptions unclear
- No previous similar transactions
- New type of transaction

### Auto-match not working
- Build more transaction history
- Check similarity threshold (70%)
- Verify previous transactions exist

## Future Enhancements

Potential improvements:

1. **OCR for scanned PDFs**
   - Support image-based statements
   - Extract from photos

2. **Multi-page statement handling**
   - Better pagination
   - Progress tracking

3. **Duplicate detection**
   - Warn if transaction already exists
   - Prevent double-entry

4. **Smart date range**
   - Auto-detect statement period
   - Filter existing transactions

5. **Bulk edit mode**
   - Edit multiple transactions
   - Apply changes to all

6. **Export templates**
   - Save extraction patterns
   - Share with team

## API Reference

### Edge Function Endpoint

```
POST /functions/v1/extract-bank-statement
```

**Headers**:
```
Authorization: Bearer <SUPABASE_ANON_KEY>
Content-Type: multipart/form-data
```

**Body**:
```
file: <PDF File>
geminiApiKey: <User's Gemini API Key>
```

**Response**:
```json
{
  "bankInfo": { ... },
  "transactions": [ ... ],
  "totalTransactions": 25
}
```

## Conclusion

The PDF extraction system provides:
- **Maximum Accuracy**: Gemini AI with 95%+ confidence
- **Minimal Intervention**: Auto-fills all possible fields
- **Smart Auto-Matching**: Learns from previous transactions
- **User-Friendly**: Clear review process with edit capability
- **Scalable**: Edge function handles heavy processing
- **Secure**: User API keys, RLS protection

This creates a seamless experience where users can upload a PDF and have transactions ready to save with minimal editing required.
