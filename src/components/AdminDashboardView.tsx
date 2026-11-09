import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Package,
  Glasses,
  Layers,
  FileCheck2,
  Users,
  Settings,
  Download,
  Plus,
  Trash2,
  Check,
  Search,
  Printer,
  ShieldAlert,
  Bell,
  Mail,
  MessageSquare,
  Send,
  CreditCard,
  Building2,
  Upload,
  Video,
  Image as ImageIcon,
  Stethoscope,
} from 'lucide-react';
import {
  Product,
  LensType,
  LensCoating,
  OrderRecord,
  PrescriptionData,
  UserProfile,
  EnquiryRecord,
  ClinicalAppointmentRecord,
} from '../types.ts';
import { formatNaira } from './OpticalImage.tsx';
import {
  resolveCoatingPriceForLens,
  formatShortCoatingLabel,
} from '../lib/estimatorPricing.ts';
import {
  parseOrderNotificationMeta,
  serializeOrderNotificationMeta,
  DEFAULT_STAGE_NOTIFICATION_TEMPLATES,
  getNotificationStageTemplates,
  interpolateNotificationTemplate,
} from '../lib/orderNotifications.ts';
import { exportSalesReportToPdf } from '../lib/pdfDocumentExport.ts';
import { DoctorAppointmentsAdminPanel } from './DoctorAppointmentsAdminPanel.tsx';

interface AdminDashboardViewProps {
  user: UserProfile | null;
  idToken: string | null;
  onSignIn: () => Promise<void>;
  onRefreshPublicCatalog: () => Promise<void>;
}

const ORDER_STAGES = [
  'Order received',
  'Prescription under review',
  'Awaiting confirmation',
  'Processing',
  'Lens preparation',
  'Quality control',
  'Ready for dispatch',
  'Shipped',
  'Delivered',
];

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  user,
  idToken,
  onSignIn,
  onRefreshPublicCatalog,
}) => {
  const [section, setSection] = useState<
    'overview' | 'orders' | 'appointments' | 'prescriptions' | 'products' | 'lenses' | 'customers' | 'cms'
  >('overview');

  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [appointments, setAppointments] = useState<ClinicalAppointmentRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionData[]>([]);
  const [customers, setCustomers] = useState<UserProfile[]>([]);
  const [enquiries, setEnquiries] = useState<EnquiryRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lensTypes, setLensTypes] = useState<LensType[]>([]);
  const [lensCoatings, setLensCoatings] = useState<LensCoating[]>([]);
  const [siteConfig, setSiteConfig] = useState<Record<string, any>>({
    heroHeadline: 'See Clearly. Look Beautiful. Live Confidently.',
    heroSubheadline:
      'Discover bespoke prescription eyewear, AI-verified optical dispensing, Varilux multifocal lenses, and blue-cut protective glasses crafted around your vision and lifestyle.',
    promoBannerText:
      'Complimentary Nationwide Express Delivery on orders above ₦120,000 · Use code VISION10 for 10% off your first pair',
    whatsappNumber: '+2348098008474',
    supportEmail: 'concierge@visioncare.ng',
    showroomAddress: 'Plot 1420 Akin Adesola Street, Victoria Island, Lagos & Maitama, Abuja',
    bankName: 'Zenith Bank PLC',
    bankAccountName: 'VISION CARE OPTICAL ATELIER LTD',
    bankAccountNumber: '1018492031',
    paymentGatewayPaystackEnabled: true,
    paymentGatewayFlutterwaveEnabled: true,
    paymentGatewayBankTransferEnabled: true,
    paymentGateways: {
      paystack: true,
      flutterwave: true,
      bank_transfer: true,
    },
  });
  const [isSavingCms, setIsSavingCms] = useState(false);
  const [cmsSaveFeedback, setCmsSaveFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Order Search & Filter
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');

  // New Product Modal / Form
  const [newProd, setNewProd] = useState({
    sku: `VC-NEW-${Math.floor(100 + Math.random() * 900)}`,
    name: '',
    brand: 'VISION CARE ATELIER',
    category: 'Unisex',
    gender: 'Unisex',
    shape: 'Round',
    rimStyle: 'Full-Rim',
    material: 'Italian Acetate',
    dimensions: '51-19-145 mm',
    priceNgn: 85000,
    stockQuantity: 20,
    description: '',
    imageUrl: '/src/assets/images/frame_round_navy_1793890600366.jpg',
    colorsCsv: 'Deep Navy, Champagne Gold, Tortoise',
  });

  // New Lens Type Form
  const [newLens, setNewLens] = useState({
    code: `lens_${Date.now().toString().slice(-4)}`,
    name: '',
    category: 'special_order_varilux',
    tier: 'Special Order Lab',
    priceNgn: 95000,
    description: '',
  });

  // New Lens Coating Form
  const [newCoating, setNewCoating] = useState({
    code: `coat_${Date.now().toString().slice(-4)}`,
    name: '',
    groupType: 'tint_treatment',
    priceNgn: 25000,
    description: '',
  });

  const [savingLensId, setSavingLensId] = useState<number | null>(null);
  const [savingCoatingId, setSavingCoatingId] = useState<number | null>(null);
  const [lensActionFeedback, setLensActionFeedback] = useState<string>('');

  const [replyTextMap, setReplyTextMap] = useState<Record<number, string>>({});
  const [customAlertMap, setCustomAlertMap] = useState<Record<number, string>>({});
  const [dispatchingOrderId, setDispatchingOrderId] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedTemplateStageKey, setSelectedTemplateStageKey] = useState<string>('Lens preparation');
  const [isSavingTemplates, setIsSavingTemplates] = useState(false);
  const [heroUrlInput, setHeroUrlInput] = useState('');
  const [heroTitleInput, setHeroTitleInput] = useState('');
  const [isUploadingHeroMedia, setIsUploadingHeroMedia] = useState(false);
  const [triggeringPriceDropId, setTriggeringPriceDropId] = useState<number | null>(null);
  const [priceDropFeedback, setPriceDropFeedback] = useState<string>('');
  const [isUploadingAboutPhoto, setIsUploadingAboutPhoto] = useState(false);

  const [clientEmailTo, setClientEmailTo] = useState('');
  const [clientEmailName, setClientEmailName] = useState('');
  const [clientEmailUid, setClientEmailUid] = useState('');
  const [clientEmailSubject, setClientEmailSubject] = useState('Official Update from Vision Care Optical Atelier');
  const [clientEmailBody, setClientEmailBody] = useState('');
  const [isSendingClientEmail, setIsSendingClientEmail] = useState(false);
  const [clientEmailFeedback, setClientEmailFeedback] = useState<string | null>(null);
  const [lastGmailComposeUrl, setLastGmailComposeUrl] = useState<string | null>(null);
  const [lastMailtoUrl, setLastMailtoUrl] = useState<string | null>(null);
  const [showSmtpSettings, setShowSmtpSettings] = useState(true);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [smtpSaveFeedback, setSmtpSaveFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Compact High-Volume Navigation, Sub-Tabs, Expandable Cards & Pagination State
  const [globalQuickJump, setGlobalQuickJump] = useState('');
  const [overviewStockFilter, setOverviewStockFilter] = useState<'ALL' | 'LOW'>('ALL');
  const [ordersSubTab, setOrdersSubTab] = useState<
    'live_orders' | 'payment_gateways' | 'delivery_methods' | 'notification_templates' | 'all_panels'
  >('live_orders');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<string>('ALL');
  const [orderPage, setOrderPage] = useState<number>(1);
  const [ordersPerPage, setOrdersPerPage] = useState<number>(10);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<number, boolean>>({});

  const [rxSearch, setRxSearch] = useState('');
  const [rxStatusFilter, setRxStatusFilter] = useState<string>('ALL');
  const [rxPage, setRxPage] = useState<number>(1);
  const [expandedRxIds, setExpandedRxIds] = useState<Record<number, boolean>>({});

  const [productsSubTab, setProductsSubTab] = useState<'catalog' | 'add_frame' | 'all'>('catalog');
  const [productSearch, setProductSearch] = useState('');
  const [productFilter, setProductFilter] = useState<'ALL' | 'LOW_STOCK' | 'DISCOUNTED' | 'AI_GLASSES'>('ALL');
  const [productPage, setProductPage] = useState<number>(1);
  const [expandedProductIds, setExpandedProductIds] = useState<Record<number, boolean>>({});

  const [lensesSubTab, setLensesSubTab] = useState<
    'lens_designs' | 'coatings' | 'estimator_settings' | 'add_new' | 'all'
  >('lens_designs');
  const [expandedLensMatrixIds, setExpandedLensMatrixIds] = useState<Record<number, boolean>>({});
  const [expandedCoatingMatrixIds, setExpandedCoatingMatrixIds] = useState<Record<number, boolean>>({});

  const [customersSubTab, setCustomersSubTab] = useState<
    'directory_enquiries' | 'email_composer' | 'smtp_settings' | 'all'
  >('directory_enquiries');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPage, setCustomerPage] = useState<number>(1);

  const [cmsSubTab, setCmsSubTab] = useState<
    'headlines_banner' | 'hero_vault' | 'about_me' | 'bank_contact' | 'cpanel_env' | 'all'
  >('headlines_banner');

  const fetchAdminData = async () => {
    if (!idToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setAppointments(data.appointments || []);
        setPrescriptions(data.prescriptions || []);
        setCustomers(data.users || []);
        setEnquiries(data.enquiries || []);
        setProducts(data.products || []);
        setLensTypes(data.lensTypes || []);
        setLensCoatings(data.lensCoatings || []);
        if (data.siteConfig && Object.keys(data.siteConfig).length > 0) {
          setSiteConfig((prev) => ({ ...prev, ...data.siteConfig }));
        }
      }
    } catch {
      // Handled gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [idToken]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="bg-[#0B192C] text-white rounded-2xl p-10 space-y-5">
          <ShieldAlert className="w-12 h-12 text-[#C5A059] mx-auto" />
          <h1 className="text-3xl font-semibold">VISION CARE — Executive Admin Portal</h1>
          <p className="text-sm text-slate-300 max-w-md mx-auto">
            Restricted to authorised optical administrators and chief dispensing optometrists. Please sign in to access inventory, OCR prescription verification, and order controls.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="px-6 py-3 bg-[#C5A059] text-[#0B192C] font-semibold text-sm rounded-xl"
          >
            Sign In as Administrator
          </button>
        </div>
      </div>
    );
  }

  // Metrics Calculation
  const totalRevenue = orders
    .filter((o) => o.paymentStatus !== 'refunded')
    .reduce((sum, o) => sum + o.totalNgn, 0);
  const pendingOrdersCount = orders.filter((o) => o.orderStatus !== 'Delivered').length;
  const completedOrdersCount = orders.filter((o) => o.orderStatus === 'Delivered').length;
  const lowStockProducts = products.filter((p) => p.stockQuantity <= 10);

  const handleExportCsvReport = () => {
    exportSalesReportToPdf(orders);
    setStatusMessage('Executive Sales Report exported in PDF format.');
  };

  const buildAdminGmailUrl = (to: string, subject: string, body: string) => {
    const params = new URLSearchParams({
      view: 'cm',
      fs: '1',
      to: (to || '').trim(),
      su: (subject || '').trim(),
      body: (body || '').trim(),
    });
    return `https://mail.google.com/mail/?${params.toString()}`;
  };

  const buildAdminMailtoUrl = (to: string, subject: string, body: string) => {
    const params = new URLSearchParams({
      subject: (subject || '').trim(),
      body: (body || '').trim(),
    });
    return `mailto:${encodeURIComponent((to || '').trim())}?${params.toString()}`;
  };

  const handleUpdateOrder = async (orderId: number, updates: any) => {
    if (!idToken) return;
    await fetch(`/api/admin/orders/${orderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(updates),
    });
    setStatusMessage('Order updated and customer notified via Account & Registered Email.');
    await fetchAdminData();
  };

  const isPaymentGatewayActive = (
    gatewayId: 'paystack' | 'flutterwave' | 'bank_transfer'
  ): boolean => {
    if (
      siteConfig.paymentGateways &&
      typeof siteConfig.paymentGateways[gatewayId] === 'boolean'
    ) {
      return siteConfig.paymentGateways[gatewayId];
    }
    if (
      gatewayId === 'paystack' &&
      typeof siteConfig.paymentGatewayPaystackEnabled === 'boolean'
    ) {
      return siteConfig.paymentGatewayPaystackEnabled;
    }
    if (
      gatewayId === 'flutterwave' &&
      typeof siteConfig.paymentGatewayFlutterwaveEnabled === 'boolean'
    ) {
      return siteConfig.paymentGatewayFlutterwaveEnabled;
    }
    if (
      gatewayId === 'bank_transfer' &&
      typeof siteConfig.paymentGatewayBankTransferEnabled === 'boolean'
    ) {
      return siteConfig.paymentGatewayBankTransferEnabled;
    }
    return true;
  };

  const handleTogglePaymentGateway = async (
    gatewayId: 'paystack' | 'flutterwave' | 'bank_transfer',
    label: string
  ) => {
    const currentlyActive = isPaymentGatewayActive(gatewayId);
    const nextState = !currentlyActive;

    const nextGateways = {
      paystack: isPaymentGatewayActive('paystack'),
      flutterwave: isPaymentGatewayActive('flutterwave'),
      bank_transfer: isPaymentGatewayActive('bank_transfer'),
      [gatewayId]: nextState,
    };

    const updatedConfig = {
      ...siteConfig,
      paymentGateways: nextGateways,
      paymentGatewayPaystackEnabled: nextGateways.paystack,
      paymentGatewayFlutterwaveEnabled: nextGateways.flutterwave,
      paymentGatewayBankTransferEnabled: nextGateways.bank_transfer,
    };

    setSiteConfig(updatedConfig);

    await fetch('/api/admin/site-config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify(updatedConfig),
    });

    setStatusMessage(
      `${label} payment option turned ${nextState ? 'ON' : 'OFF'} in Select Payment Gateway.`
    );
    await onRefreshPublicCatalog();
  };

  const getHeroMediaLibrary = (): Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
    title: string;
    caption?: string;
    isActive: boolean;
    uploadedAt: string;
  }> => {
    if (Array.isArray(siteConfig.heroMediaItems) && siteConfig.heroMediaItems.length > 0) {
      return siteConfig.heroMediaItems;
    }
    const defaultUrl =
      siteConfig.heroImage || '/src/assets/images/hero_vision_care_1793890597331.jpg';
    const isVid =
      siteConfig.heroMediaType === 'video' ||
      String(defaultUrl).startsWith('data:video/') ||
      /\.(mp4|webm|ogg|mov)(\?|$)/i.test(String(defaultUrl));
    return [
      {
        id: 'default-hero-item',
        type: isVid ? 'video' : 'image',
        url: defaultUrl,
        title: 'Vision Care Editorial Hero',
        caption:
          siteConfig.heroCaption ||
          'Featured Frame: Mayfair Round Italian Acetate with Sapphire Blue-Cut Anti-Reflective Lenses',
        isActive: true,
        uploadedAt: new Date().toISOString(),
      },
    ];
  };

  const saveUpdatedHeroMediaConfig = async (
    nextItems: Array<{
      id: string;
      type: 'image' | 'video';
      url: string;
      title: string;
      caption?: string;
      isActive: boolean;
      uploadedAt: string;
    }>,
    nextActiveId?: string,
    feedbackMsg?: string
  ) => {
    const activeId =
      nextActiveId ||
      siteConfig.heroActiveMediaId ||
      nextItems.find((i) => i.isActive)?.id ||
      nextItems[0]?.id ||
      '';
    const primaryItem =
      nextItems.find((i) => i.id === activeId) ||
      nextItems.find((i) => i.isActive) ||
      nextItems[0];

    const updatedConfig = {
      ...siteConfig,
      heroMediaItems: nextItems,
      heroActiveMediaId: activeId,
      heroImage: primaryItem?.url || siteConfig.heroImage,
      heroMediaType: primaryItem?.type || 'image',
      heroCaption: primaryItem?.caption || siteConfig.heroCaption,
    };

    setSiteConfig(updatedConfig);

    await fetch('/api/admin/site-config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify(updatedConfig),
    });

    if (feedbackMsg) {
      setStatusMessage(feedbackMsg);
    }
    await onRefreshPublicCatalog();
  };

  const handleUploadHeroFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingHeroMedia(true);
    try {
      const currentItems = getHeroMediaLibrary();
      const uploadedItems: typeof currentItems = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isVid = file.type.startsWith('video/') || /\.(mp4|webm|ogg|mov)$/i.test(file.name);
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

        uploadedItems.push({
          id: `hero-${Date.now()}-${i}`,
          type: isVid ? 'video' : 'image',
          url: dataUrl,
          title: file.name.replace(/\.[^/.]+$/, ''),
          caption:
            siteConfig.heroCaption ||
            'Featured Frame: Mayfair Round Italian Acetate with Sapphire Blue-Cut Anti-Reflective Lenses',
          isActive: true,
          uploadedAt: new Date().toISOString(),
        });
      }

      const nextList = [...uploadedItems, ...currentItems];
      const newestId = uploadedItems[0]?.id;
      await saveUpdatedHeroMediaConfig(
        nextList,
        newestId,
        `Uploaded ${uploadedItems.length} Hero ${
          uploadedItems[0]?.type === 'video' ? 'video (repeating loop)' : 'picture'
        } and published live.`
      );
    } finally {
      setIsUploadingHeroMedia(false);
      e.target.value = '';
    }
  };

  const handleAddHeroByUrl = async () => {
    const cleanUrl = heroUrlInput.trim();
    if (!cleanUrl) return;
    const isVid =
      cleanUrl.startsWith('data:video/') ||
      /\.(mp4|webm|ogg|mov)(\?|$)/i.test(cleanUrl);
    const currentItems = getHeroMediaLibrary();
    const newItem = {
      id: `hero-url-${Date.now()}`,
      type: (isVid ? 'video' : 'image') as 'image' | 'video',
      url: cleanUrl,
      title: heroTitleInput.trim() || (isVid ? 'Hero Campaign Video' : 'Hero Campaign Picture'),
      caption:
        siteConfig.heroCaption ||
        'Featured Frame: Mayfair Round Italian Acetate with Sapphire Blue-Cut Anti-Reflective Lenses',
      isActive: true,
      uploadedAt: new Date().toISOString(),
    };
    const nextList = [newItem, ...currentItems];
    setHeroUrlInput('');
    setHeroTitleInput('');
    await saveUpdatedHeroMediaConfig(
      nextList,
      newItem.id,
      `Added Hero ${isVid ? 'Video (repeating loop)' : 'Picture'} to Vault and set as active.`
    );
  };

  const handleUpdatePrescription = async (rxId: number, updates: any) => {
    if (!idToken) return;
    await fetch(`/api/admin/prescriptions/${rxId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(updates),
    });
    setStatusMessage('Prescription verification state saved.');
    await fetchAdminData();
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idToken) return;
    await fetch('/api/admin/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        sku: newProd.sku,
        name: newProd.name,
        brand: newProd.brand,
        category: newProd.category,
        gender: newProd.gender,
        shape: newProd.shape,
        rimStyle: newProd.rimStyle,
        material: newProd.material,
        dimensions: newProd.dimensions,
        priceNgn: Number(newProd.priceNgn),
        stockQuantity: Number(newProd.stockQuantity),
        description: newProd.description,
        colorsJson: JSON.stringify(newProd.colorsCsv.split(',').map((s) => s.trim())),
        imagesJson: JSON.stringify([newProd.imageUrl]),
        isFeatured: true,
        isBestSeller: false,
        isNewArrival: true,
        isActive: true,
      }),
    });
    setStatusMessage('New frame added to catalog.');
    setNewProd({ ...newProd, sku: `VC-NEW-${Math.floor(100 + Math.random() * 900)}`, name: '', description: '' });
    await fetchAdminData();
    await onRefreshPublicCatalog();
  };

  const handleDeleteProduct = async (id: number) => {
    if (!idToken) return;
    await fetch(`/api/admin/products/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    await fetchAdminData();
    await onRefreshPublicCatalog();
  };

  const filteredOrders = orders.filter((o) => {
    const q = orderSearch.toLowerCase();
    const matchesQuery =
      !q ||
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerEmail.toLowerCase().includes(q) ||
      (o.customerPhone || '').toLowerCase().includes(q) ||
      (o.paymentReference || '').toLowerCase().includes(q);
    const matchesStatus = orderStatusFilter === 'ALL' || o.orderStatus === orderStatusFilter;
    const matchesPayment = orderPaymentFilter === 'ALL' || o.paymentStatus === orderPaymentFilter;
    return matchesQuery && matchesStatus && matchesPayment;
  });

  const totalOrderPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPerPage));
  const safeOrderPage = Math.min(orderPage, totalOrderPages);
  const paginatedOrders = filteredOrders.slice(
    (safeOrderPage - 1) * ordersPerPage,
    safeOrderPage * ordersPerPage
  );

  const handleQuickJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = globalQuickJump.trim();
    if (!q) return;
    const low = q.toLowerCase();
    const matchedOrder = orders.find(
      (o) =>
        o.orderNumber.toLowerCase().includes(low) ||
        o.customerName.toLowerCase().includes(low) ||
        o.customerEmail.toLowerCase().includes(low)
    );
    if (matchedOrder) {
      setSection('orders');
      setOrdersSubTab('live_orders');
      setOrderSearch(q);
      setOrderStatusFilter('ALL');
      setOrderPaymentFilter('ALL');
      setOrderPage(1);
      setExpandedOrderIds((prev) => ({ ...prev, [matchedOrder.id]: true }));
      setGlobalQuickJump('');
      return;
    }
    const matchedProd = products.find(
      (p) => p.name.toLowerCase().includes(low) || p.sku.toLowerCase().includes(low)
    );
    if (matchedProd) {
      setSection('products');
      setProductsSubTab('catalog');
      setProductSearch(q);
      setProductPage(1);
      setExpandedProductIds((prev) => ({ ...prev, [matchedProd.id]: true }));
      setGlobalQuickJump('');
      return;
    }
    const matchedCust = customers.find(
      (c) =>
        (c.fullName || '').toLowerCase().includes(low) ||
        (c.email || '').toLowerCase().includes(low)
    );
    if (matchedCust) {
      setSection('customers');
      setCustomersSubTab('directory_enquiries');
      setCustomerSearch(q);
      setGlobalQuickJump('');
      return;
    }
    setSection('orders');
    setOrdersSubTab('live_orders');
    setOrderSearch(q);
    setGlobalQuickJump('');
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Dedicated Sticky Executive Admin Header */}
      <div className="bg-[#0B192C] text-white px-4 sm:px-6 py-3.5 border-b border-white/10 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[#C5A059] block">
                Authorised Optical Operations Console
              </span>
              <h1 className="text-lg sm:text-xl font-semibold">
                VISION CARE — Admin &amp; Lab Control Center
              </h1>
            </div>
          </div>

          {/* Global Instant Quick-Jump Bar */}
          <form onSubmit={handleQuickJumpSubmit} className="flex-1 max-w-md flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={globalQuickJump}
                onChange={(e) => setGlobalQuickJump(e.target.value)}
                placeholder="Quick jump: Order # (VC-...), client email, or frame SKU..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-[#C5A059]"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold cursor-pointer shrink-0"
            >
              Find
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2.5">
            {statusMessage && (
              <span className="text-xs bg-emerald-500/20 text-emerald-200 px-3 py-1.5 rounded-lg max-w-xs truncate">
                {statusMessage}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setSection('cms');
                setCmsSubTab('cpanel_env');
              }}
              className="px-3.5 py-1.5 bg-[#1E40AF] hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shrink-0 border border-white/15"
            >
              <Settings className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>Environment Variables (.env &amp; MySQL)</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsvReport}
              className="px-3.5 py-1.5 bg-[#C5A059] text-[#0B192C] text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Sales PDF</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* Compact Primary Admin Navigation Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-1.5 mb-5 flex items-center gap-1.5 overflow-x-auto shadow-2xs">
          {[
            { id: 'overview', label: 'Analytics & Overview', icon: BarChart3 },
            { id: 'orders', label: `Orders (${orders.length})`, icon: Package },
            { id: 'appointments', label: `Doctor Appointments (${appointments.length})`, icon: Stethoscope },
            { id: 'prescriptions', label: `Prescriptions & OCR (${prescriptions.length})`, icon: FileCheck2 },
            { id: 'products', label: `Frames (${products.length})`, icon: Glasses },
            { id: 'lenses', label: `Lenses & Coatings (${lensTypes.length})`, icon: Layers },
            { id: 'customers', label: `Customers & Email (${customers.length})`, icon: Users },
            { id: 'cms', label: 'Storefront CMS', icon: Settings },
          ].map((nav) => {
            const Icon = nav.icon;
            const active = section === nav.id;
            return (
              <button
                key={nav.id}
                type="button"
                onClick={() => setSection(nav.id as any)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#0B192C] text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#C5A059]' : 'text-slate-500'}`} />
                <span>{nav.label}</span>
              </button>
            );
          })}
        </div>

        {loading && <p className="text-xs text-slate-500 mb-3">Synchronizing live PostgreSQL metrics...</p>}

        {/* 1. OVERVIEW & ANALYTICS (COMPACT & INTERACTIVE) */}
        {section === 'overview' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <button
                type="button"
                onClick={() => {
                  setSection('orders');
                  setOrdersSubTab('live_orders');
                }}
                className="bg-white p-4 rounded-xl border border-slate-200 hover:border-[#1E40AF] text-left transition-colors cursor-pointer"
              >
                <span className="text-xs text-slate-500">Total Revenue (NGN)</span>
                <p className="text-xl sm:text-2xl font-tabular font-semibold text-[#0B192C] mt-1">
                  {formatNaira(totalRevenue)}
                </p>
                <span className="text-[11px] text-[#1E40AF] font-medium mt-1 block">
                  Across {orders.length} optical orders →
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSection('orders');
                  setOrdersSubTab('live_orders');
                }}
                className="bg-white p-4 rounded-xl border border-slate-200 hover:border-[#1E40AF] text-left transition-colors cursor-pointer"
              >
                <span className="text-xs text-slate-500">Active / Pending Orders</span>
                <p className="text-xl sm:text-2xl font-tabular font-semibold text-[#1E40AF] mt-1">
                  {pendingOrdersCount}
                </p>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {completedOrdersCount} delivered · Click to manage →
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSection('customers')}
                className="bg-white p-4 rounded-xl border border-slate-200 hover:border-[#1E40AF] text-left transition-colors cursor-pointer"
              >
                <span className="text-xs text-slate-500">Registered Customers</span>
                <p className="text-xl sm:text-2xl font-tabular font-semibold text-[#0B192C] mt-1">
                  {customers.length}
                </p>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {prescriptions.length} prescriptions · {enquiries.length} enquiries →
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSection('products')}
                className="bg-white p-4 rounded-xl border border-slate-200 hover:border-[#1E40AF] text-left transition-colors cursor-pointer"
              >
                <span className="text-xs text-slate-500">Catalog &amp; Low Stock</span>
                <p className="text-xl sm:text-2xl font-tabular font-semibold text-[#0B192C] mt-1">
                  {products.length} Frames
                </p>
                <span className="text-[11px] text-amber-700 font-medium mt-1 block">
                  {lowStockProducts.length} frame(s) with ≤ 10 units →
                </span>
              </button>
            </div>

            {/* Quick Section Shortcuts Bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#0B192C] px-2">Quick Operations Shortcuts:</span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSection('orders');
                    setOrdersSubTab('live_orders');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#0B192C] text-white font-semibold cursor-pointer"
                >
                  Open Live Orders Queue ({orders.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSection('orders');
                    setOrdersSubTab('payment_gateways');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#0B192C] font-semibold cursor-pointer"
                >
                  Payment Gateways
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSection('orders');
                    setOrdersSubTab('delivery_methods');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#0B192C] font-semibold cursor-pointer"
                >
                  Delivery Methods
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSection('customers');
                    setCustomersSubTab('email_composer');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#0B192C] font-semibold cursor-pointer"
                >
                  Email a Client
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSection('cms');
                    setCmsSubTab('hero_vault');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#0B192C] font-semibold cursor-pointer"
                >
                  Hero Video / Picture Vault
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Recent Transactions (Compact & Clickable) */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#0B192C]">
                    Recent Optical Orders (Latest 8)
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setSection('orders');
                      setOrdersSubTab('live_orders');
                    }}
                    className="text-xs font-semibold text-[#1E40AF] hover:underline cursor-pointer"
                  >
                    View All {orders.length} Orders →
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 pr-1">
                  {orders.slice(0, 8).map((o) => (
                    <div
                      key={o.id}
                      onClick={() => {
                        setSection('orders');
                        setOrdersSubTab('live_orders');
                        setExpandedOrderIds((prev) => ({ ...prev, [o.id]: true }));
                      }}
                      className="flex items-center justify-between py-2 px-2 rounded hover:bg-slate-50 text-xs cursor-pointer"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-tabular font-semibold text-[#0B192C]">{o.orderNumber}</span>
                        <span className="text-slate-500 ml-2 truncate">{o.customerName}</span>
                      </div>
                      <div className="flex items-center gap-2.5 font-tabular shrink-0">
                        <span className="text-[11px] text-slate-600">{o.orderStatus}</span>
                        <span className="font-semibold text-[#0B192C]">{formatNaira(o.totalNgn)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Low Stock Alert List (Compact Scrollable Container) */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#0B192C]">
                    Inventory &amp; Stock Health ({products.length})
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOverviewStockFilter('ALL')}
                      className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                        overviewStockFilter === 'ALL'
                          ? 'bg-[#0B192C] text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      All ({products.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOverviewStockFilter('LOW')}
                      className={`px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                        overviewStockFilter === 'LOW'
                          ? 'bg-amber-600 text-white'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      Low Stock ({lowStockProducts.length})
                    </button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 pr-1">
                  {(overviewStockFilter === 'LOW' ? lowStockProducts : products).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSection('products');
                        setProductSearch(p.sku);
                      }}
                      className="flex items-center justify-between py-2 px-2 rounded hover:bg-slate-50 text-xs cursor-pointer"
                    >
                      <div className="truncate pr-2">
                        <span className="font-semibold text-[#0B192C]">{p.name}</span>
                        <span className="text-slate-400 ml-1.5 font-tabular">({p.sku})</span>
                      </div>
                      <span
                        className={`font-tabular font-semibold shrink-0 ${
                          p.stockQuantity <= 10 ? 'text-amber-600' : 'text-emerald-700'
                        }`}
                      >
                        {p.stockQuantity} in stock
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. ORDER MANAGEMENT & REAL-TIME SMS / EMAIL NOTIFICATION CONTROLS */}
        {section === 'orders' && (
          <div className="space-y-4">
            {/* Compact Orders Sub-Navigation Bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-2 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  {
                    id: 'live_orders' as const,
                    label: `1. Live Client Orders Queue (${filteredOrders.length})`,
                  },
                  {
                    id: 'payment_gateways' as const,
                    label: '2. Payment Gateways (Paystack / Flutterwave / Bank)',
                  },
                  {
                    id: 'delivery_methods' as const,
                    label: '3. Delivery Methods & Courier Fees',
                  },
                  {
                    id: 'notification_templates' as const,
                    label: '4. SMS & Email Notification Templates',
                  },
                  {
                    id: 'all_panels' as const,
                    label: 'Show All Together',
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setOrdersSubTab(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      ordersSubTab === tab.id
                        ? 'bg-[#1E40AF] text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {(ordersSubTab === 'payment_gateways' || ordersSubTab === 'all_panels') && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-[#0B192C] text-[#C5A059] shrink-0">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-[#1E40AF]">
                      Checkout Payment Gateway Control
                    </span>
                    <h3 className="text-base sm:text-lg font-semibold text-[#0B192C] mt-0.5">
                      Select Payment Gateway (₦ NGN) — Turn Payment Options ON / OFF
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Control which payment gateway options are displayed to customers during checkout. Turning an option off immediately removes it from the customer&apos;s Select Payment Gateway selector.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-[#0B192C] text-xs font-semibold font-tabular">
                    {
                      (['paystack', 'flutterwave', 'bank_transfer'] as const).filter((id) =>
                        isPaymentGatewayActive(id)
                      ).length
                    }{' '}
                    of 3 Gateways Active
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {[
                  {
                    id: 'paystack' as const,
                    label: 'Paystack',
                    sub: 'Card / USSD / Transfer',
                  },
                  {
                    id: 'flutterwave' as const,
                    label: 'Flutterwave',
                    sub: 'Barter / Card / Bank',
                  },
                  {
                    id: 'bank_transfer' as const,
                    label: 'Bank Transfer',
                    sub: 'Direct Corporate NGN',
                  },
                ].map((gw) => {
                  const active = isPaymentGatewayActive(gw.id);
                  return (
                    <div
                      key={gw.id}
                      className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        active
                          ? 'bg-[#E0F2FE]/30 border-[#1E40AF] shadow-xs'
                          : 'bg-slate-50 border-slate-200 opacity-80'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#0B192C]">
                          {gw.id === 'bank_transfer' ? (
                            <Building2
                              className={`w-4 h-4 shrink-0 ${
                                active ? 'text-[#1E40AF]' : 'text-slate-400'
                              }`}
                            />
                          ) : (
                            <CreditCard
                              className={`w-4 h-4 shrink-0 ${
                                active ? 'text-[#1E40AF]' : 'text-slate-400'
                              }`}
                            />
                          )}
                          <span>{gw.label}</span>
                        </div>
                        <span className="block text-[11px] text-slate-500 mt-0.5">
                          {gw.sub}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleTogglePaymentGateway(gw.id, gw.label)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                          active
                            ? 'bg-[#0B192C] text-[#C5A059] hover:bg-[#162B49]'
                            : 'bg-white border border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700'
                        }`}
                      >
                        {active ? '● ON' : '○ OFF'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Paystack & Flutterwave Live Merchant & Gateway Configuration */}
              <div className="pt-3 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#0B192C] flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-[#1E40AF]" />
                      <span>Paystack Checkout Settings (Accessible Anytime)</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        isPaymentGatewayActive('paystack')
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isPaymentGatewayActive('paystack') ? 'Active at Checkout' : 'Turned Off'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={siteConfig.paystackMerchantName || ''}
                      onChange={(e) =>
                        setSiteConfig({ ...siteConfig, paystackMerchantName: e.target.value })
                      }
                      placeholder="Paystack Merchant Name (e.g. Vision Care NG)"
                      className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                    />
                    <input
                      type="email"
                      value={siteConfig.paystackMerchantEmail || ''}
                      onChange={(e) =>
                        setSiteConfig({ ...siteConfig, paystackMerchantEmail: e.target.value })
                      }
                      placeholder="Settlement Email (concierge@visioncare.ng)"
                      className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                    />
                    <input
                      type="text"
                      value={siteConfig.paystackPublicKey || ''}
                      onChange={(e) =>
                        setSiteConfig({ ...siteConfig, paystackPublicKey: e.target.value })
                      }
                      placeholder="Paystack Public Key (pk_live_... or pk_test_...)"
                      className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white font-tabular"
                    />
                    <input
                      type="text"
                      value={siteConfig.paystackPaymentUrl || ''}
                      onChange={(e) =>
                        setSiteConfig({ ...siteConfig, paystackPaymentUrl: e.target.value })
                      }
                      placeholder="Optional Paystack Direct Payment Link"
                      className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#0B192C] flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-[#1E40AF]" />
                      <span>Flutterwave Checkout Settings (Accessible Anytime)</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        isPaymentGatewayActive('flutterwave')
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isPaymentGatewayActive('flutterwave') ? 'Active at Checkout' : 'Turned Off'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={siteConfig.flutterwaveMerchantName || ''}
                      onChange={(e) =>
                        setSiteConfig({ ...siteConfig, flutterwaveMerchantName: e.target.value })
                      }
                      placeholder="Flutterwave Merchant Title (e.g. Vision Care)"
                      className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                    />
                    <input
                      type="email"
                      value={siteConfig.flutterwaveMerchantEmail || ''}
                      onChange={(e) =>
                        setSiteConfig({ ...siteConfig, flutterwaveMerchantEmail: e.target.value })
                      }
                      placeholder="Settlement Email (concierge@visioncare.ng)"
                      className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                    />
                    <input
                      type="text"
                      value={siteConfig.flutterwavePublicKey || ''}
                      onChange={(e) =>
                        setSiteConfig({ ...siteConfig, flutterwavePublicKey: e.target.value })
                      }
                      placeholder="Flutterwave Public Key (FLWPUBK-...)"
                      className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white font-tabular"
                    />
                    <input
                      type="text"
                      value={siteConfig.flutterwavePaymentUrl || ''}
                      onChange={(e) =>
                        setSiteConfig({ ...siteConfig, flutterwavePaymentUrl: e.target.value })
                      }
                      placeholder="Optional Flutterwave Direct Payment Link"
                      className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    await fetch('/api/admin/site-config', {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                      },
                      body: JSON.stringify(siteConfig),
                    });
                    setStatusMessage('Paystack & Flutterwave checkout gateway settings saved live.');
                    await onRefreshPublicCatalog();
                  }}
                  className="px-4 py-2 bg-[#0B192C] hover:bg-[#162B49] text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Save Paystack & Flutterwave Settings
                </button>
              </div>
            </div>
            )}

            {/* Admin Delivery Method Control Panel (Turn ON/OFF, Edit Prices, Thresholds & Add New Delivery Methods) */}
            {(ordersSubTab === 'delivery_methods' || ordersSubTab === 'all_panels') && (() => {
              const currentDeliveryMethods = Array.isArray(siteConfig.deliveryMethods) &&
                siteConfig.deliveryMethods.length > 0
                ? siteConfig.deliveryMethods
                : [
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

              const saveDeliveryMethodsLive = async (nextMethods: any[], msg: string) => {
                const updatedConfig = { ...siteConfig, deliveryMethods: nextMethods };
                setSiteConfig(updatedConfig);
                await fetch('/api/admin/site-config', {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                  },
                  body: JSON.stringify(updatedConfig),
                });
                setStatusMessage(msg);
                await onRefreshPublicCatalog();
              };

              return (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-[#0B192C] text-[#C5A059] shrink-0">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#1E40AF]">
                          Checkout Delivery Method Control
                        </span>
                        <h3 className="text-base sm:text-lg font-semibold text-[#0B192C] mt-0.5">
                          Delivery Methods — Edit Prices, Turn Options ON / OFF & Add Couriers
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Manage all delivery methods displayed to clients during checkout. Edit delivery fees, free-delivery thresholds, estimated timelines, or turn any option ON/OFF.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const added = [
                            ...currentDeliveryMethods,
                            {
                              id: `del_${Date.now()}`,
                              name: 'Priority Same-Day VIP Optical Dispatch',
                              description: 'Dedicated rider delivery with white-glove fitting',
                              priceNgn: 7500,
                              freeThresholdNgn: 150000,
                              estimatedDays: 'Same Day (4–6 Hours)',
                              isActive: true,
                            },
                          ];
                          saveDeliveryMethodsLive(
                            added,
                            'Added new Delivery Method and published live to checkout.'
                          );
                        }}
                        className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#0B192C] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#1E40AF]" />
                        <span>Add Delivery Method</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          saveDeliveryMethodsLive(
                            currentDeliveryMethods,
                            'Delivery methods and fees saved live.'
                          )
                        }
                        className="px-4 py-2 rounded-lg bg-[#0B192C] hover:bg-[#162B49] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>Save Delivery Methods</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {currentDeliveryMethods.map((method: any, idx: number) => {
                      const active = method.isActive !== false;
                      return (
                        <div
                          key={method.id || idx}
                          className={`p-4 rounded-xl border transition-all space-y-3 ${
                            active
                              ? 'bg-[#FAF9F6] border-slate-300'
                              : 'bg-slate-50 border-slate-200 opacity-75'
                          }`}
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center text-xs">
                            <div className="sm:col-span-4">
                              <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">
                                Delivery Method Name
                              </label>
                              <input
                                type="text"
                                value={method.name || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const next = currentDeliveryMethods.map((m: any, i: number) =>
                                    i === idx ? { ...m, name: val } : m
                                  );
                                  setSiteConfig({ ...siteConfig, deliveryMethods: next });
                                }}
                                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 bg-white font-semibold text-[#0B192C]"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">
                                Fee (₦ NGN)
                              </label>
                              <input
                                type="number"
                                value={method.priceNgn ?? 0}
                                onChange={(e) => {
                                  const val = Number(e.target.value || 0);
                                  const next = currentDeliveryMethods.map((m: any, i: number) =>
                                    i === idx ? { ...m, priceNgn: val } : m
                                  );
                                  setSiteConfig({ ...siteConfig, deliveryMethods: next });
                                }}
                                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 bg-white font-tabular font-bold text-[#1E40AF]"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">
                                Free Above (₦)
                              </label>
                              <input
                                type="number"
                                value={method.freeThresholdNgn ?? 0}
                                onChange={(e) => {
                                  const val = Number(e.target.value || 0);
                                  const next = currentDeliveryMethods.map((m: any, i: number) =>
                                    i === idx ? { ...m, freeThresholdNgn: val } : m
                                  );
                                  setSiteConfig({ ...siteConfig, deliveryMethods: next });
                                }}
                                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 bg-white font-tabular"
                              />
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">
                                Est. Timeline
                              </label>
                              <input
                                type="text"
                                value={method.estimatedDays || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const next = currentDeliveryMethods.map((m: any, i: number) =>
                                    i === idx ? { ...m, estimatedDays: val } : m
                                  );
                                  setSiteConfig({ ...siteConfig, deliveryMethods: next });
                                }}
                                placeholder="24–48 Hours"
                                className="w-full border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
                              />
                            </div>

                            <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-4">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = currentDeliveryMethods.map((m: any, i: number) =>
                                    i === idx ? { ...m, isActive: !active } : m
                                  );
                                  saveDeliveryMethodsLive(
                                    next,
                                    `Delivery method "${method.name}" turned ${!active ? 'ON' : 'OFF'}.`
                                  );
                                }}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase cursor-pointer ${
                                  active
                                    ? 'bg-[#0B192C] text-[#C5A059]'
                                    : 'bg-white border border-slate-300 text-slate-500'
                                }`}
                              >
                                {active ? '● ON' : '○ OFF'}
                              </button>
                              {currentDeliveryMethods.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = currentDeliveryMethods.filter(
                                      (_: any, i: number) => i !== idx
                                    );
                                    saveDeliveryMethodsLive(
                                      next,
                                      `Removed delivery method "${method.name}".`
                                    );
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                                  title="Delete delivery method"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          <input
                            type="text"
                            value={method.description || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const next = currentDeliveryMethods.map((m: any, i: number) =>
                                i === idx ? { ...m, description: val } : m
                              );
                              setSiteConfig({ ...siteConfig, deliveryMethods: next });
                            }}
                            placeholder="Delivery method description..."
                            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-xs text-slate-600"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Admin Checkout SMS & Email Notification Global Controls */}
            {(ordersSubTab === 'notification_templates' || ordersSubTab === 'all_panels') && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-[#0B192C] text-[#C5A059] shrink-0">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-[#1E40AF]">
                      Checkout & Lab Notification Engine
                    </span>
                    <h3 className="text-base sm:text-lg font-semibold text-[#0B192C] mt-0.5">
                      SMS & Email Order Status Notification Controls (Lab Surfacing, Quality Control, Shipped)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Control the checkout SMS/Email toggle options and dispatch real-time status alerts to customers as their eyewear moves through the lab.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    const nextEnabled = siteConfig.checkoutNotificationsEnabled === false ? true : false;
                    const updatedConfig = {
                      ...siteConfig,
                      checkoutNotificationsEnabled: nextEnabled,
                    };
                    setSiteConfig(updatedConfig);
                    await fetch('/api/admin/site-config', {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                      },
                      body: JSON.stringify(updatedConfig),
                    });
                    setStatusMessage(
                      nextEnabled
                        ? 'Checkout SMS & Email Notification Toggle enabled.'
                        : 'Checkout SMS & Email Notification Toggle disabled.'
                    );
                    await onRefreshPublicCatalog();
                  }}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer shrink-0 self-start md:self-auto ${
                    siteConfig.checkoutNotificationsEnabled !== false
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-slate-100 text-slate-600 border-slate-300'
                  }`}
                >
                  {siteConfig.checkoutNotificationsEnabled !== false
                    ? '● Checkout SMS/Email Toggle: Enabled'
                    : '○ Checkout SMS/Email Toggle: Disabled'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Default Checkout SMS State
                  </label>
                  <select
                    value={siteConfig.defaultNotifySms !== false ? 'on' : 'off'}
                    onChange={(e) =>
                      setSiteConfig({
                        ...siteConfig,
                        defaultNotifySms: e.target.value === 'on',
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                  >
                    <option value="on">Opted-In (ON by Default)</option>
                    <option value="off">Opted-Out (OFF by Default)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Default Checkout Email State
                  </label>
                  <select
                    value={siteConfig.defaultNotifyEmail !== false ? 'on' : 'off'}
                    onChange={(e) =>
                      setSiteConfig({
                        ...siteConfig,
                        defaultNotifyEmail: e.target.value === 'on',
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                  >
                    <option value="on">Opted-In (ON by Default)</option>
                    <option value="off">Opted-Out (OFF by Default)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Optional SMS Service Fee (₦ NGN)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={siteConfig.smsNotificationFeeNgn ?? 0}
                    onChange={(e) =>
                      setSiteConfig({
                        ...siteConfig,
                        smsNotificationFeeNgn: Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-tabular"
                    placeholder="0 (Free)"
                  />
                </div>

                <div>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch('/api/admin/site-config', {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                        },
                        body: JSON.stringify(siteConfig),
                      });
                      setStatusMessage('Checkout SMS & Email notification settings saved.');
                      await onRefreshPublicCatalog();
                    }}
                    className="w-full py-2.5 px-4 bg-[#0B192C] hover:bg-[#162B49] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Save Notification Settings
                  </button>
                </div>
              </div>

              {/* Automated Status Notification Channels (SMS/Email) & Editable Template Studio */}
              {(() => {
                const stageTemplates = getNotificationStageTemplates(siteConfig);
                const activeStageConfig =
                  stageTemplates[selectedTemplateStageKey] ||
                  stageTemplates['Lens preparation'] ||
                  DEFAULT_STAGE_NOTIFICATION_TEMPLATES['Lens preparation'];

                const updateActiveStageTemplate = (
                  patch: Partial<typeof activeStageConfig>
                ) => {
                  const prevMap = siteConfig.notificationStageTemplates || {};
                  const prevStage = prevMap[activeStageConfig.stageKey] || activeStageConfig;
                  setSiteConfig({
                    ...siteConfig,
                    notificationStageTemplates: {
                      ...prevMap,
                      [activeStageConfig.stageKey]: {
                        ...activeStageConfig,
                        ...prevStage,
                        ...patch,
                      },
                    },
                  });
                };

                const sampleVars = {
                  customerName: 'Chinedu Eze',
                  orderNumber: 'VC-849201-302',
                  orderStatus: activeStageConfig.stageLabel,
                  deliveryCity: 'Victoria Island',
                  deliveryState: 'Lagos',
                };

                return (
                  <div className="pt-4 border-t border-slate-200 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#1E40AF]">
                          Automated Customer Communication Studio
                        </span>
                        <h4 className="text-sm sm:text-base font-semibold text-[#0B192C]">
                          Define Notification Channels (SMS / Email) & Edit Automated Status Update Templates
                        </h4>
                        <p className="text-xs text-slate-500">
                          Customize which channels (SMS, Email, or both) fire automatically and edit the exact message templates sent when an order status updates.
                        </p>
                      </div>

                      {/* Global SMS & Email Channel Master Switches */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setSiteConfig({
                              ...siteConfig,
                              adminSmsChannelEnabled:
                                siteConfig.adminSmsChannelEnabled === false ? true : false,
                            })
                          }
                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                            siteConfig.adminSmsChannelEnabled !== false
                              ? 'bg-[#0B192C] text-white border-[#0B192C]'
                              : 'bg-slate-100 text-slate-500 border-slate-300'
                          }`}
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-[#C5A059]" />
                          <span>
                            Global SMS Channel:{' '}
                            {siteConfig.adminSmsChannelEnabled !== false ? 'ACTIVE' : 'PAUSED'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setSiteConfig({
                              ...siteConfig,
                              adminEmailChannelEnabled:
                                siteConfig.adminEmailChannelEnabled === false ? true : false,
                            })
                          }
                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                            siteConfig.adminEmailChannelEnabled !== false
                              ? 'bg-[#0B192C] text-white border-[#0B192C]'
                              : 'bg-slate-100 text-slate-500 border-slate-300'
                          }`}
                        >
                          <Mail className="w-3.5 h-3.5 text-[#C5A059]" />
                          <span>
                            Global Email Channel:{' '}
                            {siteConfig.adminEmailChannelEnabled !== false ? 'ACTIVE' : 'PAUSED'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Stage Selector Pills */}
                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        1. Select Order Status Stage to Configure Channels & Templates:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {ORDER_STAGES.map((stageKey) => {
                          const stCfg = stageTemplates[stageKey];
                          const isSelected = selectedTemplateStageKey === stageKey;
                          const channelSummary = [
                            stCfg?.smsEnabled ? 'SMS' : null,
                            stCfg?.emailEnabled ? 'Email' : null,
                          ]
                            .filter(Boolean)
                            .join('+');
                          return (
                            <button
                              key={stageKey}
                              type="button"
                              onClick={() => setSelectedTemplateStageKey(stageKey)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                                isSelected
                                  ? 'bg-[#1E40AF] text-white border-[#1E40AF] shadow-xs'
                                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              <span>{stageKey}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                  isSelected
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-200/80 text-slate-600'
                                }`}
                              >
                                {channelSummary || 'Off'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selected Stage Channel Toggles & Template Editors */}
                    <div className="rounded-xl bg-[#FAF9F6] border border-slate-200 p-4 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1E40AF]">
                            Editing Automated Stage Template
                          </span>
                          <h5 className="text-sm font-semibold text-[#0B192C]">
                            {activeStageConfig.stageLabel} ({activeStageConfig.stageKey})
                          </h5>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-xs font-semibold text-slate-600">
                            Active Channels for this Stage:
                          </span>
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-[#0B192C] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={activeStageConfig.smsEnabled}
                              onChange={(e) =>
                                updateActiveStageTemplate({ smsEnabled: e.target.checked })
                              }
                              className="w-3.5 h-3.5 accent-[#1E40AF]"
                            />
                            <MessageSquare className="w-3.5 h-3.5 text-[#1E40AF]" />
                            <span>Send SMS</span>
                          </label>

                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-[#0B192C] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={activeStageConfig.emailEnabled}
                              onChange={(e) =>
                                updateActiveStageTemplate({ emailEnabled: e.target.checked })
                              }
                              className="w-3.5 h-3.5 accent-[#1E40AF]"
                            />
                            <Mail className="w-3.5 h-3.5 text-[#1E40AF]" />
                            <span>Send Email</span>
                          </label>
                        </div>
                      </div>

                      {/* Dynamic Placeholder Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="text-slate-500 font-medium mr-1">
                          Available Dynamic Placeholders (Click to append to SMS/Email):
                        </span>
                        {[
                          '{customerName}',
                          '{orderNumber}',
                          '{orderStatus}',
                          '{deliveryCity}',
                          '{deliveryState}',
                        ].map((token) => (
                          <button
                            key={token}
                            type="button"
                            onClick={() =>
                              updateActiveStageTemplate({
                                smsTemplate: `${activeStageConfig.smsTemplate} ${token}`.trim(),
                                emailBodyTemplate: `${activeStageConfig.emailBodyTemplate} ${token}`.trim(),
                              })
                            }
                            className="px-2 py-0.5 rounded bg-white border border-slate-300 hover:border-[#1E40AF] text-[#1E40AF] font-tabular font-semibold cursor-pointer"
                          >
                            {token}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* SMS Template Input */}
                        <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-200">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-[#0B192C] flex items-center gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-[#1E40AF]" />
                              <span>Automated SMS Template Message</span>
                            </label>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                activeStageConfig.smsEnabled
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {activeStageConfig.smsEnabled ? 'SMS Enabled' : 'SMS Disabled'}
                            </span>
                          </div>
                          <textarea
                            rows={3}
                            value={activeStageConfig.smsTemplate}
                            onChange={(e) =>
                              updateActiveStageTemplate({ smsTemplate: e.target.value })
                            }
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800"
                            placeholder="Enter SMS template message..."
                          />
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600">
                            <strong className="text-[#0B192C] block mb-0.5">
                              Live SMS Preview:
                            </strong>
                            <span>
                              {interpolateNotificationTemplate(
                                activeStageConfig.smsTemplate,
                                sampleVars
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Email Subject & Body Template Input */}
                        <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-200">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-[#0B192C] flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-[#1E40AF]" />
                              <span>Automated Email Subject & Body Template</span>
                            </label>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                activeStageConfig.emailEnabled
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {activeStageConfig.emailEnabled ? 'Email Enabled' : 'Email Disabled'}
                            </span>
                          </div>
                          <input
                            type="text"
                            value={activeStageConfig.emailSubjectTemplate}
                            onChange={(e) =>
                              updateActiveStageTemplate({
                                emailSubjectTemplate: e.target.value,
                              })
                            }
                            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#0B192C]"
                            placeholder="Email Subject Line..."
                          />
                          <textarea
                            rows={2}
                            value={activeStageConfig.emailBodyTemplate}
                            onChange={(e) =>
                              updateActiveStageTemplate({
                                emailBodyTemplate: e.target.value,
                              })
                            }
                            className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800"
                            placeholder="Email Body Message..."
                          />
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600">
                            <strong className="text-[#0B192C] block mb-0.5">
                              Live Email Preview ({interpolateNotificationTemplate(activeStageConfig.emailSubjectTemplate, sampleVars)}):
                            </strong>
                            <span>
                              {interpolateNotificationTemplate(
                                activeStageConfig.emailBodyTemplate,
                                sampleVars
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            const def =
                              DEFAULT_STAGE_NOTIFICATION_TEMPLATES[activeStageConfig.stageKey];
                            if (def) {
                              updateActiveStageTemplate(def);
                            }
                          }}
                          className="px-3.5 py-2 border border-slate-300 hover:bg-white text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
                        >
                          Reset "{activeStageConfig.stageKey}" Template to Default
                        </button>

                        <button
                          type="button"
                          disabled={isSavingTemplates}
                          onClick={async () => {
                            setIsSavingTemplates(true);
                            try {
                              await fetch('/api/admin/site-config', {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                  ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                                },
                                body: JSON.stringify(siteConfig),
                              });
                              setStatusMessage(
                                `Saved notification channels & message templates for "${activeStageConfig.stageKey}".`
                              );
                              await onRefreshPublicCatalog();
                            } finally {
                              setIsSavingTemplates(false);
                            }
                          }}
                          className="px-5 py-2 bg-[#0B192C] hover:bg-[#162B49] disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 text-[#C5A059]" />
                          <span>
                            {isSavingTemplates
                              ? 'Saving Channels & Templates...'
                              : 'Save Notification Channels & Templates'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            )}

            {/* High-Volume Live Client Orders Queue with Search, Stage Filters, Collapsible Rows & Pagination */}
            {(ordersSubTab === 'live_orders' || ordersSubTab === 'all_panels') && (
              <div className="space-y-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex flex-col lg:flex-row gap-3 justify-between">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={orderSearch}
                        onChange={(e) => {
                          setOrderSearch(e.target.value);
                          setOrderPage(1);
                        }}
                        placeholder="Search by order number (VC-...), customer name, phone, email, or payment ref..."
                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={orderStatusFilter}
                        onChange={(e) => {
                          setOrderStatusFilter(e.target.value);
                          setOrderPage(1);
                        }}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white font-medium"
                      >
                        <option value="ALL">All Lab Stages ({orders.length})</option>
                        {ORDER_STAGES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>

                      <select
                        value={orderPaymentFilter}
                        onChange={(e) => {
                          setOrderPaymentFilter(e.target.value);
                          setOrderPage(1);
                        }}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white font-medium"
                      >
                        <option value="ALL">All Payment States</option>
                        <option value="paid">Paid</option>
                        <option value="pending_verification">Pending Verification</option>
                        <option value="refunded">Refunded</option>
                      </select>

                      <select
                        value={ordersPerPage}
                        onChange={(e) => {
                          setOrdersPerPage(Number(e.target.value));
                          setOrderPage(1);
                        }}
                        className="border border-slate-300 rounded-lg px-2.5 py-2 text-xs bg-white font-tabular"
                      >
                        <option value={10}>10 / page</option>
                        <option value={25}>25 / page</option>
                        <option value={50}>50 / page</option>
                        <option value={100}>100 / page</option>
                      </select>
                    </div>
                  </div>

                  {/* Quick Stage Filter Buttons & Expand/Collapse All Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setOrderStatusFilter('ALL');
                          setOrderPaymentFilter('ALL');
                          setOrderPage(1);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                          orderStatusFilter === 'ALL' && orderPaymentFilter === 'ALL'
                            ? 'bg-[#0B192C] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        All ({orders.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOrderPaymentFilter(
                            orderPaymentFilter === 'pending_verification' ? 'ALL' : 'pending_verification'
                          );
                          setOrderPage(1);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                          orderPaymentFilter === 'pending_verification'
                            ? 'bg-amber-600 text-white'
                            : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                        }`}
                      >
                        Transfer Pending ({orders.filter((o) => o.paymentStatus === 'pending_verification').length})
                      </button>
                      {['Prescription under review', 'Lens preparation', 'Quality control', 'Shipped', 'Delivered'].map(
                        (st) => {
                          const count = orders.filter((o) => o.orderStatus === st).length;
                          const active = orderStatusFilter === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => {
                                setOrderStatusFilter(active ? 'ALL' : st);
                                setOrderPage(1);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                                active
                                  ? 'bg-[#1E40AF] text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {st} ({count})
                            </button>
                          );
                        }
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const next: Record<number, boolean> = {};
                          paginatedOrders.forEach((o) => {
                            next[o.id] = true;
                          });
                          setExpandedOrderIds(next);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700 cursor-pointer"
                      >
                        Expand Page
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedOrderIds({})}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-700 cursor-pointer"
                      >
                        Collapse All
                      </button>
                    </div>
                  </div>
                </div>

                {paginatedOrders.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                    No optical orders match your current search or filter criteria.
                  </div>
                ) : (
                  paginatedOrders.map((ord) => {
                    const notifMeta = parseOrderNotificationMeta(ord.internalAdminNotes);
                    const activeChannels = [
                      ...(notifMeta.notifySms ? ['SMS'] : []),
                      ...(notifMeta.notifyEmail ? ['Email'] : []),
                    ];
                    const isExpanded = Boolean(expandedOrderIds[ord.id]);

                    return (
                      <div key={ord.id} className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-3">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          <div
                            onClick={() =>
                              setExpandedOrderIds((prev) => ({
                                ...prev,
                                [ord.id]: !prev[ord.id],
                              }))
                            }
                            className="cursor-pointer flex-1 min-w-0"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm sm:text-base font-tabular font-bold text-[#0B192C]">
                                {ord.orderNumber}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-[#0B192C] font-tabular font-semibold text-xs">
                                {formatNaira(ord.totalNgn)}
                              </span>
                              <span className="text-xs text-slate-600 font-medium">
                                · {ord.customerName} ({ord.customerPhone} · {ord.customerEmail})
                              </span>
                              <span className="text-[11px] text-[#1E40AF] font-semibold">
                                ({ord.items.length} item{ord.items.length === 1 ? '' : 's'})
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                              Delivery: {ord.deliveryAddress}, {ord.deliveryCity}, {ord.deliveryState} · Gateway:{' '}
                              <strong className="uppercase">{ord.paymentMethod}</strong> (Ref: {ord.paymentReference})
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <select
                              value={ord.paymentStatus}
                              onChange={(e) => handleUpdateOrder(ord.id, { paymentStatus: e.target.value })}
                              className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs bg-white font-medium"
                            >
                              <option value="paid">Payment: Paid</option>
                              <option value="pending_verification">Payment: Pending Verification</option>
                              <option value="refunded">Payment: Refunded</option>
                            </select>

                            <select
                              value={ord.orderStatus}
                              onChange={(e) => handleUpdateOrder(ord.id, { orderStatus: e.target.value })}
                              className="border border-[#1E40AF] rounded-lg px-2.5 py-1.5 text-xs bg-[#E0F2FE]/40 text-[#0B192C] font-semibold"
                            >
                              {ORDER_STAGES.map((s) => (
                                <option key={s} value={s}>
                                  Status: {s}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => window.print()}
                              className="p-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer"
                              title="Print Lab Order Sheet"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setExpandedOrderIds((prev) => ({
                                  ...prev,
                                  [ord.id]: !prev[ord.id],
                                }))
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                                isExpanded
                                  ? 'bg-[#0B192C] text-white border-[#0B192C]'
                                  : 'bg-slate-100 hover:bg-slate-200 text-[#0B192C] border-slate-200'
                              }`}
                            >
                              {isExpanded ? 'Hide Details ▲' : 'Lab, Alerts & Items ▼'}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="pt-3 border-t border-slate-100 space-y-3">
                            {/* Per-Order Real-Time SMS & Email Notification Console */}
                            <div className="rounded-xl bg-[#FAF9F6] border border-slate-200/90 p-4 space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0B192C] flex items-center gap-1.5">
                                    <Bell className="w-3.5 h-3.5 text-[#1E40AF]" />
                                    <span>Customer Notification Channels:</span>
                                  </span>

                                  {/* Admin Toggle for Customer SMS */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedMeta = {
                                        ...notifMeta,
                                        notifySms: !notifMeta.notifySms,
                                      };
                                      handleUpdateOrder(ord.id, {
                                        internalAdminNotes: serializeOrderNotificationMeta(updatedMeta),
                                      });
                                    }}
                                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                                      notifMeta.notifySms
                                        ? 'bg-[#0B192C] text-white border-[#0B192C]'
                                        : 'bg-white text-slate-500 border-slate-200'
                                    }`}
                                  >
                                    <MessageSquare className="w-3 h-3 text-[#C5A059]" />
                                    <span>SMS ({ord.customerPhone}): {notifMeta.notifySms ? 'ON' : 'OFF'}</span>
                                  </button>

                                  {/* Admin Toggle for Customer Email */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedMeta = {
                                        ...notifMeta,
                                        notifyEmail: !notifMeta.notifyEmail,
                                      };
                                      handleUpdateOrder(ord.id, {
                                        internalAdminNotes: serializeOrderNotificationMeta(updatedMeta),
                                      });
                                    }}
                                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                                      notifMeta.notifyEmail
                                        ? 'bg-[#0B192C] text-white border-[#0B192C]'
                                        : 'bg-white text-slate-500 border-slate-200'
                                    }`}
                                  >
                                    <Mail className="w-3 h-3 text-[#C5A059]" />
                                    <span>Email ({ord.customerEmail}): {notifMeta.notifyEmail ? 'ON' : 'OFF'}</span>
                                  </button>
                                </div>

                                <div className="text-[11px] text-slate-500">
                                  Subscribed Stages:{' '}
                                  <strong className="text-[#0B192C]">
                                    {[
                                      notifMeta.stages.labSurfacing ? 'Lab Surfacing' : null,
                                      notifMeta.stages.qualityControl ? 'Quality Control' : null,
                                      notifMeta.stages.shipped ? 'Shipped' : null,
                                    ]
                                      .filter(Boolean)
                                      .join(', ') || 'All Stages'}
                                  </strong>
                                </div>
                              </div>

                              {/* One-Click Real-Time Milestone Dispatch Buttons */}
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-2 border-t border-slate-200/80">
                                <span className="text-[11px] font-semibold text-slate-600">
                                  One-Click Milestone Alert Dispatch ({activeChannels.join(' + ') || 'In-App'}):
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                  {[
                                    {
                                      label: '1. Notify: Lab Surfacing',
                                      stage: 'Lab Surfacing',
                                      orderStatus: 'Lens preparation',
                                    },
                                    {
                                      label: '2. Notify: Quality Control',
                                      stage: 'Quality Control',
                                      orderStatus: 'Quality control',
                                    },
                                    {
                                      label: '3. Notify: Shipped',
                                      stage: 'Shipped',
                                      orderStatus: 'Shipped',
                                    },
                                  ].map((btn) => {
                                    const isCurrent = ord.orderStatus === btn.orderStatus;
                                    return (
                                      <button
                                        key={btn.stage}
                                        type="button"
                                        disabled={dispatchingOrderId === ord.id}
                                        onClick={async () => {
                                          setDispatchingOrderId(ord.id);
                                          try {
                                            await handleUpdateOrder(ord.id, {
                                              orderStatus: btn.orderStatus,
                                              dispatchAlert: {
                                                stage: btn.stage,
                                                channels:
                                                  activeChannels.length > 0 ? activeChannels : ['In-App'],
                                              },
                                            });
                                            setStatusMessage(
                                              `Dispatched "${btn.stage}" update via ${
                                                activeChannels.join(' & ') || 'Portal'
                                              } to ${ord.customerName}.`
                                            );
                                          } finally {
                                            setDispatchingOrderId(null);
                                          }
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                          isCurrent
                                            ? 'bg-[#1E40AF] text-white border-[#1E40AF]'
                                            : 'bg-white hover:bg-[#0B192C] text-[#0B192C] hover:text-white border-slate-300'
                                        }`}
                                      >
                                        <Send className="w-3 h-3 text-[#C5A059]" />
                                        <span>{btn.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Custom Real-Time SMS / Email Message Composer */}
                              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                                <input
                                  type="text"
                                  value={customAlertMap[ord.id] || ''}
                                  onChange={(e) =>
                                    setCustomAlertMap({
                                      ...customAlertMap,
                                      [ord.id]: e.target.value,
                                    })
                                  }
                                  placeholder={`Send custom SMS/Email update to ${ord.customerName} (${ord.customerPhone})...`}
                                  className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs"
                                />
                                <button
                                  type="button"
                                  disabled={!customAlertMap[ord.id]?.trim() || dispatchingOrderId === ord.id}
                                  onClick={async () => {
                                    const msg = customAlertMap[ord.id]?.trim();
                                    if (!msg) return;
                                    setDispatchingOrderId(ord.id);
                                    try {
                                      await handleUpdateOrder(ord.id, {
                                        dispatchAlert: {
                                          stage: ord.orderStatus,
                                          message: msg,
                                          channels: activeChannels.length > 0 ? activeChannels : ['In-App'],
                                        },
                                      });
                                      setCustomAlertMap({ ...customAlertMap, [ord.id]: '' });
                                      setStatusMessage(
                                        `Sent custom ${activeChannels.join(' & ') || 'Portal'} alert to ${ord.customerName}.`
                                      );
                                    } finally {
                                      setDispatchingOrderId(null);
                                    }
                                  }}
                                  className="px-3.5 py-1.5 bg-[#0B192C] hover:bg-[#162B49] disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
                                >
                                  <Send className="w-3 h-3 text-[#C5A059]" />
                                  <span>Send SMS / Email Alert</span>
                                </button>
                                {ord.customerEmail && (
                                  <a
                                    href={buildAdminGmailUrl(
                                      ord.customerEmail,
                                      `Vision Care Order Update (${ord.orderNumber})`,
                                      customAlertMap[ord.id]?.trim() ||
                                        `Hello ${ord.customerName},\n\nYour Vision Care order (${ord.orderNumber}) is currently at stage: ${ord.orderStatus}.\n\nWarm regards,\nVision Care Optical Concierge`
                                    )}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-[#1E40AF] text-xs font-semibold rounded-lg shrink-0 flex items-center justify-center gap-1"
                                    title={`Deliver directly to ${ord.customerEmail} via Gmail`}
                                  >
                                    <Mail className="w-3 h-3" />
                                    <span>Gmail Inbox</span>
                                  </a>
                                )}
                              </div>

                              {/* Recent Dispatched SMS & Email Log */}
                              {notifMeta.history.length > 0 && (
                                <div className="pt-2 border-t border-slate-200/70 space-y-1">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                                    Recent Dispatched Notifications ({notifMeta.history.length})
                                  </span>
                                  <div className="space-y-1 max-h-24 overflow-y-auto">
                                    {notifMeta.history.slice(0, 3).map((entry) => (
                                      <div
                                        key={entry.id}
                                        className="text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2 bg-white px-2.5 py-1 rounded border border-slate-200/70"
                                      >
                                        <div className="truncate max-w-xl">
                                          <span className="font-semibold text-[#1E40AF] mr-1.5">
                                            [{entry.channels.join(' + ')}]
                                          </span>
                                          <strong className="text-[#0B192C] mr-1">{entry.stage}:</strong>
                                          <span>{entry.message}</span>
                                        </div>
                                        <span className="text-[10px] font-tabular text-slate-400 shrink-0">
                                          {new Date(entry.sentAt).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          })}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="space-y-2">
                              {ord.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="p-3 rounded-lg bg-slate-50 border border-slate-200/70 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                >
                                  <div>
                                    <strong>
                                      {item.productName} ({item.selectedColor}) × {item.quantity}
                                    </strong>
                                    <span className="text-slate-600 block">
                                      Lens: {item.lensTypeName} ({item.lensOptionSelected}) · Treatment: {item.coatingSummary}
                                    </span>
                                    {item.prescriptionSnapshotJson && item.prescriptionSnapshotJson !== '{}' && (
                                      <span className="font-tabular text-[11px] text-[#1E40AF] block mt-0.5">
                                        Rx Spec: {item.prescriptionSnapshotJson}
                                      </span>
                                    )}
                                  </div>
                                  <span className="font-tabular font-semibold text-[#0B192C]">
                                    {formatNaira(item.unitTotalNgn * item.quantity)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Orders Pagination Bar */}
                {filteredOrders.length > ordersPerPage && (
                  <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="text-slate-600 font-tabular">
                      Showing {(safeOrderPage - 1) * ordersPerPage + 1}–
                      {Math.min(safeOrderPage * ordersPerPage, filteredOrders.length)} of{' '}
                      <strong>{filteredOrders.length}</strong> orders
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={safeOrderPage <= 1}
                        onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50 font-semibold cursor-pointer"
                      >
                        ← Prev
                      </button>
                      <span className="font-tabular font-semibold text-[#0B192C] px-2">
                        Page {safeOrderPage} of {totalOrderPages}
                      </span>
                      <button
                        type="button"
                        disabled={safeOrderPage >= totalOrderPages}
                        onClick={() => setOrderPage((p) => Math.min(totalOrderPages, p + 1))}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50 font-semibold cursor-pointer"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. PRESCRIPTION & OCR VERIFICATION (SEARCHABLE, COMPACT & PAGINATED) */}
        {section === 'prescriptions' && (() => {
          const filteredRx = prescriptions.filter((rx) => {
            const q = rxSearch.toLowerCase();
            const matchesQuery =
              !q ||
              (rx.patientName || '').toLowerCase().includes(q) ||
              (rx.doctorName || '').toLowerCase().includes(q) ||
              (rx.verificationStatus || '').toLowerCase().includes(q);
            const matchesStatus =
              rxStatusFilter === 'ALL' || rx.verificationStatus === rxStatusFilter;
            return matchesQuery && matchesStatus;
          });
          const rxPerPage = 10;
          const totalRxPages = Math.max(1, Math.ceil(filteredRx.length / rxPerPage));
          const safeRxPage = Math.min(rxPage, totalRxPages);
          const paginatedRx = filteredRx.slice((safeRxPage - 1) * rxPerPage, safeRxPage * rxPerPage);

          return (
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={rxSearch}
                    onChange={(e) => {
                      setRxSearch(e.target.value);
                      setRxPage(1);
                    }}
                    placeholder="Search prescriptions by patient name or doctor..."
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={rxStatusFilter}
                    onChange={(e) => {
                      setRxStatusFilter(e.target.value);
                      setRxPage(1);
                    }}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white font-medium"
                  >
                    <option value="ALL">All Statuses ({prescriptions.length})</option>
                    <option value="pending_review">Pending Review</option>
                    <option value="verified">Verified</option>
                    <option value="clarification_requested">Clarification Requested</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const next: Record<number, boolean> = {};
                      prescriptions.forEach((r) => {
                        if (r.id) next[r.id] = true;
                      });
                      setExpandedRxIds(next);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    Expand All
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedRxIds({})}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              {paginatedRx.map((rx) => {
                const isRxOpen = rx.id ? Boolean(expandedRxIds[rx.id]) : false;
                return (
                  <div key={rx.id} className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div
                        onClick={() =>
                          rx.id &&
                          setExpandedRxIds((prev) => ({
                            ...prev,
                            [rx.id!]: !prev[rx.id!],
                          }))
                        }
                        className="cursor-pointer"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm sm:text-base font-semibold text-[#0B192C]">
                            Patient: {rx.patientName}
                          </h3>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-[11px] font-semibold uppercase text-[#1E40AF]">
                            {rx.verificationStatus}
                          </span>
                          <span className="text-xs text-slate-500">
                            ({rx.submissionType === 'upload_ocr' ? 'Uploaded Document + AI OCR' : 'Manual Submission'})
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Date: {rx.prescriptionDate || 'N/A'} · Doctor: {rx.doctorName || 'Not specified'} · PD: {rx.pd} mm
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdatePrescription(rx.id!, {
                              verificationStatus: 'verified',
                              adminFeedback: 'Verified by Vision Care Chief Optometrist. Approved for lens surfacing.',
                            })
                          }
                          className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark Verified</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdatePrescription(rx.id!, {
                              verificationStatus: 'clarification_requested',
                              adminFeedback: 'Please confirm your Left Eye (OS) Cylinder Axis with your optometrist.',
                            })
                          }
                          className="px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          Request Clarification
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            rx.id &&
                            setExpandedRxIds((prev) => ({
                              ...prev,
                              [rx.id!]: !prev[rx.id!],
                            }))
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                        >
                          {isRxOpen ? 'Hide Rx ▲' : 'View Rx ▼'}
                        </button>
                      </div>
                    </div>

                    {isRxOpen && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center pt-2 border-t border-slate-100">
                        <div className="lg:col-span-2 font-tabular text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1.5">
                          <div>
                            <strong>OD (Right Eye):</strong> SPH {rx.odSph} | CYL {rx.odCyl} | AXIS {rx.odAxis}° | ADD {rx.odAdd}
                          </div>
                          <div>
                            <strong>OS (Left Eye):</strong> SPH {rx.osSph} | CYL {rx.osCyl} | AXIS {rx.osAxis}° | ADD {rx.osAdd}
                          </div>
                          <div>
                            <strong>PD:</strong> {rx.pd} mm · <strong>Status:</strong>{' '}
                            <span className="uppercase text-[#1E40AF] font-semibold">{rx.verificationStatus}</span>
                          </div>
                          {rx.ocrConfidenceNotes && (
                            <div className="font-sans text-slate-600 pt-1">
                              <strong>OCR Notes:</strong> {rx.ocrConfidenceNotes}
                            </div>
                          )}
                        </div>

                        {rx.documentDataUrl && rx.documentDataUrl.startsWith('data:image') && (
                          <div className="border border-slate-200 rounded-lg p-2 bg-white text-center">
                            <img
                              src={rx.documentDataUrl}
                              alt="Uploaded Rx Document"
                              className="max-h-28 mx-auto object-contain"
                            />
                            <span className="text-[10px] text-slate-400 block mt-1">{rx.documentFileName}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredRx.length > rxPerPage && (
                <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-tabular">
                    Page {safeRxPage} of {totalRxPages} ({filteredRx.length} prescriptions)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={safeRxPage <= 1}
                      onClick={() => setRxPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 cursor-pointer"
                    >
                      ← Prev
                    </button>
                    <button
                      type="button"
                      disabled={safeRxPage >= totalRxPages}
                      onClick={() => setRxPage((p) => Math.min(totalRxPages, p + 1))}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 cursor-pointer"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* 4. PRODUCT & FRAME MANAGEMENT + REAL-TIME WISHLIST PRICE-DROP ALERTS */}
        {section === 'products' && (() => {
          const filteredProds = products.filter((p) => {
            const q = productSearch.toLowerCase();
            const matchesQ =
              !q ||
              p.name.toLowerCase().includes(q) ||
              p.sku.toLowerCase().includes(q) ||
              p.brand.toLowerCase().includes(q) ||
              p.category.toLowerCase().includes(q);
            const matchesF =
              productFilter === 'ALL'
                ? true
                : productFilter === 'LOW_STOCK'
                  ? p.stockQuantity <= 10
                  : productFilter === 'DISCOUNTED'
                    ? Boolean(p.discountPriceNgn && p.discountPriceNgn > 0 && p.discountPriceNgn < p.priceNgn)
                    : p.category === 'AI Glasses';
            return matchesQ && matchesF;
          });
          const prodsPerPage = 10;
          const totalProdPages = Math.max(1, Math.ceil(filteredProds.length / prodsPerPage));
          const safeProdPage = Math.min(productPage, totalProdPages);
          const paginatedProds = filteredProds.slice(
            (safeProdPage - 1) * prodsPerPage,
            safeProdPage * prodsPerPage
          );

          return (
            <div className="space-y-4">
              {/* Sub-Navigation Bar for Frames */}
              <div className="bg-white rounded-xl border border-slate-200 p-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'catalog' as const, label: `1. Manage Frames & Wishlist Price-Drop (${filteredProds.length})` },
                    { id: 'add_frame' as const, label: '2. + Add New Eyewear Frame' },
                    { id: 'all' as const, label: 'Show Both Side-by-Side' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setProductsSubTab(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        productsSubTab === tab.id
                          ? 'bg-[#1E40AF] text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={productsSubTab === 'all' ? 'grid grid-cols-1 lg:grid-cols-3 gap-6' : 'space-y-4'}>
                {(productsSubTab === 'catalog' || productsSubTab === 'all') && (
                  <div className={productsSubTab === 'all' ? 'lg:col-span-2 space-y-3' : 'space-y-3'}>
                    <div className="bg-[#0B192C] text-white rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#C5A059] flex items-center gap-1.5">
                          <Bell className="w-3.5 h-3.5" />
                          <span>Real-Time Wishlist Price-Drop Alert Engine</span>
                        </span>
                        <h3 className="text-sm font-semibold">
                          Update `discountPriceNgn` on Any Frame &amp; Notify Wishlist Users Instantly
                        </h3>
                      </div>
                    </div>

                    {/* Search & Filter Bar for Frames */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-2.5 justify-between">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={productSearch}
                          onChange={(e) => {
                            setProductSearch(e.target.value);
                            setProductPage(1);
                          }}
                          placeholder="Search frame by name, SKU, or brand..."
                          className="w-full pl-9 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          { id: 'ALL' as const, label: `All (${products.length})` },
                          { id: 'LOW_STOCK' as const, label: `Low Stock (${lowStockProducts.length})` },
                          { id: 'DISCOUNTED' as const, label: 'Discounted' },
                          { id: 'AI_GLASSES' as const, label: 'AI Glasses' },
                        ].map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              setProductFilter(f.id);
                              setProductPage(1);
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${
                              productFilter === f.id
                                ? 'bg-[#0B192C] text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {priceDropFeedback && (
                      <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-medium flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>{priceDropFeedback}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPriceDropFeedback('')}
                          className="text-[11px] font-semibold underline cursor-pointer"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}

                    {paginatedProds.map((prod) => {
                      const hasDiscount = Boolean(
                        prod.discountPriceNgn && prod.discountPriceNgn > 0 && prod.discountPriceNgn < prod.priceNgn
                      );
                      const isProdExpanded = Boolean(expandedProductIds[prod.id]);
                      return (
                        <div
                          key={prod.id}
                          className="bg-white rounded-xl border border-slate-200 p-4 space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div
                              onClick={() =>
                                setExpandedProductIds((prev) => ({
                                  ...prev,
                                  [prod.id]: !prev[prod.id],
                                }))
                              }
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 font-tabular">{prod.sku}</span>
                                {hasDiscount && (
                                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase">
                                    Discount Active: {formatNaira(prod.discountPriceNgn!)}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-semibold text-[#0B192C] mt-0.5">
                                {prod.name} —{' '}
                                <span className="font-tabular text-[#1E40AF]">
                                  {formatNaira(prod.discountPriceNgn || prod.priceNgn)}
                                </span>
                                {hasDiscount && (
                                  <span className="text-xs text-slate-400 line-through font-tabular ml-2">
                                    {formatNaira(prod.priceNgn)}
                                  </span>
                                )}
                              </h4>
                              <p className="text-xs text-slate-500">
                                {prod.brand} · {prod.shape} · {prod.material} · Stock: {prod.stockQuantity}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-auto">
                              <button
                                type="button"
                                onClick={async () => {
                                  await fetch('/api/admin/products', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      Authorization: `Bearer ${idToken}`,
                                    },
                                    body: JSON.stringify({
                                      id: prod.id,
                                      stockQuantity: prod.stockQuantity + 10,
                                    }),
                                  });
                                  fetchAdminData();
                                  await onRefreshPublicCatalog();
                                }}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-medium rounded-lg cursor-pointer"
                              >
                                +10 Stock
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedProductIds((prev) => ({
                                    ...prev,
                                    [prod.id]: !prev[prod.id],
                                  }))
                                }
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-semibold rounded-lg cursor-pointer"
                              >
                                {isProdExpanded ? 'Hide Price Editor ▲' : 'Edit Price ▼'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(prod.id)}
                                className="p-2 text-slate-400 hover:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Editable Regular Price, Discount Price (discountPriceNgn) & Wishlist Price-Drop Alert Trigger */}
                          {isProdExpanded && (
                            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end bg-slate-50/80 p-3 rounded-xl">
                              <div className="sm:col-span-3">
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                                  Regular Price (₦)
                                </label>
                                <input
                                  type="number"
                                  value={prod.priceNgn}
                                  onChange={(e) => {
                                    const val = Math.max(0, Number(e.target.value) || 0);
                                    setProducts((prev) =>
                                      prev.map((p) => (p.id === prod.id ? { ...p, priceNgn: val } : p))
                                    );
                                  }}
                                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-tabular bg-white"
                                />
                              </div>

                              <div className="sm:col-span-4">
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#1E40AF] mb-1">
                                  Discount Price (`discountPriceNgn` ₦)
                                </label>
                                <input
                                  type="number"
                                  placeholder="e.g. 75000 (0 to clear)"
                                  value={prod.discountPriceNgn ?? ''}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const val = raw === '' ? null : Math.max(0, Number(raw) || 0);
                                    setProducts((prev) =>
                                      prev.map((p) =>
                                        p.id === prod.id ? { ...p, discountPriceNgn: val } : p
                                      )
                                    );
                                  }}
                                  className="w-full border border-[#1E40AF]/40 focus:border-[#1E40AF] rounded-lg px-2.5 py-1.5 text-xs font-tabular bg-white font-semibold text-[#0B192C]"
                                />
                              </div>

                              <div className="sm:col-span-5">
                                <button
                                  type="button"
                                  disabled={triggeringPriceDropId === prod.id}
                                  onClick={async () => {
                                    if (!idToken) return;
                                    setTriggeringPriceDropId(prod.id);
                                    try {
                                      const effectiveDiscount =
                                        prod.discountPriceNgn && prod.discountPriceNgn > 0
                                          ? prod.discountPriceNgn
                                          : Math.round(prod.priceNgn * 0.85);
                                      const res = await fetch(
                                        `/api/admin/products/${prod.id}/price-drop-alert`,
                                        {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            Authorization: `Bearer ${idToken}`,
                                          },
                                          body: JSON.stringify({
                                            priceNgn: prod.priceNgn,
                                            discountPriceNgn: effectiveDiscount,
                                          }),
                                        }
                                      );
                                      if (res.ok) {
                                        const data = await res.json();
                                        const msg = `Updated "${prod.name}" discountPriceNgn to ${formatNaira(
                                          effectiveDiscount
                                        )} & dispatched real-time Wishlist Price-Drop Alert to ${
                                          data.notifiedCount || 1
                                        } customer account(s).`;
                                        setPriceDropFeedback(msg);
                                        setStatusMessage(msg);
                                        await fetchAdminData();
                                        await onRefreshPublicCatalog();
                                      }
                                    } finally {
                                      setTriggeringPriceDropId(null);
                                    }
                                  }}
                                  className="w-full py-2 px-3 bg-[#0B192C] hover:bg-[#162B49] disabled:opacity-60 text-white text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <Bell className="w-3.5 h-3.5 text-[#C5A059]" />
                                  <span>
                                    {triggeringPriceDropId === prod.id
                                      ? 'Sending Price-Drop Alert...'
                                      : 'Update Discount & Trigger Wishlist Alert'}
                                  </span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {filteredProds.length > prodsPerPage && (
                      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-tabular">
                          Page {safeProdPage} of {totalProdPages} ({filteredProds.length} frames)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={safeProdPage <= 1}
                            onClick={() => setProductPage((p) => Math.max(1, p - 1))}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 cursor-pointer"
                          >
                            ← Prev
                          </button>
                          <button
                            type="button"
                            disabled={safeProdPage >= totalProdPages}
                            onClick={() => setProductPage((p) => Math.min(totalProdPages, p + 1))}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40 cursor-pointer"
                          >
                            Next →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(productsSubTab === 'add_frame' || productsSubTab === 'all') && (
                  <form
                    onSubmit={handleCreateProduct}
                    className="bg-white rounded-xl border border-slate-200 p-6 space-y-3 h-fit max-w-xl"
                  >
                    <h3 className="text-base font-semibold text-[#0B192C] flex items-center gap-2">
                      <Plus className="w-4 h-4 text-[#1E40AF]" />
                      <span>Add New Eyewear Frame</span>
                    </h3>
                    <input
                      type="text"
                      required
                      placeholder="Frame Name"
                      value={newProd.name}
                      onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Brand"
                        value={newProd.brand}
                        onChange={(e) => setNewProd({ ...newProd, brand: e.target.value })}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-xs"
                      />
                      <input
                        type="number"
                        required
                        placeholder="Price (NGN)"
                        value={newProd.priceNgn}
                        onChange={(e) => setNewProd({ ...newProd, priceNgn: Number(e.target.value) })}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-xs font-tabular"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={newProd.category}
                        onChange={(e) => setNewProd({ ...newProd, category: e.target.value })}
                        className="border border-slate-300 rounded-lg px-2.5 py-2 text-xs bg-white"
                      >
                        <option value="Unisex">Standard Frame</option>
                        <option value="AI Glasses">AI Smart Glasses</option>
                        <option value="Luxury">Luxury Frame</option>
                        <option value="Sports">Sports Frame</option>
                      </select>
                      <select
                        value={newProd.shape}
                        onChange={(e) => setNewProd({ ...newProd, shape: e.target.value })}
                        className="border border-slate-300 rounded-lg px-2.5 py-2 text-xs bg-white"
                      >
                        <option value="Round">Round</option>
                        <option value="Square">Square</option>
                        <option value="Rectangle">Rectangle</option>
                        <option value="Cat-Eye">Cat-Eye</option>
                        <option value="Aviator">Aviator</option>
                      </select>
                      <select
                        value={newProd.gender}
                        onChange={(e) => setNewProd({ ...newProd, gender: e.target.value })}
                        className="border border-slate-300 rounded-lg px-2.5 py-2 text-xs bg-white"
                      >
                        <option value="Unisex">Unisex</option>
                        <option value="Men">Men</option>
                        <option value="Women">Women</option>
                        <option value="Children">Children</option>
                      </select>
                    </div>
                    <textarea
                      rows={3}
                      required
                      placeholder="Product description..."
                      value={newProd.description}
                      onChange={(e) => setNewProd({ ...newProd, description: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-[#0B192C] text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Publish Frame to Storefront
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })()}


        {/* 5. LENS, SPECIAL ORDER LENSES & QUICK COST ESTIMATOR MANAGEMENT */}
        {section === 'lenses' && (
          <div className="space-y-4">
            {/* Compact Lenses & Coatings Sub-Navigation Bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-2 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  {
                    id: 'lens_designs' as const,
                    label: `1. Optical & Special Order Lenses (${lensTypes.length})`,
                  },
                  {
                    id: 'coatings' as const,
                    label: `2. Coatings & High-Index (${lensCoatings.length})`,
                  },
                  {
                    id: 'estimator_settings' as const,
                    label: '3. Quick Cost Estimator Settings',
                  },
                  {
                    id: 'add_new' as const,
                    label: '4. + Add New Lens / Coating',
                  },
                  {
                    id: 'all' as const,
                    label: 'Show All Together',
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setLensesSubTab(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      lensesSubTab === tab.id
                        ? 'bg-[#1E40AF] text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {lensActionFeedback && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center justify-between">
                <span>{lensActionFeedback}</span>
                <button
                  type="button"
                  onClick={() => setLensActionFeedback('')}
                  className="text-emerald-700 hover:underline text-[11px] cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Quick Cost Estimator Global Admin Control Bar */}
            {(lensesSubTab === 'estimator_settings' || lensesSubTab === 'all') && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-[#1E40AF]">
                      Storefront Estimator & Optical Pricing Engine
                    </span>
                    <h3 className="text-lg font-semibold text-[#0B192C] mt-0.5">
                      Quick Cost Estimator & Special Order Lens Controls
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      All active lenses, Special Order lenses (Bifocal, Invisible Bifocal, Varilux), and coatings below appear automatically in the Frame Page Quick Cost Estimator and Ordering Wizard.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        const nextEnabled = siteConfig.quickEstimatorEnabled === false ? true : false;
                        const updatedConfig = { ...siteConfig, quickEstimatorEnabled: nextEnabled };
                        setSiteConfig(updatedConfig);
                        await fetch('/api/admin/site-config', {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                          },
                          body: JSON.stringify(updatedConfig),
                        });
                        setStatusMessage(
                          nextEnabled
                            ? 'Quick Cost Estimator enabled on storefront.'
                            : 'Quick Cost Estimator hidden on storefront.'
                        );
                        await onRefreshPublicCatalog();
                      }}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                        siteConfig.quickEstimatorEnabled !== false
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-slate-100 text-slate-600 border-slate-300'
                      }`}
                    >
                      {siteConfig.quickEstimatorEnabled !== false
                        ? '● Quick Cost Estimator: Enabled'
                        : '○ Quick Cost Estimator: Disabled'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Default Pre-Selected Lens in Quick Estimator
                    </label>
                    <select
                      value={siteConfig.quickEstimatorDefaultLensCode || 'single_vision'}
                      onChange={(e) =>
                        setSiteConfig({ ...siteConfig, quickEstimatorDefaultLensCode: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                    >
                      <option value="frames_only">Frame Only (+₦0)</option>
                      {lensTypes
                        .filter((lt) => lt.isActive)
                        .map((lt) => (
                          <option key={lt.code} value={lt.code}>
                            {lt.name} (+{formatNaira(lt.priceNgn)})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Estimator Banner Headline
                    </label>
                    <input
                      type="text"
                      value={
                        siteConfig.quickEstimatorHeadline ||
                        'Toggle Lens Types (Standard, Special Order & Varilux) to See Complete Price Before Entering the Wizard'
                      }
                      onChange={(e) =>
                        setSiteConfig({ ...siteConfig, quickEstimatorHeadline: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch('/api/admin/site-config', {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                          },
                          body: JSON.stringify(siteConfig),
                        });
                        setLensActionFeedback('Quick Cost Estimator settings saved and published live.');
                        setStatusMessage('Quick Cost Estimator settings saved.');
                        await onRefreshPublicCatalog();
                      }}
                      className="w-full py-2.5 px-4 bg-[#0B192C] hover:bg-[#162B49] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Save Estimator Preferences
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className={lensesSubTab === 'all' ? 'grid grid-cols-1 lg:grid-cols-3 gap-8' : 'space-y-4'}>
              {/* Left 2 Columns: Editable Lens Types (including Special Order Lenses) & Coatings */}
              {(lensesSubTab === 'lens_designs' || lensesSubTab === 'coatings' || lensesSubTab === 'all') && (
                <div className={lensesSubTab === 'all' ? 'lg:col-span-2 space-y-6' : 'space-y-6'}>
                  {(lensesSubTab === 'lens_designs' || lensesSubTab === 'all') && (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-4 rounded-xl border border-slate-200">
                        <div>
                          <h3 className="text-base font-semibold text-[#0B192C]">
                            Optical & Special Order Lens Designs ({lensTypes.length})
                          </h3>
                          <p className="text-xs text-slate-500">
                            Edit prices, names, tiers, or click &ldquo;Coating Prices Matrix&rdquo; on any lens to adjust per-lens coating rates.
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const next: Record<number, boolean> = {};
                              lensTypes.forEach((l) => {
                                next[l.id] = true;
                              });
                              setExpandedLensMatrixIds(next);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                          >
                            Expand All Matrices
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedLensMatrixIds({})}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                          >
                            Collapse Matrices
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {lensTypes.map((lt) => {
                          const isSpecialOrder =
                            lt.code.includes('special_order') ||
                            lt.name.toLowerCase().includes('special order');
                          const showMatrix = Boolean(expandedLensMatrixIds[lt.id]);

                          return (
                            <div
                              key={lt.id}
                              className={`rounded-xl border p-4 space-y-3 transition-all ${
                                isSpecialOrder
                                  ? 'bg-gradient-to-r from-[#FAF9F6] to-white border-[#C5A059]'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  {isSpecialOrder && (
                                    <span className="px-2 py-0.5 rounded bg-[#0B192C] text-[#C5A059] text-[10px] font-semibold uppercase tracking-wider">
                                      Special Order Lens
                                    </span>
                                  )}
                                  <span className="text-[11px] font-tabular text-slate-400">
                                    Code: {lt.code}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={lt.isActive}
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setLensTypes((prev) =>
                                          prev.map((item) =>
                                            item.id === lt.id ? { ...item, isActive: checked } : item
                                          )
                                        );
                                      }}
                                      className="w-3.5 h-3.5 accent-[#1E40AF]"
                                    />
                                    <span>Show in Quick Estimator & Wizard</span>
                                  </label>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                <div className="sm:col-span-5">
                                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                                    Lens Design Name
                                  </label>
                                  <input
                                    type="text"
                                    value={lt.name}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setLensTypes((prev) =>
                                        prev.map((item) =>
                                          item.id === lt.id ? { ...item, name: val } : item
                                        )
                                      );
                                    }}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#0B192C]"
                                  />
                                </div>

                                <div className="sm:col-span-4">
                                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                                    Quality / Lab Tier
                                  </label>
                                  <input
                                    type="text"
                                    value={lt.tier}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setLensTypes((prev) =>
                                        prev.map((item) =>
                                          item.id === lt.id ? { ...item, tier: val } : item
                                        )
                                      );
                                    }}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-[#1E40AF] font-medium"
                                  />
                                </div>

                                <div className="sm:col-span-3">
                                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                                    Price (₦ NGN)
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    step={500}
                                    value={lt.priceNgn}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      setLensTypes((prev) =>
                                        prev.map((item) =>
                                          item.id === lt.id ? { ...item, priceNgn: val } : item
                                        )
                                      );
                                    }}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-tabular font-semibold text-[#0B192C]"
                                  />
                                </div>
                              </div>

                              <div>
                                <input
                                  type="text"
                                  value={lt.description}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setLensTypes((prev) =>
                                      prev.map((item) =>
                                        item.id === lt.id ? { ...item, description: val } : item
                                      )
                                    );
                                  }}
                                  placeholder="Clinical Description"
                                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-600"
                                />
                              </div>

                              {/* Per-Lens Corresponding Optional Coating / Index Prices in Quick Cost Estimator (Collapsible) */}
                              {showMatrix && (
                                <div className="rounded-xl bg-[#FAF9F6] border border-slate-200/90 p-3.5 space-y-2.5">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1E40AF] block">
                                        Wizard Step 4 (Coatings & Index Page) & Quick Cost Estimator — Corresponding Prices for {lt.name}
                                      </span>
                                      <span className="text-[11px] text-slate-500">
                                        When "{lt.name}" is detected or selected, these corresponding coating & index option prices are displayed and charged:
                                      </span>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                                    {lensCoatings
                                      .filter((lc) => lc.isActive)
                                      .map((lc) => {
                                        const resolvedPrice = resolveCoatingPriceForLens(
                                          lt.code,
                                          lc.code,
                                          lc.priceNgn,
                                          siteConfig
                                        );

                                        return (
                                          <div
                                            key={lc.code}
                                            className="bg-white rounded-lg border border-slate-200 p-2.5 space-y-1"
                                          >
                                            <label className="block text-[10px] font-semibold text-[#0B192C] truncate" title={lc.name}>
                                              {formatShortCoatingLabel(lc.name)}
                                            </label>
                                            <div className="flex items-center gap-1">
                                              <span className="text-[11px] text-slate-400 font-semibold">+₦</span>
                                              <input
                                                type="number"
                                                min={0}
                                                step={500}
                                                value={resolvedPrice}
                                                onChange={(e) => {
                                                  const nextVal = Math.max(0, Number(e.target.value));
                                                  const prevMatrix = siteConfig.lensCoatingPriceMatrix || {};
                                                  const prevLensRow = prevMatrix[lt.code] || {};
                                                  setSiteConfig({
                                                    ...siteConfig,
                                                    lensCoatingPriceMatrix: {
                                                      ...prevMatrix,
                                                      [lt.code]: {
                                                        ...prevLensRow,
                                                        [lc.code]: nextVal,
                                                      },
                                                    },
                                                  });
                                                }}
                                                className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-tabular font-semibold text-[#1E40AF]"
                                              />
                                            </div>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              )}

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-tabular font-semibold text-[#0B192C]">
                                    Current Lens Price: {formatNaira(lt.priceNgn)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedLensMatrixIds((prev) => ({
                                        ...prev,
                                        [lt.id]: !prev[lt.id],
                                      }))
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#1E40AF] text-xs font-semibold cursor-pointer"
                                  >
                                    {showMatrix ? 'Hide Coating Prices Matrix ▲' : 'Coating Prices Matrix ▼'}
                                  </button>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={savingLensId === lt.id}
                                    onClick={async () => {
                                      setSavingLensId(lt.id);
                                      try {
                                        const [res] = await Promise.all([
                                          fetch(`/api/admin/lens-types/${lt.id}`, {
                                            method: 'PUT',
                                            headers: {
                                              'Content-Type': 'application/json',
                                              ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                                            },
                                            body: JSON.stringify({
                                              name: lt.name,
                                              tier: lt.tier,
                                              priceNgn: Number(lt.priceNgn),
                                              description: lt.description,
                                              isActive: Boolean(lt.isActive),
                                            }),
                                          }),
                                          fetch('/api/admin/site-config', {
                                            method: 'PUT',
                                            headers: {
                                              'Content-Type': 'application/json',
                                              ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                                            },
                                            body: JSON.stringify(siteConfig),
                                          }),
                                        ]);
                                        if (res.ok) {
                                          setLensActionFeedback(
                                            `Updated "${lt.name}" (${formatNaira(lt.priceNgn)}) and its corresponding Coating / Index rates in Quick Cost Estimator.`
                                          );
                                          setStatusMessage(
                                            `Saved ${lt.name} (${formatNaira(lt.priceNgn)}) & corresponding coating prices.`
                                          );
                                          await fetchAdminData();
                                          await onRefreshPublicCatalog();
                                        }
                                      } finally {
                                        setSavingLensId(null);
                                      }
                                    }}
                                    className="px-4 py-1.5 bg-[#0B192C] hover:bg-[#162B49] disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                                  >
                                    <Check className="w-3.5 h-3.5 text-[#C5A059]" />
                                    <span>
                                      {savingLensId === lt.id
                                        ? 'Saving...'
                                        : 'Save Lens & Corresponding Coating Prices'}
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await fetch(`/api/admin/lens-types/${lt.id}`, {
                                        method: 'DELETE',
                                        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
                                      });
                                      setLensActionFeedback(`Removed lens option "${lt.name}".`);
                                      await fetchAdminData();
                                      await onRefreshPublicCatalog();
                                    }}
                                    className="p-1.5 border border-slate-200 rounded-lg text-slate-400 hover:text-red-600 hover:border-red-200 transition-colors cursor-pointer"
                                    title="Delete Lens Option"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Editable Coatings & High-Index Options */}
                  {(lensesSubTab === 'coatings' || lensesSubTab === 'all') && (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-4 rounded-xl border border-slate-200">
                        <div>
                          <h3 className="text-base font-semibold text-[#0B192C]">
                            Coatings & High-Index Options in Quick Cost Estimator ({lensCoatings.length})
                          </h3>
                          <p className="text-xs text-slate-500">
                            Control prices and visibility for Blue Cut, Photochromic, Crizal AR, and High-Index (1.56 / 1.61 / 1.67) upgrades.
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const next: Record<number, boolean> = {};
                              lensCoatings.forEach((c) => {
                                next[c.id] = true;
                              });
                              setExpandedCoatingMatrixIds(next);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                          >
                            Expand All Matrices
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedCoatingMatrixIds({})}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                          >
                            Collapse Matrices
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {lensCoatings.map((lc) => {
                          const showCoatingMatrix = Boolean(expandedCoatingMatrixIds[lc.id]);
                          return (
                            <div
                              key={lc.id}
                              className="bg-white rounded-xl border border-slate-200 p-4 space-y-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[11px] font-tabular text-slate-400">
                                  Code: {lc.code} · Group: {lc.groupType}
                                </span>
                                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={lc.isActive}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setLensCoatings((prev) =>
                                        prev.map((item) =>
                                          item.id === lc.id ? { ...item, isActive: checked } : item
                                        )
                                      );
                                    }}
                                    className="w-3.5 h-3.5 accent-[#1E40AF]"
                                  />
                                  <span>Active in Quick Cost Estimator</span>
                                </label>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                <div className="sm:col-span-8">
                                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                                    Coating / Material Name
                                  </label>
                                  <input
                                    type="text"
                                    value={lc.name}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setLensCoatings((prev) =>
                                        prev.map((item) =>
                                          item.id === lc.id ? { ...item, name: val } : item
                                        )
                                      );
                                    }}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#0B192C]"
                                  />
                                </div>

                                <div className="sm:col-span-4">
                                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                                    Add-On Price (₦ NGN)
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    step={500}
                                    value={lc.priceNgn}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      setLensCoatings((prev) =>
                                        prev.map((item) =>
                                          item.id === lc.id ? { ...item, priceNgn: val } : item
                                        )
                                      );
                                    }}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-tabular font-semibold text-[#0B192C]"
                                  />
                                </div>
                              </div>

                              <div>
                                <input
                                  type="text"
                                  value={lc.description}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setLensCoatings((prev) =>
                                      prev.map((item) =>
                                        item.id === lc.id ? { ...item, description: val } : item
                                      )
                                    );
                                  }}
                                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-600"
                                />
                              </div>

                              {/* Per-Lens Option Prices for this Coating / High-Index Option (Collapsible) */}
                              {showCoatingMatrix && (
                                <div className="rounded-xl bg-[#FAF9F6] border border-slate-200/90 p-3.5 space-y-2.5">
                                  <div>
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1E40AF] block">
                                      Coatings & Index Page — Per-Lens Option Prices for {lc.name}
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                      Set distinct prices for "{lc.name}" when Single Vision, Fused Bifocal, Invisible Bifocal, Varilux, or Special Order lenses are detected or clicked:
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                    {lensTypes
                                      .filter((lt) => lt.isActive)
                                      .map((lt) => {
                                        const resolvedPrice = resolveCoatingPriceForLens(
                                          lt.code,
                                          lc.code,
                                          lc.priceNgn,
                                          siteConfig
                                        );
                                        return (
                                          <div
                                            key={lt.code}
                                            className="bg-white rounded-lg border border-slate-200 p-2.5 space-y-1"
                                          >
                                            <label
                                              className="block text-[10px] font-semibold text-[#0B192C] truncate"
                                              title={lt.name}
                                            >
                                              {lt.name}
                                            </label>
                                            <div className="flex items-center gap-1">
                                              <span className="text-[11px] text-slate-400 font-semibold">+₦</span>
                                              <input
                                                type="number"
                                                min={0}
                                                step={500}
                                                value={resolvedPrice}
                                                onChange={(e) => {
                                                  const nextVal = Math.max(0, Number(e.target.value));
                                                  const prevMatrix = siteConfig.lensCoatingPriceMatrix || {};
                                                  const prevLensRow = prevMatrix[lt.code] || {};
                                                  setSiteConfig({
                                                    ...siteConfig,
                                                    lensCoatingPriceMatrix: {
                                                      ...prevMatrix,
                                                      [lt.code]: {
                                                        ...prevLensRow,
                                                        [lc.code]: nextVal,
                                                      },
                                                    },
                                                  });
                                                }}
                                                className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-tabular font-semibold text-[#1E40AF]"
                                              />
                                            </div>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              )}

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-tabular font-semibold text-[#1E40AF]">
                                    Base Rate: {lc.priceNgn === 0 ? 'Included (+₦0)' : `+${formatNaira(lc.priceNgn)}`}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedCoatingMatrixIds((prev) => ({
                                        ...prev,
                                        [lc.id]: !prev[lc.id],
                                      }))
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#1E40AF] text-xs font-semibold cursor-pointer"
                                  >
                                    {showCoatingMatrix ? 'Hide Per-Lens Matrix ▲' : 'Per-Lens Prices Matrix ▼'}
                                  </button>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={savingCoatingId === lc.id}
                                    onClick={async () => {
                                      setSavingCoatingId(lc.id);
                                      try {
                                        const [res] = await Promise.all([
                                          fetch(`/api/admin/lens-coatings/${lc.id}`, {
                                            method: 'PUT',
                                            headers: {
                                              'Content-Type': 'application/json',
                                              ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                                            },
                                            body: JSON.stringify({
                                              name: lc.name,
                                              priceNgn: Number(lc.priceNgn),
                                              description: lc.description,
                                              isActive: Boolean(lc.isActive),
                                            }),
                                          }),
                                          fetch('/api/admin/site-config', {
                                            method: 'PUT',
                                            headers: {
                                              'Content-Type': 'application/json',
                                              ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                                            },
                                            body: JSON.stringify(siteConfig),
                                          }),
                                        ]);
                                        if (res.ok) {
                                          setLensActionFeedback(
                                            `Updated "${lc.name}" and its per-lens Coating & Index prices across all lens types.`
                                          );
                                          setStatusMessage(`Saved ${lc.name} & per-lens prices.`);
                                          await fetchAdminData();
                                          await onRefreshPublicCatalog();
                                        }
                                      } finally {
                                        setSavingCoatingId(null);
                                      }
                                    }}
                                    className="px-4 py-1.5 bg-[#0B192C] hover:bg-[#162B49] disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                                  >
                                    <Check className="w-3.5 h-3.5 text-[#C5A059]" />
                                    <span>{savingCoatingId === lc.id ? 'Saving...' : 'Save Coating & Per-Lens Prices'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await fetch(`/api/admin/lens-coatings/${lc.id}`, {
                                        method: 'DELETE',
                                        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
                                      });
                                      setLensActionFeedback(`Removed coating "${lc.name}".`);
                                      await fetchAdminData();
                                      await onRefreshPublicCatalog();
                                    }}
                                    className="p-1.5 border border-slate-200 rounded-lg text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                                    title="Delete Coating Option"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Right Column: Add New Lens / Special Order Lens & Add New Coating */}
              {(lensesSubTab === 'add_new' || lensesSubTab === 'all') && (
                <div className={lensesSubTab === 'add_new' ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'space-y-6'}>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await fetch('/api/admin/lens-types', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                        },
                        body: JSON.stringify({
                          ...newLens,
                          code: `lens_${Date.now().toString().slice(-5)}`,
                          optionsJson: JSON.stringify(['Standard Focus', 'Custom Corridor']),
                          isActive: true,
                        }),
                      });
                      setNewLens({
                        code: `lens_${Date.now().toString().slice(-4)}`,
                        name: '',
                        category: 'special_order_varilux',
                        tier: 'Special Order Lab',
                        priceNgn: 95000,
                        description: '',
                      });
                      setLensActionFeedback('New lens design added to Quick Cost Estimator & Wizard.');
                      setStatusMessage('New lens design saved.');
                      await fetchAdminData();
                      await onRefreshPublicCatalog();
                    }}
                    className="bg-white rounded-xl border border-slate-200 p-6 space-y-3 h-fit"
                  >
                    <h3 className="text-base font-semibold text-[#0B192C] flex items-center gap-2">
                      <Plus className="w-4 h-4 text-[#1E40AF]" />
                      <span>Add New Lens / Special Order Option</span>
                    </h3>
                    <input
                      type="text"
                      required
                      placeholder="Lens Name (e.g. Special Order Varilux Lens)"
                      value={newLens.name}
                      onChange={(e) => setNewLens({ ...newLens, name: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                    />
                    <select
                      value={newLens.category}
                      onChange={(e) => setNewLens({ ...newLens, category: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                    >
                      <option value="single_vision">Single Vision</option>
                      <option value="bifocal">Bifocal Lens</option>
                      <option value="invisible_bifocal">Invisible Bifocal Lens</option>
                      <option value="progressive_varilux">Progressive / Varilux</option>
                      <option value="special_order_bifocal">Special Order Bifocal Lens</option>
                      <option value="special_order_invisible_bifocal">Special Order Invisible Bifocal Lens</option>
                      <option value="special_order_varilux">Special Order Varilux Lens</option>
                      <option value="non_prescription">Non-Prescription (0.00 Plano)</option>
                    </select>
                    <input
                      type="text"
                      required
                      placeholder="Quality Tier (e.g. Special Order Lab)"
                      value={newLens.tier}
                      onChange={(e) => setNewLens({ ...newLens, tier: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                    />
                    <input
                      type="number"
                      required
                      placeholder="Price in NGN"
                      value={newLens.priceNgn}
                      onChange={(e) => setNewLens({ ...newLens, priceNgn: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-tabular"
                    />
                    <textarea
                      rows={3}
                      required
                      placeholder="Clinical lens description..."
                      value={newLens.description}
                      onChange={(e) => setNewLens({ ...newLens, description: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-[#0B192C] hover:bg-[#162B49] text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Add Lens to Estimator & Wizard
                    </button>
                  </form>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await fetch('/api/admin/lens-coatings', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                        },
                        body: JSON.stringify({
                          ...newCoating,
                          code: `coat_${Date.now().toString().slice(-5)}`,
                          compatibleWithJson: JSON.stringify(['all']),
                          isActive: true,
                        }),
                      });
                      setNewCoating({
                        code: `coat_${Date.now().toString().slice(-4)}`,
                        name: '',
                        groupType: 'tint_treatment',
                        priceNgn: 25000,
                        description: '',
                      });
                      setLensActionFeedback('New coating/material added to Quick Cost Estimator.');
                      await fetchAdminData();
                      await onRefreshPublicCatalog();
                    }}
                    className="bg-white rounded-xl border border-slate-200 p-6 space-y-3 h-fit"
                  >
                    <h3 className="text-base font-semibold text-[#0B192C] flex items-center gap-2">
                      <Plus className="w-4 h-4 text-[#1E40AF]" />
                      <span>Add New Coating / High-Index Option</span>
                    </h3>
                    <input
                      type="text"
                      required
                      placeholder="Coating Name (e.g. 1.74 Ultra-High Index)"
                      value={newCoating.name}
                      onChange={(e) => setNewCoating({ ...newCoating, name: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                    />
                    <select
                      value={newCoating.groupType}
                      onChange={(e) => setNewCoating({ ...newCoating, groupType: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                    >
                      <option value="tint_treatment">Colour & Light Treatment</option>
                      <option value="index_material">High-Index Material</option>
                      <option value="addon_feature">Surface Shield Add-On</option>
                    </select>
                    <input
                      type="number"
                      required
                      placeholder="Add-on Price in NGN"
                      value={newCoating.priceNgn}
                      onChange={(e) => setNewCoating({ ...newCoating, priceNgn: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-tabular"
                    />
                    <textarea
                      rows={2}
                      required
                      placeholder="Coating description..."
                      value={newCoating.description}
                      onChange={(e) => setNewCoating({ ...newCoating, description: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-[#0B192C] hover:bg-[#162B49] text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Add Coating to Estimator
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. CUSTOMERS & SUPPORT ENQUIRIES (ORGANIZED SUB-TABS, SEARCH & PAGINATION) */}
        {section === 'customers' && (() => {
          const filteredCusts = customers.filter((c) => {
            const q = customerSearch.toLowerCase();
            return (
              !q ||
              (c.fullName || '').toLowerCase().includes(q) ||
              (c.email || '').toLowerCase().includes(q)
            );
          });
          const filteredEnqs = enquiries.filter((enq) => {
            const q = customerSearch.toLowerCase();
            return (
              !q ||
              (enq.customerName || '').toLowerCase().includes(q) ||
              (enq.customerEmail || '').toLowerCase().includes(q) ||
              (enq.subject || '').toLowerCase().includes(q)
            );
          });
          const custPerPage = 10;
          const totalCustPages = Math.max(1, Math.ceil(filteredCusts.length / custPerPage));
          const safeCustPage = Math.min(customerPage, totalCustPages);
          const paginatedCusts = filteredCusts.slice(
            (safeCustPage - 1) * custPerPage,
            safeCustPage * custPerPage
          );

          return (
            <div className="space-y-4">
              {/* Compact Sub-Navigation Bar for Customers & Email */}
              <div className="bg-white rounded-xl border border-slate-200 p-2 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    {
                      id: 'directory_enquiries' as const,
                      label: `1. Customers (${customers.length}) & Support Enquiries (${enquiries.length})`,
                    },
                    {
                      id: 'email_composer' as const,
                      label: '2. Direct Client Email Composer',
                    },
                    {
                      id: 'smtp_settings' as const,
                      label: '3. Outbound Gmail / SMTP Settings',
                    },
                    {
                      id: 'all' as const,
                      label: 'Show All Together',
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setCustomersSubTab(tab.id);
                        if (tab.id === 'smtp_settings') {
                          setShowSmtpSettings(true);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        customersSubTab === tab.id
                          ? 'bg-[#1E40AF] text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Direct Admin-to-Client Email Composer & Gmail / SMTP Dispatcher */}
              {(customersSubTab === 'email_composer' ||
                customersSubTab === 'smtp_settings' ||
                customersSubTab === 'all') && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-widest text-[#1E40AF] flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        <span>Direct Client Email & Gmail Inbox Delivery</span>
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-[#0B192C] mt-0.5">
                        Send Email to Client’s Registered Gmail / Email Account & Portal Inbox
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Every email sent here is delivered to the client’s registered email address (Gmail, Yahoo, Outlook, etc.) and synchronized into their Vision Care Account Inbox.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSmtpSettings((prev) => !prev)}
                      className="px-3.5 py-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-[#0B192C] shrink-0 cursor-pointer"
                    >
                      {showSmtpSettings || customersSubTab === 'smtp_settings'
                        ? 'Hide Outbound Gmail/SMTP Settings'
                        : 'Configure Outbound Gmail / SMTP'}
                    </button>
                  </div>

                  {(showSmtpSettings || customersSubTab === 'smtp_settings') && (
                    <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[#0B192C]">
                            Automated Gmail / SMTP Server Credentials
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Enter your Gmail address and 16-character Google App Password (or custom SMTP) and click <strong>Save Outbound Email Settings</strong> so the server automatically delivers emails straight into clients’ Gmail/email inboxes.
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider self-start sm:self-auto shrink-0 ${
                            siteConfig.smtpUser && siteConfig.smtpPass
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {siteConfig.smtpUser && siteConfig.smtpPass
                            ? `Configured (${siteConfig.smtpUser})`
                            : 'Awaiting Credentials'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            SMTP Host
                          </label>
                          <input
                            type="text"
                            value={siteConfig.smtpHost ?? 'smtp.gmail.com'}
                            onChange={(e) => {
                              setSiteConfig({ ...siteConfig, smtpHost: e.target.value });
                              setSmtpSaveFeedback(null);
                            }}
                            placeholder="smtp.gmail.com"
                            className="w-full border border-slate-300 focus:border-[#1E40AF] focus:outline-none rounded-lg px-2.5 py-2 text-xs bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            SMTP Port
                          </label>
                          <input
                            type="number"
                            value={siteConfig.smtpPort ?? 465}
                            onChange={(e) => {
                              setSiteConfig({ ...siteConfig, smtpPort: Number(e.target.value) });
                              setSmtpSaveFeedback(null);
                            }}
                            placeholder="465"
                            className="w-full border border-slate-300 focus:border-[#1E40AF] focus:outline-none rounded-lg px-2.5 py-2 text-xs bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Sender Gmail / Email Address
                          </label>
                          <input
                            type="email"
                            value={siteConfig.smtpUser ?? ''}
                            onChange={(e) => {
                              setSiteConfig({
                                ...siteConfig,
                                smtpUser: e.target.value,
                                smtpFromEmail: e.target.value,
                              });
                              setSmtpSaveFeedback(null);
                            }}
                            placeholder="ezehaustine1@gmail.com"
                            className="w-full border border-slate-300 focus:border-[#1E40AF] focus:outline-none rounded-lg px-2.5 py-2 text-xs bg-white"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-semibold text-slate-700">
                              Gmail App Password / SMTP Key
                            </label>
                            <button
                              type="button"
                              onClick={() => setShowSmtpPassword((prev) => !prev)}
                              className="text-[10px] font-semibold text-[#1E40AF] hover:underline cursor-pointer"
                            >
                              {showSmtpPassword ? 'Hide' : 'Show'}
                            </button>
                          </div>
                          <input
                            type={showSmtpPassword ? 'text' : 'password'}
                            value={siteConfig.smtpPass ?? ''}
                            onChange={(e) => {
                              setSiteConfig({ ...siteConfig, smtpPass: e.target.value });
                              setSmtpSaveFeedback(null);
                            }}
                            placeholder="16-char Gmail App Password"
                            className="w-full border border-slate-300 focus:border-[#1E40AF] focus:outline-none rounded-lg px-2.5 py-2 text-xs bg-white font-mono"
                          />
                        </div>
                      </div>

                      {smtpSaveFeedback && (
                        <div
                          className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2 ${
                            smtpSaveFeedback.type === 'success'
                              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                              : 'bg-red-50 border border-red-200 text-red-800'
                          }`}
                        >
                          <span>{smtpSaveFeedback.text}</span>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2.5 pt-1">
                        <button
                          type="button"
                          disabled={isSavingSmtp || isTestingSmtp}
                          onClick={async () => {
                            setIsTestingSmtp(true);
                            setSmtpSaveFeedback(null);
                            try {
                              const normalizedPass = String(siteConfig.smtpPass || '').replace(/\s+/g, '');
                              const payloadConfig = {
                                ...siteConfig,
                                smtpHost: (siteConfig.smtpHost || 'smtp.gmail.com').trim(),
                                smtpPort: Number(siteConfig.smtpPort || 465),
                                smtpUser: (siteConfig.smtpUser || '').trim(),
                                smtpPass: normalizedPass,
                                smtpFromEmail: (siteConfig.smtpUser || siteConfig.supportEmail || '').trim(),
                              };
                              setSiteConfig(payloadConfig);
                              const res = await fetch('/api/admin/test-smtp', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                                },
                                body: JSON.stringify({
                                  smtpConfig: payloadConfig,
                                  testRecipientEmail: payloadConfig.smtpUser || user.email,
                                }),
                              });
                              const data = await res.json();
                              if (!res.ok) {
                                throw new Error(data.error || 'Could not test outbound email settings');
                              }
                              await onRefreshPublicCatalog();
                              if (data.emailResult?.deliveredViaSmtp) {
                                setSmtpSaveFeedback({
                                  type: 'success',
                                  text: `Saved & Verified! A live test email was delivered via ${payloadConfig.smtpHost}:${payloadConfig.smtpPort} to ${data.toEmail}.`,
                                });
                              } else {
                                setSmtpSaveFeedback({
                                  type: 'success',
                                  text: `Settings saved! Test message logged to Account Inbox (${data.toEmail}). ${
                                    data.emailResult?.errorNote
                                      ? `Note from SMTP server: ${data.emailResult.errorNote}`
                                      : 'Add a valid 16-character Google App Password to enable live background SMTP delivery.'
                                  }`,
                                });
                              }
                              setStatusMessage('Outbound Gmail / SMTP settings saved and tested.');
                            } catch (err: any) {
                              setSmtpSaveFeedback({
                                type: 'error',
                                text: err.message || 'Failed to test outbound email settings.',
                              });
                            } finally {
                              setIsTestingSmtp(false);
                            }
                          }}
                          className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-[#0B192C] text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isTestingSmtp ? 'Saving & Sending Test Email...' : 'Save & Send Test Email'}
                        </button>

                        <button
                          type="button"
                          disabled={isSavingSmtp || isTestingSmtp}
                          onClick={async () => {
                            setIsSavingSmtp(true);
                            setSmtpSaveFeedback(null);
                            try {
                              const normalizedPass = String(siteConfig.smtpPass || '').replace(/\s+/g, '');
                              const payloadConfig = {
                                ...siteConfig,
                                smtpHost: (siteConfig.smtpHost || 'smtp.gmail.com').trim(),
                                smtpPort: Number(siteConfig.smtpPort || 465),
                                smtpUser: (siteConfig.smtpUser || '').trim(),
                                smtpPass: normalizedPass,
                                smtpFromEmail: (siteConfig.smtpUser || siteConfig.supportEmail || '').trim(),
                              };
                              setSiteConfig(payloadConfig);
                              const res = await fetch('/api/admin/site-config', {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                  ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                                },
                                body: JSON.stringify(payloadConfig),
                              });
                              const data = await res.json();
                              if (!res.ok) {
                                throw new Error(data.error || 'Failed to save outbound email settings.');
                              }
                              setSiteConfig((prev) => ({ ...prev, ...data }));
                              await onRefreshPublicCatalog();
                              setSmtpSaveFeedback({
                                type: 'success',
                                text: payloadConfig.smtpUser
                                  ? `Outbound Gmail / SMTP settings saved successfully for ${payloadConfig.smtpUser} (${payloadConfig.smtpHost}:${payloadConfig.smtpPort}).`
                                  : 'Outbound Gmail / SMTP settings saved successfully.',
                              });
                              setStatusMessage('Outbound Gmail / SMTP settings saved.');
                            } catch (err: any) {
                              setSmtpSaveFeedback({
                                type: 'error',
                                text: err.message || 'Could not save outbound email settings.',
                              });
                            } finally {
                              setIsSavingSmtp(false);
                            }
                          }}
                          className="w-full sm:w-auto px-5 py-2 bg-[#0B192C] hover:bg-[#162B49] disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          {isSavingSmtp ? 'Saving Outbound Settings...' : 'Save Outbound Email Settings'}
                        </button>
                      </div>
                    </div>
                  )}

                  {(customersSubTab === 'email_composer' || customersSubTab === 'all') && (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!clientEmailTo.trim() || !clientEmailBody.trim()) return;
                        setIsSendingClientEmail(true);
                        setClientEmailFeedback(null);
                        try {
                          const res = await fetch('/api/admin/send-email', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                            },
                            body: JSON.stringify({
                              userUid: clientEmailUid,
                              toEmail: clientEmailTo.trim(),
                              toName: clientEmailName.trim(),
                              subject: clientEmailSubject.trim(),
                              message: clientEmailBody.trim(),
                            }),
                          });
                          const data = await res.json();
                          if (!res.ok) {
                            throw new Error(data.error || 'Could not send email');
                          }
                          const gUrl =
                            data.emailResult?.gmailComposeUrl ||
                            buildAdminGmailUrl(clientEmailTo, clientEmailSubject, clientEmailBody);
                          const mUrl =
                            data.emailResult?.mailtoUrl ||
                            buildAdminMailtoUrl(clientEmailTo, clientEmailSubject, clientEmailBody);
                          setLastGmailComposeUrl(gUrl);
                          setLastMailtoUrl(mUrl);
                          const smtpStatus = data.emailResult?.deliveredViaSmtp
                            ? `Delivered via SMTP directly to ${clientEmailTo.trim()} and synced to Client Account Inbox.`
                            : `Delivered to ${clientEmailTo.trim()}'s Vision Care Account Inbox. Click "Deliver to Client's Gmail Inbox" below to also send directly from your Gmail!`;
                          setClientEmailFeedback(smtpStatus);
                          setStatusMessage(`Email dispatched to ${clientEmailTo.trim()}.`);
                          setClientEmailBody('');
                        } catch (err: any) {
                          setClientEmailFeedback(err.message || 'Failed to send email.');
                        } finally {
                          setIsSendingClientEmail(false);
                        }
                      }}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Select Registered Client (or enter email)
                          </label>
                          <select
                            value={clientEmailTo}
                            onChange={(e) => {
                              const chosenEmail = e.target.value;
                              setClientEmailTo(chosenEmail);
                              const matched = customers.find(
                                (c) => (c.email || '').toLowerCase() === chosenEmail.toLowerCase()
                              );
                              if (matched) {
                                setClientEmailName(matched.fullName || '');
                                setClientEmailUid(matched.uid || '');
                              }
                            }}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                          >
                            <option value="">-- Choose Registered Customer --</option>
                            {customers.map((c) => (
                              <option key={c.id} value={c.email}>
                                {c.fullName || 'Client'} ({c.email})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Recipient Email Address (Gmail / Any Email) *
                          </label>
                          <input
                            type="email"
                            required
                            value={clientEmailTo}
                            onChange={(e) => setClientEmailTo(e.target.value)}
                            placeholder="client@gmail.com"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Client Name
                          </label>
                          <input
                            type="text"
                            value={clientEmailName}
                            onChange={(e) => setClientEmailName(e.target.value)}
                            placeholder="Client Full Name"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Email Subject *
                        </label>
                        <input
                          type="text"
                          required
                          value={clientEmailSubject}
                          onChange={(e) => setClientEmailSubject(e.target.value)}
                          placeholder="Official Update from Vision Care Optical Atelier"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                        />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                          <label className="block text-xs font-semibold text-slate-700">
                            Email Message Body *
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              {
                                label: 'Order & Lab Ready',
                                subj: 'Your Vision Care Eyewear Order is Ready for Dispatch',
                                body: 'Hello,\n\nYour custom eyewear has passed final ultrasonic cleaning and 7-point optical verification at our laboratory. Our courier is preparing your package for delivery.\n\nWarm regards,\nVision Care Optical Atelier',
                              },
                              {
                                label: 'Prescription Verified',
                                subj: 'Clinical Prescription Verified by Chief Optometrist',
                                body: 'Hello,\n\nOur Chief Optometrist has reviewed and verified your optical prescription parameters. Digital freeform lens surfacing has now commenced.\n\nWarm regards,\nVision Care Clinical Team',
                              },
                              {
                                label: 'Appointment Follow-Up',
                                subj: 'Clinical Eye Appointment & Drug Prescription Update',
                                body: 'Hello,\n\nYour clinical eye assessment and prescription records have been updated by the Doctor. Please sign in to your Vision Care Account to view your clinical details.\n\nWarm regards,\nVision Care Eye Clinic',
                              },
                            ].map((tpl) => (
                              <button
                                key={tpl.label}
                                type="button"
                                onClick={() => {
                                  setClientEmailSubject(tpl.subj);
                                  setClientEmailBody(tpl.body);
                                }}
                                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-medium text-slate-700 cursor-pointer"
                              >
                                + {tpl.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <textarea
                          rows={4}
                          required
                          value={clientEmailBody}
                          onChange={(e) => setClientEmailBody(e.target.value)}
                          placeholder="Write your official message to the client's registered email and account inbox..."
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                        />
                      </div>

                      {clientEmailFeedback && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <span>{clientEmailFeedback}</span>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {lastGmailComposeUrl && (
                              <a
                                href={lastGmailComposeUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 rounded-lg bg-[#1E40AF] hover:bg-[#1e3a8a] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                <span>Deliver to Client’s Gmail Inbox →</span>
                              </a>
                            )}
                            {lastMailtoUrl && (
                              <a
                                href={lastMailtoUrl}
                                className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-100 text-xs font-semibold"
                              >
                                Open Mail App
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="submit"
                          disabled={isSendingClientEmail || !clientEmailTo.trim() || !clientEmailBody.trim()}
                          className="px-5 py-2.5 bg-[#0B192C] hover:bg-[#162B49] disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-2 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5 text-[#C5A059]" />
                          <span>
                            {isSendingClientEmail
                              ? 'Dispatching Email...'
                              : 'Send Email to Client Account & Email Inbox'}
                          </span>
                        </button>

                        {clientEmailTo.trim() && (
                          <a
                            href={buildAdminGmailUrl(
                              clientEmailTo,
                              clientEmailSubject,
                              clientEmailBody || `Hello ${clientEmailName || 'Client'},\n\n`
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2.5 bg-[#E0F2FE] hover:bg-sky-200 text-[#0B192C] border border-[#1E40AF]/25 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5"
                          >
                            <Mail className="w-3.5 h-3.5 text-[#1E40AF]" />
                            <span>Compose in Gmail Web</span>
                          </a>
                        )}
                      </div>
                    </form>
                  )}
                </div>
              )}

              {(customersSubTab === 'directory_enquiries' || customersSubTab === 'all') && (
                <div className="space-y-4">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          setCustomerPage(1);
                        }}
                        placeholder="Search customers or enquiries by name, email, or subject..."
                        className="w-full pl-9 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-[#0B192C]">
                          Registered Customers ({filteredCusts.length})
                        </h3>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {paginatedCusts.map((c) => (
                          <div
                            key={c.id}
                            className="py-2.5 text-xs flex flex-wrap items-center justify-between gap-2"
                          >
                            <div>
                              <span className="font-semibold text-[#0B192C]">{c.fullName || 'Client'}</span>
                              <span className="text-slate-500 block">{c.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setClientEmailTo(c.email);
                                  setClientEmailName(c.fullName || '');
                                  setClientEmailUid(c.uid || '');
                                  setCustomersSubTab('email_composer');
                                }}
                                className="px-2.5 py-1 rounded bg-[#E0F2FE] hover:bg-sky-200 text-[#0B192C] font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                              >
                                <Mail className="w-3 h-3 text-[#1E40AF]" />
                                <span>Email Client</span>
                              </button>
                              <span className="uppercase font-medium text-[#1E40AF]">{c.role}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {filteredCusts.length > custPerPage && (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-tabular">
                            Page {safeCustPage} of {totalCustPages}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={safeCustPage <= 1}
                              onClick={() => setCustomerPage((p) => Math.max(1, p - 1))}
                              className="px-2.5 py-1 rounded border border-slate-300 disabled:opacity-40 cursor-pointer"
                            >
                              ← Prev
                            </button>
                            <button
                              type="button"
                              disabled={safeCustPage >= totalCustPages}
                              onClick={() => setCustomerPage((p) => Math.min(totalCustPages, p + 1))}
                              className="px-2.5 py-1 rounded border border-slate-300 disabled:opacity-40 cursor-pointer"
                            >
                              Next →
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                      <h3 className="text-base font-semibold text-[#0B192C]">
                        Customer Support Enquiries ({filteredEnqs.length})
                      </h3>
                      <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                        {filteredEnqs.map((enq) => (
                          <div key={enq.id} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                            <div className="flex justify-between">
                              <strong>
                                {enq.customerName} ({enq.customerEmail})
                              </strong>
                              <span className="uppercase text-[#1E40AF]">{enq.status}</span>
                            </div>
                            <p className="font-medium text-[#0B192C]">{enq.subject}</p>
                            <p className="text-slate-600">{enq.message}</p>
                            <div className="flex flex-wrap gap-2 pt-1.5">
                              <input
                                type="text"
                                placeholder="Write official concierge response..."
                                value={replyTextMap[enq.id] || ''}
                                onChange={(e) => setReplyTextMap({ ...replyTextMap, [enq.id]: e.target.value })}
                                className="flex-1 min-w-[180px] border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!idToken || !replyTextMap[enq.id]) return;
                                  await fetch(`/api/admin/enquiries/${enq.id}/reply`, {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      Authorization: `Bearer ${idToken}`,
                                    },
                                    body: JSON.stringify({ adminReply: replyTextMap[enq.id] }),
                                  });
                                  setStatusMessage(`Reply sent to ${enq.customerEmail} (Account & Email).`);
                                  fetchAdminData();
                                }}
                                className="px-3 py-1.5 bg-[#0B192C] text-white rounded text-xs font-semibold cursor-pointer"
                              >
                                Reply & Email
                              </button>
                              {enq.customerEmail && (
                                <a
                                  href={buildAdminGmailUrl(
                                    enq.customerEmail,
                                    `Re: ${enq.subject} — Vision Care Optical Concierge`,
                                    replyTextMap[enq.id] || enq.adminReply || `Hello ${enq.customerName},\n\nRegarding your enquiry ("${enq.subject}"):\n\n`
                                  )}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-[#1E40AF] rounded text-xs font-semibold inline-flex items-center gap-1"
                                  title={`Open Gmail to email ${enq.customerEmail}`}
                                >
                                  <Mail className="w-3 h-3" />
                                  <span>Gmail</span>
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* 7. STOREFRONT CONTENT MANAGEMENT (ORGANIZED SUB-TABS WITH INSTANT SAVE) */}
        {section === 'cms' && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setIsSavingCms(true);
              setCmsSaveFeedback(null);
              try {
                const headers: Record<string, string> = {
                  'Content-Type': 'application/json',
                };
                if (idToken) {
                  headers.Authorization = `Bearer ${idToken}`;
                }
                const res = await fetch('/api/admin/site-config', {
                  method: 'PUT',
                  headers,
                  body: JSON.stringify(siteConfig),
                });
                const data = await res.json();
                if (!res.ok) {
                  throw new Error(data.error || 'Failed to save storefront settings.');
                }
                setSiteConfig((prev) => ({ ...prev, ...data }));
                setStatusMessage('Storefront settings saved and published live.');
                setCmsSaveFeedback({
                  type: 'success',
                  text: 'Storefront settings saved to database and updated live across the website.',
                });
                await onRefreshPublicCatalog();
              } catch (err: any) {
                setCmsSaveFeedback({
                  type: 'error',
                  text: err.message || 'Could not save storefront settings. Please try again.',
                });
              } finally {
                setIsSavingCms(false);
              }
            }}
            className="w-full max-w-5xl bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-5 shadow-xs"
          >
            <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[#0B192C]">
                  Storefront Banners, Headlines, Media Vault, About Me &amp; Bank Details
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select any CMS tab below to edit without scrolling, or click &ldquo;Save Storefront Settings&rdquo; at any time.
                </p>
              </div>
              <button
                type="submit"
                disabled={isSavingCms}
                className="px-4 py-2 bg-[#0B192C] hover:bg-[#162B49] disabled:opacity-60 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>{isSavingCms ? 'Saving...' : 'Save Storefront Settings'}</span>
              </button>
            </div>

            {/* Compact CMS Sub-Navigation Bar */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-1.5 flex flex-wrap items-center gap-1.5">
              {[
                { id: 'headlines_banner' as const, label: '1. Headlines, Promo Banner & Contact' },
                { id: 'hero_vault' as const, label: '2. Hero Video & Picture Vault' },
                { id: 'about_me' as const, label: '3. About Me (Doctor Profile)' },
                { id: 'bank_contact' as const, label: '4. Payment Gateways & Bank Account' },
                { id: 'cpanel_env' as const, label: '5. Environment Variables (.env & cPanel MySQL)' },
                { id: 'all' as const, label: 'Show All CMS Fields' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCmsSubTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    cmsSubTab === tab.id
                      ? 'bg-[#1E40AF] text-white'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {cmsSaveFeedback && (
              <div
                className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                  cmsSaveFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {cmsSaveFeedback.type === 'success' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                <span>{cmsSaveFeedback.text}</span>
              </div>
            )}

            {(cmsSubTab === 'headlines_banner' || cmsSubTab === 'all') && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Hero Headline</label>
                    <input
                      type="text"
                      required
                      value={siteConfig.heroHeadline || ''}
                      onChange={(e) => setSiteConfig({ ...siteConfig, heroHeadline: e.target.value })}
                      placeholder="See Clearly. Look Beautiful. Live Confidently."
                      className="w-full border border-slate-300 focus:border-[#1E40AF] focus:outline-none rounded-lg px-3.5 py-2.5 text-xs sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Hero Supporting Text
                    </label>
                    <textarea
                      rows={2}
                      value={siteConfig.heroSubheadline || ''}
                      onChange={(e) => setSiteConfig({ ...siteConfig, heroSubheadline: e.target.value })}
                      placeholder="Discover premium eyewear, personalised prescription lenses..."
                      className="w-full border border-slate-300 focus:border-[#1E40AF] focus:outline-none rounded-lg px-3.5 py-2.5 text-xs sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Promotional Top Banner
                    </label>
                    <input
                      type="text"
                      required
                      value={siteConfig.promoBannerText || ''}
                      onChange={(e) => setSiteConfig({ ...siteConfig, promoBannerText: e.target.value })}
                      placeholder="Complimentary Nationwide Express Delivery on orders above ₦120,000..."
                      className="w-full border border-slate-300 focus:border-[#1E40AF] focus:outline-none rounded-lg px-3.5 py-2.5 text-xs sm:text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">WhatsApp Support</label>
                    <input
                      type="text"
                      value={siteConfig.whatsappNumber || ''}
                      onChange={(e) => setSiteConfig({ ...siteConfig, whatsappNumber: e.target.value })}
                      placeholder="+2348098008474"
                      className="w-full border border-slate-300 focus:border-[#1E40AF] focus:outline-none rounded-lg px-3.5 py-2.5 text-xs sm:text-sm font-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Customer Support Email
                    </label>
                    <input
                      type="email"
                      value={siteConfig.supportEmail || ''}
                      onChange={(e) => setSiteConfig({ ...siteConfig, supportEmail: e.target.value })}
                      placeholder="concierge@visioncare.ng"
                      className="w-full border border-slate-300 focus:border-[#1E40AF] focus:outline-none rounded-lg px-3.5 py-2.5 text-xs sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Showroom & Clinic Address
                  </label>
                  <input
                    type="text"
                    value={siteConfig.showroomAddress || ''}
                    onChange={(e) => setSiteConfig({ ...siteConfig, showroomAddress: e.target.value })}
                    placeholder="Victoria Island, Lagos & Maitama, Abuja"
                    className="w-full border border-slate-300 focus:border-[#1E40AF] focus:outline-none rounded-lg px-3.5 py-2.5 text-xs sm:text-sm"
                  />
                </div>
              </div>
            )}

            {/* HERO PICTURE & REPEATING VIDEO STUDIO (ADMIN CONTROLLABLE) */}
            {(cmsSubTab === 'hero_vault' || cmsSubTab === 'all') && (() => {
              const heroLibrary = getHeroMediaLibrary();
              const activeHeroId =
                siteConfig.heroActiveMediaId ||
                heroLibrary.find((i) => i.isActive)?.id ||
                heroLibrary[0]?.id;

              return (
                <div className="p-5 rounded-2xl bg-[#FAF9F6] border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-[#1E40AF]">
                        Homepage Hero Media Vault
                      </span>
                      <h4 className="text-base font-semibold text-[#0B192C] mt-0.5">
                        Hero Picture & Repeating Video Manager
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Upload videos (played automatically in continuous repeating loop) and pictures in an easy-to-access media library. Click any item to make it the active Homepage Hero.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <label className="px-4 py-2.5 bg-[#0B192C] hover:bg-[#162B49] text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer shadow-2xs">
                        <Upload className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>
                          {isUploadingHeroMedia
                            ? 'Uploading Media...'
                            : 'Upload Video(s) / Picture(s)'}
                        </span>
                        <input
                          type="file"
                          accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime"
                          multiple
                          onChange={handleUploadHeroFiles}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Add by Direct URL or Caption Configuration */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end bg-white p-3.5 rounded-xl border border-slate-200">
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Or Add Hero Picture / Video (.mp4, .webm, .jpg, .png) by URL
                      </label>
                      <input
                        type="text"
                        value={heroUrlInput}
                        onChange={(e) => setHeroUrlInput(e.target.value)}
                        placeholder="https://... or /src/assets/..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Media Label / Title
                      </label>
                      <input
                        type="text"
                        value={heroTitleInput}
                        onChange={(e) => setHeroTitleInput(e.target.value)}
                        placeholder="e.g. Atelier Runway Video Loop"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <button
                        type="button"
                        onClick={handleAddHeroByUrl}
                        className="w-full py-2 px-3 bg-[#1E40AF] hover:bg-blue-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        + Add to Hero Vault
                      </button>
                    </div>
                  </div>

                  {/* Hero Caption & Display Mode */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Hero Media Overlay Caption
                      </label>
                      <input
                        type="text"
                        value={
                          siteConfig.heroCaption ||
                          'Featured Frame: Mayfair Round Italian Acetate with Sapphire Blue-Cut Anti-Reflective Lenses'
                        }
                        onChange={(e) =>
                          setSiteConfig({ ...siteConfig, heroCaption: e.target.value })
                        }
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Hero Display Mode
                      </label>
                      <select
                        value={siteConfig.heroDisplayMode || 'playlist'}
                        onChange={(e) =>
                          setSiteConfig({ ...siteConfig, heroDisplayMode: e.target.value })
                        }
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white font-medium"
                      >
                        <option value="playlist">All Active Videos & Pictures (Easy Switcher)</option>
                        <option value="single">Single Selected Primary Hero Only</option>
                      </select>
                    </div>
                  </div>

                  {/* Easy-to-Access Visual Grid of Uploaded Hero Videos & Pictures */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                    {heroLibrary.map((item) => {
                      const isPrimary = item.id === activeHeroId;
                      const isVid =
                        item.type === 'video' ||
                        String(item.url || '').startsWith('data:video/') ||
                        /\.(mp4|webm|ogg|mov)(\?|$)/i.test(String(item.url || ''));

                      return (
                        <div
                          key={item.id}
                          className={`rounded-xl border overflow-hidden bg-white flex flex-col justify-between transition-all ${
                            isPrimary
                              ? 'border-[#1E40AF] ring-2 ring-[#1E40AF]/30 shadow-xs'
                              : 'border-slate-200'
                          }`}
                        >
                          <div>
                            <div className="aspect-video bg-[#0B192C] relative overflow-hidden">
                              {isVid ? (
                                <video
                                  src={item.url}
                                  autoPlay
                                  loop
                                  muted
                                  playsInline
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <img
                                  src={item.url}
                                  alt={item.title}
                                  className="w-full h-full object-cover"
                                />
                              )}
                              <div className="absolute top-2 left-2 flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded bg-[#0B192C]/85 text-white text-[10px] font-semibold flex items-center gap-1">
                                  {isVid ? (
                                    <>
                                      <Video className="w-3 h-3 text-[#C5A059]" />
                                      <span>Repeating Video</span>
                                    </>
                                  ) : (
                                    <>
                                      <ImageIcon className="w-3 h-3 text-[#C5A059]" />
                                      <span>Picture</span>
                                    </>
                                  )}
                                </span>
                                {isPrimary && (
                                  <span className="px-2 py-0.5 rounded bg-[#C5A059] text-[#0B192C] text-[10px] font-bold uppercase">
                                    Primary Hero
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="p-3 space-y-1">
                              <input
                                type="text"
                                value={item.title || ''}
                                onChange={(e) => {
                                  const updated = heroLibrary.map((m) =>
                                    m.id === item.id ? { ...m, title: e.target.value } : m
                                  );
                                  setSiteConfig({ ...siteConfig, heroMediaItems: updated });
                                }}
                                className="w-full text-xs font-semibold text-[#0B192C] border-b border-transparent focus:border-slate-300 focus:outline-none pb-0.5"
                              />
                              <span className="block text-[10px] text-slate-400">
                                {item.isActive !== false ? 'Visible in Hero' : 'Hidden from Hero'}
                              </span>
                            </div>
                          </div>

                          <div className="p-3 pt-0 flex items-center justify-between gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                saveUpdatedHeroMediaConfig(
                                  heroLibrary.map((m) =>
                                    m.id === item.id ? { ...m, isActive: true } : m
                                  ),
                                  item.id,
                                  `"${item.title}" is now set as the active Homepage Hero.`
                                )
                              }
                              className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                                isPrimary
                                  ? 'bg-[#1E40AF] text-white'
                                  : 'bg-slate-100 hover:bg-[#0B192C] text-[#0B192C] hover:text-white'
                              }`}
                            >
                              {isPrimary ? '✓ Active Hero' : 'Set as Hero'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const updated = heroLibrary.map((m) =>
                                  m.id === item.id ? { ...m, isActive: m.isActive === false } : m
                                );
                                saveUpdatedHeroMediaConfig(
                                  updated,
                                  activeHeroId,
                                  `Updated visibility for "${item.title}".`
                                );
                              }}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase border cursor-pointer ${
                                item.isActive !== false
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                            >
                              {item.isActive !== false ? 'ON' : 'OFF'}
                            </button>

                            {heroLibrary.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const remaining = heroLibrary.filter((m) => m.id !== item.id);
                                  const nextPrimary =
                                    activeHeroId === item.id ? remaining[0]?.id : activeHeroId;
                                  saveUpdatedHeroMediaConfig(
                                    remaining,
                                    nextPrimary,
                                    `Removed "${item.title}" from Hero Vault.`
                                  );
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                                title="Delete media item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* HOMEPAGE BOTTOM 'ABOUT ME' — DOCTOR PICTURE & PROFESSIONAL BIOGRAPHY EDITOR */}
            {(cmsSubTab === 'about_me' || cmsSubTab === 'all') && (
              <div className="p-5 rounded-2xl bg-[#FAF9F6] border border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-[#1E40AF]">
                      Homepage Bottom &ldquo;About Me&rdquo; Profile
                    </span>
                    <h4 className="text-base font-semibold text-[#0B192C] mt-0.5">
                      About Me — My Picture, Profession &amp; Clinical Biography
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Update your professional portrait picture, title, credentials, and biography displayed when clients click &ldquo;About Me&rdquo; at the bottom of the Home page.
                    </p>
                  </div>

                  <label className="px-4 py-2.5 bg-[#0B192C] hover:bg-[#162B49] text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer shrink-0 self-start sm:self-auto">
                    <Upload className="w-3.5 h-3.5 text-[#C5A059]" />
                    <span>
                      {isUploadingAboutPhoto ? 'Uploading Picture...' : 'Upload My Picture'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsUploadingAboutPhoto(true);
                        try {
                          const dataUrl = await new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(String(reader.result || ''));
                            reader.onerror = () => reject(new Error('Failed to read image'));
                            reader.readAsDataURL(file);
                          });
                          const nextConfig = { ...siteConfig, aboutMePhoto: dataUrl };
                          setSiteConfig(nextConfig);
                          await fetch('/api/admin/site-config', {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                            },
                            body: JSON.stringify(nextConfig),
                          });
                          setStatusMessage('Your "About Me" profile picture has been uploaded and published live.');
                          await onRefreshPublicCatalog();
                        } finally {
                          setIsUploadingAboutPhoto(false);
                          e.target.value = '';
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Portrait Preview & Direct URL Input */}
                  <div className="lg:col-span-4 space-y-2.5">
                    <div className="aspect-[4/5] max-h-64 w-full rounded-xl overflow-hidden border border-slate-300 bg-white">
                      <img
                        src={
                          siteConfig.aboutMePhoto ||
                          siteConfig.heroImage ||
                          '/src/assets/images/hero_vision_care_1793890597331.jpg'
                        }
                        alt={siteConfig.aboutMeName || 'Doctor Portrait'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Or Paste Picture URL
                      </label>
                      <input
                        type="text"
                        value={siteConfig.aboutMePhoto || ''}
                        onChange={(e) =>
                          setSiteConfig({ ...siteConfig, aboutMePhoto: e.target.value })
                        }
                        placeholder="https://... or upload above"
                        className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white"
                      />
                    </div>
                  </div>

                  {/* Biography & Profession Fields */}
                  <div className="lg:col-span-8 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Full Name &amp; Title Suffix
                        </label>
                        <input
                          type="text"
                          value={siteConfig.aboutMeName ?? 'Dr. Austine Ezeh, OD'}
                          onChange={(e) =>
                            setSiteConfig({ ...siteConfig, aboutMeName: e.target.value })
                          }
                          placeholder="Dr. Austine Ezeh, OD"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Profession / Clinical Role
                        </label>
                        <input
                          type="text"
                          value={
                            siteConfig.aboutMeTitle ??
                            'Chief Consultant Optometrist & Founder, VISION CARE Optical Atelier'
                          }
                          onChange={(e) =>
                            setSiteConfig({ ...siteConfig, aboutMeTitle: e.target.value })
                          }
                          placeholder="Chief Consultant Optometrist & Founder"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Qualifications &amp; Credentials
                        </label>
                        <input
                          type="text"
                          value={
                            siteConfig.aboutMeCredentials ??
                            'Doctor of Optometry (OD) · Ocular Therapeutics Specialist'
                          }
                          onChange={(e) =>
                            setSiteConfig({ ...siteConfig, aboutMeCredentials: e.target.value })
                          }
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Professional License No.
                        </label>
                        <input
                          type="text"
                          value={siteConfig.aboutMeLicense ?? 'ODORBN/NG/4829'}
                          onChange={(e) =>
                            setSiteConfig({ ...siteConfig, aboutMeLicense: e.target.value })
                          }
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-tabular bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Clinical Experience
                        </label>
                        <input
                          type="text"
                          value={
                            siteConfig.aboutMeExperienceYears ??
                            '12+ Years Clinical & Optical Dispensing Excellence'
                          }
                          onChange={(e) =>
                            setSiteConfig({ ...siteConfig, aboutMeExperienceYears: e.target.value })
                          }
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        About Me Headline
                      </label>
                      <input
                        type="text"
                        value={
                          siteConfig.aboutMeHeadline ??
                          'Dedicated to Clinical Precision, Ocular Health & Bespoke Eyewear Craftsmanship'
                        }
                        onChange={(e) =>
                          setSiteConfig({ ...siteConfig, aboutMeHeadline: e.target.value })
                        }
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Detailed Biography &amp; Professional Statement
                      </label>
                      <textarea
                        rows={4}
                        value={
                          siteConfig.aboutMeBio ??
                          'Welcome to VISION CARE. As an attending Doctor of Optometry and optical dispensing specialist, my mission is to unite comprehensive clinical eye care with world-class prescription eyewear. Every prescription submitted on our platform—whether Single Vision, Fused or Invisible Bifocal, or bespoke Varilux Progressive—undergoes rigorous optometric verification for pupillary centration, astigmatic axis accuracy, and all-day visual comfort.'
                        }
                        onChange={(e) =>
                          setSiteConfig({ ...siteConfig, aboutMeBio: e.target.value })
                        }
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white leading-relaxed"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Areas of Clinical &amp; Optical Specialization (Comma-Separated)
                      </label>
                      <input
                        type="text"
                        value={
                          siteConfig.aboutMeSpecialties ??
                          'Comprehensive Refraction & Binocular Vision, Bespoke Varilux Progressive & Special Order Lenses, Anterior Segment & Ocular Infection Therapeutics, Digital Eye Strain & Blue-Light Protection'
                        }
                        onChange={(e) =>
                          setSiteConfig({ ...siteConfig, aboutMeSpecialties: e.target.value })
                        }
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Checkout Payment Gateway Controls & Bank Account Details in Storefront CMS */}
            {(cmsSubTab === 'bank_contact' || cmsSubTab === 'all') && (
              <div className="space-y-4">
                <div className="pt-2 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-[#0B192C]">
                        Select Payment Gateway (₦ NGN) — Checkout Payment Options
                      </h4>
                      <p className="text-xs text-slate-500">
                        Turn any payment gateway option ON or OFF for customer checkout.
                      </p>
                    </div>
                    <span className="text-xs font-semibold font-tabular text-[#1E40AF]">
                      {
                        (['paystack', 'flutterwave', 'bank_transfer'] as const).filter((id) =>
                          isPaymentGatewayActive(id)
                        ).length
                      }{' '}
                      of 3 Active
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        id: 'paystack' as const,
                        label: 'Paystack',
                        sub: 'Card / USSD / Transfer',
                      },
                      {
                        id: 'flutterwave' as const,
                        label: 'Flutterwave',
                        sub: 'Barter / Card / Bank',
                      },
                      {
                        id: 'bank_transfer' as const,
                        label: 'Bank Transfer',
                        sub: 'Direct Corporate NGN',
                      },
                    ].map((gw) => {
                      const active = isPaymentGatewayActive(gw.id);
                      return (
                        <div
                          key={gw.id}
                          className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                            active
                              ? 'bg-[#E0F2FE]/30 border-[#1E40AF]'
                              : 'bg-slate-50 border-slate-200 opacity-80'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0B192C]">
                              {gw.id === 'bank_transfer' ? (
                                <Building2
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    active ? 'text-[#1E40AF]' : 'text-slate-400'
                                  }`}
                                />
                              ) : (
                                <CreditCard
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    active ? 'text-[#1E40AF]' : 'text-slate-400'
                                  }`}
                                />
                              )}
                              <span>{gw.label}</span>
                            </div>
                            <span className="block text-[10px] text-slate-500 mt-0.5">
                              {gw.sub}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleTogglePaymentGateway(gw.id, gw.label)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                              active
                                ? 'bg-[#0B192C] text-[#C5A059] hover:bg-[#162B49]'
                                : 'bg-white border border-slate-300 text-slate-500 hover:border-slate-400'
                            }`}
                          >
                            {active ? '● ON' : '○ OFF'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bank Name</label>
                    <input
                      type="text"
                      value={siteConfig.bankName || ''}
                      onChange={(e) => setSiteConfig({ ...siteConfig, bankName: e.target.value })}
                      placeholder="Zenith Bank PLC"
                      className="w-full border border-slate-300 focus:border-[#1E40AF] focus:outline-none rounded-lg px-3.5 py-2.5 text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Bank Account Name
                    </label>
                    <input
                      type="text"
                      value={siteConfig.bankAccountName || ''}
                      onChange={(e) => setSiteConfig({ ...siteConfig, bankAccountName: e.target.value })}
                      placeholder="VISION CARE OPTICAL ATELIER LTD"
                      className="w-full border border-slate-300 focus:border-[#1E40AF] focus:outline-none rounded-lg px-3.5 py-2.5 text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Bank Account Number
                    </label>
                    <input
                      type="text"
                      value={siteConfig.bankAccountNumber || ''}
                      onChange={(e) => setSiteConfig({ ...siteConfig, bankAccountNumber: e.target.value })}
                      placeholder="1018492031"
                      className="w-full border border-slate-300 focus:border-[#1E40AF] focus:outline-none rounded-lg px-3.5 py-2.5 text-xs sm:text-sm font-tabular"
                    />
                  </div>
                </div>
              </div>
            )}

            {(cmsSubTab === 'cpanel_env' || cmsSubTab === 'all') && (
              <div className="rounded-xl bg-[#FAF9F6] border border-slate-200 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-[#1E40AF]">
                      Environment Variables &amp; cPanel MySQL Configuration
                    </span>
                    <h4 className="text-base font-semibold text-[#0B192C] mt-0.5">
                      Input &amp; Save Your Environment Variables (Pre-Filled &amp; Ready to Use)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      All values are pre-filled so your app works immediately. You can edit any value below, click &ldquo;Save Storefront Settings&rdquo;, or download a ready-to-upload `.env` file for cPanel &amp; GitHub.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const envContent = [
                        `MYSQL_HOST="${siteConfig.envMysqlHost || 'localhost'}"`,
                        `MYSQL_PORT="${siteConfig.envMysqlPort || '3306'}"`,
                        `MYSQL_DATABASE="${siteConfig.envMysqlDatabase || 'visioncare_db'}"`,
                        `MYSQL_USER="${siteConfig.envMysqlUser || 'visioncare_admin'}"`,
                        `MYSQL_PASSWORD="${siteConfig.envMysqlPassword || 'VisionCare2026!'}"`,
                        `ADMIN_EMAIL="${siteConfig.envAdminEmail || 'ezehaustine1@gmail.com'}"`,
                        `APP_URL="${siteConfig.envAppUrl || window.location.origin}"`,
                        `SMTP_HOST="${siteConfig.smtpHost || 'smtp.gmail.com'}"`,
                        `SMTP_PORT="${siteConfig.smtpPort || '465'}"`,
                        `SMTP_USER="${siteConfig.smtpUser || 'ezehaustine1@gmail.com'}"`,
                        `SMTP_FROM="${siteConfig.smtpFrom || 'ezehaustine1@gmail.com'}"`,
                      ].join('\n');
                      const blob = new Blob([envContent], { type: 'text/plain;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = '.env';
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      setStatusMessage('Downloaded .env configuration file for cPanel / GitHub.');
                    }}
                    className="px-3.5 py-2 bg-[#1E40AF] hover:bg-blue-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download `.env` File</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      MYSQL_HOST (cPanel Database Host)
                    </label>
                    <input
                      type="text"
                      value={siteConfig.envMysqlHost ?? 'localhost'}
                      onChange={(e) => setSiteConfig({ ...siteConfig, envMysqlHost: e.target.value })}
                      placeholder="localhost"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white font-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      MYSQL_PORT (MySQL Port)
                    </label>
                    <input
                      type="text"
                      value={siteConfig.envMysqlPort ?? '3306'}
                      onChange={(e) => setSiteConfig({ ...siteConfig, envMysqlPort: e.target.value })}
                      placeholder="3306"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white font-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      MYSQL_DATABASE (Database Name)
                    </label>
                    <input
                      type="text"
                      value={siteConfig.envMysqlDatabase ?? 'visioncare_db'}
                      onChange={(e) => setSiteConfig({ ...siteConfig, envMysqlDatabase: e.target.value })}
                      placeholder="visioncare_db"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white font-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      MYSQL_USER (Database Username)
                    </label>
                    <input
                      type="text"
                      value={siteConfig.envMysqlUser ?? 'visioncare_admin'}
                      onChange={(e) => setSiteConfig({ ...siteConfig, envMysqlUser: e.target.value })}
                      placeholder="visioncare_admin"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white font-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      MYSQL_PASSWORD (Database Password)
                    </label>
                    <input
                      type="text"
                      value={siteConfig.envMysqlPassword ?? 'VisionCare2026!'}
                      onChange={(e) => setSiteConfig({ ...siteConfig, envMysqlPassword: e.target.value })}
                      placeholder="VisionCare2026!"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white font-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ADMIN_EMAIL (Chief Admin Email)
                    </label>
                    <input
                      type="email"
                      value={siteConfig.envAdminEmail ?? 'ezehaustine1@gmail.com'}
                      onChange={(e) => setSiteConfig({ ...siteConfig, envAdminEmail: e.target.value })}
                      placeholder="ezehaustine1@gmail.com"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white"
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      APP_URL (Website Domain / Application URL)
                    </label>
                    <input
                      type="text"
                      value={siteConfig.envAppUrl ?? window.location.origin}
                      onChange={(e) => setSiteConfig({ ...siteConfig, envAppUrl: e.target.value })}
                      placeholder="https://yourdomain.com"
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white font-tabular"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={isSavingCms}
                className="w-full sm:w-auto px-6 py-3 bg-[#0B192C] hover:bg-[#162B49] active:scale-[0.99] disabled:opacity-60 text-white text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4 text-[#C5A059]" />
                <span>{isSavingCms ? 'Saving Storefront Settings...' : 'Save Storefront Settings'}</span>
              </button>
            </div>
          </form>
        )}

        {/* DOCTOR EYE APPOINTMENTS & DRUG PRESCRIPTION CONSOLE */}
        {section === 'appointments' && (
          <DoctorAppointmentsAdminPanel
            appointments={appointments}
            siteConfig={siteConfig}
            onSaveSiteConfig={async (patch) => {
              const updated = { ...siteConfig, ...patch };
              setSiteConfig(updated);
              await fetch('/api/admin/site-config', {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
                },
                body: JSON.stringify(updated),
              });
              await onRefreshPublicCatalog();
            }}
            onRefresh={fetchAdminData}
            onStatusFeedback={(msg) => setStatusMessage(msg)}
          />
        )}
      </div>
    </div>
  );
};
