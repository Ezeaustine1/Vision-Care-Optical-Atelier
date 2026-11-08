import React, { useState, useMemo } from 'react';
import { X, Heart, ShoppingBag, Sliders, Shield, Check, Calculator, ArrowLeft } from 'lucide-react';
import { Product, CartItem, LensType, LensCoating } from '../types.ts';
import { OpticalImage, formatNaira } from './OpticalImage.tsx';
import { LensComparisonTable } from './LensComparisonTable.tsx';
import { getEstimatorCoatingsForLens } from '../lib/estimatorPricing.ts';

interface ProductDetailModalProps {
  product: Product | null;
  lensTypes?: LensType[];
  lensCoatings?: LensCoating[];
  siteConfig?: Record<string, any>;
  isWishlisted: boolean;
  onClose: () => void;
  onToggleWishlist: (productId: number) => void;
  onAddFrameOnlyToCart: (item: CartItem) => void;
  onCustomizeInWizard: (product: Product, mode: 'prescription_glasses' | 'protective_glasses') => void;
}

const FALLBACK_ESTIMATOR_LENSES = [
  { code: 'frames_only', label: 'Frame Only', shortTag: 'Chassis Only', priceNgn: 0, mode: 'frames_only' as const },
  { code: 'single_vision', label: 'Standard Single Vision', shortTag: 'Distance / Reading', priceNgn: 35000, mode: 'prescription_glasses' as const },
  { code: 'bifocal_traditional', label: 'Bifocal Lens', shortTag: 'Dual-Zone', priceNgn: 55000, mode: 'prescription_glasses' as const },
  { code: 'invisible_bifocal', label: 'Invisible Bifocal', shortTag: 'Line-Free', priceNgn: 72000, mode: 'prescription_glasses' as const },
  { code: 'progressive_varilux_comfort', label: 'Varilux Comfort Max', shortTag: 'Progressive', priceNgn: 115000, mode: 'prescription_glasses' as const },
  { code: 'progressive_varilux_xr', label: 'Varilux XR Bespoke', shortTag: 'Flagship Progressive', priceNgn: 185000, mode: 'prescription_glasses' as const },
  { code: 'special_order_bifocal', label: 'Special Order Bifocal Lens', shortTag: 'Special Order Lab', priceNgn: 78000, mode: 'prescription_glasses' as const },
  { code: 'special_order_invisible_bifocal', label: 'Special Order Invisible Bifocal Lens', shortTag: 'Special Order Blended', priceNgn: 96000, mode: 'prescription_glasses' as const },
  { code: 'special_order_varilux', label: 'Special Order Varilux Lens', shortTag: 'Special Order Varilux', priceNgn: 148000, mode: 'prescription_glasses' as const },
  { code: 'non_prescription_plano', label: '0.00 Plano Protective', shortTag: 'No Rx Needed', priceNgn: 18000, mode: 'protective_glasses' as const },
];

const FALLBACK_ESTIMATOR_COATINGS = [
  { code: 'clear_standard', label: 'Standard Clear UV400', priceNgn: 0 },
  { code: 'clear_ar', label: 'Crizal Anti-Reflective', priceNgn: 18000 },
  { code: 'blue_cut', label: 'Blue Cut Digital Filter', priceNgn: 24000 },
  { code: 'photochromic', label: 'Transitions Photochromic', priceNgn: 38000 },
  { code: 'index_161_poly', label: '1.61 Thin High-Index', priceNgn: 22000 },
];

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  lensTypes = [],
  lensCoatings = [],
  siteConfig = {},
  isWishlisted,
  onClose,
  onToggleWishlist,
  onAddFrameOnlyToCart,
  onCustomizeInWizard,
}) => {
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [selectedColor, setSelectedColor] = useState('Default');
  const [estimatorLensCode, setEstimatorLensCode] = useState<string>(
    siteConfig.quickEstimatorDefaultLensCode || 'single_vision'
  );
  const [estimatorCoatingCode, setEstimatorCoatingCode] = useState<string>('clear_standard');

  React.useEffect(() => {
    if (siteConfig.quickEstimatorDefaultLensCode) {
      setEstimatorLensCode(siteConfig.quickEstimatorDefaultLensCode);
    }
  }, [siteConfig.quickEstimatorDefaultLensCode]);

  const estimatorLensOptions = useMemo(() => {
    const activeDbLenses = lensTypes.filter((l) => l.isActive);
    if (activeDbLenses.length === 0) return FALLBACK_ESTIMATOR_LENSES;

    return [
      {
        code: 'frames_only',
        label: 'Frame Only',
        shortTag: 'Demo Lenses',
        priceNgn: 0,
        mode: 'frames_only' as const,
      },
      ...activeDbLenses.map((lt) => ({
        code: lt.code,
        label: lt.name
          .replace('Progressive Lens — ', '')
          .replace(' (Visible Segment)', '')
          .replace(' (0.00 Plano)', ''),
        shortTag: lt.tier,
        priceNgn: lt.priceNgn,
        mode:
          lt.category === 'non_prescription'
            ? ('protective_glasses' as const)
            : ('prescription_glasses' as const),
      })),
    ];
  }, [lensTypes]);

  const estimatorCoatingOptions = useMemo(() => {
    return getEstimatorCoatingsForLens(estimatorLensCode, lensCoatings, siteConfig);
  }, [estimatorLensCode, lensCoatings, siteConfig]);

  if (!product) return null;

  let images: string[] = [];
  let colors: string[] = [];
  try {
    images = JSON.parse(product.imagesJson);
    colors = JSON.parse(product.colorsJson);
  } catch {
    images = [];
    colors = ['Standard Finish'];
  }

  const resolvedColor = colors.includes(selectedColor) ? selectedColor : colors[0] || 'Default';
  const finalPrice = product.discountPriceNgn || product.priceNgn;

  const activeLensEstimate =
    estimatorLensOptions.find((l) => l.code === estimatorLensCode) || estimatorLensOptions[1] || estimatorLensOptions[0];
  const activeCoatingEstimate =
    activeLensEstimate?.code === 'frames_only'
      ? { code: 'none', label: 'No Lens Treatment', priceNgn: 0 }
      : estimatorCoatingOptions.find((c) => c.code === estimatorCoatingCode) || estimatorCoatingOptions[0];

  const estimatedTotalNgn =
    finalPrice + (activeLensEstimate?.priceNgn || 0) + (activeCoatingEstimate?.priceNgn || 0);

  const handleBuyFrameOnly = () => {
    const item: CartItem = {
      cartItemId: `vc-frame-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      productBrand: product.brand,
      productImage: images[0] || '',
      orderType: 'frames_only',
      selectedColor: resolvedColor,
      quantity: 1,
      framePriceNgn: finalPrice,
      lensTypeName: 'Frames Only (Demo Lenses)',
      lensOptionSelected: 'Chassis Only',
      lensPriceNgn: 0,
      coatingSummary: 'None',
      coatingPriceNgn: 0,
      prescriptionSnapshot: null,
      unitTotalNgn: finalPrice,
    };
    onAddFrameOnlyToCart(item);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200"
      >
        {/* Sticky Top Bar with Prominent Back Button */}
        <div className="bg-[#0B192C] text-white px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0 border-b border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#C5A059]" />
            <span>Back</span>
          </button>

          <div className="text-center min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[#C5A059] block truncate">
              Quick View · {product.brand}
            </span>
            <h2 className="text-xs sm:text-sm font-semibold text-white truncate">
              {product.name} ({formatNaira(finalPrice)})
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-colors cursor-pointer"
            title="Close Quick View"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Compact Content Area */}
        <div className="overflow-y-auto flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left: Compact Gallery & Specifications */}
            <div className="lg:col-span-5 bg-[#F5F4F0] p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <div className="h-44 sm:h-52 w-full rounded-xl overflow-hidden bg-white border border-slate-200">
                  <OpticalImage
                    src={images[activeImageIdx] || images[0] || ''}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {images.length > 1 && (
                  <div className="flex items-center gap-2 mt-3">
                    {images.map((imgUrl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImageIdx(idx)}
                        className={`w-14 h-11 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                          activeImageIdx === idx ? 'border-[#1E40AF]' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <OpticalImage src={imgUrl} alt={`${product.name} view ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                <p className="text-xs text-slate-600 mt-3 leading-relaxed">{product.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/80 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                  <div>
                    <span className="block text-slate-400">Dimensions</span>
                    <span className="font-tabular font-semibold text-[#0B192C]">{product.dimensions}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Material</span>
                    <span className="font-semibold text-[#0B192C]">{product.material}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Rim Style</span>
                    <span className="font-semibold text-[#0B192C]">{product.rimStyle} · {product.shape}</span>
                  </div>
                </div>

                {/* Optical Guarantees */}
                <div className="pt-2 border-t border-slate-200/60 space-y-1 text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#1E40AF] shrink-0" />
                    <span>Single Vision, Bifocal & Varilux Progressive Ready</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#1E40AF] shrink-0" />
                    <span>Includes hard leatherette case & microfiber cloth</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Contiguous Purchase Module + Quick Cost Estimator */}
            <div className="lg:col-span-7 p-4 sm:p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <span className="uppercase tracking-wider font-medium">{product.brand}</span>
                    <span>·</span>
                    <span>{product.gender}</span>
                    <span>·</span>
                    <span>{product.stockQuantity > 0 ? `${product.stockQuantity} in stock` : 'Out of stock'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-[#0B192C] flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-[#1E40AF]" />
                    <span>Back</span>
                  </button>
                </div>

                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-[#0B192C]">{product.name}</h2>
                  <div className="mt-1 flex items-baseline gap-2.5 font-tabular">
                    <span className="text-xl font-semibold text-[#0B192C]">{formatNaira(finalPrice)}</span>
                    {product.discountPriceNgn && (
                      <span className="text-xs text-slate-400 line-through">{formatNaira(product.priceNgn)}</span>
                    )}
                    <span className="text-[11px] text-slate-500 font-sans">(Frame chassis price)</span>
                  </div>
                </div>

                {/* Colour Selector */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Select Frame Colourway
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {colors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedColor(c)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                          resolvedColor === c
                            ? 'bg-[#0B192C] text-white border-[#0B192C]'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* INTERACTIVE QUICK COST ESTIMATOR */}
                {siteConfig.quickEstimatorEnabled !== false && (
                  <div className="rounded-xl border border-slate-200 bg-[#FAF9F6] p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-[#0B192C] text-[#C5A059]">
                          <Calculator className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#0B192C]">
                            Quick Cost Estimator
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            {siteConfig.quickEstimatorHeadline ||
                              'Toggle lens types to preview total cost before entering the wizard'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Step A: Toggle Lens Type */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        1. Toggle Lens Type
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {estimatorLensOptions.map((opt) => {
                          const active = activeLensEstimate?.code === opt.code;
                          return (
                            <button
                              key={opt.code}
                              type="button"
                              onClick={() => setEstimatorLensCode(opt.code)}
                              className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                                active
                                  ? 'bg-[#0B192C] text-white border-[#C5A059] ring-1 ring-[#C5A059]/40 shadow-xs'
                                  : 'bg-white text-[#0B192C] border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <span className="block text-[11px] font-semibold leading-tight truncate">
                                {opt.label}
                              </span>
                              <span
                                className={`block text-[10px] font-tabular mt-0.5 ${
                                  active ? 'text-[#C5A059] font-semibold' : 'text-[#1E40AF]'
                                }`}
                              >
                                {opt.priceNgn === 0 ? 'Included' : `+${formatNaira(opt.priceNgn)}`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Step B: Optional Coating / Index Preview */}
                    {activeLensEstimate?.code !== 'frames_only' && (
                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          2. Optional Coating / Index (Corresponding to {activeLensEstimate?.label})
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {estimatorCoatingOptions.map((coat) => {
                            const active = activeCoatingEstimate?.code === coat.code;
                            return (
                              <button
                                key={coat.code}
                                type="button"
                                onClick={() => setEstimatorCoatingCode(coat.code)}
                                className={`px-2 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-[#1E40AF] text-white border-[#1E40AF]'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                <span>{coat.label}</span>
                                <span className="font-tabular ml-1 opacity-90">
                                  ({coat.priceNgn === 0 ? '+₦0' : `+${formatNaira(coat.priceNgn)}`})
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Live Total Price Breakdown Bar */}
                    <div className="p-3 rounded-xl bg-[#0B192C] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="text-xs space-y-0.5">
                        <span className="text-[10px] uppercase tracking-widest text-[#C5A059] font-semibold block">
                          Estimated Complete Pair Total
                        </span>
                        <div className="text-slate-300 font-tabular text-[11px]">
                          Frame ({formatNaira(finalPrice)}) + {activeLensEstimate?.label} (
                          {formatNaira(activeLensEstimate?.priceNgn || 0)})
                          {activeCoatingEstimate && activeCoatingEstimate.priceNgn > 0
                            ? ` + ${activeCoatingEstimate.label} (${formatNaira(activeCoatingEstimate.priceNgn)})`
                            : ''}
                        </div>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <span className="text-lg font-tabular font-semibold text-[#C5A059]">
                          {formatNaira(estimatedTotalNgn)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action CTAs */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCustomizeInWizard(
                      product,
                      activeLensEstimate?.mode === 'protective_glasses'
                        ? 'protective_glasses'
                        : 'prescription_glasses'
                    );
                  }}
                  className="w-full py-2.5 px-4 bg-[#0B192C] hover:bg-[#162B49] text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sliders className="w-4 h-4 text-[#C5A059]" />
                  <span>
                    Configure in Wizard ({formatNaira(estimatedTotalNgn)} Est.)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCustomizeInWizard(product, 'protective_glasses');
                  }}
                  className="w-full py-2 px-4 bg-[#E0F2FE] hover:bg-sky-200 text-[#0B192C] text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5 text-[#1E40AF]" />
                  <span>Order with Non-Prescription Blue Cut / Photochromic Lenses</span>
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleBuyFrameOnly}
                    className="flex-1 py-2 px-3 border border-slate-300 hover:bg-slate-50 text-[#0B192C] text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Buy Frame Only ({formatNaira(finalPrice)})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleWishlist(product.id)}
                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                      isWishlisted
                        ? 'bg-rose-50 border-rose-200 text-rose-600'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                    title="Save to Wishlist"
                  >
                    <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-rose-600' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Side-by-Side Lens & Coating Comparison Table on Product Detail Page (Collapsed by Default) */}
          <div className="border-t border-slate-200 p-4 sm:p-5 bg-[#FAF9F6]">
            <LensComparisonTable
              lensTypes={lensTypes}
              lensCoatings={lensCoatings}
              siteConfig={siteConfig}
              selectedLensCode={estimatorLensCode}
              selectedCoatingCode={estimatorCoatingCode}
              framePriceNgn={finalPrice}
              onSelectLens={(code) => setEstimatorLensCode(code)}
              onSelectCoating={(code) => setEstimatorCoatingCode(code)}
              compact={true}
              defaultExpanded={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

