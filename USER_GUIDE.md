# MoneyTrack - User Guide

## Getting Started

### 1. Sign Up / Sign In
- Open the app
- Enter your email and password
- For new users: Fill in your full name
- Click "Create Account" or "Sign In"

### 2. Configure Gemini AI (Important!)
1. Go to Settings (bottom navigation)
2. Click "Get API Key from Google"
3. Sign in to Google AI Studio
4. Create a new API key
5. Copy and paste it into the app
6. Click "Save Settings"

**Why is this important?** The AI features won't work without an API key. It enables:
- Automatic transaction categorization
- Smart ledger suggestions
- Financial insights
- Auto-filling transaction details

---

## Managing Banks

### Add Your First Bank
1. Tap "Banks" in bottom navigation
2. Tap the "+" button
3. Enter:
   - Bank name (e.g., "HDFC Bank")
   - Account number (last 4 digits for privacy)
   - Account type (Savings/Current/Credit Card)
   - Opening balance
4. Click "Add Bank"

### Managing Banks
- **Edit**: Tap the edit icon on any bank card
- **Delete**: Tap the delete icon (only if no transactions)
- **Activate/Deactivate**: Toggle the Active/Inactive button

---

## Recording Transactions

### Method 1: Upload Bank Statement (Recommended)

1. **Prepare Your Statement**
   - Download from your bank as TXT, CSV, PDF, or Excel
   - Ensure it has date, description, and amount columns

2. **Upload Process**
   - Tap "Upload" in bottom navigation
   - Select the bank account
   - Tap to upload file
   - Wait for AI extraction (may take 30-60 seconds)

3. **Review Transactions**
   - You'll see transactions one by one
   - AI suggests ledger and narration
   - You can:
     - **Edit**: Tap edit icon to modify details
     - **Import & Next**: Accept and move to next
     - **Skip**: Skip this transaction
     - **Import All**: Accept all remaining

4. **Confirm Transactions**
   - Go to Home tab
   - Review pending transactions
   - Confirm or reject each one

### Method 2: Manual Cash Transaction

1. Tap "Home" → "Cash Transaction" quick action
   OR tap the new "Cash" icon in your custom menu
2. Fill in:
   - Date
   - Type (Cash Out/Cash In)
   - Amount
   - Description
3. AI will auto-suggest:
   - Ledger account
   - Narration
4. Review and click "Record Transaction"

---

## Understanding Ledgers

### What are Ledgers?
Ledgers are categories that help organize your money. Think of them as folders for different types of transactions.

### Types of Ledgers
- **Income**: Money coming in (Salary, Sales, etc.)
- **Expense**: Money going out (Rent, Food, Travel, etc.)
- **Asset**: Things you own (Cash, Property, etc.)
- **Liability**: Money you owe (Loans, Credit Cards, etc.)

### Creating Ledgers
- The AI automatically creates ledgers as needed
- You can also create them manually when recording transactions
- Examples:
  - "Office Rent" (Expense)
  - "Client Payment" (Income)
  - "Equipment Purchase" (Asset)

---

## Daily Summary

### View Daily Transactions
1. Tap "Home" → "Daily Summary" quick action
2. Select a date
3. See:
   - Total income for the day
   - Total expenses for the day
   - Net flow (income - expenses)
   - Transaction count

### Bank-wise Breakdown
- Tap any day to expand
- See transactions grouped by bank
- Tap a bank to see individual transactions
- Perfect for reconciliation!

---

## Splitting Transactions

### When to Use Split
- Paid for group dinner
- Shared expenses with roommates
- Business expenses with partners
- Anything where multiple people share costs

### How to Split
1. Go to Home → View transaction list
2. Find the confirmed transaction
3. Tap "Split" button
4. Choose split method:
   - **Equal**: Divides equally among all
   - **Manual**: Enter custom amounts

5. Search for users by email or name
6. Add users and set their share
7. Choose if it affects their bank account
8. Add notes (optional)
9. Click "Split Transaction"

### Receiving Split Requests
1. You'll see a badge on "Split Transaction" icon
2. Tap to view pending requests
3. See who sent it and for what
4. Review your share amount
5. Confirm or Reject

---

## Reminders

### Create a Reminder
1. Tap "Reminders" (bell icon)
2. Tap "+" button
3. Fill in:
   - Type (Receivable/Debt/Payment Due)
   - Contact name
   - Amount
   - Due date
   - Reminder date
   - Contact details (optional)
   - Notification methods (email/SMS/WhatsApp)

4. Click "Create Reminder"

### Managing Reminders
- **Pending**: Shows active reminders
- **Completed**: Mark as done when paid/received
- **Delete**: Remove unwanted reminders

---

## Financial Reports

### View Reports
1. Tap "Reports" in bottom navigation
2. Choose period:
   - Month
   - Quarter
   - Year

3. See:
   - Total income and expenses
   - Top expense categories
   - Asset and liability totals
   - Visual charts and breakdowns

### Generate AI Insights
1. Scroll to "AI Financial Insights" section
2. Tap "Generate Insights"
3. Wait 10-20 seconds
4. Get:
   - Financial health assessment
   - Spending pattern analysis
   - Top 3 improvement areas
   - Budget suggestions
   - Actionable recommendations

---

## Tips for Best Experience

### 1. Regular Updates
- Upload bank statements weekly or monthly
- Confirm pending transactions promptly
- Review daily summaries regularly

### 2. AI Training
- The more you use it, the smarter it gets
- Correct AI suggestions when wrong
- Use consistent ledger names
- The app learns your patterns

### 3. Organization
- Create meaningful ledger names
- Add narrations to transactions
- Use reminders for due dates
- Keep contact details updated

### 4. Mobile Usage
- App is optimized for mobile
- Use touch gestures
- Bottom navigation is always accessible
- Quick actions save time

### 5. Data Safety
- Your data is secure and private
- Each user sees only their own data
- Regular backups recommended
- API keys are encrypted

---

## Common Questions

### Q: Why do I need a Gemini API key?
**A:** The AI features require Google's Gemini AI to work. The API key connects your app to Google's AI services. Don't worry - it's free for reasonable usage!

### Q: How accurate is the AI?
**A:** The AI is very good (85-95% accuracy) but always review its suggestions. It gets better as it learns your patterns.

### Q: Can I use this offline?
**A:** You can view your data offline, but uploading statements and AI features require internet.

### Q: Is my financial data safe?
**A:** Yes! Your data is stored securely in Supabase with Row Level Security. Only you can access your data.

### Q: How do I delete a transaction?
**A:** Only pending (unconfirmed) transactions can be deleted. For confirmed transactions, create a reverse entry.

### Q: Can I export my data?
**A:** Currently, you can view all transactions in the app. Export features can be added if needed.

### Q: What file formats work best for uploads?
**A:** TXT and CSV work best. PDF and Excel files work but may need cleaner formatting.

---

## Getting Help

### Issues with AI Suggestions?
1. Check your API key is configured
2. Ensure you have internet connection
3. Try with a simpler statement format
4. Review and correct AI suggestions to train it

### Transactions Not Showing?
1. Check if you selected the right bank
2. Confirm pending transactions
3. Check date filters
4. Refresh the page

### Split Transactions Not Working?
1. Ensure transaction is confirmed first
2. Check if other user has an account
3. Verify email spelling is correct

---

## Best Practices

1. **Start with one bank** - Master the basics first
2. **Upload regularly** - Don't let statements pile up
3. **Review AI suggestions** - They improve with your feedback
4. **Use reminders** - Never miss a payment or collection
5. **Check daily summaries** - Stay on top of your finances
6. **Generate monthly insights** - Understand your spending
7. **Split shared expenses** - Keep track of who owes what
8. **Keep notes** - Add context to transactions

---

## Support

For questions or issues:
- Check this user guide first
- Review the FEATURES.md file for complete feature list
- Ensure all settings are configured correctly
- Make sure Gemini API key is working

---

## Welcome to Stress-Free Accounting!

MoneyTrack is designed to make accounting simple and automated. Let the AI do the heavy lifting while you focus on making smart financial decisions. Happy tracking!
