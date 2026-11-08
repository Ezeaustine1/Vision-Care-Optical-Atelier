import React, { useState, useMemo } from 'react';
import {
  Check,
  Shield,
  Eye,
  Sparkles,
  Sun,
  Layers,
  Award,
  Sliders,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { LensType, LensCoating } from '../types.ts';
import { formatNaira } from './OpticalImage.tsx';
import { resolveCoatingPriceForLens } from '../lib/estimatorPricing.ts';

interface LensComparisonTableProps {
  lensTypes?: LensType[];
  lensCoatings?: LensCoating[];
  siteConfig?: Record<string, any>;
  selectedLensCode?: string;
  selectedCoatingCode?: string;
  framePriceNgn?: number;
  onSelectLens?: (code: string) => void;
  onSelectCoating?: (code: string) => void;
  compact?: boolean;
  defaultExpanded?: boolean;
}

interface LensFeatureColumn {
  code: string;
  name: string;
  shortName: string;
  badge: string;
  priceNgn: number;
  isSpecialOrder?: boolean;
  visualClarityRating: string;
  visualClarityScore: number; // out of 5
  focalZones: string;
  peripheralDistortion: string;
  blueLightProtection: string;
  uvProtection: string;
  coatingBenefits: string;
  recommendedIndex: string;
  idealFor: string;
}

interface CoatingFeatureColumn {
  code: string;
  name: string;
  badge: string;
  priceNgn: number;
  visualClarityImpact: string;
  blueLightFilterLevel: string;
  glareAndNightDriving: string;
  outdoorLightAdaptation: string;
  smudgeScratchDefense: string;
  bestPairedWith: string;
}

const DEFAULT_LENS_COLUMNS: LensFeatureColumn[] = [
  {
    code: 'single_vision',
    name: 'Standard Single Vision',
    shortName: 'Single Vision',
    badge: 'Everyday Essential',
    priceNgn: 35000,
    visualClarityRating: 'High-Definition Aspheric Single Focus',
    visualClarityScore: 4,
    focalZones: '1 Zone (Distance OR Near Reading)',
    peripheralDistortion: 'Minimal (Edge-to-edge single power)',
    blueLightProtection: 'Up to 40% HEV (100% with Blue Cut upgrade)',
    uvProtection: '100% UV400 Front & Back',
    coatingBenefits: 'Dual-sided hard scratch guard + optional Crizal AR / Blue Cut',
    recommendedIndex: '1.56 Standard / 1.61 High-Index / 1.67 Ultra-Thin',
    idealFor: 'Myopia (short-sighted), Hyperopia, Astigmatism, or dedicated reading',
  },
  {
    code: 'bifocal_traditional',
    name: 'Bifocal Lens (Fused)',
    shortName: 'Bifocal Fused',
    badge: 'Dual-Focus Classic',
    priceNgn: 55000,
    visualClarityRating: 'Crisp Dual-Segment Optical Clarity',
    visualClarityScore: 4,
    focalZones: '2 Zones (Distance + 28mm D-Segment Near)',
    peripheralDistortion: 'Low (Distinct boundary between distance & near)',
    blueLightProtection: 'Standard UV400 + Compatible with Blue Cut & AR',
    uvProtection: '100% UV400 Blocking',
    coatingBenefits: 'Scratch-resistant fused segment + optional anti-glare coating',
    recommendedIndex: '1.56 Standard / 1.61 High-Index',
    idealFor: 'Presbyopia wearers who want a wide, defined reading window',
  },
  {
    code: 'invisible_bifocal',
    name: 'Invisible Bifocal Lens',
    shortName: 'Invisible Bifocal',
    badge: 'Line-Free Cosmetic',
    priceNgn: 72000,
    visualClarityRating: 'Blended Seamless Dual-Zone Clarity',
    visualClarityScore: 4,
    focalZones: '2 Zones (Distance + Blended Invisible Near Zone)',
    peripheralDistortion: 'Softened transition zone (Zero visible line)',
    blueLightProtection: 'Enhanced UV400 + Full Blue Cut & Crizal AR support',
    uvProtection: '100% UV400 Blocking',
    coatingBenefits: 'Diamond-polished outer surface + smudge-resistant top coat',
    recommendedIndex: '1.56 Standard / 1.61 High-Index',
    idealFor: 'Clients wanting distance & reading power without a visible bifocal line',
  },
  {
    code: 'progressive_varilux_comfort',
    name: 'Varilux Comfort Max / XR',
    shortName: 'Varilux Progressive',
    badge: 'Flagship Multifocal',
    priceNgn: 115000,
    visualClarityRating: 'Ultra-HD Digital Freeform Wavefront Clarity',
    visualClarityScore: 5,
    focalZones: '3 Continuous Zones (Distance → Computer → Reading)',
    peripheralDistortion: 'Ultra-Low (Binocular Wavefront eliminates "swim")',
    blueLightProtection: 'Embedded Eye Protect System (Blocks harmful HEV blue light)',
    uvProtection: '100% UV400 (E-SPF 35 Certified)',
    coatingBenefits: 'Crizal Sapphire 360° Anti-Reflective + Super-Hydrophobic shield',
    recommendedIndex: '1.56 / 1.61 Thin / 1.67 Ultra-Thin Aspheric',
    idealFor: 'Executives & presbyopic wearers needing seamless all-day vision at every distance',
  },
  {
    code: 'special_order_bifocal',
    name: 'Special Order Bifocal Lens',
    shortName: 'Special Order Bifocal',
    badge: 'Special Order Lab',
    priceNgn: 78000,
    isSpecialOrder: true,
    visualClarityRating: 'Custom Toric + Fused Segment Precision',
    visualClarityScore: 5,
    focalZones: '2 Zones + Custom Astigmatism Cylinder/Axis Calibration',
    peripheralDistortion: 'Digitally compensated for oblique cylinder axes',
    blueLightProtection: 'Full UV400 + Custom Lab Blue Cut / Photochromic option',
    uvProtection: '100% UV400 Clinical Grade',
    coatingBenefits: 'Multi-layer hard coat + custom back-surface anti-reflective seal',
    recommendedIndex: '1.61 High-Index / 1.67 Ultra-Thin Recommended',
    idealFor: 'Prescriptions combining Cylinder, Axis & ADD requiring fused bifocal surfacing',
  },
  {
    code: 'special_order_invisible_bifocal',
    name: 'Special Order Invisible Bifocal Lens',
    shortName: 'Special Order Invisible',
    badge: 'Special Order Blended',
    priceNgn: 96000,
    isSpecialOrder: true,
    visualClarityRating: 'Bespoke Toric Blended Line-Free Clarity',
    visualClarityScore: 5,
    focalZones: '2 Blended Zones + Custom Cylinder/Axis Alignment',
    peripheralDistortion: 'Cosmetically invisible blend with axis stabilization',
    blueLightProtection: 'Full UV400 + Blue-Light & Glare Defense compatible',
    uvProtection: '100% UV400 Clinical Grade',
    coatingBenefits: 'Diamond-blended polish + oleophobic anti-smudge armor',
    recommendedIndex: '1.61 High-Index / 1.67 Ultra-Thin Recommended',
    idealFor: 'Complex CYL + AXIS + ADD prescriptions wanting a youthful, line-free look',
  },
  {
    code: 'special_order_varilux',
    name: 'Special Order Varilux Lens',
    shortName: 'Special Order Varilux',
    badge: 'Special Order Varilux',
    priceNgn: 148000,
    isSpecialOrder: true,
    visualClarityRating: 'Bespoke 40,000-Point Digital Freeform Toric Matrix',
    visualClarityScore: 5,
    focalZones: '3 Continuous Zones + Custom Toric Astigmatism Optimization',
    peripheralDistortion: 'Zero-swim panoramic vision tailored to exact PD & axis',
    blueLightProtection: 'Integrated Blue-Violet HEV Filter + Optional Transitions',
    uvProtection: '100% UV400 (E-SPF 35 Maximum Protection)',
    coatingBenefits: 'Authentic Varilux laser engraving + Crizal anti-glare & dust repellent',
    recommendedIndex: '1.61 Thin / 1.67 Ultra-Thin High-Index',
    idealFor: 'Complex CYL + AXIS + ADD wearers demanding effortless distance, laptop & near clarity',
  },
];

const DEFAULT_COATING_COLUMNS: CoatingFeatureColumn[] = [
  {
    code: 'clear_standard',
    name: 'Standard Clear UV400',
    badge: 'Included Baseline',
    priceNgn: 0,
    visualClarityImpact: '92% Light Transmission (Standard optical clarity)',
    blueLightFilterLevel: 'Baseline UV400 only (~15% high-energy blue light)',
    glareAndNightDriving: 'Standard surface reflection',
    outdoorLightAdaptation: 'Remains clear indoors & outdoors',
    smudgeScratchDefense: 'Factory dual-sided hard scratch coat',
    bestPairedWith: 'Spare reading glasses or occasional indoor wear',
  },
  {
    code: 'clear_ar',
    name: 'Crizal Anti-Reflective (AR)',
    badge: 'Crystal Clarity',
    priceNgn: 18000,
    visualClarityImpact: '99.2% Light Transmission (Eliminates ghost reflections)',
    blueLightFilterLevel: 'Moderate (~25% reflection reduction from LEDs)',
    glareAndNightDriving: 'Superior night-driving headlight & halo reduction',
    outdoorLightAdaptation: 'Ultra-clear indoors & outdoors (Invisible lens look)',
    smudgeScratchDefense: 'Hydrophobic water-repellent + anti-smudge + anti-static',
    bestPairedWith: 'Presentations, photography, night driving & everyday clarity',
  },
  {
    code: 'blue_cut',
    name: 'Blue Cut Digital Filter',
    badge: 'Screen Shield',
    priceNgn: 24000,
    visualClarityImpact: 'High-contrast soothing optics for LED/OLED monitors',
    blueLightFilterLevel: 'Blocks up to 95% harmful 415–455nm HEV Blue Light',
    glareAndNightDriving: 'Includes anti-glare layer for digital & oncoming lights',
    outdoorLightAdaptation: 'Clear indoors with subtle blue-violet protective reflex',
    smudgeScratchDefense: 'Scratch-resistant + oleophobic fingerprint protection',
    bestPairedWith: '6+ hours daily on laptops, phones, coding & financial terminals',
  },
  {
    code: 'photochromic',
    name: 'Transitions Photochromic',
    badge: '2-in-1 Sun & Indoor',
    priceNgn: 38000,
    visualClarityImpact: 'Crystal clear indoors; soothing sunglass tint in sunlight',
    blueLightFilterLevel: 'Filters Blue Light indoors (45%) & outdoors (up to 88%)',
    glareAndNightDriving: 'Reduces blinding daytime sunlight glare & squinting',
    outdoorLightAdaptation: 'Auto-darkens in 25 seconds under UV; fades back indoors',
    smudgeScratchDefense: 'Full UV400 + Crizal AR + scratch & smudge armor',
    bestPairedWith: 'Nigerian tropical sunlight, outdoor commuting & light sensitivity',
  },
  {
    code: 'index_161_poly',
    name: '1.61 / 1.67 Thin High-Index',
    badge: 'Thin & Featherlight',
    priceNgn: 22000,
    visualClarityImpact: 'Flatter aspheric profile prevents eye magnification/minification',
    blueLightFilterLevel: '100% UV400 inherent monomer block + compatible with Blue Cut',
    glareAndNightDriving: 'High Abbe optical purity with multi-coat AR finish',
    outdoorLightAdaptation: 'Available in Clear, Blue Cut, or Photochromic',
    smudgeScratchDefense: 'High-tensile impact resistance (Ideal for rimless/half-rim)',
    bestPairedWith: 'Prescriptions over ±2.25D, Special Order lenses & titanium frames',
  },
];

export const LensComparisonTable: React.FC<LensComparisonTableProps> = ({
  lensTypes = [],
  lensCoatings = [],
  siteConfig = {},
  selectedLensCode,
  selectedCoatingCode,
  framePriceNgn = 0,
  onSelectLens,
  onSelectCoating,
  compact = false,
  defaultExpanded = false,
}) => {
  const [activeTab, setActiveTab] = useState<'lenses' | 'coatings'>('lenses');
  const [filterMode, setFilterMode] = useState<'all' | 'standard' | 'special_order'>('all');
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);

  // Synchronize prices and names with Admin database records while preserving rich clinical comparison metadata
  const lensColumns = useMemo(() => {
    const activeDbMap = new Map<string, LensType>();
    lensTypes.forEach((lt) => {
      if (lt.isActive) activeDbMap.set(lt.code, lt);
    });

    const synced = DEFAULT_LENS_COLUMNS.map((col) => {
      const dbMatch = activeDbMap.get(col.code);
      if (dbMatch) {
        return {
          ...col,
          name: dbMatch.name
            .replace('Progressive Lens — ', '')
            .replace(' (Visible Segment)', ''),
          badge: dbMatch.tier || col.badge,
          priceNgn: dbMatch.priceNgn,
        };
      }
      return col;
    }).filter((col) => {
      if (lensTypes.length === 0) return true;
      return activeDbMap.has(col.code);
    });

    // Also include any custom Admin-created active lens types not in DEFAULT_LENS_COLUMNS
    const defaultCodes = new Set(DEFAULT_LENS_COLUMNS.map((c) => c.code));
    lensTypes
      .filter((lt) => lt.isActive && !defaultCodes.has(lt.code))
      .forEach((customLt) => {
        const isSpecial =
          customLt.code.includes('special_order') ||
          customLt.name.toLowerCase().includes('special order');
        synced.push({
          code: customLt.code,
          name: customLt.name,
          shortName: customLt.name,
          badge: customLt.tier || 'Custom Optical',
          priceNgn: customLt.priceNgn,
          isSpecialOrder: isSpecial,
          visualClarityRating: 'High-Precision Digital Optical Surfacing',
          visualClarityScore: 5,
          focalZones:
            customLt.category === 'single_vision'
              ? '1 Zone (Single Vision)'
              : customLt.category === 'non_prescription'
              ? '0.00 Plano Protective'
              : 'Multi-Zone Precision Focus',
          peripheralDistortion: 'Digitally compensated optical geometry',
          blueLightProtection: 'Full UV400 + Blue Cut & AR compatible',
          uvProtection: '100% UV400 Blocking',
          coatingBenefits: customLt.description || 'Scratch-resistant & multi-coated optical finish',
          recommendedIndex: '1.56 / 1.61 / 1.67 High-Index',
          idealFor: customLt.description || 'Custom clinical prescription requirements',
        });
      });

    if (filterMode === 'standard') {
      return synced.filter((c) => !c.isSpecialOrder);
    }
    if (filterMode === 'special_order') {
      return synced.filter((c) => c.isSpecialOrder);
    }
    return synced;
  }, [lensTypes, filterMode]);

  const coatingColumns = useMemo(() => {
    const activeCoatMap = new Map<string, LensCoating>();
    lensCoatings.forEach((c) => {
      if (c.isActive) activeCoatMap.set(c.code, c);
    });

    const effectiveLensCode =
      selectedLensCode && selectedLensCode !== 'frames_only'
        ? selectedLensCode
        : 'single_vision';

    return DEFAULT_COATING_COLUMNS.map((col) => {
      const dbMatch = activeCoatMap.get(col.code);
      const basePrice = dbMatch ? dbMatch.priceNgn : col.priceNgn;
      return {
        ...col,
        priceNgn: resolveCoatingPriceForLens(effectiveLensCode, col.code, basePrice, siteConfig),
      };
    });
  }, [lensCoatings, selectedLensCode, siteConfig]);

  const renderClarityDots = (score: number) => (
    <div className="flex items-center gap-1 mt-1" aria-label={`${score} out of 5 clarity`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`h-1.5 w-3.5 rounded-full ${
            n <= score ? 'bg-[#C5A059]' : 'bg-slate-200'
          }`}
        />
      ))}
      <span className="text-[10px] font-tabular font-semibold text-slate-500 ml-1">
        {score}/5
      </span>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-[#0B192C] via-[#132847] to-[#0B192C] text-white p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/30 text-[#C5A059] shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[#C5A059]">
                Clinical Optical Guide
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-sky-300 font-medium">
                {isExpanded ? 'Comparison Table Open' : 'Table Hidden — Click Compare Lenses to View'}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-white mt-0.5">
              Lens & Coating Comparison Table — Visual Clarity, Blue-Light Protection & Benefits
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Compare standard lenses, Varilux progressives, Special Order laboratory lenses, and protective coatings side-by-side.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isExpanded && (
            <div className="inline-flex rounded-xl bg-white/10 p-1 border border-white/15">
              <button
                type="button"
                onClick={() => setActiveTab('lenses')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === 'lenses'
                    ? 'bg-[#C5A059] text-[#0B192C]'
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                Lens Designs ({lensColumns.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('coatings')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === 'coatings'
                    ? 'bg-[#C5A059] text-[#0B192C]'
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                Coatings & Blue-Light ({coatingColumns.length})
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
              isExpanded
                ? 'bg-white/15 hover:bg-white/25 border border-white/25 text-white'
                : 'bg-[#C5A059] hover:bg-[#b58e47] text-[#0B192C] font-bold'
            }`}
          >
            <span>{isExpanded ? 'Hide Table' : 'Compare Lenses'}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 sm:p-6 space-y-4">
          {/* Sub-filter bar when viewing Lens Designs */}
          {activeTab === 'lenses' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
                  Filter Columns:
                </span>
                {[
                  { id: 'all', label: 'All Lenses (Standard + Special Order)' },
                  { id: 'standard', label: 'Standard & Varilux Lenses' },
                  { id: 'special_order', label: 'Special Order Lab Lenses Only' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterMode(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      filterMode === tab.id
                        ? 'bg-[#0B192C] text-white border-[#0B192C]'
                        : 'bg-[#FAF9F6] text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {onSelectLens && (
                <span className="text-[11px] text-[#1E40AF] font-medium flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Click any column header or button to preview its price in the Quick Cost Estimator</span>
                </span>
              )}
            </div>
          )}

          {/* TAB 1: LENS DESIGNS SIDE-BY-SIDE COMPARISON TABLE */}
          {activeTab === 'lenses' && (
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full min-w-[920px] border-collapse text-left">
                <thead>
                  <tr>
                    <th className="w-52 p-3.5 bg-[#FAF9F6] border border-slate-200 rounded-tl-xl align-bottom">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Optical Criterion
                      </span>
                      <span className="text-sm font-bold text-[#0B192C]">
                        Side-by-Side Lens Matrix
                      </span>
                    </th>
                    {lensColumns.map((col) => {
                      const isSelected = selectedLensCode === col.code;
                      const estPairTotal = framePriceNgn > 0 ? framePriceNgn + col.priceNgn : null;
                      return (
                        <th
                          key={col.code}
                          onClick={() => onSelectLens && onSelectLens(col.code)}
                          className={`p-3.5 border align-top transition-colors ${
                            onSelectLens ? 'cursor-pointer' : ''
                          } ${
                            isSelected
                              ? 'bg-[#0B192C] text-white border-[#0B192C]'
                              : col.isSpecialOrder
                              ? 'bg-amber-50/50 hover:bg-amber-50/90 text-[#0B192C] border-slate-200'
                              : 'bg-[#FAF9F6] hover:bg-slate-100/80 text-[#0B192C] border-slate-200'
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                                  isSelected
                                    ? 'bg-[#C5A059] text-[#0B192C]'
                                    : col.isSpecialOrder
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300/60'
                                    : 'bg-sky-100 text-[#1E40AF]'
                                }`}
                              >
                                {col.badge}
                              </span>
                              {isSelected && (
                                <span className="w-5 h-5 rounded-full bg-[#C5A059] text-[#0B192C] flex items-center justify-center shrink-0">
                                  <Check className="w-3 h-3 stroke-[2.5]" />
                                </span>
                              )}
                            </div>

                            <div className="text-xs sm:text-sm font-bold leading-snug">
                              {col.name}
                            </div>

                            <div className="pt-1">
                              <span
                                className={`text-sm font-tabular font-bold block ${
                                  isSelected ? 'text-[#C5A059]' : 'text-[#1E40AF]'
                                }`}
                              >
                                +{formatNaira(col.priceNgn)}
                              </span>
                              {estPairTotal !== null && (
                                <span
                                  className={`text-[11px] font-tabular block ${
                                    isSelected ? 'text-slate-300' : 'text-slate-500'
                                  }`}
                                >
                                  Est. Pair: {formatNaira(estPairTotal)}
                                </span>
                              )}
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="text-xs text-slate-700">
                  {/* Row 1: Visual Clarity */}
                  <tr>
                    <td className="p-3.5 font-semibold text-[#0B192C] bg-[#FAF9F6] border border-slate-200">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-[#1E40AF] shrink-0" />
                        <span>Visual Clarity & Optics</span>
                      </div>
                    </td>
                    {lensColumns.map((col) => {
                      const isSelected = selectedLensCode === col.code;
                      return (
                        <td
                          key={col.code}
                          className={`p-3.5 border border-slate-200 align-top ${
                            isSelected ? 'bg-sky-50/50 font-medium' : 'bg-white'
                          }`}
                        >
                          <span className="block text-[#0B192C] font-semibold">
                            {col.visualClarityRating}
                          </span>
                          {renderClarityDots(col.visualClarityScore)}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 2: Focal Zones */}
                  <tr>
                    <td className="p-3.5 font-semibold text-[#0B192C] bg-[#FAF9F6] border border-slate-200">
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-[#1E40AF] shrink-0" />
                        <span>Focal Zones & Transition</span>
                      </div>
                    </td>
                    {lensColumns.map((col) => {
                      const isSelected = selectedLensCode === col.code;
                      return (
                        <td
                          key={col.code}
                          className={`p-3.5 border border-slate-200 align-top ${
                            isSelected ? 'bg-sky-50/50' : 'bg-white'
                          }`}
                        >
                          <div className="font-medium text-[#0B192C]">{col.focalZones}</div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            {col.peripheralDistortion}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 3: Blue-Light Protection */}
                  <tr>
                    <td className="p-3.5 font-semibold text-[#0B192C] bg-[#FAF9F6] border border-slate-200">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-[#1E40AF] shrink-0" />
                        <span>Blue-Light & Screen Defense</span>
                      </div>
                    </td>
                    {lensColumns.map((col) => {
                      const isSelected = selectedLensCode === col.code;
                      return (
                        <td
                          key={col.code}
                          className={`p-3.5 border border-slate-200 align-top ${
                            isSelected ? 'bg-sky-50/50' : 'bg-white'
                          }`}
                        >
                          <span className="text-slate-800">{col.blueLightProtection}</span>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 4: UV & Sun Protection */}
                  <tr>
                    <td className="p-3.5 font-semibold text-[#0B192C] bg-[#FAF9F6] border border-slate-200">
                      <div className="flex items-center gap-2">
                        <Sun className="w-4 h-4 text-[#C5A059] shrink-0" />
                        <span>UV400 & Solar Protection</span>
                      </div>
                    </td>
                    {lensColumns.map((col) => {
                      const isSelected = selectedLensCode === col.code;
                      return (
                        <td
                          key={col.code}
                          className={`p-3.5 border border-slate-200 align-top ${
                            isSelected ? 'bg-sky-50/50' : 'bg-white'
                          }`}
                        >
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>{col.uvProtection}</span>
                          </span>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 5: Coating & Surface Benefits */}
                  <tr>
                    <td className="p-3.5 font-semibold text-[#0B192C] bg-[#FAF9F6] border border-slate-200">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#1E40AF] shrink-0" />
                        <span>Coating & Surface Benefits</span>
                      </div>
                    </td>
                    {lensColumns.map((col) => {
                      const isSelected = selectedLensCode === col.code;
                      return (
                        <td
                          key={col.code}
                          className={`p-3.5 border border-slate-200 align-top ${
                            isSelected ? 'bg-sky-50/50' : 'bg-white'
                          }`}
                        >
                          <div className="text-slate-700 leading-relaxed">{col.coatingBenefits}</div>
                          <div className="text-[11px] text-slate-500 mt-1 font-medium">
                            Index: {col.recommendedIndex}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 6: Clinical Prescription Suitability */}
                  <tr>
                    <td className="p-3.5 font-semibold text-[#0B192C] bg-[#FAF9F6] border border-slate-200">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-[#C5A059] shrink-0" />
                        <span>Best Suited For</span>
                      </div>
                    </td>
                    {lensColumns.map((col) => {
                      const isSelected = selectedLensCode === col.code;
                      return (
                        <td
                          key={col.code}
                          className={`p-3.5 border border-slate-200 align-top ${
                            isSelected ? 'bg-sky-50/50' : 'bg-white'
                          }`}
                        >
                          <p className="text-slate-600 leading-relaxed">{col.idealFor}</p>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Action Row: Select in Quick Cost Estimator */}
                  {onSelectLens && (
                    <tr>
                      <td className="p-3.5 font-semibold text-[#0B192C] bg-[#FAF9F6] border border-slate-200">
                        Apply to Price Estimator
                      </td>
                      {lensColumns.map((col) => {
                        const isSelected = selectedLensCode === col.code;
                        return (
                          <td
                            key={col.code}
                            className={`p-3.5 border border-slate-200 ${
                              isSelected ? 'bg-sky-50/50' : 'bg-[#FAF9F6]/60'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => onSelectLens(col.code)}
                              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                isSelected
                                  ? 'bg-[#0B192C] text-[#C5A059] shadow-xs'
                                  : 'bg-white hover:bg-[#0B192C] text-[#0B192C] hover:text-white border border-slate-300'
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-[#C5A059]" />
                                  <span>Selected in Estimator</span>
                                </>
                              ) : (
                                <span>Select (+{formatNaira(col.priceNgn)})</span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: COATINGS, BLUE-LIGHT & HIGH-INDEX COMPARISON TABLE */}
          {activeTab === 'coatings' && (
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead>
                  <tr>
                    <th className="w-52 p-3.5 bg-[#FAF9F6] border border-slate-200 align-bottom">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Coating & Material
                      </span>
                      <span className="text-sm font-bold text-[#0B192C]">
                        Protection & Clarity Matrix
                      </span>
                    </th>
                    {coatingColumns.map((coat) => {
                      const isSelected = selectedCoatingCode === coat.code;
                      return (
                        <th
                          key={coat.code}
                          onClick={() => onSelectCoating && onSelectCoating(coat.code)}
                          className={`p-3.5 border align-top transition-colors ${
                            onSelectCoating ? 'cursor-pointer' : ''
                          } ${
                            isSelected
                              ? 'bg-[#1E40AF] text-white border-[#1E40AF]'
                              : 'bg-[#FAF9F6] hover:bg-slate-100/80 text-[#0B192C] border-slate-200'
                          }`}
                        >
                          <div className="space-y-1">
                            <span
                              className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                                isSelected
                                  ? 'bg-white text-[#1E40AF]'
                                  : 'bg-sky-100 text-[#1E40AF]'
                              }`}
                            >
                              {coat.badge}
                            </span>
                            <div className="text-xs sm:text-sm font-bold">{coat.name}</div>
                            <div
                              className={`text-sm font-tabular font-bold ${
                                isSelected ? 'text-[#C5A059]' : 'text-[#1E40AF]'
                              }`}
                            >
                              {coat.priceNgn === 0 ? 'Included (+₦0)' : `+${formatNaira(coat.priceNgn)}`}
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="text-xs text-slate-700">
                  <tr>
                    <td className="p-3.5 font-semibold text-[#0B192C] bg-[#FAF9F6] border border-slate-200">
                      Visual Clarity & Light Transmission
                    </td>
                    {coatingColumns.map((coat) => (
                      <td key={coat.code} className="p-3.5 border border-slate-200 bg-white">
                        {coat.visualClarityImpact}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3.5 font-semibold text-[#0B192C] bg-[#FAF9F6] border border-slate-200">
                      Blue-Light (HEV) Screen Filtering
                    </td>
                    {coatingColumns.map((coat) => (
                      <td key={coat.code} className="p-3.5 border border-slate-200 bg-white font-medium text-[#0B192C]">
                        {coat.blueLightFilterLevel}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3.5 font-semibold text-[#0B192C] bg-[#FAF9F6] border border-slate-200">
                      Night Driving & Anti-Glare
                    </td>
                    {coatingColumns.map((coat) => (
                      <td key={coat.code} className="p-3.5 border border-slate-200 bg-white">
                        {coat.glareAndNightDriving}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3.5 font-semibold text-[#0B192C] bg-[#FAF9F6] border border-slate-200">
                      Outdoor Sunlight Adaptation
                    </td>
                    {coatingColumns.map((coat) => (
                      <td key={coat.code} className="p-3.5 border border-slate-200 bg-white">
                        {coat.outdoorLightAdaptation}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3.5 font-semibold text-[#0B192C] bg-[#FAF9F6] border border-slate-200">
                      Scratch, Water & Smudge Defense
                    </td>
                    {coatingColumns.map((coat) => (
                      <td key={coat.code} className="p-3.5 border border-slate-200 bg-white">
                        {coat.smudgeScratchDefense}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-3.5 font-semibold text-[#0B192C] bg-[#FAF9F6] border border-slate-200">
                      Recommended Lifestyle Match
                    </td>
                    {coatingColumns.map((coat) => (
                      <td key={coat.code} className="p-3.5 border border-slate-200 bg-white text-slate-600">
                        {coat.bestPairedWith}
                      </td>
                    ))}
                  </tr>
                  {onSelectCoating && (
                    <tr>
                      <td className="p-3.5 font-semibold text-[#0B192C] bg-[#FAF9F6] border border-slate-200">
                        Apply Coating to Estimator
                      </td>
                      {coatingColumns.map((coat) => {
                        const isSelected = selectedCoatingCode === coat.code;
                        return (
                          <td key={coat.code} className="p-3.5 border border-slate-200 bg-[#FAF9F6]/60">
                            <button
                              type="button"
                              onClick={() => onSelectCoating(coat.code)}
                              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                isSelected
                                  ? 'bg-[#1E40AF] text-white shadow-xs'
                                  : 'bg-white hover:bg-[#1E40AF] text-[#0B192C] hover:text-white border border-slate-300'
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Selected</span>
                                </>
                              ) : (
                                <span>
                                  Select ({coat.priceNgn === 0 ? '+₦0' : `+${formatNaira(coat.priceNgn)}`})
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
