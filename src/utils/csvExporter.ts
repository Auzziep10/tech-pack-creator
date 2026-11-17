export const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

export const DEFAULT_POM_NAMES: Record<string, string> = {
  FL001: 'Front length',
  BL001: 'Back length',
  CW001: 'Chest width',
  WS001: 'Waist width',
  HM001: 'Bottom hem width',
  HH001: 'Bottom hem height',
  SS001: 'Shoulder seam length',
  SW001: 'Shoulder width',
  AH001: 'Armhole depth',
  SL001: 'Sleeve length',
  BW001: 'Bicep width',
  CO001: 'Sleeve opening width',
  CH001: 'Sleeve opening hem height',
  NW001: 'Neck opening width',
  CW002: 'Neckband rib height',
  FD001: 'Front neck drop',
  BD001: 'Back neck drop',
  M17: 'Front panel: across lower armhole corners.',
  M18: 'Lower front: across top of hem band.',
  M19: 'Side panel: across middle of rib.',
  M20: 'Side panel: LENGTH',
  M21: 'Visible side panel: across exposed rib, front view.',
  HD001: 'Hood height',
  HD002: 'Hood width',
  PK001: 'Pocket height',
  PK002: 'Pocket width',
  PK003: 'Pocket opening',
};

// Standard Column E grading increments in cm per size step
export const DEFAULT_GRADING_CM: Record<string, number> = {
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

// Street grading increments in cm per size step
export const STREET_GRADING_CM: Record<string, number> = {
  FL001: 2,
  BL001: 2,
  CW001: 2.5,
  WS001: 2.5,
  HM001: 2,
  HH001: 0,
  SS001: 0.5,
  SW001: 1.5,
  AH001: 1,
  SL001: 1,
  BW001: 1,
  CO001: 0.5,
  CH001: 0,
  NW001: 0.5,
  CW002: 0,
  FD001: 0.3,
  BD001: 0,
  HD001: 1,
  HD002: 1,
  PK001: 0.5,
  PK002: 0.5,
  PK003: 0.5,
};

export interface CustomGradingRowRule {
  id: string;
  point: string;
  stepCm: number;
}

export interface GradingProfile {
  id: string;
  name: string;
  isBuiltIn?: boolean;
  baseType?: 'standard' | 'street';
  rulesCm: Record<string, number>;
  customRows?: CustomGradingRowRule[];
}

export const STANDARD_GRADING_PROFILE: GradingProfile = {
  id: 'standard',
  name: 'Standard',
  isBuiltIn: true,
  baseType: 'standard',
  rulesCm: { ...DEFAULT_GRADING_CM },
  customRows: [
    { id: 'M17', point: 'Front panel: across lower armhole corners.', stepCm: 2 },
    { id: 'M18', point: 'Lower front: across top of hem band.', stepCm: 2 },
    { id: 'M19', point: 'Side panel: across middle of rib.', stepCm: 0.5 },
    { id: 'M20', point: 'Side panel: LENGTH', stepCm: 1 },
    { id: 'M21', point: 'Visible side panel: across exposed rib, front view.', stepCm: 0.25 },
  ],
};

export const STREET_GRADING_PROFILE: GradingProfile = {
  id: 'street',
  name: 'Street',
  isBuiltIn: true,
  baseType: 'street',
  rulesCm: { ...STREET_GRADING_CM },
  customRows: [
    { id: 'M17', point: 'Front panel: across lower armhole corners.', stepCm: 2 },
    { id: 'M18', point: 'Lower front: across top of hem band.', stepCm: 2 },
    { id: 'M19', point: 'Side panel: across middle of rib.', stepCm: 0.5 },
    { id: 'M20', point: 'Side panel: LENGTH', stepCm: 1 },
    { id: 'M21', point: 'Visible side panel: across exposed rib, front view.', stepCm: 0.25 },
  ],
};

export const BUILT_IN_GRADING_PROFILES: GradingProfile[] = [
  STANDARD_GRADING_PROFILE,
  STREET_GRADING_PROFILE,
];

export const resolveGradingProfile = (
  profileOrId?: GradingProfile | string | null,
  allProfiles?: GradingProfile[]
): GradingProfile => {
  if (!profileOrId) return STANDARD_GRADING_PROFILE;
  if (typeof profileOrId === 'object' && profileOrId.rulesCm) {
    return profileOrId;
  }
  const targetId = String(profileOrId).trim();
  const pool = [...BUILT_IN_GRADING_PROFILES, ...(allProfiles || [])];
  return pool.find((p) => p.id === targetId) || STANDARD_GRADING_PROFILE;
};

export const parseNumericValue = (val: any): number | null => {
  if (val === null || val === undefined) return null;
  const str = String(val).trim().replace(/,/g, '.');
  if (!str || str.toLowerCase() === 'n/a' || str === '-') return null;

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

export const formatGradedNumber = (num: number): string => {
  const rounded = Math.round((num + Number.EPSILON) * 100) / 100;
  return String(Number(rounded.toFixed(2)));
};

export const inferGradingStep = (
  m: any,
  unit: 'in' | 'cm' = 'cm',
  profileOrId?: GradingProfile | string | null
): number => {
  // 1. Explicit per-row manual override in editor
  if (
    m?.customGrading &&
    m?.grading !== undefined &&
    m?.grading !== null &&
    String(m.grading).trim() !== ''
  ) {
    const parsed = parseNumericValue(m.grading);
    if (parsed !== null) return parsed;
  }

  const profile = resolveGradingProfile(profileOrId);
  const isStreetBase = profile.baseType === 'street' || profile.id === 'street';

  const idUpper = String(m?.id || '').trim().toUpperCase();
  const pointRaw = String(m?.point || m?.name || '').trim().toLowerCase();
  const text = `${pointRaw} ${m?.description || ''}`.toLowerCase();

  let cmStep: number | undefined;

  // 2. Check custom row rules on user-created profiles (match by exact point name or custom ID)
  if (!profile.isBuiltIn && profile.customRows && profile.customRows.length > 0) {
    const byPoint = pointRaw
      ? profile.customRows.find(
          (r) => r.point && r.point.trim().toLowerCase() === pointRaw
        )
      : undefined;
    if (byPoint !== undefined) {
      cmStep = byPoint.stepCm;
    } else if (idUpper) {
      const byId = profile.customRows.find(
        (r) => r.id && r.id.trim().toUpperCase() === idUpper
      );
      if (byId !== undefined) {
        cmStep = byId.stepCm;
      }
    }
  }

  // 3. Check standard POM ID map (handle CH001 disambiguation between Chest Width vs Cuff Height)
  if (cmStep === undefined) {
    if (idUpper === 'CH001' && (pointRaw.includes('chest') || pointRaw.includes('bust'))) {
      cmStep = profile.rulesCm.CW001 ?? 2.5;
    } else if (idUpper && profile.rulesCm[idUpper] !== undefined) {
      cmStep = profile.rulesCm[idUpper];
    }
  }

  // 4. Text-based fallback rules (adapts to Standard vs Street baseType)
  if (cmStep === undefined) {
    if (text.includes('visible side panel') || text.includes('exposed rib')) {
      cmStep = 0.25;
    } else if (
      text.includes('side panel') &&
      (text.includes('length') || text.includes('height') || text.includes('tall'))
    ) {
      cmStep = 1;
    } else if (text.includes('side panel')) {
      cmStep = 0.5;
    } else if (
      text.includes('front panel') ||
      text.includes('back panel') ||
      text.includes('lower armhole corner') ||
      text.includes('lower front') ||
      text.includes('lower back') ||
      text.includes('top of hem band') ||
      text.includes('across top of hem')
    ) {
      cmStep = 2;
    } else if (
      text.includes('hem height') ||
      text.includes('cuff height') ||
      text.includes('neckband') ||
      text.includes('collar width') ||
      text.includes('collar height') ||
      text.includes('back neck drop') ||
      text.includes('rib height') ||
      text.includes('fold height')
    ) {
      cmStep = 0;
    } else if (
      text.includes('hem width') ||
      text.includes('bottom opening') ||
      text.includes('sweep')
    ) {
      cmStep = profile.rulesCm.HM001 ?? (isStreetBase ? 2 : 2.5);
    } else if (text.includes('shoulder width')) {
      cmStep = profile.rulesCm.SW001 ?? (isStreetBase ? 1.5 : 2.5);
    } else if (
      text.includes('chest') ||
      text.includes('bust') ||
      text.includes('waist') ||
      text.includes('hip')
    ) {
      cmStep = profile.rulesCm.CW001 ?? 2.5;
    } else if (
      text.includes('front length') ||
      text.includes('back length') ||
      text.includes('body length') ||
      text.includes('total length') ||
      text.includes('inseam') ||
      text.includes('outseam')
    ) {
      cmStep = profile.rulesCm.FL001 ?? 2;
    } else if (text.includes('neck opening') || text.includes('neck width')) {
      cmStep = profile.rulesCm.NW001 ?? (isStreetBase ? 0.5 : 0.75);
    } else if (text.includes('front neck drop')) {
      cmStep = profile.rulesCm.FD001 ?? (isStreetBase ? 0.3 : 0.5);
    } else if (text.includes('shoulder seam')) {
      cmStep = profile.rulesCm.SS001 ?? 0.5;
    } else if (text.includes('sleeve opening') || text.includes('cuff opening')) {
      cmStep = profile.rulesCm.CO001 ?? (isStreetBase ? 0.5 : 1);
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

export const computeGradedValueForSize = (
  m: any,
  baseSize: string = 'M',
  targetSize: string = 'M',
  unit: 'in' | 'cm' = 'cm',
  profileOrId?: GradingProfile | string | null
): string => {
  const normalizedBase = SIZES.includes(String(baseSize).toUpperCase())
    ? String(baseSize).toUpperCase()
    : 'M';
  const normalizedTarget = SIZES.includes(String(targetSize).toUpperCase())
    ? String(targetSize).toUpperCase()
    : 'M';

  const baseIdx = SIZES.indexOf(normalizedBase);
  const targetIdx = SIZES.indexOf(normalizedTarget);

  const baseNum = parseNumericValue(m?.value);
  if (baseNum === null) {
    // Keep "n/a" on the base size cell and leave non-base size cells blank
    return targetIdx === baseIdx ? (m?.value || '') : '';
  }

  if (targetIdx === baseIdx) {
    return formatGradedNumber(baseNum);
  }

  const gradingStep = inferGradingStep(m, unit, profileOrId);
  const computed = Math.max(0, baseNum + (targetIdx - baseIdx) * gradingStep);
  return formatGradedNumber(computed);
};

export const computeSizeSpreadForMeasurement = (
  m: any,
  baseSize: string = 'M',
  unit: 'in' | 'cm' = 'cm',
  profileOrId?: GradingProfile | string | null
): Record<string, string> => {
  const spread: Record<string, string> = {};
  for (const sz of SIZES) {
    spread[sz] = computeGradedValueForSize(m, baseSize, sz, unit, profileOrId);
  }
  return spread;
};

export const computeSizeSpreadForAllMeasurements = (
  measurements: any[],
  baseSize: string = 'M',
  unit: 'in' | 'cm' = 'cm',
  profileOrId?: GradingProfile | string | null
): any[] => {
  return (measurements || []).map((m: any) => {
    const isNA = parseNumericValue(m?.value) === null && String(m?.value || '').trim() !== '';
    const gradingStep = inferGradingStep(m, unit, profileOrId);
    const sizes = computeSizeSpreadForMeasurement(m, baseSize, unit, profileOrId);
    return {
      ...m,
      grading: isNA ? '' : String(gradingStep),
      sizes,
    };
  });
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
  gradingProfile?: GradingProfile | string | null;
}

export function exportMeasurementsToCsv({
  packName,
  clientName = '',
  baseSize = 'M',
  unit = 'cm',
  measurements = [],
  gradingProfile,
}: ExportCsvOptions): void {
  const normalizedBase = SIZES.includes(baseSize.toUpperCase()) ? baseSize.toUpperCase() : 'M';

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

  // Data Rows — computed from Base using the active grading profile
  measurements.forEach((m: any, idx: number) => {
    const dimId = m.id || `M${String(idx + 1).padStart(2, '0')}`;
    const idUpper = String(dimId).trim().toUpperCase();
    const pointOfMeasure =
      m.point || m.name || DEFAULT_POM_NAMES[idUpper] || 'Measurement Point';
    const measurementMethod = m.description || '';
    const tolerance = formatTolerance(m);

    const baseNum = parseNumericValue(m?.value);
    const isNA = baseNum === null && String(m?.value || '').trim() !== '';
    const gradingStep = inferGradingStep(m, unit, gradingProfile);

    const sizeValues = SIZES.map((sz) =>
      computeGradedValueForSize(m, normalizedBase, sz, unit, gradingProfile)
    );

    rows.push([
      dimId,
      pointOfMeasure,
      measurementMethod,
      tolerance,
      isNA ? '' : String(gradingStep),
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
