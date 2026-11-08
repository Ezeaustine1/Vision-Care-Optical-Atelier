import { OrderRecord, ClinicalAppointmentRecord } from '../types.ts';

function sanitizePdfText(input: string | number | undefined | null): string {
  if (input === undefined || input === null) return '';
  return String(input)
    .replace(/₦/g, 'NGN ')
    .replace(/°/g, ' deg')
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/·/g, '|')
    .replace(/×/g, 'x')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function formatNgnPdf(amount: number | undefined | null): string {
  const num = Number(amount || 0);
  return `NGN ${num.toLocaleString('en-NG')}`;
}

class PdfPageBuilder {
  public ops: string[] = [];

  drawRect(
    x: number,
    y: number,
    w: number,
    h: number,
    fillRgb?: [number, number, number],
    strokeRgb?: [number, number, number],
    lineWidth = 1
  ) {
    this.ops.push('q');
    if (fillRgb) {
      this.ops.push(`${fillRgb[0].toFixed(3)} ${fillRgb[1].toFixed(3)} ${fillRgb[2].toFixed(3)} rg`);
    }
    if (strokeRgb) {
      this.ops.push(`${strokeRgb[0].toFixed(3)} ${strokeRgb[1].toFixed(3)} ${strokeRgb[2].toFixed(3)} RG`);
      this.ops.push(`${lineWidth} w`);
    }
    const mode = fillRgb && strokeRgb ? 'B' : fillRgb ? 'f' : 'S';
    this.ops.push(`${x} ${y} ${w} ${h} re ${mode}`);
    this.ops.push('Q');
  }

  drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    strokeRgb: [number, number, number] = [0.85, 0.88, 0.92],
    lineWidth = 0.75
  ) {
    this.ops.push('q');
    this.ops.push(`${strokeRgb[0].toFixed(3)} ${strokeRgb[1].toFixed(3)} ${strokeRgb[2].toFixed(3)} RG`);
    this.ops.push(`${lineWidth} w`);
    this.ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
    this.ops.push('Q');
  }

  drawText(
    text: string | number,
    x: number,
    y: number,
    size = 10,
    font: 'F1' | 'F2' = 'F1',
    colorRgb: [number, number, number] = [0.043, 0.098, 0.173]
  ) {
    const clean = sanitizePdfText(text);
    this.ops.push('BT');
    this.ops.push(`/${font} ${size} Tf`);
    this.ops.push(`${colorRgb[0].toFixed(3)} ${colorRgb[1].toFixed(3)} ${colorRgb[2].toFixed(3)} rg`);
    this.ops.push(`1 0 0 1 ${x} ${y} Tm`);
    this.ops.push(`(${clean}) Tj`);
    this.ops.push('ET');
  }
}

function buildAndDownloadMultiPagePdf(pages: PdfPageBuilder[], fileName: string): void {
  const objects: string[] = [];
  // 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');

  // 2: Pages placeholder (will be filled after knowing page object IDs)
  objects.push('');

  // 3: Font F1 (Helvetica)
  objects.push(
    '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj'
  );
  // 4: Font F2 (Helvetica-Bold)
  objects.push(
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj'
  );

  const pageObjIds: number[] = [];

  for (let i = 0; i < pages.length; i++) {
    const pageObjId = 5 + i * 2;
    const contentObjId = pageObjId + 1;
    pageObjIds.push(pageObjId);

    const stream = pages[i].ops.join('\n');
    objects.push(
      `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj`
    );
    objects.push(
      `${contentObjId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`
    );
  }

  const kidsRef = pageObjIds.map((id) => `${id} 0 R`).join(' ');
  objects[1] = `2 0 obj\n<< /Type /Pages /Kids [${kidsRef}] /Count ${pageObjIds.length} >>\nendobj`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += `${obj}\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Generates an official client optical dispensing invoice & receipt in PDF format.
 */
export function exportClientInvoiceToPdf(order: OrderRecord): void {
  const page = new PdfPageBuilder();

  // Outer Frame Border
  page.drawRect(28, 28, 539, 786, [1, 1, 1], [0.043, 0.098, 0.173], 1.5);

  // Header Banner (#0B192C)
  page.drawRect(28, 720, 539, 94, [0.043, 0.098, 0.173]);
  // Champagne Gold Accent Bar (#C5A059)
  page.drawRect(28, 716, 539, 4, [0.773, 0.627, 0.349]);

  // Brand Title
  page.drawText('VISION CARE OPTICAL ATELIER', 46, 784, 16, 'F2', [1, 1, 1]);
  page.drawText(
    'OFFICIAL CLIENT OPTICAL DISPENSING INVOICE & RECEIPT',
    46,
    764,
    9.5,
    'F2',
    [0.773, 0.627, 0.349]
  );
  page.drawText(
    'Victoria Island, Lagos & Maitama, Abuja | concierge@visioncare.ng',
    46,
    746,
    8.5,
    'F1',
    [0.85, 0.91, 0.98]
  );

  // Invoice Metadata on Right of Header
  page.drawText(`INVOICE #: ${order.orderNumber}`, 395, 784, 10, 'F2', [1, 1, 1]);
  const orderDateStr = order.createdAt
    ? new Date(order.createdAt).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  page.drawText(`Order Date: ${orderDateStr}`, 395, 766, 8.5, 'F1', [0.85, 0.91, 0.98]);
  page.drawText(
    `Payment Status: ${(order.paymentStatus || 'PAID').toUpperCase()}`,
    395,
    750,
    8.5,
    'F2',
    [0.773, 0.627, 0.349]
  );
  page.drawText(
    `Fulfilment Stage: ${order.orderStatus || 'Order received'}`,
    395,
    734,
    8,
    'F1',
    [0.85, 0.91, 0.98]
  );

  // Client & Billing / Delivery Details Box
  page.drawRect(44, 606, 507, 94, [0.973, 0.98, 0.988], [0.85, 0.88, 0.92], 0.8);
  page.drawText('BILL TO / CLIENT DETAILS', 58, 682, 9, 'F2', [0.118, 0.251, 0.686]);
  page.drawText('PAYMENT & DELIVERY CHANNEL', 310, 682, 9, 'F2', [0.118, 0.251, 0.686]);
  page.drawLine(58, 675, 537, 675, [0.85, 0.88, 0.92], 0.6);

  page.drawText('Client Name:', 58, 658, 8.5, 'F2', [0.35, 0.4, 0.48]);
  page.drawText((order.customerName || 'Valued Client').slice(0, 32), 125, 658, 9, 'F2', [0.043, 0.098, 0.173]);

  page.drawText('Email:', 58, 641, 8.5, 'F2', [0.35, 0.4, 0.48]);
  page.drawText((order.customerEmail || '').slice(0, 34), 125, 641, 8.5, 'F1', [0.043, 0.098, 0.173]);

  page.drawText('Phone:', 58, 624, 8.5, 'F2', [0.35, 0.4, 0.48]);
  page.drawText((order.customerPhone || '').slice(0, 28), 125, 624, 8.5, 'F1', [0.043, 0.098, 0.173]);

  page.drawText('Gateway:', 310, 658, 8.5, 'F2', [0.35, 0.4, 0.48]);
  page.drawText(
    `${(order.paymentMethod || 'PAYSTACK').toUpperCase()} (${(order.paymentReference || 'VERIFIED').slice(0, 22)})`,
    365,
    658,
    8.5,
    'F2',
    [0.043, 0.098, 0.173]
  );

  page.drawText('Destination:', 310, 641, 8.5, 'F2', [0.35, 0.4, 0.48]);
  const fullDest = `${order.deliveryAddress || ''}, ${order.deliveryCity || ''}, ${order.deliveryState || ''}`;
  page.drawText(fullDest.slice(0, 38), 365, 641, 8, 'F1', [0.043, 0.098, 0.173]);

  page.drawText('Courier:', 310, 624, 8.5, 'F2', [0.35, 0.4, 0.48]);
  page.drawText((order.deliveryMethod || 'Insured Optical Courier').slice(0, 36), 365, 624, 8, 'F1', [0.043, 0.098, 0.173]);

  // Itemized Table Header
  page.drawText('DISPENSED OPTICAL ITEMS & LENS SPECIFICATIONS', 44, 584, 10.5, 'F2', [0.043, 0.098, 0.173]);
  page.drawRect(44, 552, 507, 24, [0.043, 0.098, 0.173]);
  page.drawText('#', 54, 561, 8.5, 'F2', [1, 1, 1]);
  page.drawText('FRAME, LENS DESIGN & COATING SPECIFICATION', 74, 561, 8.5, 'F2', [1, 1, 1]);
  page.drawText('QTY', 385, 561, 8.5, 'F2', [1, 1, 1]);
  page.drawText('UNIT PRICE', 420, 561, 8.5, 'F2', [1, 1, 1]);
  page.drawText('TOTAL (NGN)', 488, 561, 8.5, 'F2', [1, 1, 1]);

  let currentY = 552;
  const itemsToRender = (order.items || []).slice(0, 6);

  itemsToRender.forEach((it, idx) => {
    const rowHeight = 46;
    currentY -= rowHeight;
    const bg: [number, number, number] = idx % 2 === 0 ? [1, 1, 1] : [0.976, 0.984, 0.992];
    page.drawRect(44, currentY, 507, rowHeight, bg, [0.85, 0.88, 0.92], 0.6);

    page.drawText(String(idx + 1), 54, currentY + 29, 9, 'F2', [0.043, 0.098, 0.173]);
    page.drawText(
      `${it.productName} (${it.selectedColor || 'Standard'})`.slice(0, 52),
      74,
      currentY + 30,
      9,
      'F2',
      [0.043, 0.098, 0.173]
    );
    page.drawText(
      `Lens: ${it.lensTypeName || 'Optical Lens'} (${it.lensOptionSelected || 'Standard'})`.slice(0, 64),
      74,
      currentY + 18,
      8,
      'F1',
      [0.25, 0.3, 0.38]
    );
    page.drawText(
      `Coatings: ${it.coatingSummary || 'Standard UV400'}`.slice(0, 66),
      74,
      currentY + 7,
      7.5,
      'F1',
      [0.118, 0.251, 0.686]
    );

    page.drawText(String(it.quantity || 1), 390, currentY + 22, 9, 'F2', [0.043, 0.098, 0.173]);
    page.drawText(formatNgnPdf(it.unitTotalNgn), 418, currentY + 22, 8.5, 'F1', [0.043, 0.098, 0.173]);
    page.drawText(
      formatNgnPdf((it.unitTotalNgn || 0) * (it.quantity || 1)),
      485,
      currentY + 22,
      8.5,
      'F2',
      [0.043, 0.098, 0.173]
    );
  });

  // Totals Box at bottom right
  const summaryTopY = Math.min(currentY - 16, 260);
  page.drawRect(310, summaryTopY - 96, 241, 96, [0.973, 0.98, 0.988], [0.043, 0.098, 0.173], 0.9);

  page.drawText('Subtotal:', 324, summaryTopY - 20, 9, 'F1', [0.35, 0.4, 0.48]);
  page.drawText(formatNgnPdf(order.subtotalNgn), 445, summaryTopY - 20, 9, 'F2', [0.043, 0.098, 0.173]);

  page.drawText('Delivery & Alert Service:', 324, summaryTopY - 38, 9, 'F1', [0.35, 0.4, 0.48]);
  page.drawText(
    order.deliveryFeeNgn === 0 ? 'FREE (NGN 0)' : formatNgnPdf(order.deliveryFeeNgn),
    445,
    summaryTopY - 38,
    9,
    'F1',
    [0.043, 0.098, 0.173]
  );

  page.drawText(
    `Discount${order.couponCode ? ` (${order.couponCode})` : ''}:`,
    324,
    summaryTopY - 56,
    9,
    'F1',
    [0.35, 0.4, 0.48]
  );
  page.drawText(`-${formatNgnPdf(order.discountNgn || 0)}`, 445, summaryTopY - 56, 9, 'F1', [0.05, 0.5, 0.3]);

  page.drawLine(322, summaryTopY - 66, 539, summaryTopY - 66, [0.773, 0.627, 0.349], 1);
  page.drawText('TOTAL AMOUNT (NGN):', 324, summaryTopY - 83, 10, 'F2', [0.043, 0.098, 0.173]);
  page.drawText(formatNgnPdf(order.totalNgn), 440, summaryTopY - 83, 10.5, 'F2', [0.118, 0.251, 0.686]);

  // Left Attestation & Warranty Note
  page.drawRect(44, summaryTopY - 96, 252, 96, [1, 1, 1], [0.85, 0.88, 0.92], 0.8);
  page.drawText('CLINICAL QUALITY & AUTHENTICITY GUARANTEE', 56, summaryTopY - 20, 8.5, 'F2', [0.043, 0.098, 0.173]);
  page.drawText(
    'Every Vision Care frame and prescription lens undergoes digital',
    56,
    summaryTopY - 36,
    8,
    'F1',
    [0.35, 0.4, 0.48]
  );
  page.drawText(
    'lensometer verification, UV400 testing, and 4-point alignment.',
    56,
    summaryTopY - 48,
    8,
    'F1',
    [0.35, 0.4, 0.48]
  );
  page.drawText(
    'Retain this PDF invoice for warranty & insurance reimbursement.',
    56,
    summaryTopY - 62,
    8,
    'F1',
    [0.35, 0.4, 0.48]
  );
  page.drawText('Authorised Optical Dispensing Sign-Off', 56, summaryTopY - 84, 8, 'F2', [0.118, 0.251, 0.686]);

  // Footer
  page.drawText(
    `Official PDF Invoice generated by VISION CARE Optical Atelier on ${new Date().toISOString().slice(0, 10)} - Thank you for your patronage.`,
    90,
    44,
    8,
    'F1',
    [0.45, 0.5, 0.58]
  );

  buildAndDownloadMultiPagePdf([page], `VisionCare_Invoice_${order.orderNumber}.pdf`);
}

/**
 * Generates an executive multi-page Sales & Order Ledger PDF Report for the Admin Dashboard.
 */
export function exportSalesReportToPdf(orders: OrderRecord[]): void {
  const validOrders = orders.filter((o) => o.paymentStatus !== 'refunded');
  const totalRevenue = validOrders.reduce((sum, o) => sum + (o.totalNgn || 0), 0);
  const paystackTotal = validOrders
    .filter((o) => o.paymentMethod === 'paystack')
    .reduce((sum, o) => sum + (o.totalNgn || 0), 0);
  const flutterwaveTotal = validOrders
    .filter((o) => o.paymentMethod === 'flutterwave')
    .reduce((sum, o) => sum + (o.totalNgn || 0), 0);
  const bankTransferTotal = validOrders
    .filter((o) => o.paymentMethod === 'bank_transfer')
    .reduce((sum, o) => sum + (o.totalNgn || 0), 0);

  const rowsPerPage = 16;
  const totalPages = Math.max(1, Math.ceil(orders.length / rowsPerPage));
  const pages: PdfPageBuilder[] = [];
  const reportDate = new Date().toISOString().slice(0, 10);

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const p = new PdfPageBuilder();
    p.drawRect(28, 28, 539, 786, [1, 1, 1], [0.043, 0.098, 0.173], 1.5);

    // Header
    p.drawRect(28, 730, 539, 84, [0.043, 0.098, 0.173]);
    p.drawRect(28, 726, 539, 4, [0.773, 0.627, 0.349]);
    p.drawText('VISION CARE OPTICAL ATELIER — EXECUTIVE SALES REPORT (PDF)', 44, 786, 13.5, 'F2', [1, 1, 1]);
    p.drawText(
      'Official Financial & Order Fulfilment Ledger (Nigerian Naira - NGN)',
      44,
      768,
      9,
      'F2',
      [0.773, 0.627, 0.349]
    );
    p.drawText(
      `Generated Date: ${reportDate} | Page ${pageIdx + 1} of ${totalPages} | Total Orders Logged: ${orders.length}`,
      44,
      748,
      8.5,
      'F1',
      [0.85, 0.91, 0.98]
    );

    let tableStartY = 695;

    if (pageIdx === 0) {
      // Executive KPI Summary Bar on Page 1
      p.drawRect(44, 636, 507, 72, [0.973, 0.98, 0.988], [0.85, 0.88, 0.92], 0.8);
      p.drawText('EXECUTIVE REVENUE SUMMARY BY PAYMENT GATEWAY', 56, 692, 9, 'F2', [0.118, 0.251, 0.686]);
      p.drawLine(56, 685, 539, 685, [0.85, 0.88, 0.92], 0.6);

      p.drawText('Total Net Revenue:', 56, 668, 8.5, 'F2', [0.35, 0.4, 0.48]);
      p.drawText(formatNgnPdf(totalRevenue), 148, 668, 10, 'F2', [0.043, 0.098, 0.173]);

      p.drawText('Total Orders:', 56, 650, 8.5, 'F2', [0.35, 0.4, 0.48]);
      p.drawText(`${orders.length} Orders (${validOrders.length} Active/Paid)`, 148, 650, 8.5, 'F1', [0.043, 0.098, 0.173]);

      p.drawText('Paystack Volume:', 295, 672, 8, 'F2', [0.35, 0.4, 0.48]);
      p.drawText(formatNgnPdf(paystackTotal), 395, 672, 8.5, 'F2', [0.043, 0.098, 0.173]);

      p.drawText('Flutterwave Volume:', 295, 658, 8, 'F2', [0.35, 0.4, 0.48]);
      p.drawText(formatNgnPdf(flutterwaveTotal), 395, 658, 8.5, 'F2', [0.043, 0.098, 0.173]);

      p.drawText('Bank Transfer Volume:', 295, 644, 8, 'F2', [0.35, 0.4, 0.48]);
      p.drawText(formatNgnPdf(bankTransferTotal), 395, 644, 8.5, 'F2', [0.043, 0.098, 0.173]);

      tableStartY = 616;
    }

    // Table Header
    p.drawRect(44, tableStartY - 22, 507, 22, [0.043, 0.098, 0.173]);
    p.drawText('ORDER #', 52, tableStartY - 14, 8, 'F2', [1, 1, 1]);
    p.drawText('DATE', 132, tableStartY - 14, 8, 'F2', [1, 1, 1]);
    p.drawText('CLIENT NAME', 190, tableStartY - 14, 8, 'F2', [1, 1, 1]);
    p.drawText('GATEWAY', 305, tableStartY - 14, 8, 'F2', [1, 1, 1]);
    p.drawText('ORDER STAGE', 375, tableStartY - 14, 8, 'F2', [1, 1, 1]);
    p.drawText('TOTAL (NGN)', 478, tableStartY - 14, 8, 'F2', [1, 1, 1]);

    let rowY = tableStartY - 22;
    const chunk = orders.slice(pageIdx * rowsPerPage, (pageIdx + 1) * rowsPerPage);

    if (chunk.length === 0) {
      rowY -= 32;
      p.drawRect(44, rowY, 507, 32, [1, 1, 1], [0.85, 0.88, 0.92], 0.6);
      p.drawText('No orders recorded yet.', 240, rowY + 12, 9, 'F1', [0.45, 0.5, 0.58]);
    } else {
      chunk.forEach((ord, idx) => {
        const rh = 30;
        rowY -= rh;
        const bg: [number, number, number] = idx % 2 === 0 ? [1, 1, 1] : [0.976, 0.984, 0.992];
        p.drawRect(44, rowY, 507, rh, bg, [0.85, 0.88, 0.92], 0.5);

        const dateStr = ord.createdAt
          ? new Date(ord.createdAt).toISOString().slice(0, 10)
          : reportDate;

        p.drawText((ord.orderNumber || '').slice(0, 15), 52, rowY + 11, 8, 'F2', [0.043, 0.098, 0.173]);
        p.drawText(dateStr, 132, rowY + 11, 8, 'F1', [0.35, 0.4, 0.48]);
        p.drawText((ord.customerName || 'Client').slice(0, 21), 190, rowY + 15, 8, 'F2', [0.043, 0.098, 0.173]);
        p.drawText((ord.customerEmail || '').slice(0, 24), 190, rowY + 5, 7, 'F1', [0.45, 0.5, 0.58]);
        p.drawText((ord.paymentMethod || '').toUpperCase().slice(0, 12), 305, rowY + 15, 7.5, 'F2', [0.118, 0.251, 0.686]);
        p.drawText((ord.paymentStatus || '').toUpperCase().slice(0, 12), 305, rowY + 5, 6.8, 'F1', [0.35, 0.4, 0.48]);
        p.drawText((ord.orderStatus || '').slice(0, 20), 375, rowY + 11, 7.5, 'F1', [0.043, 0.098, 0.173]);
        p.drawText(formatNgnPdf(ord.totalNgn), 475, rowY + 11, 8, 'F2', [0.043, 0.098, 0.173]);
      });
    }

    p.drawText(
      `VISION CARE Optical Atelier Executive Operations Console - Confidential PDF Sales Report (${reportDate})`,
      95,
      42,
      8,
      'F1',
      [0.45, 0.5, 0.58]
    );

    pages.push(p);
  }

  buildAndDownloadMultiPagePdf(pages, `VisionCare_Sales_Report_${reportDate}.pdf`);
}

/**
 * Generates an official Doctor's Ophthalmic Medical & Drug Prescription (Rx) in PDF format.
 */
export function exportDrugPrescriptionToPdf(appointment: ClinicalAppointmentRecord): void {
  const p = new PdfPageBuilder();

  // Outer Frame Border
  p.drawRect(28, 28, 539, 786, [1, 1, 1], [0.043, 0.098, 0.173], 1.5);

  // Header Banner (#0B192C)
  p.drawRect(28, 720, 539, 94, [0.043, 0.098, 0.173]);
  p.drawRect(28, 716, 539, 4, [0.773, 0.627, 0.349]);

  p.drawText('VISION CARE — CLINICAL OPHTHALMOLOGY & OPTOMETRY', 44, 786, 13.5, 'F2', [1, 1, 1]);
  p.drawText(
    'OFFICIAL MEDICAL CONSULTATION & OPHTHALMIC DRUG PRESCRIPTION (Rx)',
    44,
    767,
    9,
    'F2',
    [0.773, 0.627, 0.349]
  );
  p.drawText(
    `Attending Physician: ${appointment.doctorName || 'Dr. Austine Ezeh, OD'} (${appointment.doctorCredentials || 'Consultant Eye Physician'})`,
    44,
    750,
    8.5,
    'F1',
    [0.85, 0.91, 0.98]
  );
  p.drawText(
    `License / Reg #: ${appointment.doctorLicenseNumber || 'ODORBN/NG/4829'} | Victoria Island, Lagos & Maitama, Abuja`,
    44,
    734,
    8,
    'F1',
    [0.85, 0.91, 0.98]
  );

  // Right side of header
  p.drawText(`APPT / Rx #: ${appointment.appointmentNumber}`, 390, 786, 9.5, 'F2', [1, 1, 1]);
  const issueDate = (appointment.prescriptionIssuedAt || appointment.createdAt || new Date().toISOString()).slice(0, 10);
  p.drawText(`Date Issued: ${issueDate}`, 390, 768, 8.5, 'F1', [0.85, 0.91, 0.98]);
  p.drawText(
    `Total Fee: ${formatNgnPdf(appointment.totalChargeNgn || 0)} (${(appointment.paymentStatus || 'BILLED').toUpperCase()})`,
    390,
    750,
    8,
    'F2',
    [0.773, 0.627, 0.349]
  );
  p.drawText(
    `Urgency: ${(appointment.urgencyLevel || 'Routine').toUpperCase()}`,
    390,
    734,
    8,
    'F1',
    [0.85, 0.91, 0.98]
  );

  // Section 1: Patient Personal Data & Clinical Complaint
  p.drawRect(44, 594, 507, 108, [0.973, 0.98, 0.988], [0.85, 0.88, 0.92], 0.8);
  p.drawText('PATIENT PERSONAL DATA', 56, 686, 9, 'F2', [0.118, 0.251, 0.686]);
  p.drawText('OCULAR COMPLAINT & CLINICAL FINDINGS', 295, 686, 9, 'F2', [0.118, 0.251, 0.686]);
  p.drawLine(56, 679, 539, 679, [0.85, 0.88, 0.92], 0.6);

  p.drawText('Patient Name:', 56, 663, 8, 'F2', [0.35, 0.4, 0.48]);
  p.drawText((appointment.patientName || 'Patient').slice(0, 28), 122, 663, 8.5, 'F2', [0.043, 0.098, 0.173]);

  p.drawText('Age / Gender:', 56, 648, 8, 'F2', [0.35, 0.4, 0.48]);
  p.drawText(
    `${appointment.patientAge || 'Adult'} yrs / ${appointment.patientGender || 'Not specified'} (${appointment.patientOccupation || 'Client'})`.slice(0, 32),
    122,
    648,
    8,
    'F1',
    [0.043, 0.098, 0.173]
  );

  p.drawText('Phone / Email:', 56, 633, 8, 'F2', [0.35, 0.4, 0.48]);
  p.drawText(
    `${appointment.patientPhone || ''} | ${appointment.patientEmail || ''}`.slice(0, 34),
    122,
    633,
    7.8,
    'F1',
    [0.043, 0.098, 0.173]
  );

  p.drawText('Address:', 56, 618, 8, 'F2', [0.35, 0.4, 0.48]);
  p.drawText((appointment.patientAddress || 'Nigeria').slice(0, 34), 122, 618, 7.8, 'F1', [0.043, 0.098, 0.173]);

  p.drawText('Allergies/Hx:', 56, 603, 8, 'F2', [0.35, 0.4, 0.48]);
  p.drawText(
    (appointment.medicalHistoryAndAllergies || 'None reported').slice(0, 34),
    122,
    603,
    7.8,
    'F1',
    [0.043, 0.098, 0.173]
  );

  // Right side: Complaint & Diagnosis
  p.drawText('Category:', 295, 663, 8, 'F2', [0.35, 0.4, 0.48]);
  p.drawText((appointment.complaintCategory || 'Eye Complaint').slice(0, 34), 352, 663, 8, 'F2', [0.043, 0.098, 0.173]);

  p.drawText('Affected Eye:', 295, 648, 8, 'F2', [0.35, 0.4, 0.48]);
  p.drawText(
    `${appointment.affectedEye || 'Both Eyes (OU)'} | Duration: ${appointment.symptomDuration || 'Recent'}`.slice(0, 36),
    352,
    648,
    8,
    'F1',
    [0.043, 0.098, 0.173]
  );

  p.drawText('Complaint:', 295, 633, 8, 'F2', [0.35, 0.4, 0.48]);
  p.drawText((appointment.complaintDescription || '').slice(0, 38), 352, 633, 7.8, 'F1', [0.043, 0.098, 0.173]);
  if ((appointment.complaintDescription || '').length > 38) {
    p.drawText((appointment.complaintDescription || '').slice(38, 78), 352, 621, 7.8, 'F1', [0.043, 0.098, 0.173]);
  }

  p.drawText('Diagnosis:', 295, 603, 8, 'F2', [0.118, 0.251, 0.686]);
  p.drawText(
    (appointment.clinicalDiagnosis || 'Clinical Ophthalmic Assessment Completed').slice(0, 36),
    352,
    603,
    8.2,
    'F2',
    [0.118, 0.251, 0.686]
  );

  // Section 2: Prescribed Medications (Rx) Table
  p.drawText('Rx — PRESCRIBED OPHTHALMIC & MEDICAL DRUGS', 44, 574, 10.5, 'F2', [0.043, 0.098, 0.173]);
  p.drawRect(44, 546, 507, 22, [0.043, 0.098, 0.173]);
  p.drawText('#', 52, 554, 8, 'F2', [1, 1, 1]);
  p.drawText('MEDICATION NAME & CATEGORY', 68, 554, 8, 'F2', [1, 1, 1]);
  p.drawText('ROUTE / EYE', 248, 554, 8, 'F2', [1, 1, 1]);
  p.drawText('DOSAGE & FREQUENCY', 330, 554, 8, 'F2', [1, 1, 1]);
  p.drawText('DURATION', 485, 554, 8, 'F2', [1, 1, 1]);

  let currentY = 546;
  const drugs = Array.isArray(appointment.prescribedDrugs) ? appointment.prescribedDrugs.slice(0, 6) : [];

  if (drugs.length === 0) {
    currentY -= 38;
    p.drawRect(44, currentY, 507, 38, [1, 1, 1], [0.85, 0.88, 0.92], 0.6);
    p.drawText(
      'Doctor review in progress. Prescribed medications will appear here once finalized.',
      68,
      currentY + 15,
      8.5,
      'F1',
      [0.4, 0.45, 0.52]
    );
  } else {
    drugs.forEach((drug, idx) => {
      const rh = 44;
      currentY -= rh;
      const bg: [number, number, number] = idx % 2 === 0 ? [1, 1, 1] : [0.976, 0.984, 0.992];
      p.drawRect(44, currentY, 507, rh, bg, [0.85, 0.88, 0.92], 0.6);

      p.drawText(String(idx + 1), 52, currentY + 26, 8.5, 'F2', [0.043, 0.098, 0.173]);
      p.drawText((drug.drugName || 'Ophthalmic Medication').slice(0, 34), 68, currentY + 28, 8.5, 'F2', [0.043, 0.098, 0.173]);
      p.drawText((drug.category || 'Ophthalmic Rx').slice(0, 34), 68, currentY + 17, 7.5, 'F1', [0.118, 0.251, 0.686]);
      p.drawText(
        `Instructions: ${(drug.instructions || 'Use strictly as directed by the Doctor.').slice(0, 78)}`,
        68,
        currentY + 6,
        7.2,
        'F1',
        [0.35, 0.4, 0.48]
      );

      p.drawText((drug.route || 'Both Eyes (OU)').slice(0, 16), 248, currentY + 24, 8, 'F2', [0.043, 0.098, 0.173]);
      p.drawText(
        `${drug.dosage || '1 Drop'} - ${drug.frequency || 'TDS'}`.slice(0, 29),
        330,
        currentY + 24,
        8,
        'F1',
        [0.043, 0.098, 0.173]
      );
      p.drawText((drug.duration || '7 Days').slice(0, 12), 485, currentY + 24, 8, 'F2', [0.043, 0.098, 0.173]);
    });
  }

  // Section 3: Doctor's Clinical Advice & Complaint-Based Charge Breakdown
  const bottomTopY = Math.min(currentY - 14, 268);

  // Left Box: Doctor's Clinical Instructions & Follow-Up
  p.drawRect(44, bottomTopY - 104, 285, 104, [0.973, 0.98, 0.988], [0.85, 0.88, 0.92], 0.8);
  p.drawText("DOCTOR'S CLINICAL ADVICE & CARE INSTRUCTIONS", 56, bottomTopY - 18, 8.5, 'F2', [0.043, 0.098, 0.173]);
  const advice =
    appointment.clinicalNotesAndAdvice ||
    'Avoid rubbing the eyes. Wash hands thoroughly before instilling eye drops. Complete the full course of prescribed therapy.';
  p.drawText(advice.slice(0, 52), 56, bottomTopY - 34, 7.8, 'F1', [0.25, 0.3, 0.38]);
  p.drawText(advice.slice(52, 104), 56, bottomTopY - 46, 7.8, 'F1', [0.25, 0.3, 0.38]);
  p.drawText(advice.slice(104, 156), 56, bottomTopY - 58, 7.8, 'F1', [0.25, 0.3, 0.38]);

  p.drawLine(56, bottomTopY - 68, 317, bottomTopY - 68, [0.85, 0.88, 0.92], 0.6);
  p.drawText(
    `Next Follow-Up Date: ${appointment.followUpDate || '7 Days Post-Treatment / As Needed'}`,
    56,
    bottomTopY - 82,
    8,
    'F2',
    [0.118, 0.251, 0.686]
  );
  p.drawText(
    `Signed: ${appointment.doctorName || 'Dr. Austine Ezeh, OD'} (Verified Digital Rx Stamp)`,
    56,
    bottomTopY - 95,
    7.8,
    'F2',
    [0.043, 0.098, 0.173]
  );

  // Right Box: Complaint-Based Charge Breakdown
  p.drawRect(340, bottomTopY - 104, 211, 104, [1, 1, 1], [0.043, 0.098, 0.173], 0.9);
  p.drawText('COMPLAINT & CONSULTATION BILL', 352, bottomTopY - 18, 8.5, 'F2', [0.043, 0.098, 0.173]);
  p.drawText('Consultation Fee:', 352, bottomTopY - 36, 8, 'F1', [0.35, 0.4, 0.48]);
  p.drawText(formatNgnPdf(appointment.consultationFeeNgn || 0), 460, bottomTopY - 36, 8, 'F2', [0.043, 0.098, 0.173]);

  p.drawText('Complaint / Treatment:', 352, bottomTopY - 52, 8, 'F1', [0.35, 0.4, 0.48]);
  p.drawText(formatNgnPdf(appointment.treatmentFeeNgn || 0), 460, bottomTopY - 52, 8, 'F2', [0.043, 0.098, 0.173]);

  p.drawLine(352, bottomTopY - 62, 539, bottomTopY - 62, [0.773, 0.627, 0.349], 1);
  p.drawText('TOTAL CHARGE:', 352, bottomTopY - 78, 9, 'F2', [0.043, 0.098, 0.173]);
  p.drawText(formatNgnPdf(appointment.totalChargeNgn || 0), 452, bottomTopY - 78, 9.5, 'F2', [0.118, 0.251, 0.686]);

  p.drawText(
    `Status: ${(appointment.paymentStatus || 'BILLED').toUpperCase()} ${(appointment.chargeReasonNote || '').slice(0, 20)}`,
    352,
    bottomTopY - 94,
    7.2,
    'F1',
    [0.35, 0.4, 0.48]
  );

  // Footer
  p.drawText(
    `Official Ophthalmic Drug Prescription (Rx) issued by VISION CARE Clinic on ${issueDate} — Present at any registered pharmacy.`,
    68,
    42,
    8,
    'F1',
    [0.45, 0.5, 0.58]
  );

  buildAndDownloadMultiPagePdf(
    [p],
    `VisionCare_Drug_Prescription_${appointment.appointmentNumber}.pdf`
  );
}

/**
 * Triggers direct browser printing of the official Doctor's Ophthalmic Drug Prescription (Rx)
 * using an embedded print iframe (no window.open popup required).
 */
export function printDrugPrescriptionSlip(appointment: ClinicalAppointmentRecord): void {
  const existingFrame = document.getElementById('vc-rx-print-iframe') as HTMLIFrameElement | null;
  if (existingFrame && existingFrame.parentNode) {
    existingFrame.parentNode.removeChild(existingFrame);
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'vc-rx-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const issueDate = (appointment.prescriptionIssuedAt || appointment.createdAt || new Date().toISOString()).slice(0, 10);
  const drugs = Array.isArray(appointment.prescribedDrugs) ? appointment.prescribedDrugs : [];

  const rowsHtml =
    drugs.length === 0
      ? `<tr><td colspan="6" style="padding:14px;text-align:center;color:#64748b;">Awaiting Doctor's medication entry.</td></tr>`
      : drugs
          .map(
            (d, i) => `
          <tr>
            <td style="padding:10px;border:1px solid #cbd5e1;font-weight:700;">${i + 1}</td>
            <td style="padding:10px;border:1px solid #cbd5e1;">
              <div style="font-weight:700;color:#0B192C;">${d.drugName}</div>
              <div style="font-size:11px;color:#1E40AF;">${d.category || 'Ophthalmic Medication'}</div>
            </td>
            <td style="padding:10px;border:1px solid #cbd5e1;font-weight:600;">${d.route}</td>
            <td style="padding:10px;border:1px solid #cbd5e1;">${d.dosage} · ${d.frequency}</td>
            <td style="padding:10px;border:1px solid #cbd5e1;font-weight:600;">${d.duration}</td>
            <td style="padding:10px;border:1px solid #cbd5e1;font-size:11px;">${d.instructions}</td>
          </tr>`
          )
          .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Drug Prescription - ${appointment.appointmentNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0B192C; margin: 24px; }
    .header { background: #0B192C; color: #ffffff; padding: 20px 24px; border-bottom: 4px solid #C5A059; display: flex; justify-content: space-between; align-items: flex-start; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
    .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; background: #f8fafc; font-size: 12px; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    th { background: #0B192C; color: #ffffff; text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; }
    .footer { margin-top: 24px; border-top: 1px solid #cbd5e1; padding-top: 12px; display: flex; justify-content: space-between; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div style="font-size:18px;font-weight:800;letter-spacing:0.04em;">VISION CARE — CLINICAL EYE CLINIC</div>
      <div style="font-size:12px;color:#C5A059;font-weight:700;margin-top:4px;">OFFICIAL OPHTHALMIC MEDICAL & DRUG PRESCRIPTION (Rx)</div>
      <div style="font-size:11px;color:#e2e8f0;margin-top:4px;">${appointment.doctorName || 'Dr. Austine Ezeh, OD'} (${appointment.doctorCredentials || 'Consultant Eye Physician'}) · Reg: ${appointment.doctorLicenseNumber || 'ODORBN/NG/4829'}</div>
    </div>
    <div style="text-align:right;font-size:12px;">
      <div style="font-weight:700;">Rx Ref: ${appointment.appointmentNumber}</div>
      <div>Date: ${issueDate}</div>
      <div style="color:#C5A059;font-weight:700;">Total Charge: NGN ${Number(appointment.totalChargeNgn || 0).toLocaleString()} (${(appointment.paymentStatus || '').toUpperCase()})</div>
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <div style="font-weight:700;color:#1E40AF;margin-bottom:6px;text-transform:uppercase;font-size:11px;">Patient Personal Data</div>
      <div><strong>Name:</strong> ${appointment.patientName} (${appointment.patientAge || 'Adult'} yrs, ${appointment.patientGender || ''})</div>
      <div><strong>Phone / Email:</strong> ${appointment.patientPhone} · ${appointment.patientEmail}</div>
      <div><strong>Occupation / Address:</strong> ${appointment.patientOccupation || 'N/A'} · ${appointment.patientAddress || ''}</div>
      <div><strong>Medical History / Allergies:</strong> ${appointment.medicalHistoryAndAllergies || 'None reported'}</div>
    </div>
    <div class="box">
      <div style="font-weight:700;color:#1E40AF;margin-bottom:6px;text-transform:uppercase;font-size:11px;">Eye Complaint & Clinical Diagnosis</div>
      <div><strong>Complaint Category:</strong> ${appointment.complaintCategory} (${appointment.affectedEye}, ${appointment.symptomDuration})</div>
      <div><strong>Patient Complaint:</strong> ${appointment.complaintDescription}</div>
      <div style="margin-top:6px;color:#1E40AF;"><strong>Clinical Diagnosis:</strong> ${appointment.clinicalDiagnosis || 'Assessed by Attending Doctor'}</div>
    </div>
  </div>

  <h3 style="margin-top:20px;margin-bottom:6px;font-size:14px;text-transform:uppercase;">℞ Prescribed Ophthalmic & Medical Medications</h3>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Medication & Category</th>
        <th>Route / Eye</th>
        <th>Dosage & Frequency</th>
        <th>Duration</th>
        <th>Clinical Instructions</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="grid">
    <div class="box">
      <div style="font-weight:700;color:#0B192C;margin-bottom:4px;">Doctor's Clinical Advice & Precautions</div>
      <div>${appointment.clinicalNotesAndAdvice || 'Use medications strictly as prescribed. Avoid touching dropper tip to the eye or eyelashes.'}</div>
      <div style="margin-top:8px;font-weight:700;color:#1E40AF;">Follow-Up Appointment: ${appointment.followUpDate || '7 Days Post-Treatment'}</div>
    </div>
    <div class="box">
      <div style="font-weight:700;color:#0B192C;margin-bottom:4px;">Complaint-Based Consultation & Treatment Bill</div>
      <div>Consultation Fee: <strong>NGN ${Number(appointment.consultationFeeNgn || 0).toLocaleString()}</strong></div>
      <div>Complaint / Treatment Fee: <strong>NGN ${Number(appointment.treatmentFeeNgn || 0).toLocaleString()}</strong></div>
      <div style="font-size:14px;font-weight:800;color:#1E40AF;margin-top:4px;">Total Billed: NGN ${Number(appointment.totalChargeNgn || 0).toLocaleString()}</div>
      <div style="font-size:11px;color:#475569;margin-top:4px;">${appointment.chargeReasonNote || ''}</div>
    </div>
  </div>

  <div class="footer">
    <div><strong>Attending Doctor Signature:</strong> ${appointment.doctorName || 'Dr. Austine Ezeh, OD'} (${appointment.doctorLicenseNumber || 'ODORBN/NG/4829'})</div>
    <div>VISION CARE Optical Atelier & Eye Clinic · Victoria Island, Lagos & Maitama, Abuja</div>
  </div>
</body>
</html>`;

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 250);
  }
}

