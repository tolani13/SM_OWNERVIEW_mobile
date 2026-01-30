import { PDFParse } from 'pdf-parse';
import fs from 'fs';

async function testPDFParseAPI() {
  try {
    const buffer = fs.readFileSync('attached_assets/WCDE S.30 Baltimore Class Schedule.pdf');
    const pdfParseInstance = new PDFParse(new Uint8Array(buffer));

    console.log('PDFParse instance created');
    console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(pdfParseInstance)));

    // Try to get info
    const info = await pdfParseInstance.getInfo();
    console.log('Info:', info);

    // Try to get text
    const text = await pdfParseInstance.getText();
    console.log('Text type:', typeof text);
    console.log('Text keys:', Object.keys(text));
    console.log('Text content type:', typeof text.text);
    console.log('Text length:', text.text?.length || 0);
    console.log('First 200 chars:', text.text?.substring(0, 200) || 'No text');

  } catch (error) {
    console.error('Error:', error);
  }
}

testPDFParseAPI();