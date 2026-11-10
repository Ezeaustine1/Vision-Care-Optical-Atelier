import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

export interface OrderEmailItem {
  productName: string;
  productBrand?: string;
  productImage?: string;
  orderType?: string;
  selectedColor?: string;
  quantity: number;
  framePriceNgn?: number;
  lensTypeName?: string;
  lensOptionSelected?: string;
  lensPriceNgn?: number;
  coatingSummary?: string;
  coatingPriceNgn?: number;
  prescriptionSnapshotJson?: string;
  unitTotalNgn: number;
}

export interface OutboundEmailPayload {
  toEmail: string;
  toName?: string;
  subject: string;
  bodyText: string;
  category?: string;
  orderNumber?: string;
  trackingUrl?: string;
  orderDetails?: {
    orderId?: number;
    orderNumber: string;
    orderStatus: string;
    paymentMethod: string;
    paymentReference: string;
    paymentStatus: string;
    subtotalNgn: number;
    deliveryFeeNgn: number;
    discountNgn: number;
    totalNgn: number;
    deliveryAddress: string;
    deliveryCity: string;
    deliveryState: string;
    deliveryMethod?: string;
    customerPhone: string;
    createdAt?: string;
    items: OrderEmailItem[];
  };
  siteConfig?: Record<string, any>;
}

export interface OutboundEmailResult {
  deliveredViaSmtp: boolean;
  provider: 'smtp' | 'gmail_relay_ready';
  toEmail: string;
  fromEmail: string;
  subject: string;
  sentAt: string;
  gmailComposeUrl: string;
  mailtoUrl: string;
  trackingUrl?: string;
  errorNote?: string;
}

const DEFAULT_APP_URL =
  process.env.APP_URL ||
  'https://ais-pre-tbdrca2tmc2nujfnv2bu6b-322321528747.europe-west2.run.app';

export function buildOrderTrackingUrl(orderNumber?: string, baseUrl?: string): string {
  const root = (baseUrl || DEFAULT_APP_URL).replace(/\/+$/, '');
  if (!orderNumber) {
    return `${root}/?view=account`;
  }
  const cleanRef = orderNumber.trim();
  if (cleanRef.toUpperCase().startsWith('VC-APT-') || cleanRef.toUpperCase().startsWith('APT-')) {
    return `${root}/?view=appointments`;
  }
  return `${root}/?view=account&trackOrder=${encodeURIComponent(cleanRef)}`;
}

export function buildGmailComposeUrl(toEmail: string, subject: string, bodyText: string): string {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: toEmail.trim(),
    su: subject.trim(),
    body: bodyText.trim(),
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function buildMailtoUrl(toEmail: string, subject: string, bodyText: string): string {
  const params = new URLSearchParams({
    subject: subject.trim(),
    body: bodyText.trim(),
  });
  return `mailto:${encodeURIComponent(toEmail.trim())}?${params.toString()}`;
}

function escapePdfText(input: string): string {
  return String(input || '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Generates a valid, self-contained PDF Buffer containing the client's
 * Optical Lens Prescription & Bespoke Eyewear Specifications for email attachment.
 * Only called when the client actually placed an Eyewear / Glasses order.
 */
export function generateLensPrescriptionPdfBuffer(
  payload: OutboundEmailPayload
): Buffer {
  const ord = payload.orderDetails;
  const items = ord?.items || [];
  const lines: Array<{ text: string; size?: number; bold?: boolean }> = [];

  lines.push({ text: 'VISION CARE OPTICAL ATELIER LTD', size: 16, bold: true });
  lines.push({
    text: 'Official Clinical Lens Prescription & Laboratory Dispensing Dossier',
    size: 11,
    bold: true,
  });
  lines.push({ text: '-------------------------------------------------------------------------', size: 10 });
  lines.push({
    text: `Order Reference: ${ord?.orderNumber || payload.orderNumber || 'N/A'}   |   Date: ${new Date().toLocaleDateString()}`,
    size: 10,
    bold: true,
  });
  lines.push({
    text: `Patient / Client: ${payload.toName || 'Valued Client'} (${payload.toEmail})`,
    size: 10,
  });
  if (ord) {
    lines.push({
      text: `Payment Method: ${String(ord.paymentMethod || '').toUpperCase()} (Ref: ${ord.paymentReference}) - Status: ${ord.paymentStatus}`,
      size: 10,
    });
    lines.push({
      text: `Delivery: ${ord.deliveryMethod} -> ${ord.deliveryAddress}, ${ord.deliveryCity}, ${ord.deliveryState}`,
      size: 10,
    });
  }
  lines.push({ text: '-------------------------------------------------------------------------', size: 10 });

  items.forEach((it, idx) => {
    lines.push({
      text: `PAIR #${idx + 1}: ${it.productName} (${it.selectedColor || 'Standard'}) x${it.quantity}`,
      size: 11,
      bold: true,
    });
    lines.push({
      text: `Order Type: ${String(it.orderType || 'prescription_glasses').replace(/_/g, ' ').toUpperCase()}`,
      size: 10,
    });
    if (it.orderType !== 'frames_only') {
      if (it.orderType !== 'protective_glasses' && it.lensTypeName) {
        lines.push({
          text: `Lens Design: ${it.lensTypeName} (${it.lensOptionSelected || 'Standard'}) - NGN ${Number(it.lensPriceNgn || 0).toLocaleString()}`,
          size: 10,
        });
      }
      lines.push({
        text: `Coatings & Index: ${it.coatingSummary || 'Standard Uncoated'} - NGN ${Number(it.coatingPriceNgn || 0).toLocaleString()}`,
        size: 10,
      });
    }

    let rx: any = {};
    try {
      if (it.prescriptionSnapshotJson) {
        rx = JSON.parse(it.prescriptionSnapshotJson);
      }
    } catch {
      rx = {};
    }

    if (it.orderType === 'protective_glasses') {
      lines.push({
        text: 'Optical Power: 0.00 Plano (Non-Prescription Protective & Screen Eyewear)',
        size: 10,
        bold: true,
      });
    } else if (it.orderType === 'frames_only') {
      lines.push({
        text: 'Optical Power: Designer Frame Chassis Only (Factory Demo Lenses)',
        size: 10,
      });
    } else {
      lines.push({ text: 'CLINICAL PRESCRIPTION PARAMETERS (OD / OS):', size: 10, bold: true });
      lines.push({
        text: `  OD (Right Eye):  SPH ${rx.odSph || '0.00'}  |  CYL ${rx.odCyl || '0.00'}  |  AXIS ${rx.odAxis || '0'} deg  |  ADD ${rx.odAdd || '0.00'}`,
        size: 10,
      });
      lines.push({
        text: `  OS (Left Eye):   SPH ${rx.osSph || '0.00'}  |  CYL ${rx.osCyl || '0.00'}  |  AXIS ${rx.osAxis || '0'} deg  |  ADD ${rx.osAdd || '0.00'}`,
        size: 10,
      });
      lines.push({
        text: `  Binocular PD: ${rx.pd || '63'} mm${rx.doctorName ? `   |   Prescribing Doctor: ${rx.doctorName}` : ''}`,
        size: 10,
      });
      if (rx.notes) {
        lines.push({ text: `  Clinical Notes: ${rx.notes}`, size: 9 });
      }
    }
    lines.push({
      text: `  Pair Subtotal: NGN ${Number((it.unitTotalNgn || 0) * (it.quantity || 1)).toLocaleString()}`,
      size: 10,
      bold: true,
    });
    lines.push({ text: '-------------------------------------------------------------------------', size: 10 });
  });

  if (ord) {
    lines.push({
      text: `TOTAL ORDER AMOUNT: NGN ${Number(ord.totalNgn || 0).toLocaleString()}`,
      size: 12,
      bold: true,
    });
  }
  lines.push({
    text: 'Verified by Vision Care Optical Atelier Digital Surfacing Laboratory.',
    size: 9,
  });

  // Build PDF content stream
  let y = 760;
  const contentParts: string[] = ['BT'];
  for (const line of lines) {
    if (y < 50) break;
    const font = line.bold ? '/F2' : '/F1';
    const sz = line.size || 10;
    contentParts.push(`${font} ${sz} Tf`);
    contentParts.push(`1 0 0 1 45 ${y} Tm`);
    contentParts.push(`(${escapePdfText(line.text)}) Tj`);
    y -= sz + 7;
  }
  contentParts.push('ET');
  const streamData = contentParts.join('\n');

  const objects: string[] = [];
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  objects.push(
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj'
  );
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj');
  objects.push(
    `6 0 obj\n<< /Length ${Buffer.byteLength(streamData, 'utf8')} >>\nstream\n${streamData}\nendstream\nendobj`
  );

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj + '\n';
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
}

function resolveProductImageAttachment(
  rawImg: string | undefined,
  idx: number
): {
  cid: string;
  publicSrc: string;
  attachment?: { filename: string; content: Buffer; cid: string; contentType?: string };
} {
  const cid = `vc_product_${idx}@visioncare.ng`;
  const clean = String(rawImg || '').trim();
  if (!clean) {
    return { cid, publicSrc: `${DEFAULT_APP_URL}/src/assets/images/hero_vision_care_1793890597331.jpg` };
  }

  // Handle data URL
  if (clean.startsWith('data:image/')) {
    const match = clean.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (match) {
      const mime = match[1];
      const ext = mime.split('/')[1] || 'jpg';
      const buf = Buffer.from(match[2], 'base64');
      return {
        cid,
        publicSrc: clean,
        attachment: {
          filename: `product-${idx + 1}.${ext}`,
          content: buf,
          cid,
          contentType: mime,
        },
      };
    }
  }

  // Handle local path e.g. /src/assets/images/...
  if (clean.startsWith('/')) {
    const localFilePath = path.join(process.cwd(), clean.replace(/^\/+/, ''));
    if (fs.existsSync(localFilePath)) {
      try {
        const buf = fs.readFileSync(localFilePath);
        return {
          cid,
          publicSrc: `${DEFAULT_APP_URL}${clean}`,
          attachment: {
            filename: path.basename(localFilePath) || `frame-${idx + 1}.jpg`,
            content: buf,
            cid,
            contentType: 'image/jpeg',
          },
        };
      } catch {
        // Fallback to public URL
      }
    }
    return { cid, publicSrc: `${DEFAULT_APP_URL}${clean}` };
  }

  return { cid, publicSrc: clean };
}

function buildClinicalHtmlEmail(
  payload: OutboundEmailPayload,
  fromName: string,
  supportEmail: string,
  resolvedImages: Array<{ cid: string; publicSrc: string; hasCid: boolean }>
): string {
  const escapedBody = payload.bodyText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />');

  const ord = payload.orderDetails;
  const hasEyewearOrder = Boolean(ord && Array.isArray(ord.items) && ord.items.length > 0);
  const refStr = String(ord?.orderNumber || payload.orderNumber || '').trim();
  const isAppointmentEmail =
    !hasEyewearOrder &&
    (refStr.toUpperCase().startsWith('VC-APT-') ||
      refStr.toUpperCase().startsWith('APT-') ||
      payload.subject.toLowerCase().includes('appointment') ||
      payload.subject.toLowerCase().includes('doctor') ||
      payload.subject.toLowerCase().includes('drug'));

  const trackingUrl =
    payload.trackingUrl ||
    (hasEyewearOrder
      ? buildOrderTrackingUrl(ord?.orderNumber || payload.orderNumber)
      : isAppointmentEmail
      ? `${DEFAULT_APP_URL.replace(/\/+$/, '')}/?view=appointments`
      : `${DEFAULT_APP_URL.replace(/\/+$/, '')}/?view=account`);

  const orderItemsHtml =
    hasEyewearOrder && ord
      ? `
      <div style="margin-top:22px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#0B192C;border-bottom:2px solid #0B192C;padding-bottom:6px;margin-bottom:14px;">
          Ordered Eyewear &amp; Clinical Lens Specifications
        </div>
        ${ord.items
          .map((item, idx) => {
            const imgMeta = resolvedImages[idx];
            const imgSrc = imgMeta?.hasCid ? `cid:${imgMeta.cid}` : imgMeta?.publicSrc || '';
            let rx: any = {};
            try {
              if (item.prescriptionSnapshotJson) {
                rx = JSON.parse(item.prescriptionSnapshotJson);
              }
            } catch {
              rx = {};
            }
            const showRxTable =
              item.orderType !== 'frames_only' && item.orderType !== 'protective_glasses';

            return `
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E8F0;border-radius:12px;margin-bottom:14px;background-color:#FFFFFF;overflow:hidden;">
              <tr>
                <td width="130" valign="top" style="padding:14px;background-color:#F8FAFC;border-right:1px solid #E2E8F0;text-align:center;">
                  ${
                    imgSrc
                      ? `<img src="${imgSrc}" alt="${item.productName}" width="110" style="width:110px;height:84px;object-fit:cover;border-radius:8px;border:1px solid #CBD5E1;display:block;margin:0 auto;" />`
                      : ''
                  }
                  <div style="font-size:10px;color:#64748B;margin-top:6px;font-weight:600;">
                    Qty: ${item.quantity}
                  </div>
                </td>
                <td valign="top" style="padding:14px;">
                  <div style="font-size:15px;font-weight:700;color:#0B192C;">
                    ${item.productName}
                  </div>
                  <div style="font-size:12px;color:#1E40AF;font-weight:600;margin-top:2px;">
                    Colour: ${item.selectedColor || 'Standard'} · ${String(
              item.orderType || 'prescription_glasses'
            )
              .replace(/_/g, ' ')
              .toUpperCase()}
                  </div>
                  ${
                    item.orderType !== 'frames_only'
                      ? `<div style="margin-top:8px;font-size:12px;color:#334155;line-height:1.5;">
                          ${
                            item.orderType !== 'protective_glasses' && item.lensTypeName
                              ? `<div><strong>Lens Design:</strong> ${item.lensTypeName} (${
                                  item.lensOptionSelected || 'Standard'
                                })</div>`
                              : ''
                          }
                          <div><strong>Coatings &amp; Index:</strong> ${
                            item.coatingSummary || 'Standard Uncoated'
                          }</div>
                        </div>`
                      : `<div style="margin-top:8px;font-size:12px;color:#334155;">
                          <strong>Configuration:</strong> Designer Frame Chassis Only
                        </div>`
                  }
                  ${
                    showRxTable
                      ? `<table width="100%" cellpadding="4" cellspacing="0" style="margin-top:10px;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;font-size:11px;font-family:monospace;">
                          <tr style="background-color:#0B192C;color:#FFFFFF;font-weight:700;">
                            <td>EYE</td>
                            <td>SPH</td>
                            <td>CYL</td>
                            <td>AXIS</td>
                            <td>ADD</td>
                          </tr>
                          <tr>
                            <td><strong>OD (Right)</strong></td>
                            <td>${rx.odSph || '0.00'}</td>
                            <td>${rx.odCyl || '0.00'}</td>
                            <td>${rx.odAxis || '0'}°</td>
                            <td>${rx.odAdd || '0.00'}</td>
                          </tr>
                          <tr style="border-top:1px solid #E2E8F0;">
                            <td><strong>OS (Left)</strong></td>
                            <td>${rx.osSph || '0.00'}</td>
                            <td>${rx.osCyl || '0.00'}</td>
                            <td>${rx.osAxis || '0'}°</td>
                            <td>${rx.osAdd || '0.00'}</td>
                          </tr>
                          <tr>
                            <td colspan="5" style="border-top:1px solid #E2E8F0;color:#1E40AF;font-weight:700;">
                              Binocular PD: ${rx.pd || '63'} mm ${
                          rx.doctorName ? `· Dr. ${rx.doctorName}` : ''
                        }
                            </td>
                          </tr>
                        </table>`
                      : ''
                  }
                  <div style="margin-top:10px;text-align:right;font-size:13px;font-weight:700;color:#0B192C;">
                    Item Total: ₦${Number((item.unitTotalNgn || 0) * (item.quantity || 1)).toLocaleString()}
                  </div>
                </td>
              </tr>
            </table>`;
          })
          .join('')}

        <table width="100%" cellpadding="6" cellspacing="0" style="background-color:#0B192C;color:#FFFFFF;border-radius:10px;padding:12px;font-size:12px;margin-top:10px;">
          <tr>
            <td style="color:#CBD5E1;">Subtotal:</td>
            <td align="right" style="font-weight:600;">₦${Number(ord.subtotalNgn || 0).toLocaleString()}</td>
          </tr>
          <tr>
            <td style="color:#CBD5E1;">Delivery (${ord.deliveryMethod}):</td>
            <td align="right" style="font-weight:600;">${
              Number(ord.deliveryFeeNgn || 0) === 0
                ? 'Complimentary (₦0)'
                : `₦${Number(ord.deliveryFeeNgn).toLocaleString()}`
            }</td>
          </tr>
          ${
            Number(ord.discountNgn || 0) > 0
              ? `<tr>
                  <td style="color:#6EE7B7;">Promotional Discount:</td>
                  <td align="right" style="color:#6EE7B7;font-weight:700;">-₦${Number(
                    ord.discountNgn
                  ).toLocaleString()}</td>
                </tr>`
              : ''
          }
          <tr>
            <td style="border-top:1px solid #334155;padding-top:8px;font-size:14px;font-weight:700;color:#C5A059;">
              Total Amount (${String(ord.paymentMethod || '').toUpperCase()}):
            </td>
            <td align="right" style="border-top:1px solid #334155;padding-top:8px;font-size:15px;font-weight:700;color:#C5A059;">
              ₦${Number(ord.totalNgn || 0).toLocaleString()}
            </td>
          </tr>
        </table>
      </div>`
      : '';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${payload.subject}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0B192C;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F5F9;padding:28px 12px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background-color:#FFFFFF;border:1px solid #CBD5E1;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px rgba(11,25,44,0.06);">
            <!-- Executive Letterhead -->
            <tr>
              <td style="background:linear-gradient(135deg,#0B192C 0%,#162B49 100%);padding:24px 28px;color:#FFFFFF;border-bottom:3px solid #C5A059;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#C5A059;font-weight:700;">
                        ${fromName} · ${isAppointmentEmail ? 'Eye Clinic &amp; Doctor Portal' : 'Clinical Optical Concierge'}
                      </div>
                      <div style="font-size:20px;font-weight:700;margin-top:6px;color:#FFFFFF;line-height:1.3;">
                        ${payload.subject}
                      </div>
                    </td>
                    <td align="right" valign="top">
                      ${
                        payload.orderNumber || ord?.orderNumber
                          ? `<div style="background-color:rgba(197,160,89,0.2);border:1px solid #C5A059;color:#C5A059;font-size:11px;font-weight:700;padding:5px 10px;border-radius:6px;white-space:nowrap;">
                              Ref: ${ord?.orderNumber || payload.orderNumber}
                            </div>`
                          : ''
                      }
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Main Content -->
            <tr>
              <td style="padding:26px 28px;font-size:14px;line-height:1.65;color:#1E293B;">
                <p style="margin:0 0 14px 0;font-size:15px;font-weight:600;color:#0B192C;">
                  Dear ${payload.toName || payload.toEmail},
                </p>
                <div style="background-color:#FAF9F6;border-left:4px solid #1E40AF;border-top:1px solid #E2E8F0;border-right:1px solid #E2E8F0;border-bottom:1px solid #E2E8F0;border-radius:8px;padding:16px 18px;margin-bottom:18px;font-size:13.5px;color:#1E293B;">
                  ${escapedBody}
                </div>

                ${orderItemsHtml}

                ${
                  hasEyewearOrder
                    ? `<div style="margin-top:16px;padding:12px 16px;background-color:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;font-size:12px;color:#1E3A8A;">
                        <strong>Attached Document:</strong> Your official <em>Vision Care Clinical Lens Prescription &amp; Order Dossier (PDF)</em> is attached to this email for your personal optical records.
                      </div>`
                    : ''
                }

                <!-- Direct Account CTA -->
                <div style="margin-top:24px;margin-bottom:10px;text-align:center;padding:20px;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;">
                  <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1E40AF;margin-bottom:6px;">
                    ${
                      hasEyewearOrder
                        ? '9-Stage Live Optical Laboratory Tracking'
                        : 'Confidential Patient Account &amp; Eye Clinic Portal'
                    }
                  </div>
                  <div style="font-size:13px;color:#475569;margin-bottom:16px;">
                    ${
                      hasEyewearOrder
                        ? 'Click the button below to open your Vision Care Client Account and track your eyewear order in real time:'
                        : 'Click the button below to sign in to your confidential Vision Care Account to view your appointment updates and Doctor messages:'
                    }
                  </div>
                  <a href="${trackingUrl}" target="_blank" rel="noreferrer" style="display:inline-block;background-color:#0B192C;color:#FFFFFF;font-size:13px;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:10px;border:1px solid #C5A059;">
                    ${
                      hasEyewearOrder
                        ? 'Track Your Order in Vision Care Account →'
                        : 'Open My Confidential Vision Care Account →'
                    }
                  </a>
                  <div style="margin-top:10px;font-size:11px;color:#64748B;word-break:break-all;">
                    Direct Link: <a href="${trackingUrl}" style="color:#1E40AF;text-decoration:underline;">${trackingUrl}</a>
                  </div>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color:#0B192C;padding:18px 28px;font-size:11px;color:#94A3B8;border-top:1px solid #1E293B;">
                <div style="color:#FFFFFF;font-weight:700;margin-bottom:4px;">
                  ${fromName} — Victoria Island, Lagos &amp; Maitama, Abuja
                </div>
                <div>
                  Delivered to registered client email: <strong style="color:#E2E8F0;">${payload.toEmail}</strong> · Need assistance? Reply to <a href="mailto:${supportEmail}" style="color:#C5A059;text-decoration:none;">${supportEmail}</a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function dispatchClientEmail(payload: OutboundEmailPayload): Promise<OutboundEmailResult> {
  const cleanTo = (payload.toEmail || '').trim();
  const cfg = payload.siteConfig || {};
  const fromName = cfg.smtpFromName || 'VISION CARE Optical Atelier';
  const supportEmail =
    cfg.smtpFromEmail ||
    cfg.supportEmail ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER ||
    'concierge@visioncare.ng';
  const sentAt = new Date().toISOString();

  const hasEyewearOrder = Boolean(
    payload.orderDetails &&
      Array.isArray(payload.orderDetails.items) &&
      payload.orderDetails.items.length > 0
  );

  const trackingUrl =
    payload.trackingUrl ||
    buildOrderTrackingUrl(payload.orderDetails?.orderNumber || payload.orderNumber);

  const fullPlainTextBody = hasEyewearOrder
    ? `${payload.bodyText}\n\nTrack Your Order in Vision Care Account:\n${trackingUrl}`
    : `${payload.bodyText}\n\nOpen Your Confidential Vision Care Account:\n${trackingUrl}`;

  const gmailComposeUrl = buildGmailComposeUrl(cleanTo, payload.subject, fullPlainTextBody);
  const mailtoUrl = buildMailtoUrl(cleanTo, payload.subject, fullPlainTextBody);

  const smtpHost = (cfg.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const smtpPort = Number(cfg.smtpPort || process.env.SMTP_PORT || 465);
  const smtpUser = (cfg.smtpUser || process.env.SMTP_USER || '').trim();
  const rawPass = (cfg.smtpPass || process.env.SMTP_PASS || '').trim();
  const smtpPass = smtpHost.toLowerCase().includes('gmail')
    ? rawPass.replace(/\s+/g, '')
    : rawPass;

  if (cleanTo && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      const attachments: Array<any> = [];
      const resolvedImages: Array<{ cid: string; publicSrc: string; hasCid: boolean }> = [];

      if (payload.orderDetails && Array.isArray(payload.orderDetails.items)) {
        payload.orderDetails.items.forEach((item, idx) => {
          const imgResolved = resolveProductImageAttachment(item.productImage, idx);
          if (imgResolved.attachment) {
            attachments.push(imgResolved.attachment);
            resolvedImages.push({
              cid: imgResolved.cid,
              publicSrc: imgResolved.publicSrc,
              hasCid: true,
            });
          } else {
            resolvedImages.push({
              cid: imgResolved.cid,
              publicSrc: imgResolved.publicSrc,
              hasCid: false,
            });
          }

          // Also attach any uploaded prescription image/PDF from prescriptionSnapshotJson
          try {
            if (item.prescriptionSnapshotJson) {
              const rx = JSON.parse(item.prescriptionSnapshotJson);
              if (rx.documentDataUrl && String(rx.documentDataUrl).startsWith('data:')) {
                const m = String(rx.documentDataUrl).match(/^data:([^;]+);base64,(.+)$/);
                if (m) {
                  attachments.push({
                    filename: rx.documentFileName || `Uploaded-Prescription-Pair-${idx + 1}.pdf`,
                    content: Buffer.from(m[2], 'base64'),
                    contentType: m[1],
                  });
                }
              }
            }
          } catch {
            // Ignore snapshot parse error
          }
        });

        // Always attach the generated official PDF of the Lens Prescription & Order Specs
        const rxPdfBuffer = generateLensPrescriptionPdfBuffer(payload);
        attachments.push({
          filename: `VisionCare-Lens-Prescription-${payload.orderDetails.orderNumber}.pdf`,
          content: rxPdfBuffer,
          contentType: 'application/pdf',
        });
      }

      const html = buildClinicalHtmlEmail(payload, fromName, smtpUser || supportEmail, resolvedImages);

      await transporter.sendMail({
        from: `"${fromName}" <${smtpUser}>`,
        to: cleanTo,
        replyTo: supportEmail,
        subject: payload.subject,
        text: fullPlainTextBody,
        html,
        attachments,
      });

      return {
        deliveredViaSmtp: true,
        provider: 'smtp',
        toEmail: cleanTo,
        fromEmail: smtpUser,
        subject: payload.subject,
        sentAt,
        gmailComposeUrl,
        mailtoUrl,
        trackingUrl,
      };
    } catch (err: any) {
      console.warn(
        'SMTP email dispatch warning (falling back to account & Gmail relay):',
        err?.message || err
      );
      return {
        deliveredViaSmtp: false,
        provider: 'gmail_relay_ready',
        toEmail: cleanTo,
        fromEmail: supportEmail,
        subject: payload.subject,
        sentAt,
        gmailComposeUrl,
        mailtoUrl,
        trackingUrl,
        errorNote: err?.message || 'SMTP connection failed',
      };
    }
  }

  return {
    deliveredViaSmtp: false,
    provider: 'gmail_relay_ready',
    toEmail: cleanTo,
    fromEmail: supportEmail,
    subject: payload.subject,
    sentAt,
    gmailComposeUrl,
    mailtoUrl,
    trackingUrl,
  };
}
