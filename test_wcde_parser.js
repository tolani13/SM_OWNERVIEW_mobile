import fs from 'fs';
import path from 'path';
import { PDFParser } from './server/pdf-parser/index.js';

// Create PDF parser instance
const pdfParser = new PDFParser();

async function testWCDEParser() {
  console.log('🧪 Testing WCDE Parser...');

  const testFiles = [
    'attached_assets/WCDE S.30 Baltimore Class Schedule.pdf',
    'attached_assets/WCDE S.30 Baltimore Competition Lineup.pdf'
  ];

  for (const filePath of testFiles) {
    try {
      const fileName = path.basename(filePath);
      console.log(`\n📄 Testing file: ${fileName}`);

      // Read PDF file
      const pdfBuffer = fs.readFileSync(filePath);

      // Parse PDF
      const result = await pdfParser.parsePDF(pdfBuffer, fileName);

      console.log(`✅ Parse Result:`);
      console.log(`- Success: ${result.success}`);
      console.log(`- Type: ${result.type}`);
      console.log(`- Company: ${result.company}`);
      console.log(`- Total Entries: ${result.metadata.totalEntries}`);
      console.log(`- Page Count: ${result.metadata.pageCount}`);

      if (result.errors.length > 0) {
        console.log(`⚠️  Errors: ${result.errors.join(', ')}`);
      }

      if (result.warnings.length > 0) {
        console.log(`⚠️  Warnings: ${result.warnings.join(', ')}`);
      }

      if (result.data.length > 0) {
        console.log(`📊 Sample Data (first 3 entries):`);
        result.data.slice(0, 3).forEach((entry, index) => {
          console.log(`  Entry ${index + 1}:`);
          if ('className' in entry) {
            // Convention class
            console.log(`    - Class: ${entry.className}`);
            console.log(`    - Instructor: ${entry.instructor}`);
            console.log(`    - Room: ${entry.room}`);
            console.log(`    - Time: ${entry.startTime} - ${entry.endTime}`);
            console.log(`    - Day: ${entry.day}`);
            console.log(`    - Style: ${entry.style}`);
            console.log(`    - Division: ${entry.division}`);
          } else {
            // Run slot
            console.log(`    - Routine: ${entry.routineName}`);
            console.log(`    - Entry #: ${entry.entryNumber}`);
            console.log(`    - Division: ${entry.division}`);
            console.log(`    - Style: ${entry.style}`);
            console.log(`    - Time: ${entry.performanceTime}`);
            console.log(`    - Stage: ${entry.stage}`);
          }
        });
      } else {
        console.log(`❌ No data extracted from PDF`);
      }

    } catch (error) {
      console.error(`❌ Error testing ${filePath}:`, error.message);
    }
  }

  console.log('\n🎉 WCDE Parser Testing Complete!');
}

testWCDEParser().catch(console.error);