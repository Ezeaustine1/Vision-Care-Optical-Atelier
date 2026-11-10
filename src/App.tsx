/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Heart,
  Upload,
  Shield,
  Sliders,
  ArrowRight,
  MessageCircle,
  Check,
  Sparkles,
  Search,
  HelpCircle,
  Calculator,
  Stethoscope,
  ArrowLeft,
  Star,
} from 'lucide-react';
import {
  Product,
  LensType,
  LensCoating,
  PrescriptionData,
  CartItem,
  OrderRecord,
  UserProfile,
  AddressRecord,
  EnquiryRecord,
  ReviewRecord,
  CouponRecord,
  ClinicalAppointmentRecord,
} from './types.ts';
import { OpticalImage, formatNaira } from './components/OpticalImage.tsx';
import { PrescriptionWizard } from './components/PrescriptionWizard.tsx';
import { ProductDetailModal } from './components/ProductDetailModal.tsx';
import { CartCheckoutDrawer } from './components/CartCheckoutDrawer.tsx';
import { CustomerAccountView } from './components/CustomerAccountView.tsx';
import { AdminDashboardView } from './components/AdminDashboardView.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { LensComparisonTable } from './components/LensComparisonTable.tsx';
import { LiveSupportWidget } from './components/LiveSupportWidget.tsx';
import { ClinicalAppointmentView } from './components/ClinicalAppointmentView.tsx';
import { getEstimatorCoatingsForLens } from './lib/estimatorPricing.ts';

const HERO_FALLBACK = '/src/assets/images/hero_vision_care_1793890597331.jpg';

export default function App() {
  type AppView = 'home' | 'frames' | 'ai_glasses' | 'wizard' | 'protective' | 'appointments' | 'account' | 'admin';
  const [activeView, setActiveView] = useState<AppView>('home');
  const [viewHistory, setViewHistory] = useState<AppView[]>(['home']);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const isNavigatingHistoryRef = React.useRef(false);

  const VIEW_LABELS: Record<AppView, string> = {
    home: 'Home',
    frames: 'Shop Frames',
    ai_glasses: 'AI Smart Glasses',
    wizard: 'Prescription Wizard',
    protective: 'Protective Lenses',
    appointments: 'Book Eye Appointment',
    account: 'My Account & Order Tracking',
    admin: 'Admin Portal',
  };

  useEffect(() => {
    if (isNavigatingHistoryRef.current) {
      isNavigatingHistoryRef.current = false;
      return;
    }
    setViewHistory((prev) => {
      const sliced = prev.slice(0, historyIndex + 1);
      if (sliced[sliced.length - 1] === activeView) return sliced;
      const next = [...sliced, activeView];
      setHistoryIndex(next.length - 1);
      return next;
    });
  }, [activeView]);

  const handleGoBackPage = () => {
    if (historyIndex > 0) {
      const targetIndex = historyIndex - 1;
      const targetView = viewHistory[targetIndex];
      isNavigatingHistoryRef.current = true;
      setHistoryIndex(targetIndex);
      setActiveView(targetView);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (activeView !== 'home') {
      setActiveView('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleGoForwardPage = () => {
    if (historyIndex < viewHistory.length - 1) {
      const targetIndex = historyIndex + 1;
      const targetView = viewHistory[targetIndex];
      isNavigatingHistoryRef.current = true;
      setHistoryIndex(targetIndex);
      setActiveView(targetView);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Catalog State
  const [products, setProducts] = useState<Product[]>([]);
  const [lensTypes, setLensTypes] = useState<LensType[]>([]);
  const [lensCoatings, setLensCoatings] = useState<LensCoating[]>([]);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [coupons, setCoupons] = useState<CouponRecord[]>([]);
  const [siteConfig, setSiteConfig] = useState<Record<string, any>>({});
  const [loadingCatalog, setLoadingCatalog] = useState<boolean>(true);

  // Auth & Account State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [savedPrescriptions, setSavedPrescriptions] = useState<PrescriptionData[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<AddressRecord[]>([]);
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [enquiries, setEnquiries] = useState<EnquiryRecord[]>([]);
  const [appointments, setAppointments] = useState<ClinicalAppointmentRecord[]>([]);

  // Cart & Active Product Modal State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [wizardInitialProduct, setWizardInitialProduct] = useState<Product | null>(null);
  const [wizardInitialMode, setWizardInitialMode] = useState<
    'prescription_glasses' | 'frames_only' | 'protective_glasses' | 'replacement_lenses'
  >('prescription_glasses');
  const [accountTrackedOrderId, setAccountTrackedOrderId] = useState<number | null>(null);
  const [pendingTrackOrderNumber, setPendingTrackOrderNumber] = useState<string | null>(null);

  // Marketplace Filters
  const [filterGender, setFilterGender] = useState<string>('ALL');
  const [filterShape, setFilterShape] = useState<string>('ALL');
  const [filterRim, setFilterRim] = useState<string>('ALL');
  const [filterMaterial, setFilterMaterial] = useState<string>('ALL');
  const [filterMaxPrice, setFilterMaxPrice] = useState<number>(650000);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'featured' | 'newest' | 'bestselling' | 'price_asc' | 'price_desc'>('featured');

  // Protective Section Filter
  const [protectiveTypeFilter, setProtectiveTypeFilter] = useState<string>('ALL');
  const [aiGlassesSpecFilter, setAiGlassesSpecFilter] = useState<string>('ALL');

  // Hero Media Active Index (when Admin activates multiple Hero videos/pictures)
  const [heroSlideIndex, setHeroSlideIndex] = useState<number>(0);

  const activeHeroMediaList = useMemo(() => {
    const rawList = Array.isArray(siteConfig.heroMediaItems) ? siteConfig.heroMediaItems : [];
    const activeItems = rawList.filter((item: any) => item && item.url && item.isActive !== false);
    if (activeItems.length > 0) {
      if (siteConfig.heroDisplayMode === 'single' && siteConfig.heroActiveMediaId) {
        const singleMatch = activeItems.find((item: any) => item.id === siteConfig.heroActiveMediaId);
        if (singleMatch) return [singleMatch];
      }
      if (siteConfig.heroActiveMediaId) {
        const primary = activeItems.find((item: any) => item.id === siteConfig.heroActiveMediaId);
        const others = activeItems.filter((item: any) => item.id !== siteConfig.heroActiveMediaId);
        if (primary) return [primary, ...others];
      }
      return activeItems;
    }
    const fallbackUrl = siteConfig.heroImage || HERO_FALLBACK;
    const isVideo =
      siteConfig.heroMediaType === 'video' ||
      fallbackUrl.startsWith('data:video/') ||
      /\.(mp4|webm|ogg|mov)(\?|$)/i.test(fallbackUrl);
    return [
      {
        id: 'default-hero',
        type: isVideo ? ('video' as const) : ('image' as const),
        url: fallbackUrl,
        title: 'Vision Care Campaign',
        caption:
          siteConfig.heroCaption ||
          'Featured Frame: Mayfair Round Italian Acetate with Sapphire Blue-Cut Anti-Reflective Lenses',
        isActive: true,
      },
    ];
  }, [siteConfig]);

  useEffect(() => {
    setHeroSlideIndex(0);
  }, [activeHeroMediaList.length, siteConfig.heroActiveMediaId]);

  // Quick Cost Estimator Lens Toggle for Frame Product Pages
  const [quickEstimatorLensCode, setQuickEstimatorLensCode] = useState<string>('single_vision');
  const [quickEstimatorCoatingCode, setQuickEstimatorCoatingCode] = useState<string>('clear_standard');

  // Newsletter & Support Toast
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isAboutMeOpen, setIsAboutMeOpen] = useState(false);

  // Patient Review Submission State (for patients with delivered orders)
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewOrderNumber, setReviewOrderNumber] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const deliveredUserOrders = useMemo(
    () => orders.filter((o) => String(o.orderStatus || '').toLowerCase() === 'delivered'),
    [orders]
  );

  useEffect(() => {
    if (deliveredUserOrders.length > 0 && !reviewOrderNumber) {
      setReviewOrderNumber(deliveredUserOrders[0].orderNumber);
    }
  }, [deliveredUserOrders, reviewOrderNumber]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleSubmitPatientReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewFeedback(null);
    if (!user || !idToken) {
      setIsAuthModalOpen(true);
      return;
    }
    if (deliveredUserOrders.length === 0) {
      setReviewFeedback({
        type: 'error',
        message: 'Only patients who have ordered and received a Delivered order can submit a verified review.',
      });
      return;
    }
    if (!reviewComment.trim()) {
      setReviewFeedback({ type: 'error', message: 'Please write your review experience before submitting.' });
      return;
    }
    setIsSubmittingReview(true);
    try {
      const selectedOrder =
        deliveredUserOrders.find((o) => o.orderNumber === reviewOrderNumber) || deliveredUserOrders[0];
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          customerName: user.fullName || user.email,
          customerRole: `Verified Patient · Delivered Order ${selectedOrder.orderNumber}`,
          rating: reviewRating,
          comment: reviewComment.trim(),
          orderNumber: selectedOrder.orderNumber,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.review) {
        setReviews((prev) => [data.review, ...prev]);
        setReviewComment('');
        setReviewRating(5);
        setShowReviewForm(false);
        setReviewFeedback({
          type: 'success',
          message: 'Thank you! Your verified patient review has been published.',
        });
        showToast('Your verified patient review has been published.');
      } else {
        setReviewFeedback({
          type: 'error',
          message: data.error || 'Could not submit review. Please ensure your order is marked Delivered.',
        });
      }
    } catch {
      setReviewFeedback({ type: 'error', message: 'Network error while submitting your review.' });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const res = await fetch('/api/catalog');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setLensTypes(data.lensTypes || []);
        setLensCoatings(data.lensCoatings || []);
        setReviews(data.reviews || []);
        setCoupons(data.coupons || []);
        setSiteConfig(data.siteConfig || {});
        if (data.siteConfig?.quickEstimatorDefaultLensCode) {
          setQuickEstimatorLensCode(data.siteConfig.quickEstimatorDefaultLensCode);
        }
      }
      if (idToken) {
        await fetchAccountBundle(idToken);
      }
    } catch {
      // Load fallback empty catalog state silently
    } finally {
      setLoadingCatalog(false);
    }
  };

  const fetchAccountBundle = async (token: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setOrders(data.orders || []);
        setSavedPrescriptions(data.prescriptions || []);
        setSavedAddresses(data.addresses || []);
        setWishlistIds(data.wishlistProductIds || []);
        setNotifications(data.notifications || []);
        setEnquiries(data.enquiries || []);
        setAppointments(Array.isArray(data.appointments) ? data.appointments : []);
      }
    } catch {
      // Handled gracefully
    }
  };

  const handleEmailSessionSignIn = async (payload: {
    email: string;
    password?: string;
    fullName?: string;
    mode?: 'customer' | 'admin';
  }) => {
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setIdToken(data.token);
        try {
          window.localStorage.setItem('vc_auth_token', data.token);
        } catch {
          // Ignore storage quota errors
        }
        setUser(data.user);
        setOrders(data.orders || []);
        setSavedPrescriptions(data.prescriptions || []);
        setSavedAddresses(data.addresses || []);
        setWishlistIds(data.wishlistProductIds || []);
        setNotifications(data.notifications || []);
        setEnquiries(data.enquiries || []);
        setAppointments(Array.isArray(data.appointments) ? data.appointments : []);
        showToast(`Signed in as ${data.user.fullName || data.user.email}.`);
      }
    } catch {
      showToast('Could not complete sign-in. Please try again.');
    }
  };

  useEffect(() => {
    fetchCatalog();
    try {
      const storedToken = window.localStorage.getItem('vc_auth_token');
      if (storedToken) {
        setIdToken(storedToken);
        fetchAccountBundle(storedToken);
      }
      const params = new URLSearchParams(window.location.search);
      const requestedView = params.get('view');
      const trackOrderParam = params.get('trackOrder');
      if (requestedView === 'account' || trackOrderParam) {
        setActiveView('account');
      }
      if (trackOrderParam) {
        setPendingTrackOrderNumber(trackOrderParam.trim());
      }
    } catch {
      // Ignore URL parse issues
    }
  }, []);

  useEffect(() => {
    if (!pendingTrackOrderNumber || orders.length === 0) return;
    const match = orders.find(
      (o) =>
        o.orderNumber.toLowerCase() === pendingTrackOrderNumber.toLowerCase() ||
        String(o.id) === pendingTrackOrderNumber
    );
    if (match) {
      setAccountTrackedOrderId(match.id);
      setActiveView('account');
      setPendingTrackOrderNumber(null);
    }
  }, [pendingTrackOrderNumber, orders]);

  const handleGooglePopupSignIn = async () => {
    await handleEmailSessionSignIn({
      email: 'ezehaustine1@gmail.com',
      fullName: 'Austine Ezeh',
      mode: activeView === 'admin' ? 'admin' : 'customer',
    });
  };

  const handleSignIn = async () => {
    setIsAuthModalOpen(true);
  };

  const handleSignOut = async () => {
    try {
      window.localStorage.removeItem('vc_auth_token');
    } catch {
      // Ignore if storage unavailable
    }
    setUser(null);
    setIdToken(null);
    setOrders([]);
    setSavedPrescriptions([]);
    setSavedAddresses([]);
    setWishlistIds([]);
    setNotifications([]);
    setEnquiries([]);
    setAppointments([]);
    setActiveView('home');
    showToast('Signed out of Vision Care.');
  };

  const handleToggleWishlist = async (productId: number) => {
    if (!idToken) {
      setWishlistIds((prev) =>
        prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
      );
      showToast('Updated saved frames.');
      return;
    }
    const res = await fetch('/api/wishlist/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ productId }),
    });
    if (res.ok) {
      const data = await res.json();
      setWishlistIds((prev) =>
        data.added ? [...prev, productId] : prev.filter((id) => id !== productId)
      );
      showToast(data.added ? 'Saved frame to your Wishlist.' : 'Removed frame from Wishlist.');
    }
  };

  const handleAddToCart = (item: CartItem, openCheckoutAfter = false) => {
    setCart((prev) => [...prev, item]);
    if (openCheckoutAfter) {
      setIsCartOpen(true);
    } else {
      showToast(`Added ${item.productName} to your Optical Bag.`);
    }
  };

  const handleUpdateCartQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((it) => (it.cartItemId === cartItemId ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it))
    );
  };

  const handleRemoveCartItem = (cartItemId: string) => {
    setCart((prev) => prev.filter((it) => it.cartItemId !== cartItemId));
  };

  const handleEditCartItemInWizard = (item: CartItem) => {
    const matchedProd = products.find((p) => p.id === item.productId) || null;
    setWizardInitialProduct(matchedProd);
    setWizardInitialMode(item.orderType);
    handleRemoveCartItem(item.cartItemId);
    setIsCartOpen(false);
    setActiveView('wizard');
  };

  const handleSavePrescriptionToAccount = async (rx: PrescriptionData) => {
    if (!idToken) return;
    await fetch('/api/prescriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(rx),
    });
    await fetchAccountBundle(idToken);
  };

  const handleSubmitOrder = async (orderPayload: any) => {
    let activeToken = idToken;
    if (!activeToken) {
      const fallbackEmail = (orderPayload?.customerEmail || user?.email || '').trim();
      const fallbackName = (orderPayload?.customerName || user?.fullName || 'Vision Care Client').trim();
      if (fallbackEmail) {
        const sessionRes = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: fallbackEmail,
            fullName: fallbackName,
            mode: 'customer',
          }),
        });
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          activeToken = sessionData.token;
          setIdToken(sessionData.token);
          setUser(sessionData.user);
        }
      }
    }
    if (!activeToken) {
      await handleSignIn();
      throw new Error('Please enter your email address or sign in to complete your order.');
    }
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeToken}`,
      },
      body: JSON.stringify(orderPayload),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to place order');
    }
    setCart([]);
    await fetchAccountBundle(activeToken);
    await fetchCatalog();
    if (data?.order?.customerEmail) {
      showToast(
        `Order ${data.order.orderNumber} confirmed! Receipt, product image & lens prescription PDF sent to ${data.order.customerEmail}.`
      );
    }
    return data;
  };

  // Filtered & Sorted Products for Frames Marketplace
  const filteredFrames = useMemo(() => {
    return products
      .filter((p) => p.isActive)
      .filter((p) => (filterGender === 'ALL' ? true : p.gender === filterGender || p.category === filterGender))
      .filter((p) => (filterShape === 'ALL' ? true : p.shape === filterShape))
      .filter((p) => (filterRim === 'ALL' ? true : p.rimStyle === filterRim))
      .filter((p) => (filterMaterial === 'ALL' ? true : p.material === filterMaterial))
      .filter((p) => (filterMaxPrice >= 650000 ? true : (p.discountPriceNgn || p.priceNgn) <= filterMaxPrice))
      .filter((p) =>
        searchQuery.trim() === ''
          ? true
          : p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.shape.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        const priceA = a.discountPriceNgn || a.priceNgn;
        const priceB = b.discountPriceNgn || b.priceNgn;
        if (sortBy === 'price_asc') return priceA - priceB;
        if (sortBy === 'price_desc') return priceB - priceA;
        if (sortBy === 'newest') return Number(b.isNewArrival) - Number(a.isNewArrival) || b.id - a.id;
        if (sortBy === 'bestselling') return Number(b.isBestSeller) - Number(a.isBestSeller) || b.id - a.id;
        return Number(b.isFeatured) - Number(a.isFeatured) || b.id - a.id;
      });
  }, [products, filterGender, filterShape, filterRim, filterMaterial, filterMaxPrice, searchQuery, sortBy]);

  const wishlistProducts = useMemo(
    () => products.filter((p) => wishlistIds.includes(p.id)),
    [products, wishlistIds]
  );

  const totalBagCount = cart.reduce((acc, it) => acc + it.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#0B192C]">
      {/* Slim Dismissible Promotional Banner (<= 40px) */}
      <div className="bg-[#0B192C] text-slate-200 text-[11px] sm:text-xs py-2 px-3 sm:px-4 text-center border-b border-white/10">
        <span className="truncate block max-w-6xl mx-auto">
          {siteConfig.promoBannerText ||
            'Complimentary Nationwide Express Delivery on orders above ₦120,000 · Use code VISION10 for 10% off'}
        </span>
      </div>

      {/* Mandatory 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4 lg:gap-8 px-3.5 sm:px-6 py-3 sm:py-4">
          {/* Zone 1: Official Vision Care Logo + Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveView('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2.5 sm:gap-3 text-lg sm:text-xl font-bold tracking-tight text-[#0B192C] whitespace-nowrap shrink-0 font-display group"
          >
            <img
              src="/assets/aistudio/Vision_Care_Eyewear_Logo_31f9746e.png"
              alt="Vision Care — Premium Eyewear & Optical Solutions Logo"
              className="h-11 sm:h-14 w-auto object-contain rounded-lg bg-white px-1.5 py-0.5 border border-slate-200/80 shadow-2xs group-hover:border-[#C5A059] transition-colors"
            />
            <span className="hidden xl:inline-block">VISION CARE</span>
          </a>

          {/* Zone 2: 5 concise single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#frames"
              onClick={(e) => {
                e.preventDefault();
                setActiveView('frames');
              }}
              className={`hover:text-[#0B192C] transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'frames' ? 'text-[#0B192C] underline underline-offset-8 decoration-[#C5A059] decoration-2' : ''
              }`}
            >
              Shop Frames
            </a>
            <a
              href="#ai-glasses"
              onClick={(e) => {
                e.preventDefault();
                setActiveView('ai_glasses');
              }}
              className={`hover:text-[#0B192C] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                activeView === 'ai_glasses' ? 'text-[#0B192C] underline underline-offset-8 decoration-[#C5A059] decoration-2 font-semibold' : ''
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>AI Glasses</span>
            </a>
            <a
              href="#appointments"
              onClick={(e) => {
                e.preventDefault();
                setActiveView('appointments');
              }}
              className={`hover:text-[#0B192C] transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'appointments' ? 'text-[#0B192C] underline underline-offset-8 decoration-[#C5A059] decoration-2' : ''
              }`}
            >
              Book Eye Appointment
            </a>
            <a
              href="#account"
              onClick={(e) => {
                e.preventDefault();
                setActiveView('account');
              }}
              className={`hover:text-[#0B192C] transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'account' ? 'text-[#0B192C] underline underline-offset-8 decoration-[#C5A059] decoration-2' : ''
              }`}
            >
              My Account
            </a>
            <a
              href="#admin"
              onClick={(e) => {
                e.preventDefault();
                setActiveView('admin');
              }}
              className={`hover:text-[#0B192C] transition-colors whitespace-nowrap shrink-0 ${
                activeView === 'admin' ? 'text-[#0B192C] underline underline-offset-8 decoration-[#C5A059] decoration-2' : ''
              }`}
            >
              Admin Portal
            </a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="px-3.5 sm:px-4 py-2 text-xs font-medium text-white bg-[#0B192C] rounded-lg hover:bg-[#162B49] transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Optical Bag ({totalBagCount})</span>
            </button>
          </div>
        </div>

        {/* Mobile Secondary Quick Nav (Matching the exact 5 navigation links) */}
        <div className="flex md:hidden items-center justify-around border-t border-slate-100 py-2 px-3 bg-white text-xs font-medium text-slate-600 overflow-x-auto no-scrollbar gap-3">
          <button
            type="button"
            onClick={() => setActiveView('frames')}
            className={`whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'frames' ? 'text-[#0B192C] font-semibold underline underline-offset-4 decoration-[#C5A059]' : ''
            }`}
          >
            Frames
          </button>
          <button
            type="button"
            onClick={() => setActiveView('ai_glasses')}
            className="whitespace-nowrap shrink-0 text-[#1E40AF] font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Sparkles className="w-3 h-3 text-[#C5A059]" />
            <span>AI Glasses</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('appointments')}
            className={`whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'appointments' ? 'text-[#0B192C] font-semibold underline underline-offset-4 decoration-[#C5A059]' : 'text-[#0B192C] font-semibold'
            }`}
          >
            Eye Clinic
          </button>
          <button
            type="button"
            onClick={() => setActiveView('account')}
            className={`whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'account' ? 'text-[#0B192C] font-semibold underline underline-offset-4 decoration-[#C5A059]' : ''
            }`}
          >
            Account
          </button>
          <button
            type="button"
            onClick={() => setActiveView('admin')}
            className={`whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'admin' ? 'text-[#0B192C] font-semibold underline underline-offset-4 decoration-[#C5A059]' : ''
            }`}
          >
            Admin
          </button>
        </div>

        {/* Client Back & Forward Page Navigation Bar */}
        {(historyIndex > 0 || historyIndex < viewHistory.length - 1 || activeView !== 'home') && (
          <div className="bg-[#FAF9F6] border-t border-slate-200/80 px-3.5 sm:px-6 py-2">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleGoBackPage}
                  disabled={historyIndex === 0 && activeView === 'home'}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-300 text-[#0B192C] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-[#1E40AF] shrink-0" />
                  <span className="truncate max-w-[160px] sm:max-w-none">
                    {historyIndex > 0
                      ? `Back to ${VIEW_LABELS[viewHistory[historyIndex - 1]]}`
                      : 'Back to Home'}
                  </span>
                </button>

                {historyIndex < viewHistory.length - 1 && (
                  <button
                    type="button"
                    onClick={handleGoForwardPage}
                    className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#0B192C] hover:bg-[#162B49] text-white font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span className="truncate max-w-[160px] sm:max-w-none">
                      Return to {VIEW_LABELS[viewHistory[historyIndex + 1]]}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                  </button>
                )}
              </div>

              <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                Current Page: <strong className="text-[#0B192C]">{VIEW_LABELS[activeView]}</strong>
              </span>
            </div>
          </div>
        )}
      </header>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0B192C] text-white px-5 py-3 rounded-xl shadow-xl border border-white/15 text-xs font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-[#C5A059]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* MAIN VIEW ROUTER */}
      <main className="flex-1">
        {/* VIEW 1: HOMEPAGE */}
        {activeView === 'home' && (
          <div>
            {/* Split-Screen Editorial Hero Section */}
            <section className="bg-[#0B192C] text-white border-b border-white/10">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
                  <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
                    <div className="flex flex-wrap items-center gap-3.5">
                      <div className="bg-white rounded-xl p-2 sm:p-2.5 border-2 border-[#C5A059]/60 shadow-lg shrink-0">
                        <img
                          src="/assets/aistudio/Vision_Care_Eyewear_Logo_31f9746e.png"
                          alt="Vision Care Official Brand Logo"
                          className="h-14 sm:h-16 w-auto object-contain"
                        />
                      </div>
                      <div className="text-xs font-medium tracking-widest uppercase text-[#C5A059]">
                        International Optical Atelier · Lagos & Abuja
                      </div>
                    </div>
                    <h1
                      className="text-4xl sm:text-5xl lg:text-[3.5rem] font-semibold leading-[1.1] tracking-tight text-white"
                      style={{ textWrap: 'balance' } as React.CSSProperties}
                    >
                      {siteConfig.heroHeadline || 'See Clearly. Look Beautiful. Live Confidently.'}
                    </h1>
                    <p className="text-base text-slate-300 leading-relaxed max-w-xl">
                      {siteConfig.heroSubheadline ||
                        'Discover premium eyewear, personalised prescription lenses, and protective glasses designed around your vision and lifestyle.'}
                    </p>

                    <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-3 sm:gap-4 pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveView('frames')}
                        className="w-full sm:w-auto justify-center px-6 py-3.5 bg-[#C5A059] hover:bg-[#b58e47] text-[#0B192C] font-semibold text-sm rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>Shop Eyewear</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWizardInitialProduct(null);
                          setWizardInitialMode('prescription_glasses');
                          setActiveView('wizard');
                        }}
                        className="w-full sm:w-auto justify-center px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold text-sm rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-[#C5A059]" />
                        <span>Upload Prescription</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveView('appointments')}
                        className="w-full sm:w-auto justify-center px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold text-sm rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Stethoscope className="w-4 h-4 text-[#C5A059]" />
                        <span>Book Doctor Appointment</span>
                      </button>
                    </div>

                    <div className="pt-4 border-t border-white/10 flex flex-wrap items-center gap-4 text-xs text-slate-300">
                      <span>Genuine Varilux Multifocals</span>
                      <span>·</span>
                      <span>AI Prescription OCR</span>
                      <span>·</span>
                      <span>Blue Cut & Photochromic</span>
                    </div>
                  </div>

                  <div className="lg:col-span-6">
                    {(() => {
                      const safeIdx =
                        heroSlideIndex < activeHeroMediaList.length ? heroSlideIndex : 0;
                      const currentMedia = activeHeroMediaList[safeIdx] || activeHeroMediaList[0];
                      const isVideoMedia =
                        currentMedia.type === 'video' ||
                        String(currentMedia.url || '').startsWith('data:video/') ||
                        /\.(mp4|webm|ogg|mov)(\?|$)/i.test(String(currentMedia.url || ''));

                      return (
                        <div className="h-full min-h-[340px] rounded-2xl overflow-hidden border border-white/15 relative bg-[#07111E]">
                          {isVideoMedia ? (
                            <video
                              key={currentMedia.url}
                              src={currentMedia.url}
                              autoPlay
                              loop
                              muted
                              playsInline
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <OpticalImage
                              src={currentMedia.url || HERO_FALLBACK}
                              alt={
                                currentMedia.title ||
                                'Vision Care Fashionable Prescription Eyewear Campaign'
                              }
                              className="w-full h-full object-cover"
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#0B192C]/80 via-transparent to-transparent flex flex-col justify-between p-6 pointer-events-none">
                            <div className="flex justify-end pointer-events-auto">
                              {activeHeroMediaList.length > 1 && (
                                <div className="flex items-center gap-1.5 bg-[#0B192C]/80 backdrop-blur-xs px-2.5 py-1.5 rounded-xl border border-white/15">
                                  {activeHeroMediaList.map((item: any, idx: number) => {
                                    const itemIsVid =
                                      item.type === 'video' ||
                                      String(item.url || '').startsWith('data:video/');
                                    return (
                                      <button
                                        key={item.id || idx}
                                        type="button"
                                        onClick={() => setHeroSlideIndex(idx)}
                                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer ${
                                          safeIdx === idx
                                            ? 'bg-[#C5A059] text-[#0B192C]'
                                            : 'text-slate-300 hover:text-white'
                                        }`}
                                      >
                                        {itemIsVid ? `Video ${idx + 1}` : `Photo ${idx + 1}`}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            <div className="text-xs text-slate-200">
                              {currentMedia.caption ? (
                                <span>{currentMedia.caption}</span>
                              ) : (
                                <>
                                  <span className="font-semibold text-white">Featured Frame:</span>{' '}
                                  Mayfair Round Italian Acetate with Sapphire Blue-Cut Anti-Reflective Lenses
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 2: FEATURED & BEST-SELLING COLLECTION GRID (5-Column Desktop Compact Layout) */}
            <section className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-8 sm:py-12">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2.5 sm:gap-4 mb-4 sm:mb-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#1E40AF]">
                    Curated Optical Collection
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-semibold text-[#0B192C] mt-1">
                    Featured & Best-Selling Frames
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView('frames')}
                  className="text-sm font-semibold text-[#1E40AF] hover:underline flex items-center gap-1.5 py-1 touch-manipulation"
                >
                  <span>View Complete Frame Marketplace ({products.length})</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {loadingCatalog ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-2.5 gap-y-2.5 sm:gap-3.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <div key={n} className="h-52 sm:h-56 rounded-xl bg-slate-200/60 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-2.5 gap-y-2.5 sm:gap-3.5">
                  {products
                    .filter((p) => p.category !== 'AI Glasses' && !p.sku.startsWith('VC-AI-'))
                    .slice(0, 10)
                    .map((prod) => {
                      let imgs: string[] = [];
                      let cols: string[] = [];
                      try {
                        imgs = JSON.parse(prod.imagesJson);
                        cols = JSON.parse(prod.colorsJson);
                      } catch {
                        imgs = [];
                        cols = ['Default'];
                      }
                      const effectivePrice = prod.discountPriceNgn || prod.priceNgn;
                      const wishlisted = wishlistIds.includes(prod.id);

                      return (
                        <div
                          key={prod.id}
                          className="group bg-white rounded-xl border border-slate-200/90 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between"
                        >
                          <div>
                            <div
                              onClick={() => setDetailProduct(prod)}
                              className="aspect-[16/10] bg-[#F4F3EF] overflow-hidden cursor-pointer relative"
                            >
                              <OpticalImage
                                src={imgs[0] || ''}
                                alt={prod.name}
                                className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleWishlist(prod.id);
                                }}
                                className="absolute top-1.5 right-1.5 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 text-slate-700 hover:text-rose-600 shadow-xs touch-manipulation"
                                title="Save to Wishlist"
                              >
                                <Heart className={`w-3.5 h-3.5 ${wishlisted ? 'fill-rose-600 text-rose-600' : ''}`} />
                              </button>
                            </div>

                            <div className="p-2.5 sm:p-3.5">
                              <div className="flex items-center gap-1 text-[10px] text-slate-500 uppercase tracking-wider truncate">
                                <span className="truncate">{prod.brand}</span>
                                <span aria-hidden="true">·</span>
                                <span className="truncate">{prod.shape}</span>
                              </div>

                              <div className="mt-0.5 sm:mt-1 flex items-baseline justify-between gap-1.5">
                                <h3
                                  onClick={() => setDetailProduct(prod)}
                                  className="text-xs sm:text-sm font-semibold text-[#0B192C] cursor-pointer hover:text-[#1E40AF] line-clamp-1"
                                >
                                  {prod.name}
                                </h3>
                                <div className="text-right font-tabular shrink-0">
                                  <span className="text-xs font-bold text-[#0B192C]">
                                    {formatNaira(effectivePrice)}
                                  </span>
                                  {prod.discountPriceNgn && (
                                    <span className="block text-[10px] text-slate-400 line-through">
                                      {formatNaira(prod.priceNgn)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <p className="text-[11px] text-slate-500 mt-0.5 font-tabular truncate">
                                {prod.material} · {cols.length} Colours
                              </p>
                            </div>
                          </div>

                          <div className="px-2.5 pb-2.5 pt-0.5 sm:px-3.5 sm:pb-3.5 sm:pt-1 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setWizardInitialProduct(prod);
                                setWizardInitialMode('prescription_glasses');
                                setActiveView('wizard');
                              }}
                              className="flex-1 min-h-[38px] sm:min-h-[34px] py-1.5 px-2 bg-[#0B192C] hover:bg-[#162B49] active:scale-[0.99] text-white text-[11px] font-semibold rounded-lg transition-all truncate touch-manipulation"
                            >
                              + Lenses &amp; Rx
                            </button>
                            <button
                              type="button"
                              onClick={() => setDetailProduct(prod)}
                              className="min-h-[38px] sm:min-h-[34px] py-1.5 px-2.5 border border-slate-300 hover:bg-slate-50 active:scale-[0.99] text-[#0B192C] text-[11px] font-semibold rounded-lg transition-all shrink-0 touch-manipulation"
                            >
                              View
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </section>

            {/* SECTION 2B: AI SMART GLASSES & WEARABLE OPTICAL INTELLIGENCE SHOWCASE */}
            {(() => {
              const aiGlassesList = products.filter(
                (p) => p.isActive && (p.category === 'AI Glasses' || p.sku.startsWith('VC-AI-'))
              );
              if (aiGlassesList.length === 0) return null;

              return (
                <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
                  <div className="bg-gradient-to-br from-[#0B192C] via-[#10233E] to-[#0B192C] text-white rounded-3xl p-5 sm:p-8 border border-slate-800 shadow-lg space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-white/10 pb-5">
                      <div className="space-y-1.5 max-w-2xl">
                        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#C5A059]">
                          <Sparkles className="w-4 h-4" />
                          <span>Smart Eyewear &amp; Wearable Optical Intelligence</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-white">
                          AI Smart Glasses — Prescription &amp; Non-Rx Ready
                        </h2>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Experience hands-free POV cameras, open-ear directional speakers, real-time AI voice translation, and micro-HUD displays—custom-fitted by our optical laboratory with your Single Vision, Bifocal, Varilux Progressive, or 0.00 Blue-Cut / Photochromic lenses.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveView('ai_glasses');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="px-4 py-2.5 bg-[#C5A059] hover:bg-[#b58e47] text-[#0B192C] text-xs font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                        >
                          <span>Explore AI Smart Glasses ({aiGlassesList.length})</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                      {aiGlassesList.slice(0, 5).map((prod) => {
                        let imgs: string[] = [];
                        let cols: string[] = [];
                        try {
                          imgs = JSON.parse(prod.imagesJson);
                          cols = JSON.parse(prod.colorsJson);
                        } catch {
                          imgs = [];
                          cols = ['Default'];
                        }
                        const effectivePrice = prod.discountPriceNgn || prod.priceNgn;
                        const wishlisted = wishlistIds.includes(prod.id);

                        return (
                          <div
                            key={prod.id}
                            className="bg-white/5 hover:bg-white/8 border border-white/15 rounded-xl overflow-hidden flex flex-col justify-between transition-all"
                          >
                            <div>
                              <div
                                onClick={() => setDetailProduct(prod)}
                                className="aspect-[16/10] bg-[#F4F3EF] overflow-hidden cursor-pointer relative"
                              >
                                <OpticalImage
                                  src={imgs[0] || ''}
                                  alt={prod.name}
                                  className="w-full h-full object-cover"
                                />
                                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#0B192C]/90 text-[#C5A059] text-[9px] font-bold uppercase tracking-wider border border-[#C5A059]/40">
                                  AI · Rx Ready
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleWishlist(prod.id);
                                  }}
                                  className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 text-slate-700 hover:text-rose-600 shadow-xs cursor-pointer"
                                  title="Save to Wishlist"
                                >
                                  <Heart className={`w-3.5 h-3.5 ${wishlisted ? 'fill-rose-600 text-rose-600' : ''}`} />
                                </button>
                              </div>

                              <div className="p-3.5 space-y-1">
                                <div className="flex items-center gap-1.5 text-[10px] text-[#C5A059] uppercase tracking-wider font-semibold truncate">
                                  <span className="truncate">{prod.brand}</span>
                                  <span>·</span>
                                  <span>{prod.shape}</span>
                                </div>

                                <div className="flex items-baseline justify-between gap-1.5">
                                  <h3
                                    onClick={() => setDetailProduct(prod)}
                                    className="text-xs sm:text-sm font-semibold text-white cursor-pointer hover:text-[#C5A059] line-clamp-1"
                                  >
                                    {prod.name}
                                  </h3>
                                  <div className="text-right font-tabular shrink-0">
                                    <span className="text-xs font-bold text-[#C5A059]">
                                      {formatNaira(effectivePrice)}
                                    </span>
                                  </div>
                                </div>

                                <p className="text-[11px] text-slate-300 line-clamp-2 leading-snug">
                                  {prod.description}
                                </p>
                              </div>
                            </div>

                            <div className="px-3.5 pb-3.5 pt-1 flex flex-col gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setWizardInitialProduct(prod);
                                    setWizardInitialMode('prescription_glasses');
                                    setActiveView('wizard');
                                  }}
                                  className="flex-1 py-1.5 px-2 bg-[#C5A059] hover:bg-[#b58e47] text-[#0B192C] text-[11px] font-bold rounded-lg transition-colors cursor-pointer truncate"
                                >
                                  Fit Lenses + Rx
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDetailProduct(prod)}
                                  className="py-1.5 px-2 bg-white/10 hover:bg-white/20 text-white border border-white/15 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer"
                                >
                                  View
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  handleAddToCart({
                                    cartItemId: `vc-ai-${Date.now()}`,
                                    productId: prod.id,
                                    productName: prod.name,
                                    productBrand: prod.brand,
                                    productImage: imgs[0] || '',
                                    orderType: 'frames_only',
                                    selectedColor: cols[0] || 'Default',
                                    quantity: 1,
                                    framePriceNgn: effectivePrice,
                                    lensTypeName: 'AI Smart Glasses (Standard Smart Lenses)',
                                    lensOptionSelected: 'Standard AI Smart Chassis',
                                    lensPriceNgn: 0,
                                    coatingSummary: 'Factory UV400 & Anti-Glare Smart Lens',
                                    coatingPriceNgn: 0,
                                    prescriptionSnapshot: null,
                                    unitTotalNgn: effectivePrice,
                                  });
                                }}
                                className="w-full py-1.5 px-2 bg-white/5 hover:bg-white/15 text-slate-200 border border-white/10 text-[10px] font-medium rounded-lg transition-colors cursor-pointer truncate"
                              >
                                Buy Non-Rx ({formatNaira(effectivePrice)})
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            })()}

            {/* SECTION 3: HOW IT WORKS, CLINICAL CRAFTSMANSHIP & ATTRIBUTABLE TESTIMONIALS */}
            <section className="bg-white border-y border-slate-200 py-16">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
                {/* How Vision Care Works */}
                <div>
                  <div className="max-w-2xl mb-10">
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#1E40AF]">
                      Seamless Clinical Dispensing
                    </p>
                    <h2 className="text-3xl font-semibold text-[#0B192C] mt-1">
                      How Vision Care Works in 4 Steps
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {[
                      {
                        step: '01. Choose Frame or Lens Path',
                        desc: 'Select a handcrafted Italian Acetate or Japanese Titanium frame—or keep your existing frame and order replacement lenses.',
                      },
                      {
                        step: '02. Upload Rx or Enter Manually',
                        desc: 'Upload a photo or PDF of your doctor’s prescription. Our AI OCR extracts OD/OS SPH, CYL, AXIS, ADD, and PD for your confirmation.',
                      },
                      {
                        step: '03. Select Lens & Treatment',
                        desc: 'Pair Single Vision, Invisible Bifocal, or Varilux Progressive lenses with Blue Cut, Transitions Photochromic, and Crizal AR.',
                      },
                      {
                        step: '04. Lab Surfacing & Express Delivery',
                        desc: 'Every pair passes 7-point digital lensometer verification before insured delivery to your home or office across Nigeria.',
                      },
                    ].map((item) => (
                      <div key={item.step} className="space-y-2">
                        <h3 className="text-base font-semibold text-[#0B192C]">{item.step}</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Verified Patient Outcomes & Delivered-Order Reviews */}
                <div className="pt-12 border-t border-slate-100 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-[#1E40AF]">
                        Verified Patient Outcomes
                      </p>
                      <h2 className="text-2xl sm:text-3xl font-semibold text-[#0B192C] mt-1">
                        Patient Reviews from Verified Delivered Orders
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Real feedback from patients who ordered and received their prescription frames &amp; optical lenses.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setReviewFeedback(null);
                          setShowReviewForm((prev) => !prev);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-[#0B192C] hover:bg-[#162B49] text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        {showReviewForm ? 'Close Review Form' : 'Write a Patient Review'}
                      </button>
                    </div>
                  </div>

                  {reviewFeedback && (
                    <div
                      className={`p-3.5 rounded-xl border text-xs font-medium ${
                        reviewFeedback.type === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-amber-50 border-amber-200 text-amber-900'
                      }`}
                    >
                      {reviewFeedback.message}
                    </div>
                  )}

                  {showReviewForm && (
                    <div className="p-5 rounded-2xl bg-[#FAF9F6] border border-slate-200/90 space-y-4">
                      {!user ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-[#0B192C]">
                              Sign in to submit your Verified Patient Review
                            </p>
                            <p className="text-xs text-slate-600">
                              Patients who have ordered and received their order (marked Delivered) can publish a verified review here.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsAuthModalOpen(true)}
                            className="px-4 py-2.5 bg-[#1E40AF] hover:bg-[#1E3A8A] text-white text-xs font-semibold rounded-xl shrink-0 cursor-pointer"
                          >
                            Sign In / Create Account
                          </button>
                        </div>
                      ) : deliveredUserOrders.length === 0 ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-[#0B192C]">
                              Verified Review Eligibility — Delivered Order Required
                            </p>
                            <p className="text-xs text-slate-600">
                              Hi {user.fullName || user.email}, only patients who have ordered and gotten their order delivered can post a review. Once your order status reaches <span className="font-semibold text-emerald-700">Delivered</span>, you can submit your review right here.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveView('account')}
                            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-[#0B192C] text-xs font-semibold rounded-xl shrink-0 cursor-pointer"
                          >
                            Check My Order Status
                          </button>
                        </div>
                      ) : (
                        <form onSubmit={handleSubmitPatientReview} className="space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                            <div>
                              <h3 className="text-sm font-semibold text-[#0B192C]">
                                Share Your Verified Patient Experience
                              </h3>
                              <p className="text-xs text-slate-500">
                                Posting as <span className="font-semibold text-[#0B192C]">{user.fullName || user.email}</span>
                              </p>
                            </div>
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                              <Check className="w-3.5 h-3.5" />
                              <span>Eligible · Delivered Order Verified</span>
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                                Select Delivered Order
                              </label>
                              <select
                                value={reviewOrderNumber}
                                onChange={(e) => setReviewOrderNumber(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                              >
                                {deliveredUserOrders.map((ord) => (
                                  <option key={ord.id} value={ord.orderNumber}>
                                    Order {ord.orderNumber} — Delivered ({formatNaira(ord.totalNgn)})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                                Star Rating
                              </label>
                              <div className="flex items-center gap-1.5 pt-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() => setReviewRating(star)}
                                    className="p-1 cursor-pointer"
                                  >
                                    <Star
                                      className={`w-5 h-5 ${
                                        star <= reviewRating
                                          ? 'fill-amber-400 text-amber-400'
                                          : 'text-slate-300'
                                      }`}
                                    />
                                  </button>
                                ))}
                                <span className="text-xs font-semibold text-slate-700 ml-1">
                                  {reviewRating}.0 / 5.0
                                </span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                              Your Review (Frame Quality, Prescription Accuracy &amp; Delivery)
                            </label>
                            <textarea
                              rows={3}
                              required
                              value={reviewComment}
                              onChange={(e) => setReviewComment(e.target.value)}
                              placeholder="Tell other patients how your prescription lenses and frames feel..."
                              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                            />
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setShowReviewForm(false)}
                              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isSubmittingReview}
                              className="px-5 py-2 rounded-lg bg-[#0B192C] hover:bg-[#162B49] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                            >
                              {isSubmittingReview ? 'Publishing Review...' : 'Submit Verified Review'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {reviews
                      .filter((rev) => rev.isApproved !== false)
                      .map((rev) => (
                        <div
                          key={rev.id}
                          className="p-6 rounded-2xl bg-[#FAF9F6] border border-slate-200/80 flex flex-col justify-between space-y-4"
                        >
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-0.5 text-amber-400">
                                {Array.from({ length: Math.max(1, Math.min(5, Number(rev.rating) || 5)) }).map(
                                  (_, i) => (
                                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                  )
                                )}
                              </div>
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                Verified Patient
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                              “{rev.comment}”
                            </p>
                          </div>
                          <div className="pt-3 border-t border-slate-200/60">
                            <p className="text-sm font-semibold text-[#0B192C]">{rev.customerName}</p>
                            <p className="text-xs text-slate-500">{rev.customerRole}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* HOMEPAGE BOTTOM: 'ABOUT ME' — MEET THE DOCTOR & OPTICAL SPECIALIST */}
                <div id="about-me-section" className="pt-12 border-t border-slate-200">
                  <div className="bg-gradient-to-r from-[#0B192C] via-[#132847] to-[#0B192C] text-white rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-sm space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-[#C5A059] bg-slate-800 shrink-0">
                          <OpticalImage
                            src={siteConfig.aboutMePhoto || siteConfig.heroImage || HERO_FALLBACK}
                            alt={siteConfig.aboutMeName || 'Dr. Austine Ezeh, OD'}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <span className="text-[11px] font-semibold uppercase tracking-widest text-[#C5A059] block">
                            Meet the Doctor &amp; Optical Specialist
                          </span>
                          <h2 className="text-xl sm:text-2xl font-semibold text-white mt-0.5">
                            {siteConfig.aboutMeName || 'Dr. Austine Ezeh, OD'}
                          </h2>
                          <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                            {siteConfig.aboutMeTitle ||
                              'Chief Consultant Optometrist & Founder, VISION CARE Optical Atelier'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsAboutMeOpen((prev) => !prev)}
                          className="px-5 py-3 bg-[#C5A059] hover:bg-[#b58e47] text-[#0B192C] text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                        >
                          <Stethoscope className="w-4 h-4" />
                          <span>{isAboutMeOpen ? 'Hide About Me' : 'About Me'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveView('appointments');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                        >
                          Book Eye Consultation
                        </button>
                      </div>
                    </div>

                    {isAboutMeOpen && (
                      <div className="pt-6 border-t border-white/15 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        <div className="lg:col-span-4 space-y-3">
                          <div className="aspect-[4/5] max-h-80 w-full rounded-2xl overflow-hidden border-2 border-[#C5A059]/60 bg-[#07111E] shadow-lg">
                            <OpticalImage
                              src={siteConfig.aboutMePhoto || siteConfig.heroImage || HERO_FALLBACK}
                              alt={siteConfig.aboutMeName || 'Dr. Austine Ezeh, OD'}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between text-slate-300">
                              <span>License Reg:</span>
                              <strong className="font-tabular text-[#C5A059]">
                                {siteConfig.aboutMeLicense || 'ODORBN/NG/4829'}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between text-slate-300">
                              <span>Experience:</span>
                              <strong className="text-white">
                                {siteConfig.aboutMeExperienceYears || '12+ Years Clinical Practice'}
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div className="lg:col-span-8 space-y-4">
                          <div>
                            <span className="text-xs font-semibold uppercase tracking-widest text-[#C5A059]">
                              {siteConfig.aboutMeCredentials ||
                                'Doctor of Optometry (OD) · Ocular Therapeutics & Precision Multifocal Specialist'}
                            </span>
                            <h3 className="text-xl sm:text-2xl font-semibold text-white mt-1">
                              {siteConfig.aboutMeHeadline ||
                                'Dedicated to Clinical Precision, Ocular Health & Bespoke Eyewear Craftsmanship'}
                            </h3>
                          </div>

                          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                            {siteConfig.aboutMeBio ||
                              'Welcome to VISION CARE. As an attending Doctor of Optometry and optical dispensing specialist, my mission is to unite comprehensive clinical eye care with world-class prescription eyewear. Every prescription submitted on our platform—whether Single Vision, Fused or Invisible Bifocal, or bespoke Varilux Progressive—undergoes rigorous optometric verification for pupillary centration, astigmatic axis accuracy, and all-day visual comfort. Beyond precision lens surfacing, I personally oversee patient consultations for acute and chronic eye complaints, ensuring every client receives accurate diagnosis, therapeutic care, and crystal-clear vision.'}
                          </p>

                          <div className="space-y-2 pt-1">
                            <span className="text-xs font-semibold uppercase tracking-wider text-[#C5A059] block">
                              Clinical &amp; Optical Specializations
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {String(
                                siteConfig.aboutMeSpecialties ||
                                  'Comprehensive Refraction & Binocular Vision, Bespoke Varilux Progressive & Special Order Lenses, Anterior Segment & Ocular Infection Therapeutics, Digital Eye Strain & Blue-Light Protection'
                              )
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean)
                                .map((spec, idx) => (
                                  <div
                                    key={idx}
                                    className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200 flex items-center gap-2"
                                  >
                                    <Check className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
                                    <span>{spec}</span>
                                  </div>
                                ))}
                            </div>
                          </div>

                          <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveView('appointments');
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="px-4 py-2.5 bg-[#C5A059] hover:bg-[#b58e47] text-[#0B192C] text-xs font-bold rounded-xl cursor-pointer"
                              >
                                Book Appointment with {siteConfig.aboutMeName || 'Dr. Austine Ezeh'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setWizardInitialProduct(null);
                                  setWizardInitialMode('prescription_glasses');
                                  setActiveView('wizard');
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl cursor-pointer"
                              >
                                Submit Optical Prescription
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveView('admin');
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="text-[11px] text-slate-300 hover:text-[#C5A059] underline cursor-pointer"
                            >
                              Doctor / Admin: Update Picture &amp; Bio in Storefront CMS →
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* VIEW 2: FULL FRAMES MARKETPLACE */}
        {activeView === 'frames' && (
          <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-9 space-y-4 sm:space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 sm:gap-4 border-b border-slate-200 pb-4 sm:pb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#1E40AF]">
                  Complete Optical Marketplace
                </p>
                <h1 className="text-2xl sm:text-4xl font-semibold text-[#0B192C] mt-0.5 sm:mt-1">
                  Shop Eyewear Frames
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Purchase frames alone or click "+ Lenses &amp; Rx" on any frame to customize with prescription or protective lenses.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search frame or brand..."
                    className="w-full sm:w-56 min-h-[38px] pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="min-h-[38px] bg-white border border-slate-300 rounded-lg px-2.5 sm:px-3 py-2 text-xs font-medium touch-manipulation"
                >
                  <option value="featured">Sort: Featured</option>
                  <option value="bestselling">Sort: Best-Selling</option>
                  <option value="newest">Sort: Newest Arrivals</option>
                  <option value="price_asc">Price: Low to High (₦)</option>
                  <option value="price_desc">Price: High to Low (₦)</option>
                </select>
              </div>
            </div>

            {/* Filter Controls Bar — Compact 2-Column Mobile Grid */}
            <div className="bg-white p-3.5 sm:p-5 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1 truncate">Category / Gender</label>
                <select
                  value={filterGender}
                  onChange={(e) => setFilterGender(e.target.value)}
                  className="w-full min-h-[38px] border border-slate-300 rounded-lg px-2 py-1.5 bg-white touch-manipulation"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Men">Men's Frames</option>
                  <option value="Women">Women's Frames</option>
                  <option value="Unisex">Unisex Frames</option>
                  <option value="Children">Children's Frames</option>
                  <option value="Luxury">Luxury Frames</option>
                  <option value="Sports">Sports Frames</option>
                  <option value="AI Glasses">AI Smart Glasses</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1 truncate">Frame Shape</label>
                <select
                  value={filterShape}
                  onChange={(e) => setFilterShape(e.target.value)}
                  className="w-full min-h-[38px] border border-slate-300 rounded-lg px-2 py-1.5 bg-white touch-manipulation"
                >
                  <option value="ALL">All Shapes</option>
                  <option value="Round">Round Frames</option>
                  <option value="Square">Square Frames</option>
                  <option value="Rectangle">Rectangle Frames</option>
                  <option value="Cat-Eye">Cat-Eye Frames</option>
                  <option value="Aviator">Aviator Frames</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1 truncate">Rim Architecture</label>
                <select
                  value={filterRim}
                  onChange={(e) => setFilterRim(e.target.value)}
                  className="w-full min-h-[38px] border border-slate-300 rounded-lg px-2 py-1.5 bg-white touch-manipulation"
                >
                  <option value="ALL">All Rim Styles</option>
                  <option value="Full-Rim">Full-Rim Frames</option>
                  <option value="Half-Rim">Half-Rim Frames</option>
                  <option value="Rimless">Rimless Frames</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1 truncate">Material</label>
                <select
                  value={filterMaterial}
                  onChange={(e) => setFilterMaterial(e.target.value)}
                  className="w-full min-h-[38px] border border-slate-300 rounded-lg px-2 py-1.5 bg-white touch-manipulation"
                >
                  <option value="ALL">All Materials</option>
                  <option value="Italian Acetate">Italian Acetate</option>
                  <option value="Japanese Titanium">Japanese Titanium</option>
                  <option value="Stainless Steel">Stainless Steel</option>
                  <option value="TR90 Composite">TR90 Composite</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1 font-tabular truncate">
                  Max: {formatNaira(filterMaxPrice)}
                </label>
                <input
                  type="range"
                  min={40000}
                  max={650000}
                  step={5000}
                  value={filterMaxPrice}
                  onChange={(e) => setFilterMaxPrice(Number(e.target.value))}
                  className="w-full accent-[#1E40AF] mt-2 touch-manipulation"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setFilterGender('ALL');
                    setFilterShape('ALL');
                    setFilterRim('ALL');
                    setFilterMaterial('ALL');
                    setFilterMaxPrice(650000);
                    setSearchQuery('');
                  }}
                  className="w-full min-h-[38px] py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 active:scale-[0.99] font-semibold cursor-pointer touch-manipulation"
                >
                  Reset Filters
                </button>
              </div>
            </div>

            {/* Quick Cost Estimator Bar for Frame Product Page */}
            {(() => {
              const quickLensChoices = [
                { code: 'frames_only', label: 'Frame Only', priceNgn: 0, mode: 'frames_only' as const },
                ...(lensTypes.length > 0
                  ? lensTypes
                      .filter((l) => l.isActive)
                      .map((lt) => ({
                        code: lt.code,
                        label: lt.name
                          .replace('Progressive Lens — ', '')
                          .replace(' (Visible Segment)', '')
                          .replace(' (0.00 Plano)', ''),
                        priceNgn: lt.priceNgn,
                        mode:
                          lt.category === 'non_prescription'
                            ? ('protective_glasses' as const)
                            : ('prescription_glasses' as const),
                      }))
                  : [
                      { code: 'single_vision', label: 'Standard Single Vision', priceNgn: 35000, mode: 'prescription_glasses' as const },
                      { code: 'bifocal_traditional', label: 'Bifocal Lens', priceNgn: 55000, mode: 'prescription_glasses' as const },
                      { code: 'invisible_bifocal', label: 'Invisible Bifocal', priceNgn: 72000, mode: 'prescription_glasses' as const },
                      { code: 'progressive_varilux_comfort', label: 'Varilux Comfort Max', priceNgn: 115000, mode: 'prescription_glasses' as const },
                      { code: 'progressive_varilux_xr', label: 'Varilux XR Bespoke', priceNgn: 185000, mode: 'prescription_glasses' as const },
                      { code: 'special_order_bifocal', label: 'Special Order Bifocal Lens', priceNgn: 78000, mode: 'prescription_glasses' as const },
                      { code: 'special_order_invisible_bifocal', label: 'Special Order Invisible Bifocal Lens', priceNgn: 96000, mode: 'prescription_glasses' as const },
                      { code: 'special_order_varilux', label: 'Special Order Varilux Lens', priceNgn: 148000, mode: 'prescription_glasses' as const },
                      { code: 'non_prescription_plano', label: '0.00 Plano Protective', priceNgn: 18000, mode: 'protective_glasses' as const },
                    ]),
              ];

              const estimatorEnabled = siteConfig.quickEstimatorEnabled !== false;

              const selectedQuickLens = !estimatorEnabled
                ? quickLensChoices[0]
                : quickLensChoices.find((l) => l.code === quickEstimatorLensCode) || quickLensChoices[1] || quickLensChoices[0];

              const quickCoatingChoices = getEstimatorCoatingsForLens(
                selectedQuickLens?.code || quickEstimatorLensCode,
                lensCoatings,
                siteConfig
              );

              const selectedQuickCoating =
                selectedQuickLens?.code === 'frames_only'
                  ? { code: 'none', label: 'No Treatment', priceNgn: 0 }
                  : quickCoatingChoices.find((c) => c.code === quickEstimatorCoatingCode) || quickCoatingChoices[0];

              const addedOpticalCost =
                (selectedQuickLens?.priceNgn || 0) + (selectedQuickCoating?.priceNgn || 0);

              return (
                <>
                  {estimatorEnabled && (
                    <div className="bg-gradient-to-br from-[#0B192C] via-[#132847] to-[#0B192C] text-white rounded-2xl p-3.5 sm:p-6 border border-slate-800 shadow-sm space-y-3 sm:space-y-4">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3 border-b border-white/10 pb-3 sm:pb-4">
                        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3">
                          <div className="p-2 sm:p-2.5 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/30 text-[#C5A059] shrink-0">
                            <Calculator className="w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-widest text-[#C5A059]">
                                Quick Cost Estimator
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-sky-300 font-medium">
                                Instant Complete Pair Preview
                              </span>
                            </div>
                            <h2 className="text-sm sm:text-lg font-semibold text-white mt-0.5">
                              {siteConfig.quickEstimatorHeadline ||
                                'Toggle Lens Types (Standard vs. Varilux) to See Complete Price Before Entering the Wizard'}
                            </h2>
                          </div>
                        </div>

                        <div className="bg-white/10 border border-white/15 rounded-xl px-3.5 py-2 sm:px-4 sm:py-2.5 text-xs shrink-0 self-start lg:self-auto">
                          <span className="text-[10px] uppercase tracking-wider text-slate-300 block">
                            Selected Lens Package Add-on
                          </span>
                          <span className="text-xs sm:text-sm font-tabular font-semibold text-[#C5A059]">
                            {addedOpticalCost === 0
                              ? 'Frame Chassis Only (+₦0)'
                              : `+${formatNaira(addedOpticalCost)} (${selectedQuickLens?.label}${
                                  selectedQuickCoating && selectedQuickCoating.priceNgn > 0
                                    ? ` + ${selectedQuickCoating.label}`
                                    : ''
                                })`}
                          </span>
                        </div>
                      </div>

                      {/* Lens Design Toggle Pills */}
                      <div className="space-y-2">
                        <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                          1. Select Lens Type to Estimate Complete Price Across All Frames:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 sm:gap-2">
                          {quickLensChoices.map((lensOpt) => {
                            const isSelected = selectedQuickLens?.code === lensOpt.code;
                            return (
                              <button
                                key={lensOpt.code}
                                type="button"
                                onClick={() => setQuickEstimatorLensCode(lensOpt.code)}
                                className={`p-2 sm:p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between touch-manipulation ${
                                  isSelected
                                    ? 'bg-[#C5A059] text-[#0B192C] border-[#C5A059] shadow-sm font-semibold'
                                    : 'bg-white/5 hover:bg-white/10 text-white border-white/10'
                                }`}
                              >
                                <span className="text-[11px] sm:text-xs leading-snug block">{lensOpt.label}</span>
                                <span
                                  className={`text-[10px] sm:text-[11px] font-tabular mt-1 sm:mt-1.5 block ${
                                    isSelected ? 'text-[#0B192C] font-bold' : 'text-[#C5A059]'
                                  }`}
                                >
                                  {lensOpt.priceNgn === 0 ? '+₦0' : `+${formatNaira(lensOpt.priceNgn)}`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Optional Coating Toggle */}
                      {selectedQuickLens?.code !== 'frames_only' && (
                        <div className="space-y-2 pt-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                              2. Optional Coating / Index (Corresponding to {selectedQuickLens?.label}):
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/30 font-medium">
                              Dynamic {selectedQuickLens?.label} Coating Rates
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            {quickCoatingChoices.map((coatOpt) => {
                              const isSelected = selectedQuickCoating?.code === coatOpt.code;
                              return (
                                <button
                                  key={coatOpt.code}
                                  type="button"
                                  onClick={() => setQuickEstimatorCoatingCode(coatOpt.code)}
                                  className={`min-h-[34px] px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer touch-manipulation ${
                                    isSelected
                                      ? 'bg-[#1E40AF] text-white border-sky-400'
                                      : 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/10'
                                  }`}
                                >
                                  <span>{coatOpt.label}</span>
                                  <span className="font-tabular ml-1 text-[#C5A059]">
                                    ({coatOpt.priceNgn === 0 ? 'Included' : `+${formatNaira(coatOpt.priceNgn)}`})
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Side-by-Side Lens Comparison Table on Frame Product Page (Collapsed by Default) */}
                  <LensComparisonTable
                    lensTypes={lensTypes}
                    lensCoatings={lensCoatings}
                    siteConfig={siteConfig}
                    selectedLensCode={quickEstimatorLensCode}
                    selectedCoatingCode={quickEstimatorCoatingCode}
                    onSelectLens={(code) => setQuickEstimatorLensCode(code)}
                    onSelectCoating={(code) => setQuickEstimatorCoatingCode(code)}
                    compact={true}
                    defaultExpanded={false}
                  />

                  {/* Product Grid — 5 in a Row on Desktop with Compact Mobile Vertical Spacing */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-2.5 gap-y-2.5 sm:gap-x-3.5 sm:gap-y-3.5">
                    {loadingCatalog
                      ? Array.from({ length: 10 }).map((_, idx) => (
                          <div
                            key={`frame-skeleton-${idx}`}
                            className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between animate-pulse"
                          >
                            <div>
                              <div className="aspect-[16/10] bg-slate-200/80 relative">
                                <div className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/80" />
                              </div>
                              <div className="p-2.5 sm:p-3.5 space-y-1.5 sm:space-y-2">
                                <div className="h-2.5 w-2/5 bg-slate-200 rounded" />
                                <div className="flex items-center justify-between gap-2">
                                  <div className="h-3.5 w-3/5 bg-slate-200 rounded" />
                                  <div className="h-3.5 w-14 bg-slate-200 rounded" />
                                </div>
                                <div className="h-2.5 w-2/3 bg-slate-200 rounded" />
                                <div className="p-1.5 sm:p-2 rounded-lg bg-slate-100 border border-slate-200/80 space-y-1">
                                  <div className="h-2.5 w-full bg-slate-200 rounded" />
                                  <div className="h-2 w-2/3 bg-slate-200 rounded" />
                                </div>
                              </div>
                            </div>
                            <div className="px-2.5 pb-2.5 pt-0.5 sm:px-3.5 sm:pb-3.5 sm:pt-1 flex items-center gap-1.5">
                              <div className="flex-1 h-8 bg-slate-200 rounded-lg" />
                              <div className="w-14 h-8 bg-slate-200 rounded-lg" />
                            </div>
                          </div>
                        ))
                      : filteredFrames.map((prod) => {
                      let imgs: string[] = [];
                      let cols: string[] = [];
                      try {
                        imgs = JSON.parse(prod.imagesJson);
                        cols = JSON.parse(prod.colorsJson);
                      } catch {
                        imgs = [];
                        cols = ['Default'];
                      }
                      const effectivePrice = prod.discountPriceNgn || prod.priceNgn;
                      const estimatedCompletePrice = effectivePrice + addedOpticalCost;
                      const wishlisted = wishlistIds.includes(prod.id);

                      return (
                        <div
                          key={prod.id}
                          className="group bg-white rounded-xl border border-slate-200 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between"
                        >
                          <div>
                            <div
                              onClick={() => setDetailProduct(prod)}
                              className="aspect-[16/10] bg-[#F4F3EF] overflow-hidden cursor-pointer relative"
                            >
                              <OpticalImage
                                src={imgs[0] || ''}
                                alt={prod.name}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleWishlist(prod.id);
                                }}
                                className="absolute top-1.5 right-1.5 w-8 h-8 flex items-center justify-center rounded-full bg-white/90 text-slate-700 hover:text-rose-600 shadow-xs touch-manipulation"
                                title="Save to Wishlist"
                              >
                                <Heart className={`w-3.5 h-3.5 ${wishlisted ? 'fill-rose-600 text-rose-600' : ''}`} />
                              </button>
                            </div>

                            <div className="p-2.5 sm:p-3.5">
                              <div className="flex items-center gap-1 text-[10px] text-slate-500 uppercase tracking-wider truncate">
                                <span className="truncate">{prod.brand}</span>
                                <span>·</span>
                                <span>{prod.gender}</span>
                                <span className="hidden sm:inline">·</span>
                                <span className="hidden sm:inline">{prod.rimStyle}</span>
                              </div>

                              <div className="mt-0.5 sm:mt-1 flex items-baseline justify-between gap-1.5">
                                <h3
                                  onClick={() => setDetailProduct(prod)}
                                  className="text-xs sm:text-sm font-semibold text-[#0B192C] cursor-pointer hover:text-[#1E40AF] line-clamp-1"
                                >
                                  {prod.name}
                                </h3>
                                <span className="text-xs font-tabular font-bold text-[#0B192C] shrink-0">
                                  {formatNaira(effectivePrice)}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-500 mt-0.5 font-tabular truncate">
                                {prod.shape} · {prod.material}
                              </p>

                              {/* Quick Cost Estimator Live Breakdown Badge on Card */}
                              <div
                                onClick={() => setDetailProduct(prod)}
                                className="mt-1.5 sm:mt-2 p-1.5 sm:p-2 rounded-lg bg-[#FAF9F6] border border-slate-200/90 hover:border-[#1E40AF]/40 cursor-pointer transition-colors space-y-0.5"
                              >
                                <div className="flex items-center justify-between text-[10px] gap-1">
                                  <span className="font-semibold text-[#1E40AF] flex items-center gap-1 truncate">
                                    <Calculator className="w-2.5 h-2.5 shrink-0" />
                                    <span className="truncate">+{selectedQuickLens?.label}</span>
                                  </span>
                                  <span className="font-tabular font-bold text-[#0B192C] text-[10px] sm:text-[11px] shrink-0">
                                    {formatNaira(estimatedCompletePrice)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="px-2.5 pb-2.5 pt-0.5 sm:px-3.5 sm:pb-3.5 sm:pt-1 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setWizardInitialProduct(prod);
                                setWizardInitialMode(
                                  selectedQuickLens?.mode === 'protective_glasses'
                                    ? 'protective_glasses'
                                    : 'prescription_glasses'
                                );
                                setActiveView('wizard');
                              }}
                              className="flex-1 min-h-[38px] sm:min-h-[34px] py-1.5 px-2 bg-[#0B192C] hover:bg-[#162B49] active:scale-[0.99] text-white text-[11px] font-semibold rounded-lg truncate transition-all touch-manipulation"
                            >
                              + Lenses &amp; Rx
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleAddToCart({
                                  cartItemId: `vc-frame-${Date.now()}`,
                                  productId: prod.id,
                                  productName: prod.name,
                                  productBrand: prod.brand,
                                  productImage: imgs[0] || '',
                                  orderType: 'frames_only',
                                  selectedColor: cols[0] || 'Default',
                                  quantity: 1,
                                  framePriceNgn: effectivePrice,
                                  lensTypeName: 'Frames Only (Demo Lenses)',
                                  lensOptionSelected: 'Chassis Only',
                                  lensPriceNgn: 0,
                                  coatingSummary: 'None',
                                  coatingPriceNgn: 0,
                                  prescriptionSnapshot: null,
                                  unitTotalNgn: effectivePrice,
                                });
                              }}
                              className="min-h-[38px] sm:min-h-[34px] py-1.5 px-2.5 border border-slate-300 hover:bg-slate-50 active:scale-[0.99] text-[#0B192C] text-[11px] font-semibold rounded-lg shrink-0 transition-all touch-manipulation"
                            >
                              Frame
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* VIEW 2B: DEDICATED AI SMART GLASSES ATELIER (PRESCRIPTION & NON-RX READY) */}
        {activeView === 'ai_glasses' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
            <div className="bg-gradient-to-br from-[#0B192C] via-[#132847] to-[#0B192C] text-white rounded-2xl p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 border border-slate-800">
              <div className="space-y-2 max-w-2xl">
                <div className="text-xs font-semibold uppercase tracking-widest text-[#C5A059] flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>Smart Eyewear &amp; Wearable Optical Intelligence</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-semibold">
                  AI Smart Glasses — Custom Prescription &amp; Non-Rx Ready
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Order genuine AI Smart Glasses featuring ultra-wide POV cameras, open-ear directional spatial audio, real-time AI voice translation, and micro-HUD displays. Order with standard smart lenses, 0.00 Plano Blue-Cut / Photochromic protection, or custom-surfaced Single Vision, Bifocal, and Varilux Progressive prescription lenses.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const firstAi = products.find(
                      (p) => p.isActive && (p.category === 'AI Glasses' || p.sku.startsWith('VC-AI-'))
                    );
                    if (firstAi) setWizardInitialProduct(firstAi);
                    setWizardInitialMode('prescription_glasses');
                    setActiveView('wizard');
                  }}
                  className="px-5 py-3 bg-[#C5A059] hover:bg-[#b58e47] text-[#0B192C] text-xs font-bold rounded-xl cursor-pointer"
                >
                  Order AI Glasses with Prescription
                </button>
              </div>
            </div>

            {/* AI Smart Glasses Capability Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {[
                { id: 'ALL', label: 'All AI Smart Glasses' },
                { id: 'CAMERA', label: 'POV Camera & Voice AI' },
                { id: 'AUDIO', label: 'Executive Audio & Translation' },
                { id: 'HUD', label: 'Proactive Micro-HUD Display' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAiGlassesSpecFilter(tab.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    aiGlassesSpecFilter === tab.id
                      ? 'bg-[#0B192C] text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {loadingCatalog
                ? Array.from({ length: 10 }).map((_, idx) => (
                    <div
                      key={`ai-glasses-skeleton-${idx}`}
                      className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between shadow-xs animate-pulse"
                    >
                      <div>
                        <div className="aspect-[16/10] bg-slate-200/80 relative">
                          <div className="absolute top-2 left-2 w-24 h-4 rounded bg-slate-300/80" />
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/80" />
                        </div>
                        <div className="p-3.5 space-y-2">
                          <div className="h-2.5 w-1/2 bg-slate-200 rounded" />
                          <div className="flex items-center justify-between gap-2">
                            <div className="h-3.5 w-3/5 bg-slate-200 rounded" />
                            <div className="h-3.5 w-14 bg-slate-200 rounded" />
                          </div>
                          <div className="h-2.5 w-full bg-slate-200 rounded" />
                        </div>
                      </div>
                      <div className="px-3.5 pb-3.5 pt-1 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-7 bg-slate-200 rounded-lg" />
                          <div className="w-14 h-7 bg-slate-200 rounded-lg" />
                        </div>
                      </div>
                    </div>
                  ))
                : products
                    .filter((p) => p.isActive && (p.category === 'AI Glasses' || p.sku.startsWith('VC-AI-')))
                .filter((p) => {
                  if (aiGlassesSpecFilter === 'ALL') return true;
                  const text = `${p.name} ${p.description}`.toLowerCase();
                  if (aiGlassesSpecFilter === 'CAMERA') return text.includes('camera') || text.includes('meta');
                  if (aiGlassesSpecFilter === 'AUDIO') return text.includes('translation') || text.includes('solos') || text.includes('audio');
                  if (aiGlassesSpecFilter === 'HUD') return text.includes('display') || text.includes('halliday') || text.includes('digiwindow');
                  return true;
                })
                .map((prod) => {
                  let imgs: string[] = [];
                  let cols: string[] = [];
                  try {
                    imgs = JSON.parse(prod.imagesJson);
                    cols = JSON.parse(prod.colorsJson);
                  } catch {
                    imgs = [];
                    cols = ['Default'];
                  }
                  const effectivePrice = prod.discountPriceNgn || prod.priceNgn;
                  const wishlisted = wishlistIds.includes(prod.id);

                  return (
                    <div
                      key={prod.id}
                      className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-md transition-all"
                    >
                      <div>
                        <div
                          onClick={() => setDetailProduct(prod)}
                          className="aspect-[16/10] bg-[#F4F3EF] overflow-hidden relative cursor-pointer"
                        >
                          <OpticalImage src={imgs[0] || ''} alt={prod.name} className="w-full h-full object-cover" />
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#0B192C]/90 text-[#C5A059] text-[9px] font-bold uppercase tracking-wider">
                            AI · Rx Ready
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleWishlist(prod.id);
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 text-slate-700 hover:text-rose-600 cursor-pointer"
                          >
                            <Heart className={`w-3.5 h-3.5 ${wishlisted ? 'fill-rose-600 text-rose-600' : ''}`} />
                          </button>
                        </div>

                        <div className="p-3.5 space-y-1">
                          <div className="text-[10px] text-[#1E40AF] font-semibold uppercase tracking-wider truncate">
                            {prod.brand} · {prod.shape}
                          </div>
                          <div className="flex items-baseline justify-between gap-1.5">
                            <h3
                              onClick={() => setDetailProduct(prod)}
                              className="text-xs sm:text-sm font-semibold text-[#0B192C] cursor-pointer hover:text-[#1E40AF] line-clamp-1"
                            >
                              {prod.name}
                            </h3>
                            <div className="text-right font-tabular shrink-0">
                              <span className="text-xs font-bold text-[#0B192C]">
                                {formatNaira(effectivePrice)}
                              </span>
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2 leading-snug">{prod.description}</p>
                        </div>
                      </div>

                      <div className="px-3.5 pb-3.5 pt-1 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setWizardInitialProduct(prod);
                              setWizardInitialMode('prescription_glasses');
                              setActiveView('wizard');
                            }}
                            className="flex-1 py-1.5 px-2 bg-[#0B192C] hover:bg-[#162B49] text-white text-[11px] font-semibold rounded-lg cursor-pointer truncate"
                          >
                            Fit Lenses + Rx
                          </button>
                          <button
                            type="button"
                            onClick={() => setDetailProduct(prod)}
                            className="py-1.5 px-2 border border-slate-300 hover:bg-slate-50 text-[#0B192C] text-[11px] font-semibold rounded-lg cursor-pointer"
                          >
                            View
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              handleAddToCart({
                                cartItemId: `vc-ai-std-${Date.now()}`,
                                productId: prod.id,
                                productName: prod.name,
                                productBrand: prod.brand,
                                productImage: imgs[0] || '',
                                orderType: 'frames_only',
                                selectedColor: cols[0] || 'Default',
                                quantity: 1,
                                framePriceNgn: effectivePrice,
                                lensTypeName: 'AI Smart Glasses (Standard Smart Lenses)',
                                lensOptionSelected: 'Standard AI Smart Chassis',
                                lensPriceNgn: 0,
                                coatingSummary: 'Factory UV400 & Anti-Glare Smart Lens',
                                coatingPriceNgn: 0,
                                prescriptionSnapshot: null,
                                unitTotalNgn: effectivePrice,
                              });
                            }}
                            className="py-1 px-1.5 bg-slate-100 hover:bg-slate-200 text-[#0B192C] text-[10px] font-semibold rounded-md cursor-pointer truncate"
                          >
                            AI Only
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setWizardInitialProduct(prod);
                              setWizardInitialMode('protective_glasses');
                              setActiveView('wizard');
                            }}
                            className="py-1 px-1.5 bg-[#E0F2FE] hover:bg-sky-200 text-[#0B192C] text-[10px] font-semibold rounded-md cursor-pointer truncate"
                          >
                            + 0.00 Shield
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* VIEW 3: PROTECTIVE & SCREEN GLASSES (WITHOUT PRESCRIPTION) */}
        {activeView === 'protective' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
            <div className="bg-[#0B192C] text-white rounded-2xl p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="text-xs font-semibold uppercase tracking-widest text-[#C5A059] flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span>Non-Prescription (0.00 Plano) Protective Eyewear</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-semibold">
                  Protective & Digital Screen Glasses — No Prescription Needed
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Engineered for executives, software engineers, creatives, and drivers who have 20/20 vision but want superior defense against digital screen glare, HEV blue light, and outdoor UV sunlight.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setWizardInitialProduct(null);
                  setWizardInitialMode('replacement_lenses');
                  setActiveView('wizard');
                }}
                className="px-5 py-3 bg-[#C5A059] text-[#0B192C] text-xs font-semibold rounded-xl shrink-0"
              >
                Order Protective Lenses for Existing Frame
              </button>
            </div>

            {/* Protective Lens Category Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {[
                'ALL',
                'Photochromic Glasses',
                'Photochromic Blue Cut Glasses',
                'Fashion Protective Glasses',
              ].map((typeLabel) => (
                <button
                  key={typeLabel}
                  type="button"
                  onClick={() => setProtectiveTypeFilter(typeLabel)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    protectiveTypeFilter === typeLabel
                      ? 'bg-[#0B192C] text-white'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {typeLabel === 'ALL' ? 'All Protective Eyewear' : typeLabel}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {products
                .filter((p) => p.isActive)
                .filter((p) => {
                  if (protectiveTypeFilter === 'ALL') return true;
                  const resolvedType =
                    p.defaultProtectiveType === 'Photochromic Glasses' ||
                    p.defaultProtectiveType === 'Photochromic Blue Cut Glasses' ||
                    p.defaultProtectiveType === 'Fashion Protective Glasses'
                      ? p.defaultProtectiveType
                      : p.id % 2 === 0
                      ? 'Photochromic Blue Cut Glasses'
                      : 'Photochromic Glasses';
                  return resolvedType === protectiveTypeFilter;
                })
                .map((prod) => {
                  let imgs: string[] = [];
                  let cols: string[] = [];
                  try {
                    imgs = JSON.parse(prod.imagesJson);
                    cols = JSON.parse(prod.colorsJson);
                  } catch {
                    imgs = [];
                    cols = ['Default'];
                  }

                  const resolvedProtectiveType =
                    prod.defaultProtectiveType === 'Photochromic Glasses' ||
                    prod.defaultProtectiveType === 'Photochromic Blue Cut Glasses' ||
                    prod.defaultProtectiveType === 'Fashion Protective Glasses'
                      ? prod.defaultProtectiveType
                      : prod.id % 2 === 0
                      ? 'Photochromic Blue Cut Glasses'
                      : 'Photochromic Glasses';

                  const baseFramePrice = prod.discountPriceNgn || prod.priceNgn;
                  const protectivePackagePrice = baseFramePrice + 24000; // Frame + Non-Rx Protective Shield

                  return (
                    <div
                      key={prod.id}
                      className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col justify-between hover:shadow-md transition-all"
                    >
                      <div>
                        <div
                          onClick={() => setDetailProduct(prod)}
                          className="aspect-[16/10] bg-[#F4F3EF] overflow-hidden relative cursor-pointer"
                        >
                          <OpticalImage src={imgs[0] || ''} alt={prod.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-3.5">
                          <div className="text-[10px] text-[#1E40AF] font-semibold truncate">
                            0.00 Non-Rx · {resolvedProtectiveType}
                          </div>
                          <div className="mt-1 flex items-baseline justify-between gap-1.5">
                            <h3
                              onClick={() => setDetailProduct(prod)}
                              className="text-xs sm:text-sm font-semibold text-[#0B192C] line-clamp-1 cursor-pointer hover:text-[#1E40AF]"
                            >
                              {prod.name}
                            </h3>
                            <span className="text-xs font-tabular font-bold text-[#0B192C] shrink-0">
                              {formatNaira(protectivePackagePrice)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{prod.description}</p>
                        </div>
                      </div>

                      <div className="px-3.5 pb-3.5 pt-1 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            handleAddToCart({
                              cartItemId: `vc-prot-${Date.now()}`,
                              productId: prod.id,
                              productName: prod.name,
                              productBrand: prod.brand,
                              productImage: imgs[0] || '',
                              orderType: 'protective_glasses',
                              selectedColor: cols[0] || 'Default',
                              quantity: 1,
                              framePriceNgn: baseFramePrice,
                              lensTypeName: 'Non-Prescription Protective Lens (0.00 Plano)',
                              lensOptionSelected: resolvedProtectiveType,
                              lensPriceNgn: 18000,
                              coatingSummary: `${resolvedProtectiveType} + UV400 + Scratch Resistant (₦6,000)`,
                              coatingPriceNgn: 6000,
                              prescriptionSnapshot: null,
                              unitTotalNgn: protectivePackagePrice,
                            });
                          }}
                          className="w-full py-1.5 px-2 bg-[#0B192C] hover:bg-[#162B49] text-white text-[11px] font-semibold rounded-lg cursor-pointer"
                        >
                          Add Non-Rx Pair
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* VIEW 4: SMART ORDERING WIZARD & PRESCRIPTION UPLOAD */}
        {activeView === 'wizard' && (
          <PrescriptionWizard
            products={products}
            lensTypes={lensTypes}
            lensCoatings={lensCoatings}
            savedPrescriptions={savedPrescriptions}
            siteConfig={siteConfig}
            initialProduct={wizardInitialProduct}
            initialOrderType={wizardInitialMode}
            onAddToCart={handleAddToCart}
            onSavePrescriptionToAccount={handleSavePrescriptionToAccount}
          />
        )}

        {/* VIEW 4B: CLINICAL EYE COMPLAINT APPOINTMENTS & DRUG PRESCRIPTION (Rx PDF) */}
        {activeView === 'appointments' && (
          <ClinicalAppointmentView
            user={user}
            appointments={appointments}
            notifications={notifications}
            orders={orders}
            prescriptions={savedPrescriptions}
            enquiries={enquiries}
            products={products}
            lensTypes={lensTypes}
            lensCoatings={lensCoatings}
            siteConfig={siteConfig}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onOpenFullAccount={() => setActiveView('account')}
            onAddToCart={handleAddToCart}
            onSavePrescriptionToAccount={handleSavePrescriptionToAccount}
            onEmailSessionSignIn={handleEmailSessionSignIn}
            onUpdateProfile={async (data) => {
              if (!idToken) return;
              await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify(data),
              });
              await fetchAccountBundle(idToken);
            }}
            onSendOrderEnquiry={async (enq) => {
              await fetch('/api/enquiries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userUid: user?.uid || '',
                  customerName: user?.fullName || 'Client',
                  customerEmail: user?.email || '',
                  ...enq,
                }),
              });
              if (idToken) await fetchAccountBundle(idToken);
            }}
            onAppointmentCreated={(created) => {
              setAppointments((prev) => [created, ...prev]);
              showToast(`Eye Appointment ${created.appointmentNumber} submitted. Complete payment for Admin verification.`);
            }}
            onAppointmentUpdated={(updated) => {
              setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
              showToast('Payment reference submitted for Admin verification.');
            }}
          />
        )}

        {/* VIEW 5: CUSTOMER ACCOUNT & DASHBOARD */}
        {activeView === 'account' && (
          <CustomerAccountView
            user={user}
            orders={orders}
            prescriptions={savedPrescriptions}
            addresses={savedAddresses}
            wishlistProducts={wishlistProducts}
            products={products}
            lensTypes={lensTypes}
            lensCoatings={lensCoatings}
            notifications={notifications}
            enquiries={enquiries}
            appointments={appointments}
            siteConfig={siteConfig}
            initialTrackedOrderId={accountTrackedOrderId}
            onAddToCart={handleAddToCart}
            onSavePrescriptionToAccount={handleSavePrescriptionToAccount}
            onAppointmentCreated={(created) => {
              setAppointments((prev) => [created, ...prev]);
              showToast(`Eye Appointment ${created.appointmentNumber} submitted to Doctor.`);
            }}
            onAppointmentUpdated={(updated) => {
              setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
              showToast('Appointment payment updated.');
            }}
            onEmailSessionSignIn={handleEmailSessionSignIn}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onUpdateProfile={async (data) => {
              if (!idToken) return;
              await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify(data),
              });
              await fetchAccountBundle(idToken);
            }}
            onAddAddress={async (addr) => {
              if (!idToken) return;
              await fetch('/api/addresses', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify(addr),
              });
              await fetchAccountBundle(idToken);
            }}
            onDeleteAddress={async (id) => {
              if (!idToken) return;
              await fetch(`/api/addresses/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${idToken}` },
              });
              await fetchAccountBundle(idToken);
            }}
            onSendOrderEnquiry={async (enq) => {
              await fetch('/api/enquiries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userUid: user?.uid || '',
                  customerName: user?.fullName || 'Client',
                  customerEmail: user?.email || '',
                  ...enq,
                }),
              });
              if (idToken) await fetchAccountBundle(idToken);
            }}
            onSelectProduct={(prod) => {
              setWizardInitialProduct(prod);
              setWizardInitialMode('prescription_glasses');
              setActiveView('wizard');
            }}
            onRemoveWishlist={handleToggleWishlist}
          />
        )}

        {/* VIEW 6: ADMIN DASHBOARD */}
        {activeView === 'admin' && (
          <AdminDashboardView
            user={user}
            idToken={idToken}
            onSignIn={handleSignIn}
            onRefreshPublicCatalog={fetchCatalog}
          />
        )}
      </main>

      {/* Product Details Modal */}
      <ProductDetailModal
        product={detailProduct}
        lensTypes={lensTypes}
        lensCoatings={lensCoatings}
        siteConfig={siteConfig}
        isWishlisted={detailProduct ? wishlistIds.includes(detailProduct.id) : false}
        onClose={() => setDetailProduct(null)}
        onToggleWishlist={handleToggleWishlist}
        onAddFrameOnlyToCart={(item) => handleAddToCart(item, false)}
        onCustomizeInWizard={(prod, mode) => {
          setWizardInitialProduct(prod);
          setWizardInitialMode(mode);
          setActiveView('wizard');
        }}
      />

      {/* Slide-Over Cart & Checkout Drawer */}
      <CartCheckoutDrawer
        isOpen={isCartOpen}
        cart={cart}
        coupons={coupons}
        user={user}
        savedAddresses={savedAddresses}
        siteConfig={siteConfig}
        onClose={() => setIsCartOpen(false)}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveCartItem}
        onEditItemInWizard={handleEditCartItemInWizard}
        onSubmitOrder={handleSubmitOrder}
        onRequireSignIn={handleSignIn}
        onNavigateToAccountTracking={(orderId) => {
          if (orderId) {
            setAccountTrackedOrderId(orderId);
          }
          setActiveView('account');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Sign In / Register / Password Reset Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onGoogleSignIn={handleGooglePopupSignIn}
        onEmailSessionSignIn={handleEmailSessionSignIn}
      />

      {/* Footer with FAQ, Newsletter, WhatsApp Support & Policies */}
      <footer className="bg-[#0B192C] text-slate-300 border-t border-white/10 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-3">
              <div className="inline-block bg-white rounded-xl p-2.5 border border-[#C5A059]/50 shadow-sm">
                <img
                  src="/assets/aistudio/Vision_Care_Eyewear_Logo_31f9746e.png"
                  alt="Vision Care Official Logo"
                  className="h-14 w-auto object-contain"
                />
              </div>
              <span className="block text-xl font-bold text-white font-display tracking-tight">VISION CARE</span>
              <p className="text-xs text-slate-400 leading-relaxed">
                Premium online optical store & clinical dispensing laboratory. Prescription eyewear, genuine Varilux progressives, Blue Cut screen glasses, and designer frames delivered nationwide across Nigeria.
              </p>
              <div className="text-xs text-slate-300 font-tabular pt-1">
                <div>{siteConfig.showroomAddress || 'Victoria Island, Lagos & Maitama, Abuja'}</div>
                <div>Email: {siteConfig.supportEmail || 'concierge@visioncare.ng'}</div>
                <div>WhatsApp: {siteConfig.whatsappNumber || '+234 809 800 8474'}</div>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <span className="font-semibold text-white uppercase tracking-wider block mb-2">
                Optical Categories
              </span>
              <button
                type="button"
                onClick={() => {
                  setWizardInitialProduct(null);
                  setWizardInitialMode('prescription_glasses');
                  setActiveView('wizard');
                }}
                className="block hover:text-white"
              >
                Order Prescription Glasses
              </button>
              <button
                type="button"
                onClick={() => {
                  setWizardInitialProduct(null);
                  setWizardInitialMode('prescription_glasses');
                  setActiveView('wizard');
                }}
                className="block hover:text-white"
              >
                Varilux Progressive Lenses
              </button>
              <button type="button" onClick={() => setActiveView('protective')} className="block hover:text-white">
                Blue Cut & Photochromic Glasses
              </button>
              <button type="button" onClick={() => setActiveView('frames')} className="block hover:text-white">
                Italian Acetate & Titanium Frames
              </button>
              <button type="button" onClick={() => setActiveView('ai_glasses')} className="block hover:text-white">
                AI Smart Glasses (Rx &amp; Non-Rx)
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveView('home');
                  setIsAboutMeOpen(true);
                  setTimeout(() => {
                    document.getElementById('about-me-section')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                className="block text-[#C5A059] font-semibold hover:underline cursor-pointer"
              >
                About Me — Meet the Doctor
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <span className="font-semibold text-white uppercase tracking-wider block mb-2">
                Frequently Asked Questions
              </span>
              <div className="space-y-2 text-slate-400">
                <p>
                  <strong className="text-slate-200">How does AI Prescription OCR work?</strong> Upload a photo or PDF of your prescription; our engine extracts OD/OS values and our chief optometrist verifies before lens cutting.
                </p>
                <p>
                  <strong className="text-slate-200">Can I order without a prescription?</strong> Yes—visit Protective Lenses for 0.00 Plano Blue Cut or Photochromic glasses.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-semibold text-white uppercase tracking-wider block">
                Vision Care Optical Journal
              </span>
              <p className="text-xs text-slate-400">
                Subscribe for seasonal frame lookbooks, eye-care tips, and private trunk show invitations.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newsletterEmail) {
                    setNewsletterSubscribed(true);
                    setNewsletterEmail('');
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="Enter your email..."
                  className="flex-1 bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#C5A059] text-[#0B192C] text-xs font-semibold rounded-lg"
                >
                  Join
                </button>
              </form>
              {newsletterSubscribed && (
                <p className="text-xs text-[#C5A059]">Thank you for subscribing to Vision Care.</p>
              )}

              <div className="pt-2">
                <a
                  href={`https://wa.me/${(siteConfig.whatsappNumber || '2348098008474').replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#C5A059] hover:underline"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Chat with an Optometrist on WhatsApp</span>
                </a>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <span>© {new Date().getFullYear()} VISION CARE Optical Atelier Ltd. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <span>Privacy Policy</span>
              <span>·</span>
              <span>Prescription Accuracy Guarantee</span>
              <span>·</span>
              <span>Paystack & Flutterwave Secured</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Bottom-Right Live Support Widget (Connected to Admin Enquiry System) */}
      <LiveSupportWidget
        user={user}
        orders={orders}
        enquiries={enquiries}
        products={products}
        lensTypes={lensTypes}
        onEnquirySubmitted={async (createdEnquiry) => {
          setEnquiries((prev) => [createdEnquiry, ...prev]);
          if (idToken) {
            await fetchAccountBundle(idToken);
          }
        }}
      />
    </div>
  );
}
