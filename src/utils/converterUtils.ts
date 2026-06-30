import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

export const converterUtils = {
  // 1. Convert Text/Markdown/HTML/JSON to PDF
  async textToPdf(content: string, type: 'txt' | 'md' | 'html' | 'json', fileName: string): Promise<Blob> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    doc.setProperties({ title: fileName });
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);

    let textLines: string[] = [];

    if (type === 'json') {
      try {
        const parsed = JSON.parse(content);
        const formattedJson = JSON.stringify(parsed, null, 2);
        textLines = doc.splitTextToSize(formattedJson, 180);
      } catch (e) {
        textLines = doc.splitTextToSize(content, 180);
      }
    } else if (type === 'md') {
      // Simple Markdown parser for PDF
      const lines = content.split('\n');
      let y = 15;
      
      for (const line of lines) {
        if (y > 280) {
          doc.addPage();
          y = 15;
        }

        if (line.startsWith('# ')) {
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(18);
          doc.text(line.replace('# ', ''), 15, y);
          y += 10;
        } else if (line.startsWith('## ')) {
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(14);
          doc.text(line.replace('## ', ''), 15, y);
          y += 8;
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(11);
          doc.text(`• ${line.substring(2)}`, 20, y);
          y += 6;
        } else {
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(11);
          const splitLines = doc.splitTextToSize(line, 180);
          for (const sl of splitLines) {
            if (y > 280) {
              doc.addPage();
              y = 15;
            }
            doc.text(sl, 15, y);
            y += 6;
          }
        }
      }
      return doc.output('blob');
    } else if (type === 'html') {
      // Render simple HTML text lines
      const cleanHtml = content.replace(/<[^>]*>/g, ''); // Basic strip tags
      textLines = doc.splitTextToSize(cleanHtml, 180);
    } else {
      // Plain text
      textLines = doc.splitTextToSize(content, 180);
    }

    // Default rendering for txt, json, html
    if (type === 'txt' || type === 'json' || type === 'html') {
      let y = 15;
      for (const line of textLines) {
        if (y > 280) {
          doc.addPage();
          y = 15;
        }
        doc.text(line, 15, y);
        y += 6;
      }
    }

    return doc.output('blob');
  },

  // 2. Convert Text/Markdown/HTML/JSON to DOCX
  async textToDocx(content: string, type: 'txt' | 'md' | 'html' | 'json'): Promise<Blob> {
    const paragraphs: Paragraph[] = [];

    if (type === 'md') {
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.startsWith('# ')) {
          paragraphs.push(
            new Paragraph({
              text: line.replace('# ', ''),
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 240, after: 120 },
            })
          );
        } else if (line.startsWith('## ')) {
          paragraphs.push(
            new Paragraph({
              text: line.replace('## ', ''),
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 180, after: 80 },
            })
          );
        } else {
          // Check for inline bold or italic
          let text = line;
          const runs: TextRun[] = [];
          
          // Simple bold parser
          if (text.includes('**')) {
            const parts = text.split('**');
            for (let i = 0; i < parts.length; i++) {
              runs.push(
                new TextRun({
                  text: parts[i],
                  bold: i % 2 === 1,
                })
              );
            }
          } else {
            runs.push(new TextRun(text));
          }

          paragraphs.push(
            new Paragraph({
              children: runs,
              spacing: { after: 120 },
            })
          );
        }
      }
    } else {
      // For txt, json, html
      const lines = content.split('\n');
      for (const line of lines) {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun(line)],
            spacing: { after: 120 },
          })
        );
      }
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    return blob;
  },

  // 3. Image format converter (JPG, PNG, WEBP)
  async convertImage(imageFile: File, targetFormat: 'jpeg' | 'png' | 'webp'): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(imageFile);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get 2D canvas context.'));
          return;
        }

        // Draw image
        ctx.drawImage(img, 0, 0);

        // Convert to target format blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Conversion failed.'));
            }
          },
          `image/${targetFormat}`,
          0.90 // 90% quality
        );
        
        URL.revokeObjectURL(img.src);
      };

      img.onerror = () => {
        reject(new Error('Failed to load source image.'));
        URL.revokeObjectURL(img.src);
      };
    });
  }
};
