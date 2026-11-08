import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Building2,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sliders,
  Bell,
  Mail,
  MessageSquare,
  Download,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import {
  CartItem,
  CouponRecord,
  UserProfile,
  AddressRecord,
  DeliveryMethodConfig,
} from '../types.ts';
import { OpticalImage, formatNaira } from './OpticalImage.tsx';
import { exportClientInvoiceToPdf } from '../lib/pdfDocumentExport.ts';
import { exportPrescriptionToPdf } from '../lib/prescriptionPdfExport.ts';

const DEFAULT_DELIVERY_METHODS: DeliveryMethodConfig[] = [
  {
    id: 'del_lagos_express',
    name: 'Lagos Express Doorstep Courier',
    description: 'Victoria Island, Ikoyi, Lekki & Mainland priority dispatch',
    priceNgn: 3500,
    freeThresholdNgn: 120000,
    estimatedDays: '24–48 Hours',
    isActive: true,
  },
  {
    id: 'del_nationwide_air',
    name: 'Nationwide Insured Air Courier (All 36 States & FCT Abuja)',
    description: 'Hard-shell tracked optical dispatch across Nigeria',
    priceNgn: 5000,
    freeThresholdNgn: 120000,
    estimatedDays: '2–3 Business Days',
    isActive: true,
  },
  {
    id: 'del_clinic_pickup',
    name: 'Showroom & Eye Clinic Pickup (VI Lagos / Maitama Abuja)',
    description: 'Complimentary in-clinic frame fitting & ultrasonic adjustment',
    priceNgn: 0,
    freeThresholdNgn: 0,
    estimatedDays: 'Ready in 24 Hours',
    isActive: true,
  },
];

interface CartCheckoutDrawerProps {
  isOpen: boolean;
  cart: CartItem[];
  coupons: CouponRecord[];
  user: UserProfile | null;
  savedAddresses: AddressRecord[];
  siteConfig: Record<string, any>;
  onClose: () => void;
  onUpdateQuantity: (cartItemId: string, delta: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onEditItemInWizard: (item: CartItem) => void;
  onSubmitOrder: (orderPayload: any) => Promise<any>;
  onRequireSignIn: () => Promise<void>;
  onNavigateToAccountTracking?: (orderId?: number) => void;
}

const NIGERIAN_STATES = [
  'Lagos',
  'FCT - Abuja',
  'Rivers',
  'Oyo',
  'Kano',
  'Enugu',
  'Delta',
  'Anambra',
  'Ogun',
  'Kaduna',
  'Edo',
  'Akwa Ibom',
  'Cross River',
  'Kwara',
  'Osun',
  'Ondo',
  'Plateau',
];

const ALL_PAYMENT_GATEWAYS = [
  { id: 'paystack' as const, label: 'Paystack', sub: 'Card / USSD / Transfer' },
  { id: 'flutterwave' as const, label: 'Flutterwave', sub: 'Barter / Card / Bank' },
  { id: 'bank_transfer' as const, label: 'Bank Transfer', sub: 'Direct Corporate NGN' },
];

function isPaymentGatewayEnabled(
  siteConfig: Record<string, any> | undefined,
  id: 'paystack' | 'flutterwave' | 'bank_transfer'
): boolean {
  if (!siteConfig) return true;
  if (siteConfig.paymentGateways && typeof siteConfig.paymentGateways[id] === 'boolean') {
    return siteConfig.paymentGateways[id];
  }
  if (id === 'paystack' && typeof siteConfig.paymentGatewayPaystackEnabled === 'boolean') {
    return siteConfig.paymentGatewayPaystackEnabled;
  }
  if (id === 'flutterwave' && typeof siteConfig.paymentGatewayFlutterwaveEnabled === 'boolean') {
    return siteConfig.paymentGatewayFlutterwaveEnabled;
  }
  if (id === 'bank_transfer' && typeof siteConfig.paymentGatewayBankTransferEnabled === 'boolean') {
    return siteConfig.paymentGatewayBankTransferEnabled;
  }
  return true;
}

export const CartCheckoutDrawer: React.FC<CartCheckoutDrawerProps> = ({
  isOpen,
  cart,
  coupons,
  user,
  savedAddresses,
  siteConfig,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onEditItemInWizard,
  onSubmitOrder,
  onRequireSignIn,
  onNavigateToAccountTracking,
}) => {
  const [mode, setMode] = useState<'cart' | 'checkout' | 'confirmed'>('cart');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponRecord | null>(null);
  const [couponMessage, setCouponMessage] = useState('');

  const enabledPaymentGateways = useMemo(
    () => ALL_PAYMENT_GATEWAYS.filter((pm) => isPaymentGatewayEnabled(siteConfig, pm.id)),
    [siteConfig]
  );

  const enabledDeliveryMethods = useMemo<DeliveryMethodConfig[]>(() => {
    const raw =
      Array.isArray(siteConfig?.deliveryMethods) && siteConfig.deliveryMethods.length > 0
        ? siteConfig.deliveryMethods
        : DEFAULT_DELIVERY_METHODS;
    return raw.filter((m: DeliveryMethodConfig) => m.isActive !== false);
  }, [siteConfig?.deliveryMethods]);

  // Checkout Form
  const [customerName, setCustomerName] = useState(user?.fullName || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '+234 ');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('Victoria Island');
  const [deliveryState, setDeliveryState] = useState('Lagos');
  const [deliveryMethod, setDeliveryMethod] = useState(
    () => enabledDeliveryMethods[0]?.name || 'Lagos Express Doorstep Courier'
  );
  const [orderNotes, setOrderNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'paystack' | 'flutterwave' | 'bank_transfer'>(
    () => (ALL_PAYMENT_GATEWAYS.find((pm) => isPaymentGatewayEnabled(siteConfig, pm.id))?.id || 'paystack')
  );
  const [gatewayChannel, setGatewayChannel] = useState<'card' | 'transfer' | 'ussd'>('card');
  const [gatewayCustomRef, setGatewayCustomRef] = useState('');
  const [gatewayModalOpen, setGatewayModalOpen] = useState(false);
  const [cardLast4, setCardLast4] = useState('4081');
  const [selectedUssdBank, setSelectedUssdBank] = useState('*737# (GTBank)');
  const [bankTransferRef, setBankTransferRef] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);

  useEffect(() => {
    if (
      enabledPaymentGateways.length > 0 &&
      !enabledPaymentGateways.some((pm) => pm.id === paymentMethod)
    ) {
      setPaymentMethod(enabledPaymentGateways[0].id);
    }
  }, [enabledPaymentGateways, paymentMethod]);

  // Real-Time SMS & Email Notification Toggles (Controlled by Admin defaults in siteConfig)
  const [notifyEmail, setNotifyEmail] = useState<boolean>(
    siteConfig?.defaultNotifyEmail !== false
  );
  const [notifySms, setNotifySms] = useState<boolean>(
    siteConfig?.defaultNotifySms !== false
  );
  const [notifyStages, setNotifyStages] = useState<{
    labSurfacing: boolean;
    qualityControl: boolean;
    shipped: boolean;
  }>({
    labSurfacing: true,
    qualityControl: true,
    shipped: true,
  });

  useEffect(() => {
    if (typeof siteConfig?.defaultNotifyEmail === 'boolean') {
      setNotifyEmail(siteConfig.defaultNotifyEmail);
    }
    if (typeof siteConfig?.defaultNotifySms === 'boolean') {
      setNotifySms(siteConfig.defaultNotifySms);
    }
  }, [siteConfig?.defaultNotifyEmail, siteConfig?.defaultNotifySms]);

  useEffect(() => {
    if (
      enabledDeliveryMethods.length > 0 &&
      !enabledDeliveryMethods.some((m) => m.name === deliveryMethod)
    ) {
      setDeliveryMethod(enabledDeliveryMethods[0].name);
    }
  }, [enabledDeliveryMethods, deliveryMethod]);

  const subtotalNgn = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitTotalNgn * item.quantity, 0),
    [cart]
  );

  const selectedDeliveryConfig = useMemo(
    () =>
      enabledDeliveryMethods.find((m) => m.name === deliveryMethod) ||
      enabledDeliveryMethods[0] ||
      null,
    [enabledDeliveryMethods, deliveryMethod]
  );

  const deliveryFeeNgn = useMemo(() => {
    if (subtotalNgn === 0) return 0;
    if (!selectedDeliveryConfig) return 0;
    const baseFee = Number(selectedDeliveryConfig.priceNgn || 0);
    if (baseFee === 0) return 0;
    const threshold = Number(selectedDeliveryConfig.freeThresholdNgn || 0);
    if (threshold > 0 && subtotalNgn >= threshold) return 0;
    return baseFee;
  }, [subtotalNgn, selectedDeliveryConfig]);

  const smsFeeNgn = useMemo(() => {
    if (siteConfig?.checkoutNotificationsEnabled === false) return 0;
    if (!notifySms) return 0;
    return Number(siteConfig?.smsNotificationFeeNgn || 0);
  }, [notifySms, siteConfig?.checkoutNotificationsEnabled, siteConfig?.smsNotificationFeeNgn]);

  const discountNgn = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (subtotalNgn < appliedCoupon.minOrderNgn) return 0;
    return Math.round((subtotalNgn * appliedCoupon.discountPercent) / 100);
  }, [appliedCoupon, subtotalNgn]);

  const finalTotalNgn = Math.max(0, subtotalNgn + deliveryFeeNgn + smsFeeNgn - discountNgn);

  if (!isOpen) return null;

  const handleApplyCoupon = () => {
    const clean = couponInput.trim().toUpperCase();
    const match = coupons.find((c) => c.code.toUpperCase() === clean && c.isActive);
    if (!match) {
      setCouponMessage('Invalid or expired coupon code. Try VISION10 or FIRSTCARE15.');
      setAppliedCoupon(null);
      return;
    }
    if (subtotalNgn < match.minOrderNgn) {
      setCouponMessage(`Code ${match.code} requires a minimum order of ${formatNaira(match.minOrderNgn)}.`);
      setAppliedCoupon(null);
      return;
    }
    setAppliedCoupon(match);
    setCouponMessage(`${match.discountPercent}% discount (${match.code}) applied!`);
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    const resolvedEmail = (customerEmail || user?.email || '').trim();
    if (!user && !resolvedEmail) {
      await onRequireSignIn();
      return;
    }

    if (
      enabledPaymentGateways.length === 0 ||
      !enabledPaymentGateways.some((pm) => pm.id === paymentMethod)
    ) {
      setSubmitError('No active payment gateway is currently available. Please contact administrator support.');
      return;
    }

    setIsSubmitting(true);
    try {
      const channelTag = gatewayChannel.toUpperCase();
      const gatewayRef =
        paymentMethod === 'paystack'
          ? gatewayCustomRef.trim() || `PSTK-${channelTag}-${Date.now().toString().slice(-7)}`
          : paymentMethod === 'flutterwave'
          ? gatewayCustomRef.trim() || `FLW-${channelTag}-${Date.now().toString().slice(-7)}`
          : bankTransferRef.trim() || `TRF-NGN-${Date.now().toString().slice(-7)}`;

      const payload = {
        customerName: customerName || user?.fullName || 'Vision Care Client',
        customerEmail: resolvedEmail,
        customerPhone,
        deliveryAddress,
        deliveryCity,
        deliveryState,
        deliveryMethod,
        orderNotes,
        subtotalNgn,
        deliveryFeeNgn: deliveryFeeNgn + smsFeeNgn,
        discountNgn,
        couponCode: appliedCoupon?.code || '',
        totalNgn: finalTotalNgn,
        paymentMethod,
        paymentReference: gatewayRef,
        notifySms: siteConfig?.checkoutNotificationsEnabled === false ? false : notifySms,
        notifyEmail: siteConfig?.checkoutNotificationsEnabled === false ? true : notifyEmail,
        notifyStages,
        items: cart.map((c) => ({
          productId: c.productId,
          productName: c.productName,
          productBrand: c.productBrand,
          productImage: c.productImage,
          orderType: c.orderType,
          selectedColor: c.selectedColor,
          quantity: c.quantity,
          framePriceNgn: c.framePriceNgn,
          lensTypeName: c.lensTypeName,
          lensOptionSelected: c.lensOptionSelected,
          lensPriceNgn: c.lensPriceNgn,
          coatingSummary: c.coatingSummary,
          coatingPriceNgn: c.coatingPriceNgn,
          prescriptionSnapshotJson: JSON.stringify(c.prescriptionSnapshot || {}),
          unitTotalNgn: c.unitTotalNgn,
        })),
      };

      const res = await onSubmitOrder(payload);
      setConfirmedOrder({
        ...res.order,
        items: res.items || payload.items,
      });
      setGatewayModalOpen(false);
      setMode('confirmed');
    } catch (err: any) {
      setSubmitError(err.message || 'Could not complete checkout. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-xl h-full flex flex-col justify-between shadow-2xl overflow-hidden">
        {/* Top Drawer Bar */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 bg-[#0B192C] text-white flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold truncate">
              {mode === 'cart' && `Your Optical Bag (${cart.length})`}
              {mode === 'checkout' && 'Secure Nigerian Optical Checkout'}
              {mode === 'confirmed' && 'Order Confirmed — Vision Care Atelier'}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-300 truncate">
              All prices in Nigerian Naira (₦)
              {enabledPaymentGateways.length > 0
                ? ` · ${enabledPaymentGateways.map((g) => g.label).join(', ')}`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
          {mode === 'confirmed' && confirmedOrder ? (
            <div className="text-center py-4 space-y-5">
              <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-[#1E40AF]">
                  Official Receipt, Lens Prescription PDF &amp; Dispensing Ticket
                </span>
                <h3 className="text-2xl font-semibold text-[#0B192C] mt-1">
                  {confirmedOrder.orderNumber} — {confirmedOrder.orderStatus}
                </h3>
                <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
                  Thank you, {confirmedOrder.customerName}. Your order totaling{' '}
                  <strong className="font-tabular text-[#0B192C]">
                    {formatNaira(confirmedOrder.totalNgn)}
                  </strong>{' '}
                  has been logged in our optical laboratory and dispatched to{' '}
                  <strong className="text-[#1E40AF]">{confirmedOrder.customerEmail}</strong>.
                </p>
              </div>

              {/* Instant Email Dispatched Summary Banner */}
              <div className="bg-[#FAF9F6] border border-[#C5A059]/45 rounded-xl p-4 text-left space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#1E40AF] shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-[#0B192C]">
                        Instant Confirmation Email Sent to {confirmedOrder.customerEmail}
                      </p>
                      <p className="text-[11px] text-slate-600">
                        Includes ordered product photo(s), attached Lens Prescription PDF, and direct Vision Care Account tracking link.
                      </p>
                    </div>
                  </div>
                  <a
                    href="https://mail.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1.5 rounded-lg bg-[#E0F2FE] hover:bg-sky-200 text-[#0B192C] text-[11px] font-semibold shrink-0 flex items-center gap-1"
                  >
                    <span>Open Gmail</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Ordered Product Image Preview */}
                {Array.isArray(confirmedOrder.items) && confirmedOrder.items.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-200/80">
                    {confirmedOrder.items.map((it: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-slate-200">
                        <div className="w-14 h-12 rounded-md overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                          <OpticalImage
                            src={it.productImage || '/src/assets/images/prod_1.jpg'}
                            alt={it.productName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[#0B192C] truncate">{it.productName}</p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {it.lensOptionSelected || 'Standard Lens'}
                            {it.coatingSummary && it.coatingSummary !== 'None' ? ` · ${it.coatingSummary}` : ''}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-[#0B192C] font-tabular">
                          {formatNaira(Number(it.unitTotalNgn || 0))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-1 flex items-center justify-between text-[11px] text-slate-600">
                  <span>Direct Account Order Tracking Link:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const trackedId = confirmedOrder?.id;
                      setMode('cart');
                      onClose();
                      if (onNavigateToAccountTracking) {
                        onNavigateToAccountTracking(trackedId);
                      }
                    }}
                    className="text-[#1E40AF] font-semibold underline hover:text-blue-900 cursor-pointer"
                  >
                    /?view=account&amp;trackOrder={confirmedOrder.orderNumber}
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-xs space-y-2 font-tabular">
                <div className="flex justify-between">
                  <span className="text-slate-500">Order Reference:</span>
                  <span className="font-semibold text-[#0B192C]">{confirmedOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Channel:</span>
                  <span className="uppercase font-semibold text-[#0B192C]">{confirmedOrder.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Reference:</span>
                  <span>{confirmedOrder.paymentReference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Status:</span>
                  <span className="font-semibold text-emerald-700">{confirmedOrder.paymentStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Delivery Destination:</span>
                  <span>
                    {confirmedOrder.deliveryAddress}, {confirmedOrder.deliveryCity}, {confirmedOrder.deliveryState}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500">Real-Time Status Alerts:</span>
                  <span className="font-semibold text-[#1E40AF]">
                    {[
                      notifySms ? `SMS (${confirmedOrder.customerPhone})` : null,
                      `Email (${confirmedOrder.customerEmail})`,
                    ]
                      .filter(Boolean)
                      .join(' & ')}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    exportClientInvoiceToPdf({
                      ...confirmedOrder,
                      items: confirmedOrder.items || [],
                    })
                  }
                  className="px-4 py-2.5 bg-[#1E40AF] hover:bg-blue-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Official Invoice (PDF)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const firstItem = (confirmedOrder.items || [])[0] || {};
                    let rxObj: any = {};
                    try {
                      if (firstItem.prescriptionSnapshotJson) {
                        rxObj = JSON.parse(firstItem.prescriptionSnapshotJson);
                      }
                    } catch {
                      rxObj = {};
                    }
                    exportPrescriptionToPdf({
                      prescription: {
                        patientName: rxObj.patientName || confirmedOrder.customerName || 'Vision Care Client',
                        submissionType: rxObj.submissionType || 'manual',
                        odSph: String(rxObj.odSph ?? '0.00'),
                        odCyl: String(rxObj.odCyl ?? '0.00'),
                        odAxis: String(rxObj.odAxis ?? '0'),
                        odAdd: String(rxObj.odAdd ?? '0.00'),
                        osSph: String(rxObj.osSph ?? '0.00'),
                        osCyl: String(rxObj.osCyl ?? '0.00'),
                        osAxis: String(rxObj.osAxis ?? '0'),
                        osAdd: String(rxObj.osAdd ?? '0.00'),
                        pd: String(rxObj.pd ?? '63'),
                        monocularPdOd: String(rxObj.monocularPdOd ?? ''),
                        monocularPdOs: String(rxObj.monocularPdOs ?? ''),
                        prescriptionDate:
                          rxObj.prescriptionDate || new Date().toISOString().slice(0, 10),
                        doctorName: rxObj.doctorName || 'Vision Care Clinical Dispensing Unit',
                        notes:
                          rxObj.notes ||
                          `Order Reference: ${confirmedOrder.orderNumber} | Payment Ref: ${confirmedOrder.paymentReference}`,
                        customerConfirmed: true,
                      },
                      selectedFrameName: firstItem.productName || 'Vision Care Frame',
                      selectedLensName: firstItem.lensOptionSelected || 'Standard Optical Lens',
                      selectedCoatingSummary: firstItem.coatingSummary || 'Standard Coating',
                      totalEstimateFormatted: formatNaira(Number(confirmedOrder.totalNgn || 0)),
                    });
                  }}
                  className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Lens Prescription (PDF)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const trackedId = confirmedOrder?.id;
                    setMode('cart');
                    onClose();
                    if (onNavigateToAccountTracking) {
                      onNavigateToAccountTracking(trackedId);
                    }
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#0B192C] text-white text-xs font-semibold rounded-lg hover:bg-[#162B49] cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Track Order in Vision Care Account</span>
                  <ArrowRight className="w-4 h-4 text-[#C5A059]" />
                </button>
              </div>
            </div>
          ) : cart.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <p className="text-lg font-semibold text-[#0B192C]">Your Optical Bag is Empty</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Explore our designer frames, upload your prescription in the Smart Ordering Wizard, or select Blue Cut screen glasses.
              </p>
            </div>
          ) : mode === 'cart' ? (
            <>
              <div className="space-y-4">
                {cart.map((item) => (
                  <div
                    key={item.cartItemId}
                    className="p-4 rounded-xl border border-slate-200 bg-white flex gap-4 items-start"
                  >
                    <div className="w-20 h-16 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                      <OpticalImage src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold text-[#0B192C] truncate">{item.productName}</h4>
                          <p className="text-xs text-slate-500">
                            {item.selectedColor} · {item.orderType.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.cartItemId)}
                          className="text-slate-400 hover:text-red-600 p-1"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mt-2 text-xs text-slate-600 space-y-0.5">
                        <div>
                          <strong className="text-[#0B192C]">Lens:</strong> {item.lensTypeName} ({item.lensOptionSelected})
                        </div>
                        <div>
                          <strong className="text-[#0B192C]">Coatings:</strong> {item.coatingSummary}
                        </div>
                        {item.prescriptionSnapshot && (
                          <div className="font-tabular text-[11px] text-[#1E40AF] pt-1">
                            Rx: OD {item.prescriptionSnapshot.odSph}/{item.prescriptionSnapshot.odCyl}×{item.prescriptionSnapshot.odAxis}° | OS {item.prescriptionSnapshot.osSph}/{item.prescriptionSnapshot.osCyl}×{item.prescriptionSnapshot.osAxis}° | PD {item.prescriptionSnapshot.pd}mm
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.cartItemId, -1)}
                            className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-tabular font-semibold px-2">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.cartItemId, 1)}
                            className="p-1.5 rounded border border-slate-200 hover:bg-slate-100 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditItemInWizard(item)}
                            className="ml-1 sm:ml-2 text-[11px] text-[#1E40AF] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Sliders className="w-3 h-3" />
                            <span>Edit Lens Specs</span>
                          </button>
                        </div>
                        <span className="text-sm font-tabular font-semibold text-[#0B192C]">
                          {formatNaira(item.unitTotalNgn * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Discount Code Input */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block text-xs font-semibold text-[#0B192C]">
                  Promotional or Corporate Optical Code (Try VISION10 or FIRSTCARE15)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Enter code e.g. VISION10"
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs uppercase bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="px-4 py-2 bg-[#0B192C] text-white text-xs font-semibold rounded-lg hover:bg-[#162B49]"
                  >
                    Apply
                  </button>
                </div>
                {couponMessage && (
                  <p className="text-xs text-[#1E40AF] font-medium">{couponMessage}</p>
                )}
              </div>
            </>
          ) : (
            /* CHECKOUT FORM */
            <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-5">
              {!user && (
                <div className="p-4 bg-[#E0F2FE] border border-sky-200 rounded-xl flex items-center justify-between gap-4">
                  <div className="text-xs text-[#0B192C]">
                    <strong>Sign in required to place order:</strong> Link your order and prescription to your Vision Care account for live tracking and downloadable invoices.
                  </div>
                  <button
                    type="button"
                    onClick={onRequireSignIn}
                    className="px-3.5 py-2 bg-[#0B192C] text-white text-xs font-semibold rounded-lg shrink-0"
                  >
                    Sign In with Google
                  </button>
                </div>
              )}

              {savedAddresses.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Load Saved Delivery Address
                  </label>
                  <select
                    onChange={(e) => {
                      const addr = savedAddresses.find((a) => String(a.id) === e.target.value);
                      if (addr) {
                        setCustomerName(addr.recipientName);
                        setCustomerPhone(addr.phone);
                        setDeliveryAddress(addr.streetAddress);
                        setDeliveryCity(addr.city);
                        setDeliveryState(addr.state);
                      }
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                  >
                    <option value="">-- Select Saved Address --</option>
                    {savedAddresses.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}: {a.streetAddress}, {a.city}, {a.state}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Chidinma Okafor"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number (Nigeria) *</label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+234 803 000 0000"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-tabular"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="client@domain.com"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Street Delivery Address *</label>
                <input
                  type="text"
                  required
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="House number, street name, estate..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City / District *</label>
                  <input
                    type="text"
                    required
                    value={deliveryCity}
                    onChange={(e) => setDeliveryCity(e.target.value)}
                    placeholder="e.g. Lekki Phase 1 / Maitama"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">State *</label>
                  <select
                    value={deliveryState}
                    onChange={(e) => setDeliveryState(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                  >
                    {NIGERIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Delivery Method ({enabledDeliveryMethods.length} active option
                    {enabledDeliveryMethods.length === 1 ? '' : 's'})
                  </label>
                  {selectedDeliveryConfig?.estimatedDays && (
                    <span className="text-[11px] font-semibold text-[#1E40AF]">
                      Est. {selectedDeliveryConfig.estimatedDays}
                    </span>
                  )}
                </div>

                {enabledDeliveryMethods.length === 0 ? (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    Delivery methods are currently being updated by the administrator.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {enabledDeliveryMethods.map((method) => {
                      const isSelected = deliveryMethod === method.name;
                      const isFreeByThreshold =
                        Number(method.freeThresholdNgn || 0) > 0 &&
                        subtotalNgn >= Number(method.freeThresholdNgn);
                      const effectiveFee =
                        Number(method.priceNgn || 0) === 0 || isFreeByThreshold
                          ? 0
                          : Number(method.priceNgn);

                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setDeliveryMethod(method.name)}
                          className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-[#0B192C] text-white border-[#0B192C] shadow-xs'
                              : 'bg-white hover:bg-slate-50 text-[#0B192C] border-slate-200'
                          }`}
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="text-xs font-semibold flex items-center gap-2">
                              <span>{method.name}</span>
                              {method.estimatedDays && (
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                                    isSelected
                                      ? 'bg-white/15 text-[#C5A059]'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {method.estimatedDays}
                                </span>
                              )}
                            </div>
                            {method.description && (
                              <p
                                className={`text-[11px] truncate ${
                                  isSelected ? 'text-slate-300' : 'text-slate-500'
                                }`}
                              >
                                {method.description}
                              </p>
                            )}
                          </div>
                          <span
                            className={`text-xs font-bold font-tabular shrink-0 ${
                              isSelected ? 'text-[#C5A059]' : 'text-[#1E40AF]'
                            }`}
                          >
                            {effectiveFee === 0 ? 'FREE (₦0)' : formatNaira(effectiveFee)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Payment Gateway Selection */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Select Payment Gateway (₦ NGN)
                  </label>
                  <span className="text-[11px] font-tabular text-slate-400">
                    {enabledPaymentGateways.length} active option{enabledPaymentGateways.length === 1 ? '' : 's'}
                  </span>
                </div>

                {enabledPaymentGateways.length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                    Online payment gateways are currently turned off by the administrator. Please contact Vision Care support or check back shortly.
                  </div>
                ) : (
                  <div
                    className={`grid gap-2.5 ${
                      enabledPaymentGateways.length === 1
                        ? 'grid-cols-1'
                        : enabledPaymentGateways.length === 2
                        ? 'grid-cols-1 sm:grid-cols-2'
                        : 'grid-cols-1 sm:grid-cols-3'
                    }`}
                  >
                    {enabledPaymentGateways.map((pm) => (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentMethod(pm.id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          paymentMethod === pm.id
                            ? 'border-[#1E40AF] bg-[#E0F2FE]/40 ring-1 ring-[#1E40AF]'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0B192C]">
                          {pm.id === 'bank_transfer' ? (
                            <Building2 className="w-3.5 h-3.5 text-[#1E40AF]" />
                          ) : (
                            <CreditCard className="w-3.5 h-3.5 text-[#1E40AF]" />
                          )}
                          <span>{pm.label}</span>
                        </div>
                        <span className="block text-[10px] text-slate-500 mt-0.5">{pm.sub}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Interactive Paystack & Flutterwave Gateway Configuration & Channel Panel */}
                {(paymentMethod === 'paystack' || paymentMethod === 'flutterwave') &&
                  enabledPaymentGateways.some((pm) => pm.id === paymentMethod) && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div>
                            <span className="font-semibold text-[#0B192C] block">
                              {paymentMethod === 'paystack'
                                ? siteConfig?.paystackMerchantName || 'Paystack NGN Instant Checkout'
                                : siteConfig?.flutterwaveMerchantName || 'Flutterwave NGN Instant Checkout'}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Merchant:{' '}
                              {paymentMethod === 'paystack'
                                ? siteConfig?.paystackMerchantEmail || siteConfig?.supportEmail || 'concierge@visioncare.ng'
                                : siteConfig?.flutterwaveMerchantEmail || siteConfig?.supportEmail || 'concierge@visioncare.ng'}{' '}
                              · Amount: <strong className="font-tabular text-[#0B192C]">{formatNaira(finalTotalNgn)}</strong>
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                          Live Ready
                        </span>
                      </div>

                      {/* Gateway Payment Channel Selector (Card / Transfer / USSD) */}
                      <div>
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                          Select {paymentMethod === 'paystack' ? 'Paystack' : 'Flutterwave'} Payment Channel:
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'card' as const, label: 'Debit / Credit Card', sub: 'Visa · Mastercard · Verve' },
                            { id: 'transfer' as const, label: 'Instant Transfer', sub: 'Virtual NGN Account' },
                            { id: 'ussd' as const, label: 'Mobile USSD', sub: '*737# · *901# · *894#' },
                          ].map((ch) => (
                            <button
                              key={ch.id}
                              type="button"
                              onClick={() => setGatewayChannel(ch.id)}
                              className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                                gatewayChannel === ch.id
                                  ? 'bg-[#0B192C] text-white border-[#0B192C]'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <span className="block text-[11px] font-semibold">{ch.label}</span>
                              <span
                                className={`block text-[9px] mt-0.5 ${
                                  gatewayChannel === ch.id ? 'text-slate-300' : 'text-slate-400'
                                }`}
                              >
                                {ch.sub}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Channel-Specific Interactive Details */}
                      {gatewayChannel === 'card' && (
                        <div className="bg-white p-3 rounded-lg border border-slate-200/90 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-medium text-slate-600">
                              3D-Secure NGN Card Authorization ({paymentMethod === 'paystack' ? 'Paystack' : 'Flutterwave'})
                            </span>
                            <span className="font-tabular font-semibold text-[#1E40AF]">
                              {formatNaira(finalTotalNgn)}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <input
                              type="text"
                              placeholder="Card Last 4 (e.g. 4081)"
                              maxLength={4}
                              value={cardLast4}
                              onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, ''))}
                              className="col-span-2 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-tabular"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const prefix = paymentMethod === 'paystack' ? 'PSTK' : 'FLW';
                                setGatewayCustomRef(`${prefix}-CARD-${cardLast4 || '4081'}-${Date.now().toString().slice(-5)}`);
                              }}
                              className="px-2.5 py-1.5 bg-[#E0F2FE] hover:bg-sky-200 text-[#0B192C] font-semibold rounded text-[11px] cursor-pointer"
                            >
                              Verify Card
                            </button>
                          </div>
                        </div>
                      )}

                      {gatewayChannel === 'transfer' && (
                        <div className="bg-white p-3 rounded-lg border border-slate-200/90 space-y-1.5 font-tabular text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-slate-500">
                              {paymentMethod === 'paystack' ? 'Paystack Titan / Zenith:' : 'Flutterwave Wema / Sterling:'}
                            </span>
                            <strong className="text-[#0B192C]">
                              {siteConfig?.bankName || 'Zenith Bank PLC'} —{' '}
                              <span className="text-[#1E40AF]">{siteConfig?.bankAccountNumber || '1018492031'}</span>
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Beneficiary:</span>
                            <strong className="text-[#0B192C]">
                              {siteConfig?.bankAccountName || 'VISION CARE OPTICAL ATELIER LTD'}
                            </strong>
                          </div>
                        </div>
                      )}

                      {gatewayChannel === 'ussd' && (
                        <div className="bg-white p-3 rounded-lg border border-slate-200/90 space-y-2">
                          <label className="block text-[11px] font-medium text-slate-600">
                            Select Your Nigerian Bank USSD Channel:
                          </label>
                          <select
                            value={selectedUssdBank}
                            onChange={(e) => {
                              setSelectedUssdBank(e.target.value);
                              const prefix = paymentMethod === 'paystack' ? 'PSTK' : 'FLW';
                              setGatewayCustomRef(`${prefix}-USSD-${Date.now().toString().slice(-6)}`);
                            }}
                            className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white font-tabular"
                          >
                            <option value="*737# (GTBank)">*737*000*9482# — GTBank Instant USSD</option>
                            <option value="*901# (Access Bank)">*901*000*9482# — Access Bank Instant USSD</option>
                            <option value="*894# (First Bank)">*894*000*9482# — First Bank Instant USSD</option>
                            <option value="*966# (Zenith Bank)">*966*000*9482# — Zenith Bank Instant USSD</option>
                            <option value="*919# (UBA)">*919*000*9482# — UBA Magic Banking USSD</option>
                          </select>
                        </div>
                      )}

                      {/* Optional Admin-Configured Direct Payment URL or Custom Reference */}
                      {((paymentMethod === 'paystack' && siteConfig?.paystackPaymentUrl) ||
                        (paymentMethod === 'flutterwave' && siteConfig?.flutterwavePaymentUrl)) && (
                        <div className="flex items-center justify-between bg-[#E0F2FE]/60 px-3 py-2 rounded-lg border border-sky-200">
                          <span className="text-[11px] text-[#0B192C] font-medium">
                            Direct {paymentMethod === 'paystack' ? 'Paystack' : 'Flutterwave'} Payment Link:
                          </span>
                          <a
                            href={
                              paymentMethod === 'paystack'
                                ? siteConfig.paystackPaymentUrl
                                : siteConfig.flutterwavePaymentUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-semibold text-[#1E40AF] hover:underline flex items-center gap-1"
                          >
                            <span>Open Payment Page</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Gateway Transaction Reference (Auto-generated or enter custom receipt ref):
                        </label>
                        <input
                          type="text"
                          value={gatewayCustomRef}
                          onChange={(e) => setGatewayCustomRef(e.target.value)}
                          placeholder={
                            paymentMethod === 'paystack'
                              ? 'Auto-verified on click (or enter PSTK-... ref)'
                              : 'Auto-verified on click (or enter FLW-... ref)'
                          }
                          className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-tabular bg-white"
                        />
                      </div>
                    </div>
                  )}

                {paymentMethod === 'bank_transfer' &&
                  enabledPaymentGateways.some((pm) => pm.id === 'bank_transfer') && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                      <div className="font-tabular space-y-1 text-[#0B192C]">
                        <div>
                          <span className="text-slate-500">Bank:</span>{' '}
                          <strong>{siteConfig?.bankName || 'Zenith Bank PLC'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Account Name:</span>{' '}
                          <strong>{siteConfig?.bankAccountName || 'VISION CARE OPTICAL ATELIER LTD'}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Account Number:</span>{' '}
                          <strong className="text-sm text-[#1E40AF]">
                            {siteConfig?.bankAccountNumber || '1018492031'}
                          </strong>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Enter NIP Session ID / Transfer Reference for Admin Verification *
                        </label>
                        <input
                          type="text"
                          required
                          value={bankTransferRef}
                          onChange={(e) => setBankTransferRef(e.target.value)}
                          placeholder="e.g. NIP-000014261105..."
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-tabular bg-white"
                        />
                      </div>
                    </div>
                  )}
              </div>

              {/* Real-Time SMS & Email Order Status Notification Toggle */}
              {siteConfig?.checkoutNotificationsEnabled !== false && (
                <div className="rounded-xl border border-slate-200 bg-[#FAF9F6] p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-lg bg-[#0B192C] text-[#C5A059] shrink-0 mt-0.5">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0B192C] block">
                          {siteConfig?.checkoutNotificationTitle ||
                            'Real-Time Order Status Updates (SMS & Email)'}
                        </span>
                        <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                          Receive instant alerts as your eyewear progresses through{' '}
                          <strong className="text-[#0B192C]">Lab Surfacing</strong>,{' '}
                          <strong className="text-[#0B192C]">Quality Control</strong>, and{' '}
                          <strong className="text-[#0B192C]">Shipped</strong>.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Channel Toggles: SMS & Email */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setNotifySms((prev) => !prev)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        notifySms
                          ? 'bg-[#0B192C] text-white border-[#C5A059] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MessageSquare
                          className={`w-4 h-4 shrink-0 ${
                            notifySms ? 'text-[#C5A059]' : 'text-slate-400'
                          }`}
                        />
                        <div className="truncate">
                          <span className="block text-xs font-semibold">SMS Status Alerts</span>
                          <span
                            className={`block text-[10px] font-tabular truncate ${
                              notifySms ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {Number(siteConfig?.smsNotificationFeeNgn || 0) > 0
                              ? `+${formatNaira(Number(siteConfig.smsNotificationFeeNgn))} (${customerPhone || 'Phone'})`
                              : `Free (${customerPhone || 'Mobile SMS'})`}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                          notifySms
                            ? 'bg-[#C5A059] text-[#0B192C]'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {notifySms ? 'ON' : 'OFF'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNotifyEmail((prev) => !prev)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        notifyEmail
                          ? 'bg-[#0B192C] text-white border-[#C5A059] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Mail
                          className={`w-4 h-4 shrink-0 ${
                            notifyEmail ? 'text-[#C5A059]' : 'text-slate-400'
                          }`}
                        />
                        <div className="truncate">
                          <span className="block text-xs font-semibold">Email Status Alerts</span>
                          <span
                            className={`block text-[10px] truncate ${
                              notifyEmail ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            Free ({customerEmail || user?.email || 'Email'})
                          </span>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                          notifyEmail
                            ? 'bg-[#C5A059] text-[#0B192C]'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {notifyEmail ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  </div>

                  {/* Stage Checkboxes (Lab Surfacing, Quality Control, Shipped) */}
                  {(notifySms || notifyEmail) && (
                    <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="font-semibold text-slate-600">Notify me at milestones:</span>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-[#0B192C] font-medium">
                          <input
                            type="checkbox"
                            checked={notifyStages.labSurfacing}
                            onChange={(e) =>
                              setNotifyStages((prev) => ({
                                ...prev,
                                labSurfacing: e.target.checked,
                              }))
                            }
                            className="w-3.5 h-3.5 accent-[#1E40AF]"
                          />
                          <span>Lab Surfacing</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-[#0B192C] font-medium">
                          <input
                            type="checkbox"
                            checked={notifyStages.qualityControl}
                            onChange={(e) =>
                              setNotifyStages((prev) => ({
                                ...prev,
                                qualityControl: e.target.checked,
                              }))
                            }
                            className="w-3.5 h-3.5 accent-[#1E40AF]"
                          />
                          <span>Quality Control</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-[#0B192C] font-medium">
                          <input
                            type="checkbox"
                            checked={notifyStages.shipped}
                            onChange={(e) =>
                              setNotifyStages((prev) => ({
                                ...prev,
                                shipped: e.target.checked,
                              }))
                            }
                            className="w-3.5 h-3.5 accent-[#1E40AF]"
                          />
                          <span>Shipped</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Order / Fitting Notes</label>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Optional delivery instructions or optical alignment notes"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                />
              </div>

              {submitError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {submitError}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Bottom Summary & Action Bar */}
        {cart.length > 0 && mode !== 'confirmed' && (
          <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 space-y-3.5 sm:space-y-4">
            <div className="space-y-1.5 text-xs font-tabular">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span>{formatNaira(subtotalNgn)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Delivery Fee:</span>
                <span>{deliveryFeeNgn === 0 ? 'Complimentary (₦0)' : formatNaira(deliveryFeeNgn)}</span>
              </div>
              {smsFeeNgn > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>SMS Notification Service:</span>
                  <span>{formatNaira(smsFeeNgn)}</span>
                </div>
              )}
              {discountNgn > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Discount ({appliedCoupon?.code}):</span>
                  <span>-{formatNaira(discountNgn)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold text-[#0B192C] pt-2 border-t border-slate-200">
                <span>Total Payable:</span>
                <span>{formatNaira(finalTotalNgn)}</span>
              </div>
            </div>

            {mode === 'cart' ? (
              <button
                type="button"
                onClick={() => setMode('checkout')}
                className="w-full py-3.5 bg-[#0B192C] hover:bg-[#162B49] text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <span>Proceed to Secure Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMode('cart')}
                  className="px-4 py-3.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-100"
                >
                  Back to Bag
                </button>
                <button
                  type="submit"
                  form="checkout-form"
                  disabled={isSubmitting || enabledPaymentGateways.length === 0}
                  className="flex-1 py-3.5 bg-[#1E40AF] hover:bg-blue-800 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>
                    {enabledPaymentGateways.length === 0
                      ? 'Payment Gateways Currently Disabled'
                      : isSubmitting
                      ? 'Processing Payment...'
                      : paymentMethod === 'paystack'
                      ? `Pay ${formatNaira(finalTotalNgn)} with Paystack`
                      : paymentMethod === 'flutterwave'
                      ? `Pay ${formatNaira(finalTotalNgn)} with Flutterwave`
                      : `Submit Transfer (${formatNaira(finalTotalNgn)})`}
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
