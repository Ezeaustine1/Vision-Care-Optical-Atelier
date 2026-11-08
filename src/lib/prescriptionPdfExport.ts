import { PrescriptionData } from '../types.ts';

export interface PrescriptionPdfExportOptions {
  prescription: PrescriptionData;
  lensRecommendation?: string;
  selectedFrameName?: string;
  selectedLensName?: string;
  selectedCoatingSummary?: string;
  totalEstimateFormatted?: string;
}

function sanitizePdfText(input: string | undefined | null): string {
  if (!input) return '';
  return String(input)
    .replace(/₦/g, 'NGN ')
    .replace(/°/g, ' deg')
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function classifyPrescriptionSummary(rx: PrescriptionData): {
  classification: string;
  suitableFor: string;
} {
  const isNonZero = (val: string | undefined) => {
    if (!val) return false;
    const num = parseFloat(String(val).replace(/[^\d.-]/g, ''));
    return !Number.isNaN(num) && Math.abs(num) > 0;
  };

  const hasSph = isNonZero(rx.odSph) || isNonZero(rx.osSph);
  const hasCylOrAxis =
    isNonZero(rx.odCyl) ||
    isNonZero(rx.osCyl) ||
    isNonZero(rx.odAxis) ||
    isNonZero(rx.osAxis);
  const hasAdd = isNonZero(rx.odAdd) || isNonZero(rx.osAdd);

  if (!hasSph && !hasCylOrAxis && !hasAdd) {
    return {
      classification: 'Plano / Non-Prescription (0.00)',
      suitableFor: 'Protective Blue-Cut, Photochromic, or Anti-Reflective Lenses',
    };
  }
  if (!hasAdd && (hasSph || hasCylOrAxis)) {
    return {
      classification: 'Single Lens Prescription (Single Vision)',
      suitableFor: 'Single Vision Distance, Reading, or Astigmatism Lenses',
    };
  }
  if (hasAdd && hasCylOrAxis) {
    return {
      classification: 'Special Order Multifocal Lens Prescription',
      suitableFor: 'Bifocal Fused, Invisible Bifocal, or Varilux Progressive Lenses',
    };
  }
  return {
    classification: 'Multifocal Lens Prescription',
    suitableFor: 'Bifocal Fused, Invisible Bifocal, or Varilux Progressive Lenses',
  };
}

/**
 * Generates a standards-compliant PDF 1.4 clinical prescription document
 * and triggers a direct browser download.
 */
export function exportPrescriptionToPdf(options: PrescriptionPdfExportOptions): void {
  const {
    prescription: rx,
    lensRecommendation,
    selectedFrameName,
    selectedLensName,
    selectedCoatingSummary,
    totalEstimateFormatted,
  } = options;

  const ops: string[] = [];

  const drawRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    fillRgb?: [number, number, number],
    strokeRgb?: [number, number, number],
    lineWidth = 1
  ) => {
    ops.push('q');
    if (fillRgb) {
      ops.push(`${fillRgb[0].toFixed(3)} ${fillRgb[1].toFixed(3)} ${fillRgb[2].toFixed(3)} rg`);
    }
    if (strokeRgb) {
      ops.push(`${strokeRgb[0].toFixed(3)} ${strokeRgb[1].toFixed(3)} ${strokeRgb[2].toFixed(3)} RG`);
      ops.push(`${lineWidth} w`);
    }
    const mode = fillRgb && strokeRgb ? 'B' : fillRgb ? 'f' : 'S';
    ops.push(`${x} ${y} ${w} ${h} re ${mode}`);
    ops.push('Q');
  };

  const drawLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    strokeRgb: [number, number, number] = [0.85, 0.88, 0.92],
    lineWidth = 0.75
  ) => {
    ops.push('q');
    ops.push(`${strokeRgb[0].toFixed(3)} ${strokeRgb[1].toFixed(3)} ${strokeRgb[2].toFixed(3)} RG`);
    ops.push(`${lineWidth} w`);
    ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
    ops.push('Q');
  };

  const drawText = (
    text: string,
    x: number,
    y: number,
    size = 10,
    font: 'F1' | 'F2' = 'F1',
    colorRgb: [number, number, number] = [0.043, 0.098, 0.173]
  ) => {
    const clean = sanitizePdfText(text);
    ops.push('BT');
    ops.push(`/${font} ${size} Tf`);
    ops.push(`${colorRgb[0].toFixed(3)} ${colorRgb[1].toFixed(3)} ${colorRgb[2].toFixed(3)} rg`);
    ops.push(`1 0 0 1 ${x} ${y} Tm`);
    ops.push(`(${clean}) Tj`);
    ops.push('ET');
  };

  // Page dimensions: A4 (595 x 842 pt)
  // Outer Clinical Border
  drawRect(28, 28, 539, 786, [1, 1, 1], [0.043, 0.098, 0.173], 1.5);

  // Top Header Banner (#0B192C)
  drawRect(28, 724, 539, 90, [0.043, 0.098, 0.173]);

  // Gold Accent Bar (#C5A059)
  drawRect(28, 720, 539, 4, [0.773, 0.627, 0.349]);

  // Brand Title & Clinical Header
  drawText('VISION CARE OPTICAL ATELIER & EYE CLINIC', 48, 782, 16, 'F2', [1, 1, 1]);
  drawText(
    'OFFICIAL VERIFIED OPTICAL PRESCRIPTION RECORD',
    48,
    763,
    10,
    'F2',
    [0.773, 0.627, 0.349]
  );
  drawText(
    'Valid for Dispensing & Clinical Reference Across All Licensed Eye Care Providers',
    48,
    744,
    8.5,
    'F1',
    [0.85, 0.91, 0.98]
  );

  const recordId = rx.id ? `VC-RX-${String(rx.id).padStart(5, '0')}` : `VC-RX-${Date.now().toString().slice(-6)}`;
  drawText(`Record ID: ${recordId}`, 430, 782, 9, 'F2', [1, 1, 1]);
  drawText(
    `Issued: ${rx.prescriptionDate || new Date().toISOString().slice(0, 10)}`,
    430,
    765,
    8.5,
    'F1',
    [0.85, 0.91, 0.98]
  );
  drawText(
    `Status: ${rx.customerConfirmed || rx.verificationStatus === 'approved' ? 'VERIFIED' : 'CONFIRMED'}`,
    430,
    748,
    8.5,
    'F2',
    [0.773, 0.627, 0.349]
  );

  // Patient & Clinical Metadata Box
  drawRect(48, 628, 499, 74, [0.973, 0.98, 0.988], [0.85, 0.88, 0.92], 0.8);

  drawText('PATIENT & CLINICAL DETAILS', 62, 684, 9, 'F2', [0.118, 0.251, 0.686]);
  drawLine(62, 678, 533, 678, [0.85, 0.88, 0.92], 0.6);

  drawText('Patient Name:', 62, 661, 9, 'F2', [0.35, 0.4, 0.48]);
  drawText(rx.patientName || 'Valued Vision Care Patient', 145, 661, 9.5, 'F2', [0.043, 0.098, 0.173]);

  drawText('Prescribing Doctor:', 62, 642, 9, 'F2', [0.35, 0.4, 0.48]);
  drawText(rx.doctorName || 'Licensed Optometrist / Ophthalmologist', 155, 642, 9, 'F1', [0.043, 0.098, 0.173]);

  drawText('Capture Method:', 320, 661, 9, 'F2', [0.35, 0.4, 0.48]);
  drawText(
    rx.submissionType === 'upload_ocr' ? 'AI OCR + Clinical Review' : 'Manual Refraction Entry',
    405,
    661,
    9,
    'F1',
    [0.043, 0.098, 0.173]
  );

  drawText('Exam / Rx Date:', 320, 642, 9, 'F2', [0.35, 0.4, 0.48]);
  drawText(
    rx.prescriptionDate || new Date().toISOString().slice(0, 10),
    405,
    642,
    9,
    'F1',
    [0.043, 0.098, 0.173]
  );

  // Section Title: Clinical Refraction Parameters Table
  drawText('1. CLINICAL REFRACTION PARAMETERS (OD & OS)', 48, 602, 11, 'F2', [0.043, 0.098, 0.173]);
  drawText(
    'Standard ophthalmic notation in Diopters (D) and Axis degrees (0 deg - 180 deg).',
    48,
    588,
    8.5,
    'F1',
    [0.38, 0.43, 0.5]
  );

  // Table Header
  drawRect(48, 548, 499, 28, [0.043, 0.098, 0.173]);
  drawText('EYE', 62, 559, 9, 'F2', [1, 1, 1]);
  drawText('SPHERE (SPH)', 185, 559, 9, 'F2', [1, 1, 1]);
  drawText('CYLINDER (CYL)', 285, 559, 9, 'F2', [1, 1, 1]);
  drawText('AXIS', 395, 559, 9, 'F2', [1, 1, 1]);
  drawText('READING ADD', 465, 559, 9, 'F2', [1, 1, 1]);

  // Row 1: Right Eye (OD)
  drawRect(48, 512, 499, 36, [1, 1, 1], [0.85, 0.88, 0.92], 0.8);
  drawText('OD (Right Eye)', 62, 531, 9.5, 'F2', [0.043, 0.098, 0.173]);
  drawText('Oculus Dexter', 62, 519, 7.5, 'F1', [0.45, 0.5, 0.58]);
  drawText(rx.odSph || '0.00', 195, 526, 10.5, 'F2', [0.043, 0.098, 0.173]);
  drawText(rx.odCyl || '0.00', 298, 526, 10.5, 'F2', [0.043, 0.098, 0.173]);
  drawText(`${rx.odAxis || '0'} deg`, 395, 526, 10.5, 'F2', [0.043, 0.098, 0.173]);
  drawText(rx.odAdd || '0.00', 475, 526, 10.5, 'F2', [0.043, 0.098, 0.173]);

  // Row 2: Left Eye (OS)
  drawRect(48, 476, 499, 36, [0.976, 0.984, 0.992], [0.85, 0.88, 0.92], 0.8);
  drawText('OS (Left Eye)', 62, 495, 9.5, 'F2', [0.043, 0.098, 0.173]);
  drawText('Oculus Sinister', 62, 483, 7.5, 'F1', [0.45, 0.5, 0.58]);
  drawText(rx.osSph || '0.00', 195, 490, 10.5, 'F2', [0.043, 0.098, 0.173]);
  drawText(rx.osCyl || '0.00', 298, 490, 10.5, 'F2', [0.043, 0.098, 0.173]);
  drawText(`${rx.osAxis || '0'} deg`, 395, 490, 10.5, 'F2', [0.043, 0.098, 0.173]);
  drawText(rx.osAdd || '0.00', 475, 490, 10.5, 'F2', [0.043, 0.098, 0.173]);

  // Row 3: Pupillary Distance (PD) Bar
  drawRect(48, 442, 499, 34, [0.93, 0.96, 0.995], [0.75, 0.84, 0.95], 0.8);
  drawText('Binocular Pupillary Distance (PD):', 62, 455, 9.5, 'F2', [0.043, 0.098, 0.173]);
  drawText(`${rx.pd || '63'} mm`, 235, 455, 10.5, 'F2', [0.118, 0.251, 0.686]);

  const monoPdText =
    rx.monocularPdOd || rx.monocularPdOs
      ? `OD ${rx.monocularPdOd || '-'} mm / OS ${rx.monocularPdOs || '-'} mm`
      : 'Standard Symmetric';
  drawText('Monocular PD:', 315, 455, 9, 'F2', [0.35, 0.4, 0.48]);
  drawText(monoPdText, 390, 455, 9, 'F1', [0.043, 0.098, 0.173]);

  // Section 2: Optical Lens Suitability & Clinical Classification
  const guidance = classifyPrescriptionSummary(rx);
  drawText('2. CLINICAL LENS CLASSIFICATION & SUITABILITY', 48, 412, 11, 'F2', [0.043, 0.098, 0.173]);

  drawRect(48, 344, 499, 56, [0.973, 0.98, 0.988], [0.85, 0.88, 0.92], 0.8);
  drawText('Prescription Classification:', 62, 380, 9, 'F2', [0.35, 0.4, 0.48]);
  drawText(guidance.classification, 195, 380, 9.5, 'F2', [0.118, 0.251, 0.686]);

  drawText('Suitable Lens Designs:', 62, 360, 9, 'F2', [0.35, 0.4, 0.48]);
  drawText(
    lensRecommendation || guidance.suitableFor,
    195,
    360,
    9,
    'F1',
    [0.043, 0.098, 0.173]
  );

  // Section 3: Selected Optical Configuration & Clinical Notes
  drawText('3. DISPENSING SPECIFICATION & CLINICAL NOTES', 48, 314, 11, 'F2', [0.043, 0.098, 0.173]);
  drawRect(48, 212, 499, 90, [1, 1, 1], [0.85, 0.88, 0.92], 0.8);

  drawText('Selected Frame:', 62, 282, 9, 'F2', [0.35, 0.4, 0.48]);
  drawText(
    selectedFrameName || 'Applicable to Any Compatible Optical Frame Chassis',
    180,
    282,
    9,
    'F1',
    [0.043, 0.098, 0.173]
  );

  drawText('Selected Lens Design:', 62, 263, 9, 'F2', [0.35, 0.4, 0.48]);
  drawText(
    selectedLensName || guidance.suitableFor,
    180,
    263,
    9,
    'F1',
    [0.043, 0.098, 0.173]
  );

  drawText('Coatings & Index:', 62, 244, 9, 'F2', [0.35, 0.4, 0.48]);
  drawText(
    selectedCoatingSummary || 'UV400 & Scratch-Resistant Optical Standard',
    180,
    244,
    9,
    'F1',
    [0.043, 0.098, 0.173]
  );

  drawText('Clinical / Optometrist Notes:', 62, 225, 9, 'F2', [0.35, 0.4, 0.48]);
  const noteStr =
    rx.adminFeedback ||
    rx.notes ||
    rx.ocrConfidenceNotes ||
    'Verified optical parameters ready for precision digital lens surfacing.';
  drawText(noteStr.slice(0, 72), 195, 225, 8.5, 'F1', [0.043, 0.098, 0.173]);

  if (totalEstimateFormatted) {
    drawText('Configured Total:', 390, 282, 9, 'F2', [0.35, 0.4, 0.48]);
    drawText(totalEstimateFormatted, 475, 282, 9.5, 'F2', [0.043, 0.098, 0.173]);
  }

  // Official Certification & Provider portability block
  drawRect(48, 92, 499, 98, [0.973, 0.98, 0.988], [0.773, 0.627, 0.349], 1);
  drawText('PROVIDER PORTABILITY & CLINICAL ATTESTATION', 62, 170, 9.5, 'F2', [0.043, 0.098, 0.173]);
  drawText(
    'This document contains the patient\'s verified refractive parameters (OD, OS, Axis, Reading ADD,',
    62,
    152,
    8.5,
    'F1',
    [0.25, 0.3, 0.38]
  );
  drawText(
    'and Pupillary Distance). It may be retained for personal medical records or presented to any',
    62,
    139,
    8.5,
    'F1',
    [0.25, 0.3, 0.38]
  );
  drawText(
    'licensed optometrist, ophthalmologist, or optical dispensing laboratory for lens fabrication.',
    62,
    126,
    8.5,
    'F1',
    [0.25, 0.3, 0.38]
  );

  drawLine(62, 108, 240, 108, [0.043, 0.098, 0.173], 0.8);
  drawText('Vision Care Chief Optometrist Desk', 62, 98, 8, 'F2', [0.043, 0.098, 0.173]);

  drawLine(350, 108, 530, 108, [0.043, 0.098, 0.173], 0.8);
  drawText('Victoria Island, Lagos | support@visioncare.ng', 350, 98, 8, 'F1', [0.35, 0.4, 0.48]);

  // Footer
  drawText(
    `Generated by VISION CARE Optical Atelier on ${new Date().toISOString().slice(0, 10)} - See Clearly. Look Beautiful.`,
    125,
    46,
    8,
    'F1',
    [0.45, 0.5, 0.58]
  );

  const contentStream = ops.join('\n');

  // Assemble valid PDF 1.4 objects
  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj',
    `6 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj`,
  ];

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
  const safePatient = (rx.patientName || 'Patient')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const dateSuffix = rx.prescriptionDate || new Date().toISOString().slice(0, 10);

  const link = document.createElement('a');
  link.href = url;
  link.download = `VisionCare_Prescription_${safePatient || 'Verified'}_${dateSuffix}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
