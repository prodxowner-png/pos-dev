import QRCode from 'qrcode';

/**
 * CRC16-CCITT (0x1021) calculator for EMVCo Thai PromptPay QR
 */
export function crc16Ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    const byte = data.charCodeAt(i);
    crc ^= byte << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface PromptPayParams {
  /** Mobile number (e.g., "0819876543" or "0066819876543"), Tax ID (13 digits), or Biller ID */
  target: string;
  /** Amount in THB (e.g., 150.50 or 0 for open amount) */
  amount?: number;
  /** Optional reference 1 (e.g. Order ID) */
  ref1?: string;
  /** Optional reference 2 (e.g. Cashier Shift) */
  ref2?: string;
}

/**
 * Formats a 2-digit tag string
 */
function f(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${tag}${len}${value}`;
}

/**
 * Sanitizes target ID to standard PromptPay payload target
 */
export function formatPromptPayTarget(target: string): { type: 'MOBILE' | 'TAX_ID' | 'BILLER_ID'; formatted: string } {
  const clean = target.replace(/[^0-9]/g, '');
  if (clean.length === 10 && clean.startsWith('0')) {
    // Thai Mobile Number -> 0066 + 9 digits (omit leading 0)
    return { type: 'MOBILE', formatted: `0066${clean.substring(1)}` };
  } else if (clean.length === 11 && clean.startsWith('66')) {
    return { type: 'MOBILE', formatted: `00${clean}` };
  } else if (clean.length === 13) {
    return { type: 'TAX_ID', formatted: clean };
  } else {
    return { type: 'BILLER_ID', formatted: clean.padStart(15, '0') };
  }
}

/**
 * Generates official EMVCo PromptPay QR raw payload string
 */
export function generatePromptPayPayload({ target, amount, ref1, ref2 }: PromptPayParams): string {
  const { type, formatted } = formatPromptPayTarget(target);

  // Payload format indicator: 000201
  let payload = f('00', '01');

  // Point of initiation method: 010211 (static) or 010212 (dynamic)
  const isDynamic = amount && amount > 0;
  payload += f('01', isDynamic ? '12' : '11');

  // Merchant Information - PromptPay AID
  const aid = 'A000000677010111';
  let targetTag = '01'; // Mobile
  if (type === 'TAX_ID') targetTag = '02';
  if (type === 'BILLER_ID') targetTag = '03';

  const merchantValue = f('00', aid) + f(targetTag, formatted);
  payload += f('29', merchantValue);

  // Country Code: TH
  payload += f('58', 'TH');

  // Currency: 764 (THB)
  payload += f('53', '764');

  // Amount if specified
  if (amount && amount > 0) {
    const formattedAmount = amount.toFixed(2);
    payload += f('54', formattedAmount);
  }

  // Additional Data Field Template (Ref 1, Ref 2)
  if (ref1 || ref2) {
    let addData = '';
    if (ref1) addData += f('01', ref1.substring(0, 25));
    if (ref2) addData += f('02', ref2.substring(0, 25));
    if (addData) {
      payload += f('62', addData);
    }
  }

  // Checksum header tag
  payload += '6304';

  // Calculate CRC16 checksum
  const checksum = crc16Ccitt(payload);

  return `${payload}${checksum}`;
}

/**
 * Renders a QR code to data URL string for display in <img> tag
 */
export async function generateQrDataUrl(text: string, size = 300): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: size,
      margin: 2,
      color: {
        dark: '#0f172a', // slate-900
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('Failed to generate QR data URL:', err);
    return '';
  }
}
