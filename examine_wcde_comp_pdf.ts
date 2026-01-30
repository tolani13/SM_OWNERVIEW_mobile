import { PDFParse } from 'pdf-parse';
import fs from 'fs';

async function examineWCDECompPDF() {
  try {
    const buffer = fs.readFileSync('attached_assets/WCDE S.30 Baltimore Competition Lineup.pdf');
    const pdfParseInstance = new PDFParse(new Uint8Array(buffer));

    const infoResult = await pdfParseInstance.getInfo();
    console.log('📄 PDF Info:', {
      totalPages: infoResult.total,
      title: infoResult.info.Title,
      creator: infoResult.info.Creator
    });

    // Get text from all pages
    const textResult = await pdfParseInstance.getText();
    const fullText = textResult.text;

    console.log('📊 Text Analysis:');
    console.log('- Total characters:', fullText.length);
    console.log('- Total lines:', fullText.split('\n').length);

    // Show first 50 lines to understand structure
    const lines = fullText.split('\n');
    console.log('📝 First 50 lines:');
    lines.slice(0, 50).forEach((line, index) => {
      console.log(`${index + 1}: ${line}`);
    });

    // Check for WCDE indicators
    const lowerText = fullText.toLowerCase();
    console.log('🔍 WCDE Indicators:');
    console.log('- Contains "wcde":', lowerText.includes('wcde'));
    console.log('- Contains "west coast":', lowerText.includes('west coast'));
    console.log('- Contains "mini":', lowerText.includes('mini'));
    console.log('- Contains "junior":', lowerText.includes('junior'));
    console.log('- Contains "teen":', lowerText.includes('teen'));
    console.log('- Contains "senior":', lowerText.includes('senior'));
    console.log('- Contains "entry":', lowerText.includes('entry'));
    console.log('- Contains "competition":', lowerText.includes('competition'));

    // Check for time patterns
    const timePattern = /\d{1,2}:\d{2}\s*[ap]m/i;
    const timeMatches = fullText.match(timePattern);
    console.log('⏰ Time patterns found:', timeMatches ? timeMatches.length : 0);

  } catch (error) {
    console.error('Error:', error);
  }
}

examineWCDECompPDF();