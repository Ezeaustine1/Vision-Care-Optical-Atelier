import React, { useState, useMemo, useEffect } from 'react';
import {
  Check,
  Upload,
  FileText,
  Sparkles,
  AlertTriangle,
  Eye,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  ShoppingBag,
  Info,
  Download,
} from 'lucide-react';
import {
  Product,
  LensType,
  LensCoating,
  PrescriptionData,
  CartItem,
} from '../types.ts';
import { OpticalImage, formatNaira } from './OpticalImage.tsx';
import { exportPrescriptionToPdf } from '../lib/prescriptionPdfExport.ts';
import { resolveCoatingPriceForLens } from '../lib/estimatorPricing.ts';

interface LensCostBreakdown {
  headline: string;
  factors: string[];
  recommendedFor: string;
}

function getLensDesignCostBreakdown(lt: LensType): LensCostBreakdown {
  const code = lt.code.toLowerCase();
  const name = lt.name.toLowerCase();

  if (code.includes('special_order_varilux')) {
    return {
      headline: 'Special Order Custom-Surfaced Varilux Progressive',
      factors: [
        'Individually lab-surfaced toric + multifocal matrix for complex Cylinder, Axis, and Reading ADD prescriptions.',
        'Custom back-surface digital freeform optimization eliminates oblique astigmatism distortion.',
        'Includes multi-stage lensometer verification and authentic Varilux laser engraving.',
      ],
      recommendedFor: 'Special Order prescriptions combining Astigmatism (CYL/AXIS) with Reading Addition (ADD).',
    };
  }

  if (code.includes('special_order_invisible_bifocal')) {
    return {
      headline: 'Special Order Blended Invisible Bifocal Lab Surfacing',
      factors: [
        'Bespoke diamond-blended dual-power surfacing crafted for combined Cylinder, Axis, and ADD powers.',
        'Seamless outer cosmetic surface with zero visible segment line and custom axis rotation alignment.',
      ],
      recommendedFor: 'Special Order astigmatic & presbyopic wearers seeking a line-free bifocal aesthetic.',
    };
  }

  if (code.includes('special_order_bifocal')) {
    return {
      headline: 'Special Order Fused Toric Bifocal Surfacing',
      factors: [
        'Custom laboratory surfacing combining cylindrical astigmatism axis correction with a fused near-reading segment.',
        'Precision vertical segment height and optical center calibration for high or complex prescriptions.',
      ],
      recommendedFor: 'Special Order prescriptions requiring a distinct, wide near-vision window with CYL/AXIS correction.',
    };
  }

  if (code.includes('varilux_xr') || name.includes('xr')) {
    return {
      headline: 'Bespoke Freeform Progressive Engineering',
      factors: [
        'Dual-sided CNC digital freeform surfacing across 40,000+ micro-optical points.',
        'Binocular Wavefront Management eliminates peripheral "swim" and head-tilting.',
        'Tailored to your exact pupillary distance, vertex posture, and frame wrap.',
      ],
      recommendedFor: 'Demanding multifocal wearers seeking instant panoramic focus at all distances.',
    };
  }

  if (code.includes('varilux') || lt.category === 'progressive_varilux' || name.includes('progressive')) {
    return {
      headline: 'Genuine Varilux Multifocal Surfacing',
      factors: [
        'Seamless 3-zone power progression (Distance → Computer → Near Reading) with no visible line.',
        'Requires complex digital corridor optimization and multi-axis lensometer calibration.',
        'Includes authentic Varilux laser micro-engraving and adaptation guarantee.',
      ],
      recommendedFor: 'Presbyopia (ADD +0.75D to +3.50D) needing all-day visual comfort.',
    };
  }

  if (code.includes('invisible_bifocal') || lt.category === 'invisible_bifocal') {
    return {
      headline: 'Blended Segment Polishing Technology',
      factors: [
        'Precision diamond-blended transition zone removes the harsh visible bifocal ledge.',
        'Extra multi-stage polishing cycle for cosmetic clarity and reduced image jump.',
      ],
      recommendedFor: 'Clients wanting dual distance/near powers with a youthful, line-free appearance.',
    };
  }

  if (code.includes('bifocal') || lt.category === 'bifocal') {
    return {
      headline: 'Fused Dual-Segment Optical Molding',
      factors: [
        'Combines two distinct refractive powers into a single optical blank with a 28mm reading window.',
        'Requires precise vertical segment height alignment to your lower eyelid margin.',
      ],
      recommendedFor: 'Drivers and readers who prefer a wide, clearly defined near reading zone.',
    };
  }

  if (code.includes('plano') || lt.category === 'non_prescription') {
    return {
      headline: 'Single-Vision Zero-Power Protective Optical Glazing (0.00 Plano)',
      factors: [
        'Engineered with single-vision aspheric optical geometry at 0.00D (no prescription power) for zero visual distortion.',
        'Cast from optical-grade monomer blanks with integrated HEV blue-light, photochromic, and multi-layer Anti-Reflective (AR) shields.',
        'Custom-edged to fit your chosen frame bevel with 100% UV400 baseline protection.',
      ],
      recommendedFor: 'Clients without a prescription seeking Blue Cut Photo AR, Photo AR, or digital screen protection.',
    };
  }

  return {
    headline: 'Single-Vision Digital Aspheric Surfacing',
    factors: [
      'Individually surfaced to your OD/OS sphere, cylinder, and astigmatism axis (0°–180°).',
      'Digital optical centration matched to your binocular Pupillary Distance (PD).',
    ],
    recommendedFor: 'Dedicated distance driving, everyday myopia/hyperopia, or single-focus reading.',
  };
}

interface ProtectiveLensOptionSpec {
  label: string;
  fullTitle: string;
  tag: string;
  coatingCode: string;
  description: string;
  highlights: string[];
  recommendedFor: string;
}

const PROTECTIVE_LENS_DESIGN_OPTIONS: ProtectiveLensOptionSpec[] = [
  {
    label: 'Blue Cut Photo AR',
    fullTitle: 'Blue Cut Photo AR (Photochromic + Blue Cut Digital Filter + Anti-Reflective)',
    tag: 'Blue Cut + Photochromic + Anti-Reflective',
    coatingCode: 'photochromic_ar',
    description:
      'All-in-one zero-power (0.00 Plano) single-vision protective lens that filters harmful HEV 415–455nm blue light from digital screens indoors, eliminates surface and night-driving glare with multi-layer Anti-Reflective (AR) coating, and automatically darkens into UV400 sunglasses in outdoor sunlight.',
    highlights: [
      'Filters harmful HEV 415–455nm blue light from monitors, laptops, tablets, and smartphones to prevent digital eye strain',
      'Automatically darkens into rich UV400 sun-protective lenses outdoors and returns to crystal clear indoors within seconds',
      'Multi-layer Anti-Reflective (AR) vacuum coating eliminates screen reflections, studio flash bounce, and night-driving headlight halos',
    ],
    recommendedFor:
      'Executives, software engineers, gamers, and drivers needing complete indoor screen protection and outdoor sun adaptation.',
  },
  {
    label: 'Photo AR',
    fullTitle: 'Photo AR (Photochromic Sun-Adaptive + Anti-Reflective)',
    tag: 'Photochromic Sun-Adaptive + Anti-Reflective',
    coatingCode: 'photochromic',
    description:
      'Light-adaptive zero-power (0.00 Plano) single-vision protective lens that stays crystal clear with Crizal Anti-Reflective (AR) glare protection indoors and during night driving, while rapidly darkening into comfortable UV400 sun-protective lenses outdoors.',
    highlights: [
      'Remains 99.2% crystal clear indoors with zero colour distortion for natural everyday visual comfort',
      'Transitions photochromic molecules darken automatically in outdoor UV sunlight with 100% UVA/UVB protection',
      'Crizal multi-layer Anti-Reflective (AR) shield eliminates oncoming headlight dazzle and overhead office glare',
    ],
    recommendedFor:
      'Indoor-to-outdoor wearers and drivers seeking seamless UV sun adaptation and reflection-free night vision.',
  },
];

const SINGLE_VISION_OPTION_DESCRIPTIONS: Record<string, string> = {
  'Distance Vision (Myopia / Hyperopia)':
    'Full-field single-vision optical correction calibrated for crisp far-distance clarity, driving, television, and everyday wear.',
  'Near Reading Vision':
    'Dedicated single-focus near-vision lens optimized for books, documents, fine print, and close-up reading comfort (35–40cm).',
  'Intermediate Computer Distance':
    'Ergonomic mid-range single-vision focus tailored for desktop monitors, laptops, and office workstations (55–70cm).',
};

function getLensCoatingCostBreakdown(c: LensCoating): LensCostBreakdown {
  const code = c.code.toLowerCase();

  if (code.includes('167')) {
    return {
      headline: 'Why 1.67 Ultra-Thin High-Index Costs More',
      factors: [
        'Synthesized from high-density MR-7 optical monomer that bends light 40% more efficiently.',
        'Flatter aspheric geometry eliminates thick "coke-bottle" edges and eye magnification.',
        'Up to 35% lighter on the nose bridge with high tensile strength for rimless/semi-rimless mounts.',
      ],
      recommendedFor: 'Stronger prescriptions (±4.50D and higher) or luxury thin-metal frames.',
    };
  }

  if (code.includes('161')) {
    return {
      headline: 'Why 1.61 High-Index Costs More',
      factors: [
        'High-tensile optical resin reduces lens profile thickness by ~25% over standard 1.56.',
        'Superior impact resistance prevents drill-hole cracking in rimless and half-rim frames.',
      ],
      recommendedFor: 'Moderate prescriptions (±2.25D to ±4.50D) and lightweight everyday wear.',
    };
  }

  if (code.includes('156')) {
    return {
      headline: 'Standard 1.56 Mid-Index Value',
      factors: [
        'Included at no extra material surcharge for mild prescriptions.',
        'Factory-sealed with dual-sided hard scratch coat and UV400 protection.',
      ],
      recommendedFor: 'Mild prescriptions between -2.25D and +2.00D in full-rim frames.',
    };
  }

  if (code.includes('photochromic_ar')) {
    return {
      headline: 'Triple-Matrix Photochromic + Blue-Cut + AR',
      factors: [
        'Impregnated with trillions of silver-halide photochromic molecules that react to outdoor UV.',
        'Combines selective HEV 415–455nm blue-light substrate absorption with vacuum-deposited AR layers.',
      ],
      recommendedFor: 'All-in-one indoor workstation protection and outdoor sun adaptation.',
    };
  }

  if (code.includes('photochromic')) {
    return {
      headline: 'Transitions Adaptive Molecular Technology',
      factors: [
        'In-mass photochromic dye thermal bonding ensures uniform tinting and rapid indoor fade-back.',
        'Blocks 100% UVA/UVB while adapting automatically to changing sunlight.',
      ],
      recommendedFor: 'Clients moving frequently between indoor offices and bright outdoor sunlight.',
    };
  }

  if (code.includes('blue_cut_ar')) {
    return {
      headline: 'Dual HEV Blue-Cut + Sapphire Anti-Reflective',
      factors: [
        'Combines monomer-level HEV blue-light filtration with 7-layer ion-assisted AR vacuum deposition.',
        'Eliminates both digital screen eye strain and night-driving headlight halos.',
      ],
      recommendedFor: 'Executives, software engineers, and night drivers.',
    };
  }

  if (code.includes('blue_cut')) {
    return {
      headline: 'HEV 415–455nm Digital Filter Monomer',
      factors: [
        'Specialized light-absorbing chromophores attenuate high-energy blue wavelengths from LEDs.',
        'Reduces ciliary muscle fatigue and circadian disruption without harsh yellow tinting.',
      ],
      recommendedFor: '6+ hours daily on laptops, monitors, and smartphones.',
    };
  }

  if (code.includes('clear_ar')) {
    return {
      headline: 'Multi-Layer Vacuum Anti-Reflective (AR)',
      factors: [
        'Clean-room ion-beam deposition applies microscopic metal-oxide layers to cancel surface glare.',
        'Increases light transmission to 99.2% for sharper night contrast.',
      ],
      recommendedFor: 'Night driving, studio photography, and video calls.',
    };
  }

  if (code.includes('hydrophobic')) {
    return {
      headline: 'Fluoropolymer Nano-Seal Topcoat',
      factors: [
        'Creates a high-contact-angle 115° surface tension barrier against water, skin oils, and dust.',
        'Extends the lifespan of underlying anti-reflective coatings.',
      ],
      recommendedFor: 'Humid climates, active wearers, and effortless daily lens cleaning.',
    };
  }

  return {
    headline: 'Standard Optical Monomer',
    factors: [
      'High-Abbe value optical resin for natural color fidelity without chromatic aberration.',
      'Included in base lens package.',
    ],
    recommendedFor: 'Everyday indoor and general optical use.',
  };
}

interface PrescriptionWizardProps {
  products: Product[];
  lensTypes: LensType[];
  lensCoatings: LensCoating[];
  savedPrescriptions: PrescriptionData[];
  siteConfig?: Record<string, any>;
  initialProduct?: Product | null;
  initialOrderType?: 'prescription_glasses' | 'frames_only' | 'protective_glasses' | 'replacement_lenses';
  onAddToCart: (item: CartItem, openCheckoutAfter?: boolean) => void;
  onSavePrescriptionToAccount?: (rx: PrescriptionData) => Promise<void>;
}

const SPH_VALUES: string[] = [];
for (let v = -10.0; v <= 6.0; v += 0.25) {
  SPH_VALUES.push(v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2));
}

const CYL_VALUES: string[] = [];
for (let v = -5.0; v <= 4.0; v += 0.25) {
  CYL_VALUES.push(v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2));
}

const ADD_VALUES = ['0.00', '+0.75', '+1.00', '+1.25', '+1.50', '+1.75', '+2.00', '+2.25', '+2.50', '+2.75', '+3.00', '+3.25', '+3.50'];
const PD_VALUES = Array.from({ length: 24 }, (_, i) => String(52 + i));

export const PrescriptionWizard: React.FC<PrescriptionWizardProps> = ({
  products,
  lensTypes,
  lensCoatings,
  savedPrescriptions,
  siteConfig,
  initialProduct,
  initialOrderType = 'prescription_glasses',
  onAddToCart,
  onSavePrescriptionToAccount,
}) => {
  const [step, setStep] = useState<number>(1);
  const [orderType, setOrderType] = useState<
    'prescription_glasses' | 'frames_only' | 'protective_glasses' | 'replacement_lenses'
  >(initialOrderType);

  const [rxMode, setRxMode] = useState<'manual' | 'upload_ocr'>('manual');
  const [rxData, setRxData] = useState<PrescriptionData>({
    patientName: '',
    submissionType: 'manual',
    odSph: '-1.50',
    odCyl: '-0.50',
    odAxis: '90',
    odAdd: '0.00',
    osSph: '-1.75',
    osCyl: '-0.25',
    osAxis: '85',
    osAdd: '0.00',
    pd: '63',
    monocularPdOd: '',
    monocularPdOs: '',
    prescriptionDate: new Date().toISOString().slice(0, 10),
    doctorName: '',
    notes: '',
    documentDataUrl: '',
    documentFileName: '',
    ocrConfidenceNotes: '',
    unreadableFields: [],
    customerConfirmed: false,
  });

  const [isExtractingOcr, setIsExtractingOcr] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [lastUploadedPayload, setLastUploadedPayload] = useState<{
    mimeType: string;
    base64Data: string;
    fileName: string;
    dataUrl: string;
  } | null>(null);

  // Step 3: Lens Design (starts unselected at ₦0 until client chooses a lens)
  const [selectedLensId, setSelectedLensId] = useState<number | null>(null);
  const [selectedLensOption, setSelectedLensOption] = useState<string>('Distance Vision (Myopia / Hyperopia)');

  // Step 4: Lens Material, Coating & Colour (starts unselected at ₦0 until client chooses options)
  const tintCoatings = useMemo(
    () => lensCoatings.filter((c) => c.groupType === 'tint_treatment' && c.isActive),
    [lensCoatings]
  );
  const indexMaterials = useMemo(
    () => lensCoatings.filter((c) => c.groupType === 'index_material' && c.isActive),
    [lensCoatings]
  );
  const addonFeatures = useMemo(
    () => lensCoatings.filter((c) => c.groupType === 'addon_feature' && c.isActive),
    [lensCoatings]
  );

  const [selectedTintCode, setSelectedTintCode] = useState<string | null>(null);
  const [selectedIndexCode, setSelectedIndexCode] = useState<string | null>(null);
  const [selectedAddonCodes, setSelectedAddonCodes] = useState<string[]>([]);

  // Step 5: Frame Selection (only pre-selected if client clicked "Select Frame" on a specific product)
  const activeFrames = useMemo(() => products.filter((p) => p.isActive), [products]);
  const [selectedFrameId, setSelectedFrameId] = useState<number | null>(
    initialProduct?.id ?? null
  );
  const [selectedFrameColor, setSelectedFrameColor] = useState<string>('');

  useEffect(() => {
    setSelectedFrameId(initialProduct?.id ?? null);
    setSelectedFrameColor('');
  }, [initialProduct]);

  useEffect(() => {
    setOrderType(initialOrderType);
  }, [initialOrderType]);

  const selectedFrame = useMemo(() => {
    if (orderType === 'replacement_lenses' || selectedFrameId === null) return null;
    return activeFrames.find((f) => f.id === selectedFrameId) || null;
  }, [activeFrames, selectedFrameId, orderType]);

  const frameColors = useMemo(() => {
    if (!selectedFrame) return ['Default'];
    try {
      return JSON.parse(selectedFrame.colorsJson);
    } catch {
      return ['Default'];
    }
  }, [selectedFrame]);

  const activeColor = selectedFrameColor || frameColors[0] || 'Default';

  const selectedLens = useMemo(() => {
    if (orderType === 'frames_only' || selectedLensId === null) return null;
    return lensTypes.find((l) => l.id === selectedLensId && l.isActive) || null;
  }, [lensTypes, selectedLensId, orderType]);

  const selectedTint = useMemo(
    () => (selectedTintCode ? tintCoatings.find((c) => c.code === selectedTintCode) || null : null),
    [tintCoatings, selectedTintCode]
  );
  const selectedIndex = useMemo(
    () => (selectedIndexCode ? indexMaterials.find((c) => c.code === selectedIndexCode) || null : null),
    [indexMaterials, selectedIndexCode]
  );
  const selectedAddons = useMemo(
    () => addonFeatures.filter((c) => selectedAddonCodes.includes(c.code)),
    [addonFeatures, selectedAddonCodes]
  );

  // Determine the active lens code for dynamic Coating & Index pricing in Step 4
  const effectiveLensForCoatings = useMemo(() => {
    if (orderType === 'frames_only') {
      return { code: 'frames_only', label: 'Frames Only', source: 'order_type' as const };
    }
    if (selectedLens) {
      return {
        code: selectedLens.code,
        label: selectedLens.name,
        source: 'selected_lens' as const,
      };
    }
    if (orderType === 'protective_glasses') {
      const plano = lensTypes.find((l) => l.category === 'non_prescription' && l.isActive);
      return {
        code: plano?.code || 'non_prescription_plano',
        label: plano?.name || 'Non-Prescription Protective Lens (0.00 Plano)',
        source: 'detected_rx' as const,
      };
    }

    // Use live prescription detection logic to determine the corresponding lens tier
    const isNonZero = (val: string | undefined) => {
      if (!val) return false;
      const num = parseFloat(String(val).replace(/[^\d.-]/g, ''));
      return !Number.isNaN(num) && Math.abs(num) > 0;
    };
    const hasSph = isNonZero(rxData.odSph) || isNonZero(rxData.osSph);
    const hasCylOrAxis =
      isNonZero(rxData.odCyl) ||
      isNonZero(rxData.osCyl) ||
      isNonZero(rxData.odAxis) ||
      isNonZero(rxData.osAxis);
    const hasAdd = isNonZero(rxData.odAdd) || isNonZero(rxData.osAdd);

    if (hasAdd && hasCylOrAxis) {
      return {
        code: 'special_order_bifocal',
        label: 'Special Order Fused Bifocal Lens (Detected)',
        source: 'detected_rx' as const,
      };
    }
    if (hasAdd && !hasCylOrAxis) {
      return {
        code: 'bifocal_traditional',
        label: 'Fused Bifocal Lens (Detected)',
        source: 'detected_rx' as const,
      };
    }
    if (hasSph || hasCylOrAxis) {
      return {
        code: 'single_vision',
        label: 'Single Vision Lens (Detected)',
        source: 'detected_rx' as const,
      };
    }
    return {
      code: 'single_vision',
      label: 'Single Vision Lens',
      source: 'detected_rx' as const,
    };
  }, [
    orderType,
    selectedLens,
    lensTypes,
    rxData.odSph,
    rxData.osSph,
    rxData.odCyl,
    rxData.osCyl,
    rxData.odAxis,
    rxData.osAxis,
    rxData.odAdd,
    rxData.osAdd,
  ]);

  const getDynamicCoatingPrice = (coating: LensCoating): number => {
    if (orderType === 'frames_only') return 0;
    return resolveCoatingPriceForLens(
      effectiveLensForCoatings.code,
      coating.code,
      coating.priceNgn,
      siteConfig
    );
  };

  // Accurate Real-Time Cost Calculation (strictly reflects client's actual selections)
  const frameCost = useMemo(() => {
    if (orderType === 'replacement_lenses' || !selectedFrame) return 0;
    const rawPrice =
      selectedFrame.discountPriceNgn !== null &&
      selectedFrame.discountPriceNgn !== undefined &&
      Number(selectedFrame.discountPriceNgn) > 0
        ? Number(selectedFrame.discountPriceNgn)
        : Number(selectedFrame.priceNgn);
    return Number.isFinite(rawPrice) ? Math.max(0, Math.round(rawPrice)) : 0;
  }, [orderType, selectedFrame]);

  const lensCost = useMemo(() => {
    if (orderType === 'frames_only' || orderType === 'protective_glasses' || !selectedLens) return 0;
    const rawPrice = Number(selectedLens.priceNgn);
    return Number.isFinite(rawPrice) ? Math.max(0, Math.round(rawPrice)) : 0;
  }, [orderType, selectedLens]);

  const coatingCost = useMemo(() => {
    if (orderType === 'frames_only') return 0;
    const tintPrice = selectedTint
      ? resolveCoatingPriceForLens(
          effectiveLensForCoatings.code,
          selectedTint.code,
          selectedTint.priceNgn,
          siteConfig
        )
      : 0;
    const indexPrice = selectedIndex
      ? resolveCoatingPriceForLens(
          effectiveLensForCoatings.code,
          selectedIndex.code,
          selectedIndex.priceNgn,
          siteConfig
        )
      : 0;
    const addonPrice = selectedAddons.reduce(
      (acc, a) =>
        acc +
        resolveCoatingPriceForLens(
          effectiveLensForCoatings.code,
          a.code,
          a.priceNgn,
          siteConfig
        ),
      0
    );
    const sum = tintPrice + indexPrice + addonPrice;
    return Number.isFinite(sum) ? Math.max(0, Math.round(sum)) : 0;
  }, [
    orderType,
    selectedTint,
    selectedIndex,
    selectedAddons,
    effectiveLensForCoatings.code,
    siteConfig,
  ]);

  const totalUnitCost = useMemo(
    () => frameCost + lensCost + coatingCost,
    [frameCost, lensCost, coatingCost]
  );

  const handleResetConfigurationTotal = () => {
    setSelectedFrameId(null);
    setSelectedFrameColor('');
    setSelectedLensId(null);
    setSelectedTintCode(null);
    setSelectedIndexCode(null);
    setSelectedAddonCodes([]);
  };

  const [pdfExportedFeedback, setPdfExportedFeedback] = useState(false);

  const isProtectivePlanoActive =
    orderType === 'protective_glasses' ||
    effectiveLensForCoatings.code === 'non_prescription_plano';

  const resolvedSelectedTintName = useMemo(() => {
    if (!selectedTint) return undefined;
    if (isProtectivePlanoActive) {
      const matchedSpec = PROTECTIVE_LENS_DESIGN_OPTIONS.find(
        (o) => o.coatingCode === selectedTint.code
      );
      if (matchedSpec) return matchedSpec.fullTitle;
    }
    return selectedTint.name;
  }, [selectedTint, isProtectivePlanoActive]);

  const handleExportPrescriptionPdf = () => {
    const coatingParts = [
      resolvedSelectedTintName,
      selectedIndex?.name,
      ...selectedAddons.map((a) => a.name),
    ].filter(Boolean);

    exportPrescriptionToPdf({
      prescription: { ...rxData, customerConfirmed: true },
      selectedFrameName:
        orderType === 'replacement_lenses'
          ? 'Client Existing Frame (Replacement Lenses)'
          : selectedFrame?.name,
      selectedLensName: selectedLens ? `${selectedLens.name} (${selectedLensOption})` : undefined,
      selectedCoatingSummary: coatingParts.length > 0 ? coatingParts.join(' + ') : undefined,
      totalEstimateFormatted: totalUnitCost > 0 ? formatNaira(totalUnitCost) : undefined,
    });

    setPdfExportedFeedback(true);
    setTimeout(() => setPdfExportedFeedback(false), 3000);
  };

  // Handle File Upload + AI OCR
  const runOcrExtraction = async (mimeType: string, base64Data: string, fileName: string, dataUrl: string) => {
    setIsExtractingOcr(true);
    setOcrError('');
    setLastUploadedPayload({ mimeType, base64Data, fileName, dataUrl });
    try {
      const response = await fetch('/api/prescriptions/extract-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mimeType, base64Data, fileName }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'OCR extraction failed');
      }

      setRxData((prev) => ({
        ...prev,
        submissionType: 'upload_ocr',
        patientName: data.patientName || prev.patientName,
        odSph: SPH_VALUES.includes(data.odSph) ? data.odSph : prev.odSph,
        odCyl: CYL_VALUES.includes(data.odCyl) ? data.odCyl : prev.odCyl,
        odAxis: data.odAxis ? String(data.odAxis) : prev.odAxis,
        odAdd: ADD_VALUES.includes(data.odAdd) ? data.odAdd : prev.odAdd,
        osSph: SPH_VALUES.includes(data.osSph) ? data.osSph : prev.osSph,
        osCyl: CYL_VALUES.includes(data.osCyl) ? data.osCyl : prev.osCyl,
        osAxis: data.osAxis ? String(data.osAxis) : prev.osAxis,
        osAdd: ADD_VALUES.includes(data.osAdd) ? data.osAdd : prev.osAdd,
        pd: PD_VALUES.includes(data.pd) ? data.pd : prev.pd,
        monocularPdOd: data.monocularPdOd || prev.monocularPdOd,
        monocularPdOs: data.monocularPdOs || prev.monocularPdOs,
        prescriptionDate: data.prescriptionDate || prev.prescriptionDate,
        doctorName: data.doctorName || prev.doctorName,
        documentDataUrl: dataUrl,
        documentFileName: fileName,
        ocrConfidenceNotes:
          data.confidenceNotes ||
          'Optical parameters extracted. Please verify each value against your clinical document before proceeding.',
        unreadableFields: Array.isArray(data.unreadableFields) ? data.unreadableFields : [],
        customerConfirmed: false,
      }));
    } catch (err: any) {
      setOcrError(err.message || 'Could not automatically extract values. Please enter or verify manually below.');
    } finally {
      setIsExtractingOcr(false);
    }
  };

  const processSelectedFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    const allowedExt = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
    if (!allowedMime.includes(file.type) && !allowedExt.includes(ext)) {
      setOcrError('Unsupported format. Please upload a JPG, JPEG, PNG, or PDF file.');
      return;
    }
    const resolvedMime =
      file.type || (ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg');

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64Data = result.split(',')[1] || '';
      runOcrExtraction(resolvedMime, base64Data, file.name, result);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processSelectedFile(file);
    e.target.value = '';
  };

  // Generate a realistic clinical prescription slip on canvas and run live Gemini OCR on it
  const handleGenerateAndScanSampleSlip = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 760;
    canvas.height = 460;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 760, 460);
    ctx.strokeStyle = '#0B192C';
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, 724, 424);

    ctx.fillStyle = '#0B192C';
    ctx.font = 'bold 22px Georgia';
    ctx.fillText('LAGOS PREMIER EYE CLINIC & OPTOMETRY', 40, 60);
    ctx.font = '14px sans-serif';
    ctx.fillText('Dr. Tunde Bakare, OD, FNCO  |  Date: 2026-10-28', 40, 88);
    ctx.fillText('Patient Name: Chinedu Eze', 40, 115);

    ctx.font = 'bold 16px monospace';
    ctx.fillText('EYE       SPH       CYL       AXIS      ADD', 40, 165);
    ctx.fillText('------------------------------------------------', 40, 185);
    ctx.fillText('OD (R)   -2.25     -0.75      110      +1.50', 40, 215);
    ctx.fillText('OS (L)   -2.50     -0.50       85      +1.50', 40, 250);
    ctx.fillText('------------------------------------------------', 40, 280);
    ctx.fillText('Binocular PD: 64 mm   |   Monocular PD: OD 32.0 / OS 32.0', 40, 315);
    ctx.font = '14px sans-serif';
    ctx.fillText('Recommendation: Progressive Varilux with Blue Cut Anti-Reflective Coating.', 40, 360);

    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.split(',')[1] || '';
    runOcrExtraction('image/png', base64Data, 'clinical_prescription_slip.png', dataUrl);
  };

  const isPrescriptionRequired = orderType === 'prescription_glasses' || orderType === 'replacement_lenses';

  const handleCompleteWizard = async (openCheckoutAfter: boolean) => {
    if (isPrescriptionRequired && onSavePrescriptionToAccount) {
      try {
        await onSavePrescriptionToAccount({ ...rxData, customerConfirmed: true });
      } catch {
        // Proceed even if guest user
      }
    }

    const frameImg = (() => {
      if (!selectedFrame) return '/src/assets/images/frame_aviator_gold_1793890598064.jpg';
      try {
        return JSON.parse(selectedFrame.imagesJson)[0];
      } catch {
        return '/src/assets/images/frame_aviator_gold_1793890598064.jpg';
      }
    })();

    const coatingParts = [
      resolvedSelectedTintName,
      selectedIndex?.name,
      ...selectedAddons.map((a) => a.name),
    ].filter(Boolean);

    const item: CartItem = {
      cartItemId: `vc-${Date.now()}`,
      productId: orderType === 'replacement_lenses' ? null : selectedFrame?.id || null,
      productName:
        orderType === 'replacement_lenses'
          ? 'Custom Replacement Lenses (Client Frame)'
          : selectedFrame?.name || 'Custom Optical Configuration (No Frame Selected)',
      productBrand:
        orderType === 'replacement_lenses' ? 'VISION CARE LAB' : selectedFrame?.brand || 'VISION CARE',
      productImage: frameImg,
      orderType,
      selectedColor: orderType === 'replacement_lenses' ? 'Existing Frame' : selectedFrame ? activeColor : 'N/A',
      quantity: 1,
      framePriceNgn: frameCost,
      lensTypeName:
        orderType === 'frames_only'
          ? 'Frames Only (No Lenses)'
          : selectedLens?.name || 'No Lens Selected',
      lensOptionSelected:
        orderType === 'frames_only'
          ? 'Chassis Only'
          : selectedLens
          ? selectedLensOption
          : 'None',
      lensPriceNgn: lensCost,
      coatingSummary:
        orderType === 'frames_only'
          ? 'No Lens Treatment'
          : coatingParts.length > 0
          ? coatingParts.join(' + ')
          : 'Standard Untreated',
      coatingPriceNgn: coatingCost,
      prescriptionSnapshot: isPrescriptionRequired ? { ...rxData, customerConfirmed: true } : null,
      unitTotalNgn: totalUnitCost,
    };

    onAddToCart(item, openCheckoutAfter);
  };

  const stepsList = [
    { num: 1, label: '1. Order Type' },
    { num: 2, label: '2. Prescription' },
    { num: 3, label: '3. Lens Design' },
    { num: 4, label: '4. Coatings & Index' },
    { num: 5, label: '5. Select Frame' },
    { num: 6, label: '6. Review Specs' },
    { num: 7, label: '7. Complete Order' },
  ];

  const isFieldUnreadable = (fieldKey: string) => {
    return (rxData.unreadableFields || []).some((u) =>
      u.toLowerCase().includes(fieldKey.toLowerCase())
    );
  };

  const rxLensGuidance = useMemo(() => {
    const isNonZero = (val: string | undefined) => {
      if (!val) return false;
      const num = parseFloat(String(val).replace(/[^\d.-]/g, ''));
      return !Number.isNaN(num) && Math.abs(num) > 0;
    };

    const hasSph = isNonZero(rxData.odSph) || isNonZero(rxData.osSph);
    const hasCyl = isNonZero(rxData.odCyl) || isNonZero(rxData.osCyl);
    const hasAxis = isNonZero(rxData.odAxis) || isNonZero(rxData.osAxis);
    const hasCylOrAxis = hasCyl || hasAxis;
    const hasAdd = isNonZero(rxData.odAdd) || isNonZero(rxData.osAdd);

    if (!hasSph && !hasCylOrAxis && !hasAdd) {
      return null;
    }

    // Case 1: Only Sphere, OR Cylinder & Axis, OR Sphere, Cylinder & Axis (no ADD)
    if (!hasAdd && (hasSph || hasCylOrAxis)) {
      const detectedBoxes =
        hasSph && hasCylOrAxis
          ? 'Sphere (SPH), Cylinder (CYL), and Axis'
          : hasSph
          ? 'Sphere (SPH)'
          : 'Cylinder (CYL) and Axis';

      return {
        type: 'single_lens' as const,
        badge: 'Single Lens Prescription',
        headline: 'Your Prescription Indicates a Single Lens (Single Vision)',
        detectedBoxes,
        message: `You have entered values in the ${detectedBoxes} box${
          hasSph && !hasCylOrAxis ? '' : 'es'
        } only. This prescription is a Single Lens (Single Vision Lens).`,
        suitableLenses: ['Single Vision Lens'],
      };
    }

    // Case 2: Cylinder, Axis & ADD, OR Sphere, Cylinder, Axis & ADD
    if (hasAdd && hasCylOrAxis) {
      const detectedBoxes = hasSph
        ? 'Sphere (SPH), Cylinder (CYL), Axis, and ADD'
        : 'Cylinder (CYL), Axis, and ADD';

      return {
        type: 'special_order_multifocal' as const,
        badge: 'Special Order Lens Prescription',
        headline: 'Special Order Lens — Suitable for Bifocal Fused, Invisible Bifocal, or Varilux',
        detectedBoxes,
        message: `You have entered values in the ${detectedBoxes} boxes. Please note that your lens prescription is a Special Order Lens, and your lens will be suitable for Bifocal Fused, Invisible Bifocal, or Varilux.`,
        suitableLenses: ['Bifocal Fused', 'Invisible Bifocal', 'Varilux (Progressive)'],
      };
    }

    // Case 3: Only Sphere & ADD (or ADD without Cylinder/Axis)
    const detectedBoxes = hasSph ? 'Sphere (SPH) and ADD' : 'ADD';
    return {
      type: 'standard_multifocal' as const,
      badge: 'Multifocal Lens Prescription',
      headline: 'Suitable for Bifocal Fused, Invisible Bifocal, or Varilux',
      detectedBoxes,
      message: `You have entered values in the ${detectedBoxes} boxes. Your lens will be suitable for Bifocal Fused, Invisible Bifocal, or Varilux.`,
      suitableLenses: ['Bifocal Fused', 'Invisible Bifocal', 'Varilux (Progressive)'],
    };
  }, [
    rxData.odSph,
    rxData.osSph,
    rxData.odCyl,
    rxData.osCyl,
    rxData.odAxis,
    rxData.osAxis,
    rxData.odAdd,
    rxData.osAdd,
  ]);

  const isSingleVisionDetected =
    isPrescriptionRequired && rxLensGuidance?.type === 'single_lens';

  const step3LensTypes = useMemo(() => {
    const active = lensTypes.filter((lt) => lt.isActive);

    const isSpecialOrder = (lt: LensType) => {
      const code = (lt.code || '').toLowerCase();
      const cat = (lt.category || '').toLowerCase();
      const name = (lt.name || '').toLowerCase();
      return (
        code.startsWith('special_order_') ||
        cat.startsWith('special_order_') ||
        name.includes('special order')
      );
    };

    const isSingleVision = (lt: LensType) => {
      const code = (lt.code || '').toLowerCase();
      const cat = (lt.category || '').toLowerCase();
      const name = (lt.name || '').toLowerCase();
      return (
        code === 'single_vision' ||
        cat === 'single_vision' ||
        name.includes('single vision')
      );
    };

    const isNonPrescription = (lt: LensType) => {
      const code = (lt.code || '').toLowerCase();
      const cat = (lt.category || '').toLowerCase();
      const name = (lt.name || '').toLowerCase();
      return (
        code === 'non_prescription_plano' ||
        cat === 'non_prescription' ||
        name.includes('non-prescription')
      );
    };

    if (orderType === 'protective_glasses') {
      const planoOnly = active.filter((lt) => isNonPrescription(lt));
      if (planoOnly.length > 0) return planoOnly;
    }

    if (isPrescriptionRequired && rxLensGuidance?.type === 'standard_multifocal') {
      return active.filter(
        (lt) => !isSingleVision(lt) && !isNonPrescription(lt) && !isSpecialOrder(lt)
      );
    }

    if (isPrescriptionRequired && rxLensGuidance?.type === 'special_order_multifocal') {
      return active.filter((lt) => isSpecialOrder(lt));
    }

    return active;
  }, [lensTypes, orderType, isPrescriptionRequired, rxLensGuidance]);

  useEffect(() => {
    if (
      isPrescriptionRequired &&
      (rxLensGuidance?.type === 'standard_multifocal' ||
        rxLensGuidance?.type === 'special_order_multifocal') &&
      selectedLensId !== null &&
      !step3LensTypes.some((lt) => lt.id === selectedLensId)
    ) {
      setSelectedLensId(null);
    }
  }, [isPrescriptionRequired, rxLensGuidance, selectedLensId, step3LensTypes]);

  const handleProceedFromPrescriptionStep = () => {
    if (isPrescriptionRequired && !rxData.customerConfirmed) {
      setRxData((prev) => ({ ...prev, customerConfirmed: true }));
    }
    if (orderType === 'frames_only') {
      setStep(selectedFrame ? 6 : 5);
      return;
    }
    if (isSingleVisionDetected) {
      const svLens =
        lensTypes.find((l) => l.category === 'single_vision' && l.isActive) ||
        lensTypes.find((l) => l.name.toLowerCase().includes('single vision') && l.isActive);
      if (svLens) {
        setSelectedLensId(svLens.id);
        try {
          const opts = JSON.parse(svLens.optionsJson);
          if (Array.isArray(opts) && opts[0]) {
            setSelectedLensOption(opts[0]);
          }
        } catch {
          // keep current option
        }
      }
      setStep(4);
      return;
    }
    if (
      selectedLensId !== null &&
      !step3LensTypes.some((lt) => lt.id === selectedLensId)
    ) {
      setSelectedLensId(null);
    }
    setStep(3);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8 border-b border-slate-200 pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-widest uppercase text-[#1E40AF] mb-2">
            Bespoke Optical Dispensing Wizard
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-[#0B192C] tracking-tight">
            Order Prescription & Protective Eyewear
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Configure your exact optical parameters, upload your doctor’s prescription for AI-assisted extraction, and pair with Varilux, Blue Cut, or Photochromic lenses.
          </p>
        </div>

        {/* Live Running Configuration Total — Responsive, Interactive & 100% Accurate */}
        <div className="w-full lg:w-auto bg-[#0B192C] text-white p-4 sm:px-5 sm:py-4 rounded-xl border border-white/10 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center justify-between sm:justify-start gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="block text-[11px] text-slate-300 uppercase tracking-wider font-medium">
                  Running Configuration Total
                </span>
              </div>
              <div className="flex items-baseline gap-2.5 mt-0.5">
                <span className="text-2xl sm:text-3xl font-semibold font-tabular text-[#C5A059] tracking-tight">
                  {formatNaira(totalUnitCost)}
                </span>
                {totalUnitCost > 0 && (
                  <button
                    type="button"
                    onClick={handleResetConfigurationTotal}
                    title="Reset all selected options to ₦0"
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
              <span className="block text-[10px] text-slate-400 font-tabular mt-0.5">
                {orderType === 'frames_only'
                  ? `${formatNaira(frameCost)} = ${formatNaira(totalUnitCost)}`
                  : orderType === 'protective_glasses'
                  ? `${formatNaira(frameCost)} + ${formatNaira(coatingCost)} = ${formatNaira(totalUnitCost)}`
                  : `${formatNaira(frameCost)} + ${formatNaira(lensCost)} + ${formatNaira(coatingCost)} = ${formatNaira(totalUnitCost)}`}
              </span>
            </div>
          </div>

          <div
            className={`grid ${
              orderType === 'frames_only'
                ? 'grid-cols-1'
                : orderType === 'protective_glasses'
                ? 'grid-cols-2'
                : 'grid-cols-3'
            } sm:flex sm:flex-col gap-1.5 sm:gap-1 text-xs text-slate-200 border-t sm:border-t-0 sm:border-l border-white/15 pt-3 sm:pt-0 sm:pl-4 font-tabular`}
          >
            {/* Frame Line */}
            <div className="flex items-center justify-between gap-2 bg-white/5 sm:bg-transparent px-2.5 py-1.5 sm:p-0 rounded-lg">
              <button
                type="button"
                onClick={() => setStep(5)}
                className="text-left hover:text-[#C5A059] transition-colors truncate cursor-pointer"
                title={
                  orderType === 'replacement_lenses'
                    ? 'Own Frame (₦0)'
                    : selectedFrame
                    ? `${selectedFrame.name} — Click to change frame`
                    : 'No frame selected yet — Click to choose frame'
                }
              >
                <span className="text-slate-400">Frame: </span>
                <span className="font-semibold text-white">{formatNaira(frameCost)}</span>
              </button>
              {selectedFrame && orderType !== 'replacement_lenses' && (
                <button
                  type="button"
                  onClick={() => setSelectedFrameId(null)}
                  title="Clear selected frame"
                  className="text-[10px] text-slate-400 hover:text-rose-300 px-1 rounded cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>

            {/* Lens Line (hidden for protective_glasses and frames_only) */}
            {orderType !== 'protective_glasses' && orderType !== 'frames_only' && (
              <div className="flex items-center justify-between gap-2 bg-white/5 sm:bg-transparent px-2.5 py-1.5 sm:p-0 rounded-lg">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="text-left hover:text-[#C5A059] transition-colors truncate cursor-pointer"
                  title={
                    selectedLens
                      ? `${selectedLens.name} — Click to change lens`
                      : 'No lens selected yet — Click to choose lens'
                  }
                >
                  <span className="text-slate-400">Lens: </span>
                  <span className="font-semibold text-white">{formatNaira(lensCost)}</span>
                </button>
                {selectedLens && (
                  <button
                    type="button"
                    onClick={() => setSelectedLensId(null)}
                    title="Clear selected lens"
                    className="text-[10px] text-slate-400 hover:text-rose-300 px-1 rounded cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>
            )}

            {/* Coatings Line (hidden for frames_only) */}
            {orderType !== 'frames_only' && (
              <div className="flex items-center justify-between gap-2 bg-white/5 sm:bg-transparent px-2.5 py-1.5 sm:p-0 rounded-lg">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="text-left hover:text-[#C5A059] transition-colors truncate cursor-pointer"
                  title={
                    coatingCost > 0
                      ? 'Click to adjust coatings & index'
                      : 'No paid coatings selected — Click to configure'
                  }
                >
                  <span className="text-slate-400">Coatings: </span>
                  <span className="font-semibold text-white">{formatNaira(coatingCost)}</span>
                </button>
                {(selectedTintCode || selectedIndexCode || selectedAddonCodes.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTintCode(null);
                      setSelectedIndexCode(null);
                      setSelectedAddonCodes([]);
                    }}
                    title="Clear selected coatings & index"
                    className="text-[10px] text-slate-400 hover:text-rose-300 px-1 rounded cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 7-Step Interactive Progress Bar */}
      <div className="mb-6 sm:mb-8 overflow-x-auto no-scrollbar pb-2">
        <div className="flex items-center gap-2 min-w-max">
          {stepsList
            .filter(
              (s) =>
                !(s.num === 5 && Boolean(selectedFrame) && step !== 5 && orderType !== 'frames_only') &&
                !(orderType === 'protective_glasses' && (s.num === 2 || s.num === 3)) &&
                !(orderType === 'frames_only' && (s.num === 2 || s.num === 3 || s.num === 4))
            )
            .map((s) => {
              const isActive = step === s.num;
              const isDone = step > s.num;
              return (
                <button
                  key={s.num}
                  onClick={() => setStep(s.num)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${
                    isActive
                      ? 'bg-[#0B192C] text-white shadow-sm'
                      : isDone
                      ? 'bg-[#E0F2FE] text-[#0B192C] hover:bg-sky-200'
                      : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isDone && <Check className="w-3.5 h-3.5 text-[#1E40AF]" />}
                  <span>{s.label}</span>
                </button>
              );
            })}
        </div>
      </div>

      {/* STEP 1: CHOOSE WHAT YOU WANT */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-[#0B192C]">
            Step 1: Choose What You Want to Order
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                id: 'prescription_glasses',
                title: 'Complete Prescription Glasses',
                subtitle: 'Frame + Custom Prescription Lenses (Single Vision, Bifocal, or Varilux Progressive)',
                details: 'Upload your prescription or enter OD/OS values manually. Includes ultrasonic fitting and alignment.',
              },
              {
                id: 'protective_glasses',
                title: 'Protective & Screen Glasses (Without Prescription)',
                subtitle: 'Zero-Power (0.00 Plano) Blue Cut, Photochromic, or Anti-Reflective Eyewear',
                details: 'Designed for digital professionals, gamers, and outdoor drivers who do not need vision correction.',
              },
              {
                id: 'frames_only',
                title: 'Designer Frames Only',
                subtitle: 'Purchase an authentic Vision Care frame chassis with factory demo lenses',
                details: 'Ideal if you want to glaze lenses locally later or collect a spare luxury frame.',
              },
              {
                id: 'replacement_lenses',
                title: 'Replacement Lenses for Your Existing Frame',
                subtitle: 'Keep your current frame and upgrade to new prescription or protective lenses',
                details: 'Our courier collects your existing frame, fits your new precision-cut lenses, and delivers back to you.',
              },
            ].map((option) => {
              const selected = orderType === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    const nextOrderType = option.id as
                      | 'prescription_glasses'
                      | 'frames_only'
                      | 'protective_glasses'
                      | 'replacement_lenses';
                    setOrderType(nextOrderType);
                    if (nextOrderType === 'frames_only') {
                      setSelectedLensId(null);
                      setSelectedTintCode(null);
                      setSelectedIndexCode(null);
                      setSelectedAddonCodes([]);
                    } else if (nextOrderType === 'replacement_lenses') {
                      setSelectedFrameId(null);
                    } else if (nextOrderType === 'protective_glasses') {
                      const planoLens = lensTypes.find(
                        (l) =>
                          l.isActive &&
                          (l.code === 'non_prescription_plano' || l.category === 'non_prescription')
                      );
                      if (planoLens) {
                        setSelectedLensId(planoLens.id);
                      }
                      if (
                        !PROTECTIVE_LENS_DESIGN_OPTIONS.some(
                          (o) => o.label === selectedLensOption || o.fullTitle === selectedLensOption
                        )
                      ) {
                        setSelectedLensOption(PROTECTIVE_LENS_DESIGN_OPTIONS[0].fullTitle);
                      }
                      if (
                        selectedTintCode &&
                        !PROTECTIVE_LENS_DESIGN_OPTIONS.some((o) => o.coatingCode === selectedTintCode)
                      ) {
                        setSelectedTintCode(null);
                      }
                    }
                  }}
                  className={`text-left p-6 rounded-xl border transition-all duration-300 cursor-pointer ${
                    selected
                      ? 'option-pop-selected bg-gradient-to-br from-[#0B192C] via-[#132A4A] to-[#1E40AF] border-[#C5A059] ring-2 ring-[#C5A059]/40 shadow-xl'
                      : 'bg-white border-slate-200 hover:border-[#1E40AF]/40 hover:-translate-y-0.5 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3
                        className={`text-lg font-semibold transition-colors ${
                          selected ? 'text-white' : 'text-[#0B192C]'
                        }`}
                      >
                        {option.title}
                      </h3>
                      <p
                        className={`text-sm font-medium mt-1 transition-colors ${
                          selected ? 'text-[#C5A059]' : 'text-[#1E40AF]'
                        }`}
                      >
                        {option.subtitle}
                      </p>
                    </div>
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        selected
                          ? 'bg-[#C5A059] text-[#0B192C] scale-110 shadow-sm'
                          : 'border border-slate-300 text-transparent'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  </div>
                  <p
                    className={`text-sm mt-3 leading-relaxed transition-colors ${
                      selected ? 'text-[#E0F2FE]/90' : 'text-slate-600'
                    }`}
                  >
                    {option.details}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={() => {
                if (orderType === 'frames_only') {
                  setSelectedLensId(null);
                  setSelectedTintCode(null);
                  setSelectedIndexCode(null);
                  setSelectedAddonCodes([]);
                  setStep(5);
                  return;
                }
                if (orderType === 'protective_glasses') {
                  const planoLens = lensTypes.find(
                    (l) =>
                      l.isActive &&
                      (l.code === 'non_prescription_plano' || l.category === 'non_prescription')
                  );
                  if (planoLens) {
                    setSelectedLensId(planoLens.id);
                  }
                  if (
                    !PROTECTIVE_LENS_DESIGN_OPTIONS.some(
                      (o) => o.label === selectedLensOption || o.fullTitle === selectedLensOption
                    )
                  ) {
                    setSelectedLensOption(PROTECTIVE_LENS_DESIGN_OPTIONS[0].fullTitle);
                  }
                  if (
                    selectedTintCode &&
                    !PROTECTIVE_LENS_DESIGN_OPTIONS.some((o) => o.coatingCode === selectedTintCode)
                  ) {
                    setSelectedTintCode(null);
                  }
                  setStep(4);
                  return;
                }
                setStep(2);
              }}
              className="w-full sm:w-auto justify-center px-6 py-3 bg-[#0B192C] text-white text-sm font-medium rounded-lg hover:bg-[#162B49] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>
                {orderType === 'frames_only'
                  ? 'Continue to Select Frame'
                  : orderType === 'protective_glasses'
                  ? 'Continue to Coatings & Index'
                  : 'Continue to Step 2'}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: PRESCRIPTION SUBMISSION / AI OCR */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-[#0B192C]">
                Step 2: Prescription Parameters & AI OCR Verification
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                {isPrescriptionRequired
                  ? 'Choose Option A to enter your OD/OS values manually, or Option B to upload your prescription photo/PDF for automatic extraction.'
                  : 'You selected a non-prescription option. No optical prescription is required—proceed directly to lens/frame selection.'}
              </p>
            </div>

            {isPrescriptionRequired && (
              <div className="grid grid-cols-1 sm:flex sm:items-center gap-1 p-1 bg-slate-200/80 rounded-lg shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setRxMode('manual');
                    setRxData((prev) => ({ ...prev, submissionType: 'manual' }));
                  }}
                  className={`px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    rxMode === 'manual'
                      ? 'bg-[#0B192C] text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Option A: Enter Manually
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRxMode('upload_ocr');
                    setRxData((prev) => ({ ...prev, submissionType: 'upload_ocr' }));
                  }}
                  className={`px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    rxMode === 'upload_ocr'
                      ? 'bg-[#0B192C] text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  Option B: Upload Prescription (AI OCR)
                </button>
              </div>
            )}
          </div>

          {!isPrescriptionRequired ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
              <ShieldCheck className="w-10 h-10 text-[#1E40AF] mx-auto" />
              <h3 className="text-xl font-semibold text-[#0B192C]">
                No Prescription Needed for {orderType === 'frames_only' ? 'Frames Only' : 'Protective Zero-Power Glasses'}
              </h3>
              <p className="text-sm text-slate-600 max-w-lg mx-auto">
                Your eyewear will be prepared with 0.00 Plano non-prescription lenses (or factory demo lenses for Frames Only).
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Saved Prescriptions Selector if available */}
              {savedPrescriptions.length > 0 && (
                <div className="bg-[#E0F2FE]/60 border border-sky-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#1E40AF]">
                      Saved Prescriptions in Your Account
                    </p>
                    <p className="text-sm text-[#0B192C]">
                      Select a previously saved prescription to populate all fields automatically.
                    </p>
                  </div>
                  <select
                    onChange={(e) => {
                      const found = savedPrescriptions.find((p) => String(p.id) === e.target.value);
                      if (found) {
                        setRxData({
                          ...found,
                          customerConfirmed: true,
                        });
                      }
                    }}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-[#0B192C]"
                  >
                    <option value="">-- Choose Saved Prescription --</option>
                    {savedPrescriptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.patientName} · OD {p.odSph} / OS {p.osSph} ({p.prescriptionDate || 'Saved'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* OPTION B: UPLOAD & AI OCR PANEL */}
              {rxMode === 'upload_ocr' && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-5 shadow-xs">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-semibold text-[#0B192C] flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-[#C5A059] shrink-0" />
                        <span>AI-Assisted Clinical Prescription Document Reader</span>
                      </h3>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Supported formats: JPG, JPEG, PNG, PDF. Extracts OD, OS, SPH, CYL, AXIS, ADD, and PD values without inventing missing figures.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleGenerateAndScanSampleSlip}
                        disabled={isExtractingOcr}
                        className="w-full sm:w-auto px-3.5 py-2.5 bg-[#E0F2FE] text-[#0B192C] hover:bg-sky-200 disabled:opacity-60 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <FileText className="w-4 h-4 text-[#1E40AF] shrink-0" />
                        <span>
                          {isExtractingOcr ? 'Scanning Prescription...' : 'Test with Sample Clinical Prescription Slip'}
                        </span>
                      </button>
                      {lastUploadedPayload && !isExtractingOcr && (
                        <button
                          type="button"
                          onClick={() =>
                            runOcrExtraction(
                              lastUploadedPayload.mimeType,
                              lastUploadedPayload.base64Data,
                              lastUploadedPayload.fileName,
                              lastUploadedPayload.dataUrl
                            )
                          }
                          className="w-full sm:w-auto px-3.5 py-2.5 border border-slate-300 text-[#0B192C] hover:bg-slate-50 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-[#1E40AF] shrink-0" />
                          <span>Re-Scan</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-stretch">
                    <label
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingOver(true);
                      }}
                      onDragLeave={() => setIsDraggingOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingOver(false);
                        const droppedFile = e.dataTransfer.files?.[0];
                        if (droppedFile) {
                          processSelectedFile(droppedFile);
                        }
                      }}
                      className={`relative overflow-hidden flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 sm:p-8 cursor-pointer transition-colors text-center min-h-[210px] ${
                        isExtractingOcr
                          ? 'border-[#1E40AF] bg-[#0B192C]/95 text-white'
                          : isDraggingOver
                          ? 'border-[#1E40AF] bg-[#E0F2FE]/40'
                          : 'border-slate-300 hover:border-[#1E40AF] bg-slate-50/60'
                      }`}
                    >
                      {isExtractingOcr && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-5 bg-[#0B192C]/90 backdrop-blur-xs">
                          {lastUploadedPayload?.dataUrl && lastUploadedPayload.dataUrl.startsWith('data:image') && (
                            <img
                              src={lastUploadedPayload.dataUrl}
                              alt="Prescription being scanned"
                              className="absolute inset-0 w-full h-full object-contain opacity-20 p-3 pointer-events-none"
                            />
                          )}
                          {/* Corner Optical Alignment Reticles */}
                          <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-[#C5A059] rounded-tl pointer-events-none" />
                          <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-[#C5A059] rounded-tr pointer-events-none" />
                          <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-[#C5A059] rounded-bl pointer-events-none" />
                          <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-[#C5A059] rounded-br pointer-events-none" />

                          {/* Sweeping Optical Laser Scan Line */}
                          <div className="absolute inset-x-4 top-2 h-0.5 bg-gradient-to-r from-transparent via-[#C5A059] to-transparent shadow-[0_0_14px_2px_rgba(197,160,89,0.75)] optical-scan-beam pointer-events-none" />

                          <div className="relative z-20 flex flex-col items-center text-center space-y-2">
                            <div className="p-2.5 rounded-full bg-white/10 border border-white/15">
                              <RefreshCw className="w-5 h-5 text-[#C5A059] animate-spin" />
                            </div>
                            <span className="text-xs sm:text-sm font-semibold text-white tracking-wide">
                              Optical OCR Scanning Document...
                            </span>
                            <span className="text-[11px] text-slate-300 font-tabular max-w-xs truncate">
                              {lastUploadedPayload?.fileName || 'Analyzing OD / OS / CYL / AXIS / PD'}
                            </span>
                          </div>
                        </div>
                      )}

                      <Upload className="w-8 h-8 text-[#1E40AF] mb-3 shrink-0" />
                      <span className="text-xs sm:text-sm font-semibold text-[#0B192C] break-words max-w-full">
                        {rxData.documentFileName
                          ? `Replace Uploaded File (${rxData.documentFileName})`
                          : 'Click or Drag & Drop Prescription Image or PDF'}
                      </span>
                      <span className="text-xs text-slate-500 mt-1">
                        High-resolution photo, clinic scan, or PDF document (JPG, JPEG, PNG, PDF)
                      </span>
                      <span className="mt-3 px-4 py-1.5 bg-[#0B192C] text-white text-xs font-medium rounded-lg">
                        Browse Device Files
                      </span>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>

                    <div className="space-y-3 flex flex-col justify-center">
                      {isExtractingOcr && (
                        <div className="relative overflow-hidden p-4 sm:p-5 bg-slate-50 rounded-xl border border-[#1E40AF]/30 flex items-center gap-3.5 shadow-xs">
                          <div className="p-2.5 rounded-lg bg-[#E0F2FE] text-[#1E40AF] shrink-0">
                            <RefreshCw className="w-5 h-5 animate-spin" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-semibold text-[#0B192C]">
                              Reading Optical Prescription via Gemini Vision OCR...
                            </p>
                            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                              Calibrating Right Eye (OD), Left Eye (OS), Cylinder Axis (0°–180°), Reading Addition, and Pupillary Distance.
                            </p>
                          </div>
                        </div>
                      )}

                      {ocrError && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <span>{ocrError}</span>
                        </div>
                      )}

                      {!rxData.documentDataUrl && !isExtractingOcr && !ocrError && (
                        <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-2">
                          <p className="font-semibold text-[#0B192C]">
                            Ready for Optical Prescription Extraction
                          </p>
                          <p className="leading-relaxed">
                            Upload a photo or PDF of your prescription on the left, or click{' '}
                            <strong className="text-[#1E40AF]">Test with Sample Clinical Prescription Slip</strong> above to see automatic OD/OS/PD extraction in action.
                          </p>
                        </div>
                      )}

                      {rxData.documentDataUrl && !isExtractingOcr && (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#0B192C] truncate max-w-[240px] sm:max-w-xs">
                              Uploaded: {rxData.documentFileName}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setLastUploadedPayload(null);
                                setRxData((prev) => ({
                                  ...prev,
                                  documentDataUrl: '',
                                  documentFileName: '',
                                  ocrConfidenceNotes: '',
                                  unreadableFields: [],
                                }));
                              }}
                              className="text-xs font-medium text-red-600 hover:underline shrink-0"
                            >
                              Remove File
                            </button>
                          </div>

                          {rxData.documentDataUrl.startsWith('data:image') ? (
                            <img
                              src={rxData.documentDataUrl}
                              alt="Uploaded clinical prescription preview"
                              className="max-h-40 w-full rounded-lg border border-slate-200 object-contain mx-auto bg-white p-1"
                            />
                          ) : (
                            <div className="p-3 bg-white rounded-lg border border-slate-200 flex items-center gap-2 text-xs text-[#0B192C]">
                              <FileText className="w-4 h-4 text-[#1E40AF] shrink-0" />
                              <span className="truncate">PDF Prescription Document Attached ({rxData.documentFileName})</span>
                            </div>
                          )}

                          {/* Responsive Extracted Values Snapshot */}
                          <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#1E40AF]">
                                Extracted Optical Parameters
                              </span>
                              <span className="text-[11px] text-emerald-700 font-medium">
                                Populated in Form Below
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-tabular text-[#0B192C]">
                              <div className="p-2 rounded bg-slate-50 border border-slate-100">
                                <span className="font-semibold block text-slate-500 text-[10px]">RIGHT EYE (OD)</span>
                                <span>
                                  SPH {rxData.odSph} · CYL {rxData.odCyl} · AXIS {rxData.odAxis}° · ADD {rxData.odAdd}
                                </span>
                              </div>
                              <div className="p-2 rounded bg-slate-50 border border-slate-100">
                                <span className="font-semibold block text-slate-500 text-[10px]">LEFT EYE (OS)</span>
                                <span>
                                  SPH {rxData.osSph} · CYL {rxData.osCyl} · AXIS {rxData.osAxis}° · ADD {rxData.osAdd}
                                </span>
                              </div>
                            </div>
                            <div className="text-[11px] text-slate-600 font-tabular flex flex-wrap gap-x-4 gap-y-1">
                              <span>PD: {rxData.pd} mm</span>
                              {rxData.patientName && <span>Patient: {rxData.patientName}</span>}
                              {rxData.doctorName && <span>Clinic/Dr: {rxData.doctorName}</span>}
                            </div>

                            {rxLensGuidance && (
                              <div
                                className={`mt-2 p-2.5 rounded-lg border text-xs leading-relaxed ${
                                  rxLensGuidance.type === 'special_order_multifocal'
                                    ? 'bg-[#0B192C] text-white border-[#C5A059]'
                                    : rxLensGuidance.type === 'standard_multifocal'
                                    ? 'bg-[#E0F2FE]/80 text-[#0B192C] border-sky-300'
                                    : 'bg-emerald-50 text-emerald-950 border-emerald-200'
                                }`}
                              >
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <span
                                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                                      rxLensGuidance.type === 'special_order_multifocal'
                                        ? 'bg-[#C5A059] text-[#0B192C]'
                                        : rxLensGuidance.type === 'standard_multifocal'
                                        ? 'bg-[#1E40AF] text-white'
                                        : 'bg-emerald-700 text-white'
                                    }`}
                                  >
                                    {rxLensGuidance.badge}
                                  </span>
                                  <span className="font-semibold">{rxLensGuidance.headline}</span>
                                </div>
                                <p
                                  className={
                                    rxLensGuidance.type === 'special_order_multifocal'
                                      ? 'text-slate-200'
                                      : 'text-slate-700'
                                  }
                                >
                                  {rxLensGuidance.message}
                                </p>
                              </div>
                            )}
                          </div>

                          {rxData.ocrConfidenceNotes && (
                            <p className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                              <strong className="text-[#1E40AF]">OCR Extraction Summary:</strong>{' '}
                              {rxData.ocrConfidenceNotes}
                            </p>
                          )}

                          {rxData.unreadableFields && rxData.unreadableFields.length > 0 && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
                              <strong>Fields Requiring Manual Confirmation:</strong>{' '}
                              {rxData.unreadableFields.join(', ')}. Please verify or complete these highlighted fields in the table below.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* INTERACTIVE OD / OS PRESCRIPTION TABLE */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-[#0B192C]">
                    Clinical Refraction Values (OD & OS)
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      setRxData((prev) => ({
                        ...prev,
                        patientName: prev.patientName || 'Adebayo Ogunlesi',
                        odSph: '-1.75',
                        odCyl: '-0.50',
                        odAxis: '105',
                        odAdd: '+1.25',
                        osSph: '-2.00',
                        osCyl: '-0.75',
                        osAxis: '80',
                        osAdd: '+1.25',
                        pd: '64',
                        doctorName: 'Dr. Kemi Adesina (Lagos Eye Centre)',
                      }))
                    }
                    className="text-xs font-medium text-[#1E40AF] hover:underline self-start sm:self-auto"
                  >
                    Populate Example Prescription
                  </button>
                </div>

                <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
                  <table className="w-full min-w-[540px] text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                        <th className="py-3 pr-4">Eye</th>
                        <th className="py-3 px-3">Sphere (SPH)</th>
                        <th className="py-3 px-3">Cylinder (CYL)</th>
                        <th className="py-3 px-3">Axis (0°–180°)</th>
                        <th className="py-3 pl-3">Reading ADD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm font-tabular">
                      {/* RIGHT EYE (OD) */}
                      <tr>
                        <td className="py-4 pr-4 font-sans">
                          <span className="font-semibold text-[#0B192C] block">Right Eye (OD)</span>
                          <span className="text-xs text-slate-500">Oculus Dexter</span>
                        </td>
                        <td className="py-4 px-3">
                          <select
                            value={rxData.odSph}
                            onChange={(e) => setRxData({ ...rxData, odSph: e.target.value })}
                            className={`w-full border rounded-lg px-3 py-2 text-sm bg-white ${
                              isFieldUnreadable('od sph') ? 'border-amber-500 bg-amber-50' : 'border-slate-300'
                            }`}
                          >
                            {SPH_VALUES.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-4 px-3">
                          <select
                            value={rxData.odCyl}
                            onChange={(e) => setRxData({ ...rxData, odCyl: e.target.value })}
                            className={`w-full border rounded-lg px-3 py-2 text-sm bg-white ${
                              isFieldUnreadable('od cyl') ? 'border-amber-500 bg-amber-50' : 'border-slate-300'
                            }`}
                          >
                            {CYL_VALUES.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-4 px-3">
                          <input
                            type="number"
                            min={0}
                            max={180}
                            value={rxData.odAxis}
                            onChange={(e) => setRxData({ ...rxData, odAxis: e.target.value })}
                            placeholder="0 - 180"
                            className={`w-full border rounded-lg px-3 py-2 text-sm bg-white ${
                              isFieldUnreadable('od axis') ? 'border-amber-500 bg-amber-50' : 'border-slate-300'
                            }`}
                          />
                        </td>
                        <td className="py-4 pl-3">
                          <select
                            value={rxData.odAdd}
                            onChange={(e) => setRxData({ ...rxData, odAdd: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                          >
                            {ADD_VALUES.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>

                      {/* LEFT EYE (OS) */}
                      <tr>
                        <td className="py-4 pr-4 font-sans">
                          <span className="font-semibold text-[#0B192C] block">Left Eye (OS)</span>
                          <span className="text-xs text-slate-500">Oculus Sinister</span>
                        </td>
                        <td className="py-4 px-3">
                          <select
                            value={rxData.osSph}
                            onChange={(e) => setRxData({ ...rxData, osSph: e.target.value })}
                            className={`w-full border rounded-lg px-3 py-2 text-sm bg-white ${
                              isFieldUnreadable('os sph') ? 'border-amber-500 bg-amber-50' : 'border-slate-300'
                            }`}
                          >
                            {SPH_VALUES.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-4 px-3">
                          <select
                            value={rxData.osCyl}
                            onChange={(e) => setRxData({ ...rxData, osCyl: e.target.value })}
                            className={`w-full border rounded-lg px-3 py-2 text-sm bg-white ${
                              isFieldUnreadable('os cyl') ? 'border-amber-500 bg-amber-50' : 'border-slate-300'
                            }`}
                          >
                            {CYL_VALUES.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-4 px-3">
                          <input
                            type="number"
                            min={0}
                            max={180}
                            value={rxData.osAxis}
                            onChange={(e) => setRxData({ ...rxData, osAxis: e.target.value })}
                            placeholder="0 - 180"
                            className={`w-full border rounded-lg px-3 py-2 text-sm bg-white ${
                              isFieldUnreadable('os axis') ? 'border-amber-500 bg-amber-50' : 'border-slate-300'
                            }`}
                          />
                        </td>
                        <td className="py-4 pl-3">
                          <select
                            value={rxData.osAdd}
                            onChange={(e) => setRxData({ ...rxData, osAdd: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                          >
                            {ADD_VALUES.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Live Clinical Prescription Lens Classification & Suitability Indicator */}
                {rxLensGuidance && (
                  <div
                    className={`p-4 sm:p-5 rounded-xl border transition-all ${
                      rxLensGuidance.type === 'special_order_multifocal'
                        ? 'bg-gradient-to-br from-[#0B192C] via-[#132A4A] to-[#1E40AF] text-white border-[#C5A059] shadow-sm'
                        : rxLensGuidance.type === 'standard_multifocal'
                        ? 'bg-[#E0F2FE]/70 text-[#0B192C] border-[#1E40AF]/30'
                        : 'bg-emerald-50/90 text-[#0B192C] border-emerald-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-current/10">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${
                            rxLensGuidance.type === 'special_order_multifocal'
                              ? 'bg-[#C5A059] text-[#0B192C]'
                              : rxLensGuidance.type === 'standard_multifocal'
                              ? 'bg-[#1E40AF] text-white'
                              : 'bg-emerald-700 text-white'
                          }`}
                        >
                          {rxLensGuidance.badge}
                        </span>
                        <h4 className="text-sm sm:text-base font-semibold">
                          {rxLensGuidance.headline}
                        </h4>
                      </div>
                      <span
                        className={`text-xs font-medium ${
                          rxLensGuidance.type === 'special_order_multifocal'
                            ? 'text-[#C5A059]'
                            : 'text-[#1E40AF]'
                        }`}
                      >
                        Detected Input: {rxLensGuidance.detectedBoxes}
                      </span>
                    </div>

                    <p
                      className={`text-xs sm:text-sm mt-2.5 leading-relaxed ${
                        rxLensGuidance.type === 'special_order_multifocal'
                          ? 'text-slate-100'
                          : 'text-slate-700'
                      }`}
                    >
                      {rxLensGuidance.message}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[11px] font-semibold uppercase tracking-wider ${
                            rxLensGuidance.type === 'special_order_multifocal'
                              ? 'text-[#C5A059]'
                              : 'text-slate-500'
                          }`}
                        >
                          Recommended Lens Options:
                        </span>
                        {rxLensGuidance.suitableLenses.map((lensLabel) => (
                          <span
                            key={lensLabel}
                            className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                              rxLensGuidance.type === 'special_order_multifocal'
                                ? 'bg-white/10 text-white border-white/20'
                                : 'bg-white text-[#0B192C] border-slate-200'
                            }`}
                          >
                            {lensLabel}
                          </span>
                        ))}
                      </div>

                      {rxLensGuidance.type === 'single_lens' && (
                        <button
                          type="button"
                          onClick={handleProceedFromPrescriptionStep}
                          className="px-4 py-2 bg-[#0B192C] hover:bg-[#162B49] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                        >
                          <span>Continue to Lens Coatings & Materials</span>
                          <ChevronRight className="w-3.5 h-3.5 text-[#C5A059]" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* PD, Doctor, Date, and Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Binocular PD (mm)
                    </label>
                    <select
                      value={rxData.pd}
                      onChange={(e) => setRxData({ ...rxData, pd: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-tabular bg-white"
                    >
                      {PD_VALUES.map((v) => (
                        <option key={v} value={v}>
                          {v} mm {v === '63' ? '(Standard Adult Average)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Monocular PD OD / OS (Optional)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="OD e.g. 31.5"
                        value={rxData.monocularPdOd}
                        onChange={(e) => setRxData({ ...rxData, monocularPdOd: e.target.value })}
                        className="border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-tabular"
                      />
                      <input
                        type="text"
                        placeholder="OS e.g. 31.5"
                        value={rxData.monocularPdOs}
                        onChange={(e) => setRxData({ ...rxData, monocularPdOs: e.target.value })}
                        className="border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-tabular"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Prescription Date
                    </label>
                    <input
                      type="date"
                      value={rxData.prescriptionDate}
                      onChange={(e) => setRxData({ ...rxData, prescriptionDate: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Optometrist / Clinic Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. Okafor, VI Eye Clinic"
                      value={rxData.doctorName}
                      onChange={(e) => setRxData({ ...rxData, doctorName: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Patient Full Name
                    </label>
                    <input
                      type="text"
                      placeholder="Full name for clinical lens packet"
                      value={rxData.patientName}
                      onChange={(e) => setRxData({ ...rxData, patientName: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Additional Dispensing Instructions
                    </label>
                    <input
                      type="text"
                      placeholder="Prism notes, vertex distance, or occupational computer distance..."
                      value={rxData.notes}
                      onChange={(e) => setRxData({ ...rxData, notes: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* Mandatory Confirmation Checkbox + Export to PDF action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="flex items-start gap-3 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={rxData.customerConfirmed}
                      onChange={(e) => setRxData({ ...rxData, customerConfirmed: e.target.checked })}
                      className="mt-1 w-4 h-4 accent-[#1E40AF]"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed">
                      <strong className="text-[#0B192C]">Mandatory Clinical Confirmation:</strong> I have reviewed the Right Eye (OD), Left Eye (OS), Axis, and Pupillary Distance values above and confirm they are accurate—or I request a Vision Care chief optometrist to verify my uploaded prescription prior to lens surfacing.
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={handleExportPrescriptionPdf}
                    className="px-3.5 py-2 bg-white hover:bg-[#E0F2FE]/60 text-[#0B192C] border border-slate-300 hover:border-[#1E40AF] rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer self-start sm:self-center"
                  >
                    <Download className="w-3.5 h-3.5 text-[#1E40AF]" />
                    <span>{pdfExportedFeedback ? 'PDF Downloaded' : 'Export to PDF'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-5 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-100 flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Step</span>
            </button>
            <button
              type="button"
              onClick={handleProceedFromPrescriptionStep}
              className="px-6 py-3 bg-[#0B192C] text-white text-sm font-medium rounded-lg hover:bg-[#162B49] flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                Continue to{' '}
                {orderType === 'frames_only'
                  ? selectedFrame
                    ? 'Review Specifications'
                    : 'Frame Selection'
                  : isSingleVisionDetected
                  ? 'Lens Coatings & Materials'
                  : 'Lens Design'}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: LENS TYPE SELECTION */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-[#0B192C]">
              Step 3: Select Your Preferred Lens Design
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {orderType === 'protective_glasses'
                ? 'Single-Vision Non-Prescription Protective Lens Design (0.00 Plano) — Engineered with single-vision optical clarity for digital screen filtration, anti-reflective glare control, and outdoor UV400 sun adaptation without prescription power.'
                : 'From single-vision clarity to genuine Varilux multifocal progressives and invisible bifocals.'}
            </p>
          </div>

          <div
            className={`grid grid-cols-1 ${
              orderType === 'protective_glasses' && step3LensTypes.length === 1
                ? 'lg:grid-cols-1'
                : 'md:grid-cols-2 lg:grid-cols-3'
            } gap-6`}
          >
            {step3LensTypes.map((lt) => {
              const isSelected = selectedLens?.id === lt.id;
              const costInfo = getLensDesignCostBreakdown(lt);
              const isPlanoProtectiveCard =
                lt.code === 'non_prescription_plano' ||
                lt.category === 'non_prescription' ||
                lt.name.toLowerCase().includes('non-prescription');
              const isSingleVisionCard =
                lt.code === 'single_vision' ||
                lt.category === 'single_vision' ||
                lt.name.toLowerCase().includes('single vision');

              let parsedOptions: string[] = [];
              try {
                parsedOptions = JSON.parse(lt.optionsJson);
              } catch {
                parsedOptions = ['Standard Optical Focus'];
              }

              const effectiveOptions = isPlanoProtectiveCard
                ? PROTECTIVE_LENS_DESIGN_OPTIONS.map((o) => o.label)
                : parsedOptions;

              return (
                <div
                  key={lt.id}
                  onClick={() => {
                    if (isSelected && orderType !== 'protective_glasses') {
                      setSelectedLensId(null);
                    } else {
                      setSelectedLensId(lt.id);
                      if (effectiveOptions[0] && !effectiveOptions.includes(selectedLensOption)) {
                        setSelectedLensOption(effectiveOptions[0]);
                        if (isPlanoProtectiveCard) {
                          setSelectedTintCode(PROTECTIVE_LENS_DESIGN_OPTIONS[0].coatingCode);
                        }
                      }
                    }
                  }}
                  className={`cursor-pointer rounded-xl border p-6 flex flex-col justify-between transition-all ${
                    isSelected
                      ? 'option-pop-selected bg-white border-[#1E40AF] ring-2 ring-[#1E40AF]/20 shadow-md'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <span className="font-medium text-[#1E40AF]">
                        {isPlanoProtectiveCard
                          ? 'Precision Protective Standard · Single-Vision 0.00 Plano (No Prescription)'
                          : lt.tier}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {/* Hover Info Tooltip Trigger */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          tabIndex={0}
                          aria-label={`Details for ${lt.name}`}
                          className="group/tooltip relative inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-[#1E40AF] hover:bg-[#E0F2FE]/60 focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/30 transition-colors"
                        >
                          <Info className="w-3.5 h-3.5" />
                          <div className="pointer-events-none opacity-0 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100 transition-opacity duration-150 absolute right-0 top-full mt-2 z-30 w-72 sm:w-80 p-4 rounded-xl bg-[#0B192C] text-white shadow-xl border border-slate-700 text-left space-y-2">
                            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#C5A059]">
                                Optical Lens Specification
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-white leading-snug">
                              {costInfo.headline}
                            </p>
                            <ul className="space-y-1 text-[11px] text-slate-200 leading-relaxed list-disc pl-3.5">
                              {costInfo.factors.map((factor, i) => (
                                <li key={i}>{factor}</li>
                              ))}
                            </ul>
                            <p className="text-[10px] text-slate-300 pt-1 border-t border-white/10">
                              <strong className="text-[#C5A059]">Recommended for:</strong>{' '}
                              {costInfo.recommendedFor}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <h3 className="text-lg font-semibold text-[#0B192C]">
                      {isPlanoProtectiveCard
                        ? 'Non-Prescription Protective Lens (Single-Vision 0.00 Plano Design)'
                        : lt.name}
                    </h3>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      {isPlanoProtectiveCard
                        ? 'Engineered for a single unifocal optical plane with zero prescription power (0.00D Plano)—combining single-vision distortion-free clarity with specialized Blue Cut Photo AR, Photo AR, digital screen filtration, and UV400 eye protection.'
                        : lt.description}
                    </p>

                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {isPlanoProtectiveCard
                          ? 'Select Protective Lens Option (0.00 Plano · No Prescription):'
                          : 'Focal / Corridor Option:'}
                      </span>

                      {isPlanoProtectiveCard ? (
                        <div
                          className={`grid grid-cols-1 ${
                            orderType === 'protective_glasses' ? 'md:grid-cols-2' : ''
                          } gap-3 pt-1`}
                        >
                          {PROTECTIVE_LENS_DESIGN_OPTIONS.map((spec) => {
                            const optionChecked = isSelected && selectedLensOption === spec.label;
                            return (
                              <label
                                key={spec.label}
                                onClick={(e) => e.stopPropagation()}
                                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                                  optionChecked
                                    ? 'bg-[#E0F2FE]/55 border-[#1E40AF] ring-1 ring-[#1E40AF]/30 shadow-xs'
                                    : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-white'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`lens-opt-${lt.id}`}
                                  checked={optionChecked}
                                  onChange={() => {
                                    setSelectedLensId(lt.id);
                                    setSelectedLensOption(spec.label);
                                    setSelectedTintCode(spec.coatingCode);
                                  }}
                                  className="mt-1 accent-[#1E40AF] shrink-0"
                                />
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs sm:text-sm font-semibold text-[#0B192C]">
                                      {spec.label}
                                    </span>
                                    <span className="px-2 py-0.5 rounded bg-[#0B192C] text-[#C5A059] text-[10px] font-semibold">
                                      {spec.tag}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 leading-relaxed">
                                    {spec.description}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {parsedOptions.map((opt) => {
                            const svDesc = isSingleVisionCard
                              ? SINGLE_VISION_OPTION_DESCRIPTIONS[opt]
                              : undefined;
                            return (
                              <label
                                key={opt}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer"
                              >
                                <input
                                  type="radio"
                                  name={`lens-opt-${lt.id}`}
                                  checked={isSelected && selectedLensOption === opt}
                                  onChange={() => {
                                    setSelectedLensId(lt.id);
                                    setSelectedLensOption(opt);
                                  }}
                                  className="mt-0.5 accent-[#1E40AF] shrink-0"
                                />
                                <div>
                                  <span className="font-medium text-[#0B192C]">{opt}</span>
                                  {svDesc && (
                                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                                      {svDesc}
                                    </p>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`mt-6 w-full py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                      isSelected
                        ? 'bg-[#0B192C] text-white'
                        : 'bg-slate-100 text-[#0B192C] hover:bg-slate-200'
                    }`}
                  >
                    {isSelected
                      ? isPlanoProtectiveCard
                        ? `Selected Protective Lens: ${selectedLensOption}`
                        : 'Selected Lens Design'
                      : 'Select This Lens'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4">
            <button
              type="button"
              onClick={() => setStep(orderType === 'protective_glasses' ? 1 : 2)}
              className="px-5 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-100 flex items-center justify-center gap-2 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Step</span>
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="px-6 py-3 bg-[#0B192C] text-white text-sm font-medium rounded-lg hover:bg-[#162B49] flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue to Lens Coatings & Materials</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: LENS MATERIAL, COATING & COLOUR OPTIONS */}
      {step === 4 && (
        <div className="space-y-8">
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold text-[#0B192C]">
                Step 4: Select Lens Colour, Treatment & High-Index Material
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Combine Blue Cut digital filtration, Transitions Photochromic sun adaptation, and Crizal Anti-Reflective coatings. Every option price below is dynamically calibrated for your detected and selected lens type.
              </p>
            </div>

            {/* Responsive Active Lens & Dynamic Coating Price Tier Selector */}
            <div className="rounded-xl bg-gradient-to-r from-[#0B192C] via-[#132A4A] to-[#0B192C] text-white p-4 sm:p-5 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded bg-[#C5A059] text-[#0B192C] text-[10px] font-bold uppercase tracking-wider">
                    Dynamic Coating & Index Pricing Active
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-white">
                    Calibrated for: <span className="text-[#C5A059]">{effectiveLensForCoatings.label}</span>
                  </span>
                </div>
                <span className="text-[11px] text-slate-300">
                  Switch or click any lens tier below to compare its corresponding Coating & Index rates:
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(isSingleVisionDetected
                  ? lensTypes.filter(
                      (lt) =>
                        lt.isActive &&
                        (lt.code === 'single_vision' ||
                          lt.category === 'single_vision' ||
                          lt.name.toLowerCase().includes('single vision'))
                    )
                  : step3LensTypes
                ).map((lt) => {
                  const isActiveTier =
                    selectedLens?.id === lt.id ||
                    (!selectedLens && effectiveLensForCoatings.code === lt.code);
                  return (
                    <button
                      key={lt.id}
                      type="button"
                      onClick={() => {
                        setSelectedLensId(lt.id);
                        try {
                          const opts = JSON.parse(lt.optionsJson);
                          if (Array.isArray(opts) && opts[0]) {
                            setSelectedLensOption(opts[0]);
                          }
                        } catch {
                          // ignore
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        isActiveTier
                          ? 'option-pop-selected bg-[#C5A059] text-[#0B192C] border-[#C5A059] shadow-xs'
                          : 'bg-white/10 hover:bg-white/15 text-slate-200 border-white/15'
                      }`}
                    >
                      {lt.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 4A: Colour & Optical Treatment */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#0B192C]">
              {isProtectivePlanoActive
                ? `1. Protective Lens Treatment Options (${effectiveLensForCoatings.label})`
                : `1. Lens Colour & Light Treatment (${effectiveLensForCoatings.label})`}
            </h3>

            {isProtectivePlanoActive ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {PROTECTIVE_LENS_DESIGN_OPTIONS.map((spec) => {
                  const matchedCoating =
                    tintCoatings.find((c) => c.code === spec.coatingCode) ||
                    lensCoatings.find((c) => c.code === spec.coatingCode);
                  const fallbackBasePrice = spec.coatingCode === 'photochromic_ar' ? 52000 : 38000;
                  const dynamicPrice = matchedCoating
                    ? getDynamicCoatingPrice(matchedCoating)
                    : resolveCoatingPriceForLens(
                        effectiveLensForCoatings.code,
                        spec.coatingCode,
                        fallbackBasePrice,
                        siteConfig
                      );
                  const isSelected = selectedTintCode === spec.coatingCode;

                  return (
                    <button
                      key={spec.coatingCode}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedTintCode(null);
                        } else {
                          setSelectedTintCode(spec.coatingCode);
                          setSelectedLensOption(spec.fullTitle);
                        }
                      }}
                      className={`text-left p-6 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'option-pop-selected bg-white border-[#1E40AF] ring-2 ring-[#1E40AF]/20 shadow-md'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="inline-block px-2.5 py-0.5 rounded bg-[#0B192C] text-[#C5A059] text-[10px] font-semibold uppercase tracking-wider mb-1.5">
                              {spec.tag}
                            </span>
                            <h4 className="text-base font-semibold text-[#0B192C]">
                              {spec.fullTitle}
                            </h4>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-sm font-tabular font-semibold text-[#1E40AF]">
                              {dynamicPrice === 0 ? 'Included' : `+${formatNaira(dynamicPrice)}`}
                            </span>
                            <span
                              onClick={(e) => e.stopPropagation()}
                              className="group/tooltip relative inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-[#1E40AF] hover:bg-[#E0F2FE]/60 transition-colors"
                            >
                              <Info className="w-3.5 h-3.5" />
                              <span className="pointer-events-none opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150 absolute right-0 top-full mt-2 z-30 w-72 sm:w-80 p-4 rounded-xl bg-[#0B192C] text-white shadow-xl border border-slate-700 text-left space-y-2 font-normal">
                                <span className="flex items-center justify-between border-b border-white/10 pb-1.5">
                                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[#C5A059]">
                                    Protective Lens Specification
                                  </span>
                                  <span className="text-[11px] font-tabular font-semibold text-sky-300">
                                    {dynamicPrice === 0 ? 'Included' : `+${formatNaira(dynamicPrice)}`}
                                  </span>
                                </span>
                                <span className="block text-xs font-semibold text-white leading-snug">
                                  {spec.fullTitle}
                                </span>
                                <ul className="space-y-1 text-[11px] text-slate-200 leading-relaxed list-disc pl-3.5">
                                  {spec.highlights.map((factor, i) => (
                                    <li key={i}>{factor}</li>
                                  ))}
                                </ul>
                                <span className="block text-[10px] text-slate-300 pt-1 border-t border-white/10">
                                  <strong className="text-[#C5A059]">Best for:</strong>{' '}
                                  {spec.recommendedFor}
                                </span>
                              </span>
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">{spec.description}</p>

                        <ul className="space-y-1.5 pt-2 border-t border-slate-100 text-xs text-slate-700 list-disc pl-4">
                          {spec.highlights.map((highlight, idx) => (
                            <li key={idx} className="leading-relaxed">
                              {highlight}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div
                        className={`mt-5 w-full py-2.5 rounded-lg text-xs font-semibold text-center transition-colors ${
                          isSelected
                            ? 'bg-[#0B192C] text-white'
                            : 'bg-slate-100 text-[#0B192C] hover:bg-slate-200'
                        }`}
                      >
                        {isSelected ? `Selected: ${spec.label}` : `Select ${spec.label}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tintCoatings.map((c) => {
                  const isSelected = selectedTintCode === c.code;
                  const costInfo = getLensCoatingCostBreakdown(c);
                  const dynamicPrice = getDynamicCoatingPrice(c);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedTintCode(isSelected ? null : c.code)}
                      className={`text-left p-5 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'option-pop-selected bg-white border-[#1E40AF] ring-2 ring-[#1E40AF]/20 shadow-md'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-sm font-semibold text-[#0B192C]">{c.name}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-xs font-tabular font-semibold text-[#1E40AF]">
                              {dynamicPrice === 0 ? 'Included' : `+${formatNaira(dynamicPrice)}`}
                            </span>
                            <span
                              onClick={(e) => e.stopPropagation()}
                              className="group/tooltip relative inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-[#1E40AF] hover:bg-[#E0F2FE]/60 transition-colors"
                            >
                              <Info className="w-3.5 h-3.5" />
                              <span className="pointer-events-none opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150 absolute right-0 top-full mt-2 z-30 w-72 p-4 rounded-xl bg-[#0B192C] text-white shadow-xl border border-slate-700 text-left space-y-2 font-normal">
                                <span className="flex items-center justify-between border-b border-white/10 pb-1.5">
                                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[#C5A059]">
                                    Treatment Cost Breakdown
                                  </span>
                                  <span className="text-[11px] font-tabular font-semibold text-sky-300">
                                    {dynamicPrice === 0 ? 'Included' : `+${formatNaira(dynamicPrice)}`}
                                  </span>
                                </span>
                                <span className="block text-xs font-semibold text-white leading-snug">
                                  {costInfo.headline}
                                </span>
                                <ul className="space-y-1 text-[11px] text-slate-200 leading-relaxed list-disc pl-3.5">
                                  {costInfo.factors.map((factor, i) => (
                                    <li key={i}>{factor}</li>
                                  ))}
                                </ul>
                                <span className="block text-[10px] text-slate-300 pt-1 border-t border-white/10">
                                  <strong className="text-[#C5A059]">Best for:</strong>{' '}
                                  {costInfo.recommendedFor}
                                </span>
                              </span>
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{c.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4B: Lens Thickness / High-Index Material */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#0B192C]">
              2. Lens Material & Thinness Index ({effectiveLensForCoatings.label} · Scratch-Resistant & UV400)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {indexMaterials.map((idx) => {
                const isSelected = selectedIndexCode === idx.code;
                const costInfo = getLensCoatingCostBreakdown(idx);
                const dynamicPrice = getDynamicCoatingPrice(idx);
                return (
                  <button
                    key={idx.id}
                    type="button"
                    onClick={() => setSelectedIndexCode(isSelected ? null : idx.code)}
                    className={`text-left p-5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'option-pop-selected bg-white border-[#1E40AF] ring-2 ring-[#1E40AF]/20 shadow-md'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-sm font-semibold text-[#0B192C]">{idx.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs font-tabular font-semibold text-[#1E40AF]">
                          {dynamicPrice === 0 ? 'Included' : `+${formatNaira(dynamicPrice)}`}
                        </span>
                        <span
                          onClick={(e) => e.stopPropagation()}
                          className="group/tooltip relative inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-[#1E40AF] hover:bg-[#E0F2FE]/60 transition-colors"
                        >
                          <Info className="w-3.5 h-3.5" />
                          <span className="pointer-events-none opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150 absolute right-0 top-full mt-2 z-30 w-72 p-4 rounded-xl bg-[#0B192C] text-white shadow-xl border border-slate-700 text-left space-y-2 font-normal">
                            <span className="flex items-center justify-between border-b border-white/10 pb-1.5">
                              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#C5A059]">
                                High-Index Cost Breakdown
                              </span>
                              <span className="text-[11px] font-tabular font-semibold text-sky-300">
                                {dynamicPrice === 0 ? 'Included' : `+${formatNaira(dynamicPrice)}`}
                              </span>
                            </span>
                            <span className="block text-xs font-semibold text-white leading-snug">
                              {costInfo.headline}
                            </span>
                            <ul className="space-y-1 text-[11px] text-slate-200 leading-relaxed list-disc pl-3.5">
                              {costInfo.factors.map((factor, i) => (
                                <li key={i}>{factor}</li>
                              ))}
                            </ul>
                            <span className="block text-[10px] text-slate-300 pt-1 border-t border-white/10">
                              <strong className="text-[#C5A059]">Recommended for:</strong>{' '}
                              {costInfo.recommendedFor}
                            </span>
                          </span>
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{idx.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4C: Additional Surface Shield */}
          {addonFeatures.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-[#0B192C]">
                3. Optional Laboratory Surface Enhancement ({effectiveLensForCoatings.label})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addonFeatures.map((add) => {
                  const checked = selectedAddonCodes.includes(add.code);
                  const costInfo = getLensCoatingCostBreakdown(add);
                  const dynamicPrice = getDynamicCoatingPrice(add);
                  return (
                    <label
                      key={add.id}
                      className={`p-4 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                        checked ? 'option-pop-selected bg-white border-[#1E40AF] ring-2 ring-[#1E40AF]/20 shadow-sm' : 'bg-white border-slate-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAddonCodes([...selectedAddonCodes, add.code]);
                          } else {
                            setSelectedAddonCodes(selectedAddonCodes.filter((c) => c !== add.code));
                          }
                        }}
                        className="mt-1 w-4 h-4 accent-[#1E40AF]"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[#0B192C]">{add.name}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-xs font-tabular font-semibold text-[#1E40AF]">
                              +{formatNaira(dynamicPrice)}
                            </span>
                            <span
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              className="group/tooltip relative inline-flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-[#1E40AF] hover:bg-[#E0F2FE]/60 transition-colors"
                            >
                              <Info className="w-3.5 h-3.5" />
                              <span className="pointer-events-none opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150 absolute right-0 top-full mt-2 z-30 w-72 p-4 rounded-xl bg-[#0B192C] text-white shadow-xl border border-slate-700 text-left space-y-2 font-normal">
                                <span className="flex items-center justify-between border-b border-white/10 pb-1.5">
                                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[#C5A059]">
                                    Surface Shield Breakdown
                                  </span>
                                  <span className="text-[11px] font-tabular font-semibold text-sky-300">
                                    +{formatNaira(dynamicPrice)}
                                  </span>
                                </span>
                                <span className="block text-xs font-semibold text-white leading-snug">
                                  {costInfo.headline}
                                </span>
                                <ul className="space-y-1 text-[11px] text-slate-200 leading-relaxed list-disc pl-3.5">
                                  {costInfo.factors.map((factor, i) => (
                                    <li key={i}>{factor}</li>
                                  ))}
                                </ul>
                                <span className="block text-[10px] text-slate-300 pt-1 border-t border-white/10">
                                  <strong className="text-[#C5A059]">Best for:</strong>{' '}
                                  {costInfo.recommendedFor}
                                </span>
                              </span>
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{add.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4">
            <button
              type="button"
              onClick={() =>
                setStep(
                  orderType === 'protective_glasses'
                    ? 1
                    : isSingleVisionDetected
                    ? 2
                    : 3
                )
              }
              className="px-5 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-100 flex items-center justify-center gap-2 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Step</span>
            </button>
            <button
              type="button"
              onClick={() => setStep(selectedFrame ? 6 : 5)}
              className="px-6 py-3 bg-[#0B192C] text-white text-sm font-medium rounded-lg hover:bg-[#162B49] flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {selectedFrame
                  ? 'Review Prescription & Specifications'
                  : 'Continue to Frame Selection'}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: SELECT FRAME */}
      {step === 5 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-[#0B192C]">
              Step 5: Select Your Eyewear Frame & Colourway
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {orderType === 'replacement_lenses'
                ? 'You selected Replacement Lenses for your own existing frame. You may proceed directly to Step 6 or switch to a new frame below.'
                : 'Choose from our handcrafted Italian Acetate, Japanese Beta-Titanium, and TR90 collection.'}
            </p>
          </div>

          {orderType === 'replacement_lenses' ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
              <Eye className="w-8 h-8 text-[#C5A059] mx-auto" />
              <h3 className="text-lg font-semibold text-[#0B192C]">
                Using Your Own Existing Frame (₦0 Frame Charge)
              </h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Our dispatch rider will collect your frame in an insured optical hard-case, glaze your new lenses, and return them to your doorstep.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {activeFrames.map((frame) => {
                const isSelected = selectedFrame?.id === frame.id;
                let imgs: string[] = [];
                let cols: string[] = [];
                try {
                  imgs = JSON.parse(frame.imagesJson);
                  cols = JSON.parse(frame.colorsJson);
                } catch {
                  imgs = [];
                  cols = ['Standard'];
                }
                const effectivePrice = frame.discountPriceNgn || frame.priceNgn;

                return (
                  <div
                    key={frame.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedFrameId(null);
                      } else {
                        setSelectedFrameId(frame.id);
                        setSelectedFrameColor(cols[0] || 'Default');
                      }
                    }}
                    className={`cursor-pointer rounded-xl border overflow-hidden flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'option-pop-selected bg-white border-[#1E40AF] ring-2 ring-[#1E40AF]/20 shadow-md'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                        <OpticalImage
                          src={imgs[0] || ''}
                          alt={frame.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-4">
                        <div className="text-xs text-slate-500 flex items-center gap-1.5">
                          <span>{frame.brand}</span>
                          <span>·</span>
                          <span>{frame.shape}</span>
                        </div>
                        <h3 className="text-base font-semibold text-[#0B192C] mt-1">{frame.name}</h3>
                        <p className="text-sm font-tabular font-semibold text-[#0B192C] mt-1">
                          {formatNaira(effectivePrice)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 font-tabular">
                          Size: {frame.dimensions} · {frame.material}
                        </p>

                        {isSelected && (
                          <div className="mt-3 pt-3 border-t border-slate-100">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Colour Finish:
                            </label>
                            <select
                              value={activeColor}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setSelectedFrameColor(e.target.value)}
                              className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs bg-white"
                            >
                              {cols.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="px-4 pb-4">
                      <button
                        type="button"
                        className={`w-full py-2 rounded-lg text-xs font-semibold ${
                          isSelected
                            ? 'bg-[#0B192C] text-white'
                            : 'bg-slate-100 text-[#0B192C] hover:bg-slate-200'
                        }`}
                      >
                        {isSelected ? 'Selected Frame' : 'Select Frame'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4">
            <button
              type="button"
              onClick={() => setStep(orderType === 'frames_only' ? 1 : 4)}
              className="px-5 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-100 flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Step</span>
            </button>
            <button
              type="button"
              onClick={() => setStep(6)}
              className="px-6 py-3 bg-[#0B192C] text-white text-sm font-medium rounded-lg hover:bg-[#162B49] flex items-center justify-center gap-2"
            >
              <span>Review Prescription & Specifications</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 6 & 7: REVIEW SPECIFICATIONS & ADD TO CART / CHECKOUT */}
      {(step === 6 || step === 7) && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-[#0B192C]">
              Step {step}: Review Your Optical Specifications & Cost Summary
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Verify every detail of your bespoke eyewear configuration. You can click any previous step above to adjust your choices without losing information.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-xs font-medium text-slate-500">Selected Configuration</span>
                  <h3 className="text-xl font-semibold text-[#0B192C]">
                    {orderType === 'replacement_lenses'
                      ? 'Custom Replacement Lenses (Client Frame)'
                      : selectedFrame?.name || 'No Frame Selected Yet (₦0)'}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Colour: {orderType === 'replacement_lenses' ? 'Customer Frame' : selectedFrame ? activeColor : 'None'}
                    {selectedFrame?.dimensions ? ` · ${selectedFrame.dimensions}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="text-xs font-medium text-[#1E40AF] hover:underline"
                >
                  Change Frame
                </button>
              </div>

              {/* Prescription Table Summary */}
              {isPrescriptionRequired && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-[#0B192C]">
                      Confirmed Prescription Parameters ({rxData.submissionType === 'upload_ocr' ? 'AI OCR + Verified' : 'Manual Entry'})
                    </h4>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleExportPrescriptionPdf}
                        className="px-3 py-1.5 bg-[#0B192C] hover:bg-[#162B49] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>{pdfExportedFeedback ? 'Prescription PDF Saved' : 'Export to PDF'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="text-xs font-medium text-[#1E40AF] hover:underline cursor-pointer"
                      >
                        Edit Prescription
                      </button>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 font-tabular text-xs space-y-2 border border-slate-200">
                    <div className="grid grid-cols-5 font-semibold text-slate-500 border-b border-slate-200 pb-1.5">
                      <span>EYE</span>
                      <span>SPH</span>
                      <span>CYL</span>
                      <span>AXIS</span>
                      <span>ADD</span>
                    </div>
                    <div className="grid grid-cols-5 text-[#0B192C]">
                      <span className="font-semibold">OD (Right)</span>
                      <span>{rxData.odSph}</span>
                      <span>{rxData.odCyl}</span>
                      <span>{rxData.odAxis}°</span>
                      <span>{rxData.odAdd}</span>
                    </div>
                    <div className="grid grid-cols-5 text-[#0B192C]">
                      <span className="font-semibold">OS (Left)</span>
                      <span>{rxData.osSph}</span>
                      <span>{rxData.osCyl}</span>
                      <span>{rxData.osAxis}°</span>
                      <span>{rxData.osAdd}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 text-slate-600 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap gap-4">
                        <span>Binocular PD: {rxData.pd} mm</span>
                        {rxData.patientName && <span>Patient: {rxData.patientName}</span>}
                        {rxData.doctorName && <span>Doctor: {rxData.doctorName}</span>}
                      </div>
                      <span className="text-[11px] text-slate-500 font-sans">
                        Official clinical PDF formatted for personal records & external eye care providers
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Lens & Coating Summary */}
              {orderType !== 'frames_only' && (
                <div
                  className={`grid grid-cols-1 ${
                    orderType === 'protective_glasses' ? '' : 'sm:grid-cols-2'
                  } gap-4 pt-2`}
                >
                  {orderType !== 'protective_glasses' && (
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-500">Lens Design</span>
                        <button
                          type="button"
                          onClick={() => setStep(3)}
                          className="text-xs text-[#1E40AF] hover:underline"
                        >
                          Edit
                        </button>
                      </div>
                      <p className="text-sm font-semibold text-[#0B192C]">
                        {selectedLens ? `${selectedLens.name} (${formatNaira(lensCost)})` : 'No Lens Selected (₦0)'}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {selectedLens ? selectedLensOption : 'Click Edit to choose a lens design'}
                      </p>
                    </div>
                  )}

                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-500">Coatings & Index</span>
                      <button
                        type="button"
                        onClick={() => setStep(4)}
                        className="text-xs text-[#1E40AF] hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                    <p className="text-sm font-semibold text-[#0B192C]">
                      {resolvedSelectedTintName
                        ? resolvedSelectedTintName
                        : 'No Light Treatment Selected (₦0)'}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {selectedIndex ? selectedIndex.name : 'Standard Index (₦0)'}
                      {selectedAddons.length > 0
                        ? ` + ${selectedAddons.map((a) => a.name).join(', ')}`
                        : ''}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Itemized Naira Financial Breakdown */}
            <div className="bg-[#0B192C] text-white rounded-xl p-6 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-white border-b border-white/15 pb-3">
                  Itemized Optical Summary
                </h3>
                <div className="space-y-2.5 text-sm font-tabular">
                  <div className="flex justify-between text-slate-300">
                    <span>Frame Chassis:</span>
                    <span>{formatNaira(frameCost)}</span>
                  </div>
                  {orderType !== 'protective_glasses' && orderType !== 'frames_only' && (
                    <div className="flex justify-between text-slate-300">
                      <span>Lens Design ({selectedLens?.tier || 'None'}):</span>
                      <span>{formatNaira(lensCost)}</span>
                    </div>
                  )}
                  {orderType !== 'frames_only' && (
                    <div className="flex justify-between text-slate-300">
                      <span>Coatings & High-Index:</span>
                      <span>{formatNaira(coatingCost)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-300">
                    <span>Ultrasonic Fitting & Hard Case:</span>
                    <span>Complimentary</span>
                  </div>
                  <div className="border-t border-white/15 pt-3 flex justify-between text-lg font-semibold text-[#C5A059]">
                    <span>Configuration Total:</span>
                    <span>{formatNaira(totalUnitCost)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleCompleteWizard(true)}
                  className="w-full py-3.5 bg-[#C5A059] hover:bg-[#b58e47] text-[#0B192C] font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Add to Cart & Proceed to Checkout</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCompleteWizard(false)}
                  className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
                >
                  Add to Cart & Continue Shopping
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              onClick={() =>
                setStep(
                  orderType === 'frames_only'
                    ? selectedFrame
                      ? 2
                      : 5
                    : selectedFrame
                    ? 4
                    : 5
                )
              }
              className="px-5 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Step</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
