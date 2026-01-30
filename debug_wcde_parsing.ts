import { PDFParser } from './server/pdf-parser/index';
import fs from 'fs';

async function debugWCDEParsing() {
  try {
    const pdfParser = new PDFParser();
    const buffer = fs.readFileSync('attached_assets/WCDE S.30 Baltimore Competition Lineup.pdf');

    const result = await pdfParser.parsePDF(buffer, 'WCDE Competition Lineup.pdf');

    console.log('📊 WCDE Competition Parsing Debug:');
    console.log(`- Total entries parsed: ${result.data.length}`);
    console.log(`- Expected entries: 248`);
    console.log(`- Missing entries: ${248 - result.data.length}`);

    // Find the highest entry number parsed
    const entryNumbers = (result.data as any[]).map(entry => parseInt(entry.entryNumber));
    const maxEntryNumber = Math.max(...entryNumbers);
    console.log(`- Highest entry number parsed: ${maxEntryNumber}`);

    // Find gaps in entry numbers
    const missingEntries = [];
    for (let i = 1; i <= maxEntryNumber; i++) {
      if (!entryNumbers.includes(i)) {
        missingEntries.push(i);
      }
    }
    console.log(`- Missing entry numbers: ${missingEntries.length}`);
    console.log(`- First few missing: ${missingEntries.slice(0, 10).join(', ')}`);

    // Show some sample entries with their raw text
    console.log('📝 Sample entries with raw text:');
    (result.data as any[]).slice(0, 5).forEach((entry, index) => {
      console.log(`Entry ${entry.entryNumber}: "${entry.routineName}"`);
      console.log(`  Raw: "${entry.rawText}"`);
    });

    // Check for entries that might be malformed
    const malformedEntries = (result.data as any[]).filter(entry =>
      !entry.routineName || entry.routineName.length < 3 ||
      !entry.entryNumber || isNaN(parseInt(entry.entryNumber))
    );
    console.log(`- Malformed entries: ${malformedEntries.length}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

debugWCDEParsing();