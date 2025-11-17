import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface ExtractedTransaction {
  date: string;
  particulars: string;
  amount: number;
  transactionType: 'DEBIT' | 'CREDIT';
}

export async function extractTransactionsFromPDF(file: File): Promise<ExtractedTransaction[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      text += textContent.items.map((item: any) => item.str).join(' ');
      text += '\n';
    }

    return parseTransactionsFromText(text);
  } catch (error) {
    console.error('Error extracting PDF:', error);
    return [];
  }
}

export async function extractTransactionsFromExcel(file: File): Promise<ExtractedTransaction[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];

    const transactions: ExtractedTransaction[] = [];

    for (const row of data) {
      if (!row || row.length < 3) continue;

      const dateStr = String(row[0]).trim();
      const particulars = String(row[1]).trim();
      const amountStr = String(row[2]).trim();

      if (!dateStr || !particulars || !amountStr) continue;

      const date = parseDateString(dateStr);
      if (!date) continue;

      const amount = parseFloat(amountStr.replace(/[^\d.-]/g, ''));
      if (isNaN(amount)) continue;

      transactions.push({
        date,
        particulars,
        amount: Math.abs(amount),
        transactionType: amount >= 0 ? 'CREDIT' : 'DEBIT'
      });
    }

    return transactions;
  } catch (error) {
    console.error('Error extracting Excel:', error);
    return [];
  }
}

function parseTransactionsFromText(text: string): ExtractedTransaction[] {
  const transactions: ExtractedTransaction[] = [];
  const lines = text.split('\n');

  const dateRegex = /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/g;
  const amountRegex = /[-]?\s*(?:Rs\.?|₹)?\s*(\d+[.,]\d{2})/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const dateMatch = line.match(dateRegex);
    if (dateMatch) {
      const dateStr = dateMatch[0];
      const date = parseDateString(dateStr);

      if (date) {
        const amountMatch = line.match(amountRegex);
        if (amountMatch) {
          const amountStr = amountMatch[0];
          const amount = parseFloat(amountStr.replace(/[^\d.-]/g, ''));

          if (!isNaN(amount) && amount !== 0) {
            const particulars = line
              .replace(dateRegex, '')
              .replace(amountRegex, '')
              .trim();

            transactions.push({
              date,
              particulars: particulars || 'Transaction',
              amount: Math.abs(amount),
              transactionType: amount >= 0 ? 'CREDIT' : 'DEBIT'
            });
          }
        }
      }
    }
  }

  return transactions;
}

function parseDateString(dateStr: string): string | null {
  const formats = [
    /(\d{2})[-\/](\d{2})[-\/](\d{4})/,
    /(\d{4})[-\/](\d{2})[-\/](\d{2})/,
    /(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let year = parseInt(match[3]);
      let month = parseInt(match[2]);
      let day = parseInt(match[1]);

      if (format === formats[1]) {
        day = parseInt(match[3]);
        month = parseInt(match[2]);
        year = parseInt(match[1]);
      }

      if (year < 100) {
        year += year < 50 ? 2000 : 1900;
      }

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  }

  return null;
}
