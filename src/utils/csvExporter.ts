const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

const DEFAULT_POM_NAMES: Record<string, string> = {
  FL001: 'Front length',
  BL001: 'Back length',
  CW001: 'Chest width',
  WS001: 'Waist width',
  HM001: 'Hem width',
  HH001: 'Bottom hem height',
  SS001: 'Shoulder seam',
  SW001: 'Shoulder width',
  AH001: 'Armhole height',
  SL001: 'Sleeve length',
  BW001: 'Bicep width',
  CO001: 'Sleeve opening',
  CH001: 'Sleeve hem height',
  NW001: 'Neck opening width',
  CW002: 'Neckband height',
  FD001: 'Front neck drop',
  BD001: 'Back neck drop',
  HD001: 'Hood height',
  HD002: 'Hood width',
  PK001: 'Pocket height',
  PK002: 'Pocket width',
  PK003: 'Pocket opening',
};

// Standard grading increments in cm per size step
const DEFAULT_GRADING_CM: Record<string, number> = {
  FL001: 2,
  BL001: 2,
  CW001: 2.5,
  WS001: 2.5,
  HM001: 2.5,
  HH001: 0,
  SS001: 0.5,
  SW001: 2.5,
  AH001: 1,
  SL001: 1,
  BW001: 1,
  CO001: 1,
  CH001: 0,
  NW001: 0.75,
  CW002: 0,
  FD001: 0.5,
  BD001: 0,
  HD001: 1,
  HD002: 1,
  PK001: 0.5,
  PK002: 0.5,
  PK003: 0.5,
};

const parseNumericValue = (val: any): number | null => {
  if (val === null || val === undefined) return null;
  const str = String(val).trim().replace(/,/g, '.');
  if (!str) return null;

  // Mixed fraction e.g. "27 1/8"
  let match = str.match(/^([+-]?\d+)[\s-]+(\d+)\/(\d+)$/);
  if (match) {
    const whole = parseFloat(match[1]);
    const sign = whole < 0 ? -1 : 1;
    return whole + sign * (parseFloat(match[2]) / parseFloat(match[3]));
  }

  // Simple fraction e.g. "3/8"
  match = str.match(/^([+-]?\d+)\/(\d+)$/);
  if (match) {
    return parseFloat(match[1]) / parseFloat(match[2]);
  }

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
};

const inferGradingStep = (m: any, unit: 'in' | 'cm'): number => {
  if (m.grading !== undefined && m.grading !== null && String(m.grading).trim() !== '') {
    const parsed = parseNumericValue(m.grading);
    if (parsed !== null) return parsed;
  }

  const idUpper = String(m.id || '').trim().toUpperCase();
  let cmStep: number | undefined = DEFAULT_GRADING_CM[idUpper];

  if (cmStep === undefined) {
    const text = `${m.point || ''} ${m.name || ''} ${m.description || ''}`.toLowerCase();
    if (
      text.includes('hem height') ||
      text.includes('cuff height') ||
      text.includes('neckband') ||
      text.includes('collar width') ||
      text.includes('collar height') ||
      text.includes('back neck drop') ||
      text.includes('rib height')
    ) {
      cmStep = 0;
    } else if (
      text.includes('chest') ||
      text.includes('bust') ||
      text.includes('waist') ||
      text.includes('hem width') ||
      text.includes('bottom opening') ||
      text.includes('sweep') ||
      text.includes('shoulder width') ||
      text.includes('hip')
    ) {
      cmStep = 2.5;
    } else if (
      text.includes('front length') ||
      text.includes('back length') ||
      text.includes('body length') ||
      text.includes('total length') ||
      text.includes('inseam') ||
      text.includes('outseam')
    ) {
      cmStep = 2;
    } else if (text.includes('neck opening') || text.includes('neck width')) {
      cmStep = 0.75;
    } else if (text.includes('shoulder seam') || text.includes('front neck drop')) {
      cmStep = 0.5;
    } else if (
      text.includes('armhole') ||
      text.includes('sleeve') ||
      text.includes('bicep')
    ) {
      cmStep = 1;
    } else {
      cmStep = 1;
    }
  }

  if (unit === 'in') {
    return Number((cmStep / 2.54).toFixed(2));
  }
  return cmStep;
};

const formatTolerance = (m: any): string => {
  const tolPlus = m.tolPlus !== undefined && m.tolPlus !== null ? String(m.tolPlus).trim() : '';
  const tolMinus = m.tolMinus !== undefined && m.tolMinus !== null ? String(m.tolMinus).trim() : '';

  if (tolPlus || tolMinus) {
    const cleanPlus = tolPlus.replace(/^[+-]\s*/, '');
    const cleanMinus = tolMinus.replace(/^[+-]\s*/, '');
    if (cleanPlus && cleanMinus && cleanPlus !== cleanMinus) {
      return `+${cleanPlus} / -${cleanMinus}`;
    }
    return cleanPlus || cleanMinus;
  }

  if (m.tolerance) {
    const raw = String(m.tolerance).trim();
    const parts = raw.split('/').map((s) => s.replace(/^[+-]\s*/, '').trim());
    if (parts.length === 2 && parts[0] === parts[1]) {
      return parts[0];
    }
    return raw.replace(/^[+-]\s*/, '');
  }

  return '0.5';
};

const escapeCsvCell = (val: any): string => {
  const str = val === null || val === undefined ? '' : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export interface ExportCsvOptions {
  packName: string;
  clientName?: string;
  baseSize?: string;
  unit?: 'in' | 'cm';
  measurements: any[];
}

export function exportMeasurementsToCsv({
  packName,
  clientName = '',
  baseSize = 'M',
  unit = 'cm',
  measurements = [],
}: ExportCsvOptions): void {
  const normalizedBase = SIZES.includes(baseSize.toUpperCase()) ? baseSize.toUpperCase() : 'M';
  const baseIdx = SIZES.indexOf(normalizedBase);

  const rows: string[][] = [];

  // Row 1: CLIENT
  rows.push(['CLIENT', clientName || 'N/A', '', '', '', '', '', '', '', '', '', '']);

  // Row 2: STYLE
  rows.push(['STYLE', packName || 'Untitled Garment', '', '', '', '', '', '', '', '', '', '']);

  // Row 3: Header Row
  const sizeHeaders = SIZES.map((sz) => (sz === normalizedBase ? `${sz} (Base)` : sz));
  rows.push([
    'DIM ID',
    'Point of measure',
    'Measurement method',
    'Tolerance (+/-)',
    'grading',
    ...sizeHeaders,
  ]);

  // Data Rows
  measurements.forEach((m: any, idx: number) => {
    const dimId = m.id || `M${String(idx + 1).padStart(2, '0')}`;
    const idUpper = String(dimId).trim().toUpperCase();
    const pointOfMeasure =
      m.point || m.name || DEFAULT_POM_NAMES[idUpper] || 'Measurement Point';
    const measurementMethod = m.description || '';
    const tolerance = formatTolerance(m);
    const gradingStep = inferGradingStep(m, unit);
    const baseNum = parseNumericValue(m.value);

    const sizeValues = SIZES.map((sz, szIdx) => {
      if (sz === normalizedBase) {
        if (baseNum !== null) return baseNum.toFixed(1);
        return m.value || '';
      }

      // Check if an explicit graded value exists for this size
      const explicitVal = m.sizes?.[sz];
      const explicitNum = parseNumericValue(explicitVal);
      if (explicitNum !== null && explicitNum > 0) {
        return explicitNum.toFixed(1);
      }

      // Otherwise calculate from base measurement + grading increment
      if (baseNum !== null) {
        const computed = baseNum + (szIdx - baseIdx) * gradingStep;
        return Math.max(0, computed).toFixed(1);
      }

      return '';
    });

    rows.push([
      dimId,
      pointOfMeasure,
      measurementMethod,
      tolerance,
      String(gradingStep),
      ...sizeValues,
    ]);
  });

  const csvContent = '\uFEFF' + rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeFilename = (packName || 'TechPack').replace(/[^a-z0-9_-]+/gi, '_');
  link.href = url;
  link.setAttribute('download', `${safeFilename}_Measurements.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
