import { LensCoating, LensType } from '../types.ts';

export type LensCoatingPriceMatrix = Record<string, Record<string, number>>;

/**
 * Default per-lens coating & index pricing (in NGN).
 * Every lens design (Single Vision, Fused Bifocal, Invisible Bifocal, Varilux,
 * Special Order Fused Bifocal, Special Order Invisible Bifocal, Special Order Varilux,
 * and Non-Prescription Protective) has distinct prices for every option on the
 * Coatings & Index page, and every option within a lens tier has a distinct price.
 */
export const DEFAULT_LENS_COATING_PRICE_MATRIX: LensCoatingPriceMatrix = {
  non_prescription_plano: {
    clear_standard: 10000,
    clear_ar: 14000,
    blue_cut: 19000,
    blue_cut_ar: 26000,
    photochromic: 30000,
    photochromic_ar: 39000,
    polarized_tint: 28000,
    index_156: 8000,
    index_161_poly: 18000,
    index_167_ultra: 34000,
    addon_hydrophobic: 9000,
  },
  single_vision: {
    clear_standard: 12000,
    clear_ar: 18000,
    blue_cut: 24000,
    blue_cut_ar: 34000,
    photochromic: 38000,
    photochromic_ar: 52000,
    polarized_tint: 35000,
    index_156: 10000,
    index_161_poly: 22000,
    index_167_ultra: 45000,
    addon_hydrophobic: 12000,
  },
  bifocal_traditional: {
    clear_standard: 16000,
    clear_ar: 22000,
    blue_cut: 29000,
    blue_cut_ar: 40000,
    photochromic: 45000,
    photochromic_ar: 60000,
    polarized_tint: 42000,
    index_156: 14000,
    index_161_poly: 27000,
    index_167_ultra: 49000,
    addon_hydrophobic: 14500,
  },
  invisible_bifocal: {
    clear_standard: 19000,
    clear_ar: 25000,
    blue_cut: 33000,
    blue_cut_ar: 45000,
    photochromic: 50000,
    photochromic_ar: 66000,
    polarized_tint: 46000,
    index_156: 17000,
    index_161_poly: 31000,
    index_167_ultra: 55000,
    addon_hydrophobic: 16500,
  },
  progressive_varilux_comfort: {
    clear_standard: 23000,
    clear_ar: 30000,
    blue_cut: 39000,
    blue_cut_ar: 53000,
    photochromic: 58000,
    photochromic_ar: 76000,
    polarized_tint: 54000,
    index_156: 21000,
    index_161_poly: 36000,
    index_167_ultra: 64000,
    addon_hydrophobic: 19500,
  },
  progressive_varilux_xr: {
    clear_standard: 27000,
    clear_ar: 36000,
    blue_cut: 46000,
    blue_cut_ar: 62000,
    photochromic: 68000,
    photochromic_ar: 88000,
    polarized_tint: 62000,
    index_156: 25000,
    index_161_poly: 44000,
    index_167_ultra: 76000,
    addon_hydrophobic: 23500,
  },
  special_order_bifocal: {
    clear_standard: 20000,
    clear_ar: 27000,
    blue_cut: 35000,
    blue_cut_ar: 47000,
    photochromic: 52000,
    photochromic_ar: 70000,
    polarized_tint: 48000,
    index_156: 18500,
    index_161_poly: 33000,
    index_167_ultra: 58000,
    addon_hydrophobic: 17500,
  },
  special_order_invisible_bifocal: {
    clear_standard: 24000,
    clear_ar: 32000,
    blue_cut: 41000,
    blue_cut_ar: 56000,
    photochromic: 60000,
    photochromic_ar: 80000,
    polarized_tint: 56000,
    index_156: 22500,
    index_161_poly: 39000,
    index_167_ultra: 67000,
    addon_hydrophobic: 20500,
  },
  special_order_varilux: {
    clear_standard: 29000,
    clear_ar: 38000,
    blue_cut: 48000,
    blue_cut_ar: 66000,
    photochromic: 72000,
    photochromic_ar: 94000,
    polarized_tint: 66000,
    index_156: 26500,
    index_161_poly: 46000,
    index_167_ultra: 80000,
    addon_hydrophobic: 24500,
  },
};

export const FALLBACK_COATING_DEFINITIONS = [
  { code: 'clear_standard', label: 'Standard Clear UV400', basePriceNgn: 12000 },
  { code: 'clear_ar', label: 'Crizal Anti-Reflective', basePriceNgn: 18000 },
  { code: 'blue_cut', label: 'Blue Cut Filter', basePriceNgn: 24000 },
  { code: 'photochromic', label: 'Transitions Photochromic', basePriceNgn: 38000 },
  { code: 'index_161_poly', label: '1.61 Thin High-Index', basePriceNgn: 22000 },
];

export function formatShortCoatingLabel(name: string): string {
  return name
    .replace(' Lens with Crizal Anti-Reflective (AR) Coating', ' + Crizal AR')
    .replace('Standard 1.56 Optical Index (Scratch & UV400)', 'Standard 1.56 Index')
    .replace('Thin & Impact-Resistant 1.61 High-Index', '1.61 Thin High-Index')
    .replace('Ultra-Thin 1.67 Aspheric High-Index', '1.67 Ultra-Thin Index');
}

/**
 * Normalizes any lens code or LensType to one of the canonical matrix keys
 * if it matches a known category/name pattern, while preserving exact custom codes
 * when Admin has configured them in siteConfig.lensCoatingPriceMatrix.
 */
export function resolveCanonicalLensKey(
  lensCodeOrType: string | LensType | null | undefined,
  adminMatrix?: LensCoatingPriceMatrix
): string {
  if (!lensCodeOrType) return 'single_vision';

  const rawCode =
    typeof lensCodeOrType === 'string' ? lensCodeOrType : lensCodeOrType.code || '';
  const rawCategory =
    typeof lensCodeOrType === 'string' ? '' : lensCodeOrType.category || '';
  const rawName =
    typeof lensCodeOrType === 'string' ? '' : lensCodeOrType.name || '';

  if (rawCode === 'frames_only') return 'frames_only';

  if (adminMatrix && adminMatrix[rawCode]) {
    return rawCode;
  }
  if (DEFAULT_LENS_COATING_PRICE_MATRIX[rawCode]) {
    return rawCode;
  }

  const combined = `${rawCode} ${rawCategory} ${rawName}`.toLowerCase();
  if (combined.includes('special_order_varilux') || (combined.includes('special order') && combined.includes('varilux'))) {
    return 'special_order_varilux';
  }
  if (
    combined.includes('special_order_invisible') ||
    (combined.includes('special order') && combined.includes('invisible'))
  ) {
    return 'special_order_invisible_bifocal';
  }
  if (
    combined.includes('special_order_bifocal') ||
    (combined.includes('special order') && combined.includes('bifocal'))
  ) {
    return 'special_order_bifocal';
  }
  if (combined.includes('varilux_xr') || combined.includes('xr series')) {
    return 'progressive_varilux_xr';
  }
  if (combined.includes('varilux') || combined.includes('progressive')) {
    return 'progressive_varilux_comfort';
  }
  if (combined.includes('invisible_bifocal') || combined.includes('invisible bifocal')) {
    return 'invisible_bifocal';
  }
  if (combined.includes('bifocal')) {
    return 'bifocal_traditional';
  }
  if (combined.includes('plano') || combined.includes('non_prescription') || combined.includes('non-prescription')) {
    return 'non_prescription_plano';
  }
  return 'single_vision';
}

/**
 * Resolves the coating/index option price for a specific lensCode + coatingCode,
 * respecting Admin overrides in siteConfig.lensCoatingPriceMatrix first,
 * then DEFAULT_LENS_COATING_PRICE_MATRIX, then proportional scaling for custom lenses.
 */
export function resolveCoatingPriceForLens(
  lensCode: string,
  coatingCode: string,
  baseCoatingPriceNgn: number,
  siteConfig?: Record<string, any>
): number {
  if (!lensCode || lensCode === 'frames_only') return 0;

  const adminMatrix: LensCoatingPriceMatrix | undefined = siteConfig?.lensCoatingPriceMatrix;

  // 1. Direct exact lensCode override in Admin Matrix
  if (
    adminMatrix &&
    adminMatrix[lensCode] &&
    typeof adminMatrix[lensCode][coatingCode] === 'number'
  ) {
    return Math.max(0, Math.round(Number(adminMatrix[lensCode][coatingCode])));
  }

  // 2. Canonical lens key override in Admin Matrix
  const canonicalKey = resolveCanonicalLensKey(lensCode, adminMatrix);
  if (
    adminMatrix &&
    adminMatrix[canonicalKey] &&
    typeof adminMatrix[canonicalKey][coatingCode] === 'number'
  ) {
    return Math.max(0, Math.round(Number(adminMatrix[canonicalKey][coatingCode])));
  }

  // 3. Default matrix for canonical lens key
  const defaultForLens = DEFAULT_LENS_COATING_PRICE_MATRIX[canonicalKey];
  if (defaultForLens && typeof defaultForLens[coatingCode] === 'number') {
    const singleVisionDefault =
      DEFAULT_LENS_COATING_PRICE_MATRIX.single_vision?.[coatingCode] ?? baseCoatingPriceNgn;
    const baseDelta =
      baseCoatingPriceNgn > 0 && singleVisionDefault > 0
        ? baseCoatingPriceNgn - singleVisionDefault
        : 0;
    return Math.max(0, Math.round(defaultForLens[coatingCode] + baseDelta));
  }

  // 4. Fallback for custom Admin-created coating codes: scale according to lens tier
  const effectiveBase = baseCoatingPriceNgn > 0 ? baseCoatingPriceNgn : 15000;
  const lower = canonicalKey.toLowerCase();
  let multiplier = 1.0;
  if (lower.includes('special_order_varilux')) multiplier = 2.0;
  else if (lower.includes('varilux_xr')) multiplier = 1.9;
  else if (lower.includes('special_order_invisible')) multiplier = 1.7;
  else if (lower.includes('varilux') || lower.includes('progressive')) multiplier = 1.6;
  else if (lower.includes('special_order')) multiplier = 1.45;
  else if (lower.includes('invisible_bifocal')) multiplier = 1.35;
  else if (lower.includes('bifocal')) multiplier = 1.2;
  else if (lower.includes('plano') || lower.includes('non_prescription')) multiplier = 0.85;

  return Math.round((effectiveBase * multiplier) / 500) * 500;
}

/**
 * Returns the list of active coating/index choices with prices dynamically resolved
 * for the currently selected lensCode in the Quick Cost Estimator.
 */
export function getEstimatorCoatingsForLens(
  lensCode: string,
  lensCoatings: LensCoating[],
  siteConfig?: Record<string, any>
): Array<{ code: string; label: string; priceNgn: number }> {
  const activeDbCoatings = lensCoatings.filter((c) => c.isActive);
  const rawList =
    activeDbCoatings.length > 0
      ? activeDbCoatings.map((c) => ({
          code: c.code,
          label: formatShortCoatingLabel(c.name),
          basePriceNgn: c.priceNgn,
        }))
      : FALLBACK_COATING_DEFINITIONS;

  return rawList.map((item) => ({
    code: item.code,
    label: item.label,
    priceNgn: resolveCoatingPriceForLens(lensCode, item.code, item.basePriceNgn, siteConfig),
  }));
}
