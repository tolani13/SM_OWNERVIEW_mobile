import { PDFParse } from 'pdf-parse';
import fs from 'fs';

async function analyzeFullPDF() {
  try {
    const buffer = fs.readFileSync('attached_assets/WCDE S.30 Baltimore Competition Lineup.pdf');
    const pdfParseInstance = new PDFParse(new Uint8Array(buffer));

    const textResult = await pdfParseInstance.getText();
    const fullText = textResult.text;
    const lines = fullText.split('\n');

    console.log('📊 Full PDF Analysis:');
    console.log('- Total lines:', lines.length);
    console.log('- Total characters:', fullText.length);

    // Count lines that look like entries (start with numbers)
    const entryLines = lines.filter(line => line.trim().match(/^\d+/));
    console.log('- Potential entry lines:', entryLines.length);

    // Show some sample entry lines from different parts of the document
    console.log('📝 Sample entry lines from throughout the document:');
    for (let i = 0; i < lines.length; i += 100) {
      if (lines[i].trim().match(/^\d+/)) {
        console.log(`Line ${i}: ${lines[i]}`);
      }
    }

    // Count lines with specific patterns
    const patterns = [
      { name: 'Entry numbers', pattern: /^\d+\s/, count: 0 },
      { name: 'Time patterns', pattern: /\d{1,2}:\d{2}/, count: 0 },
      { name: 'Studio names', pattern: /(Studio|Academy|Dance)/i, count: 0 },
      { name: 'Page markers', pattern: /-- \d+ of \d+ --/, count: 0 }
    ];

    lines.forEach(line => {
      patterns.forEach(pattern => {
        if (line.match(pattern.pattern)) {
          pattern.count++;
        }
      });
    });

    console.log('🔍 Pattern Analysis:');
    patterns.forEach(pattern => {
      console.log(`${pattern.name}: ${pattern.count}`);
    });

    // Check for multi-line entries
    console.log('📄 Checking for multi-line entries...');
    let multiLineEntries = 0;
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].trim().match(/^\d+/) && !lines[i].match(/\d{1,2}:\d{2}/) && lines[i+1].trim().length > 0) {
        multiLineEntries++;
        console.log(`Multi-line entry at line ${i}: ${lines[i]}`);
        console.log(`  Continued: ${lines[i+1]}`);
      }
    }
    console.log(`Multi-line entries found: ${multiLineEntries}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeFullPDF();