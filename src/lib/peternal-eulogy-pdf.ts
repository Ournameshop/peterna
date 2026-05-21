export async function downloadEulogyPdf(eulogyText: string, petName: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });

  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 72;
  const contentW = pageW - marginX * 2;

  // Heading
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(28);
  doc.setTextColor(42, 33, 27);
  doc.text(petName, pageW / 2, 96, { align: 'center' });

  // Thin rule
  doc.setDrawColor(201, 169, 97);
  doc.setLineWidth(0.75);
  doc.line(marginX, 112, pageW - marginX, 112);

  // Body
  doc.setFont('times', 'italic');
  doc.setFontSize(13);
  doc.setTextColor(74, 63, 54);
  const lines = doc.splitTextToSize(eulogyText, contentW);
  doc.text(lines, marginX, 140, { lineHeightFactor: 1.75 });

  doc.save(`${petName}-eulogy.pdf`);
}
