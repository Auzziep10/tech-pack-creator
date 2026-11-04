export const maxDuration = 60;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

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

  let match = str.match(/^([+-]?\d+)[\s-]+(\d+)\/(\d+)$/);
  if (match) {
    const whole = parseFloat(match[1]);
    const sign = whole < 0 ? -1 : 1;
    return whole + sign * (parseFloat(match[2]) / parseFloat(match[3]));
  }

  match = str.match(/^([+-]?\d+)\/(\d+)$/);
  if (match) {
    return parseFloat(match[1]) / parseFloat(match[2]);
  }

  const num = parseFloat(str);
  return isNaN(num) ? null : num;
};

const inferGradingStep = (m: any, unit: 'in' | 'cm' = 'cm'): number => {
  if (m?.grading !== undefined && m?.grading !== null && String(m.grading).trim() !== '') {
    const parsed = parseNumericValue(m.grading);
    if (parsed !== null) return parsed;
  }

  const idUpper = String(m?.id || '').trim().toUpperCase();
  const pointText = `${m?.point || ''} ${m?.name || ''}`.toLowerCase();

  let cmStep: number | undefined;
  if (idUpper === 'CH001' && (pointText.includes('chest') || pointText.includes('bust'))) {
    cmStep = 2.5;
  } else {
    cmStep = DEFAULT_GRADING_CM[idUpper];
  }

  if (cmStep === undefined) {
    const text = `${pointText} ${m?.description || ''}`.toLowerCase();
    if (
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
    } else {
      cmStep = 1;
    }
  }

  if (unit === 'in') {
    return Number((cmStep / 2.54).toFixed(2));
  }
  return cmStep;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { measurements, baseSize = 'M', targetSize = 'M', unit = 'cm' } = req.body;
    const normalizedBase = SIZES.includes(String(baseSize).toUpperCase())
      ? String(baseSize).toUpperCase()
      : 'M';
    const normalizedTarget = SIZES.includes(String(targetSize).toUpperCase())
      ? String(targetSize).toUpperCase()
      : 'M';

    const baseIdx = SIZES.indexOf(normalizedBase);
    const targetIdx = SIZES.indexOf(normalizedTarget);

    const graded = (measurements || []).map((m: any) => {
      const baseNum = parseNumericValue(m?.value);
      const gradingStep = inferGradingStep(m, unit);
      let newVal = m?.value || '';
      if (baseNum !== null) {
        const computed = Math.max(0, baseNum + (targetIdx - baseIdx) * gradingStep);
        newVal = computed.toFixed(1);
      }
      return {
        ...m,
        grading: String(gradingStep),
        value: newVal,
      };
    });

    return res.status(200).json({ data: graded });
  } catch (err: any) {
    console.error('Grading Error details:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
