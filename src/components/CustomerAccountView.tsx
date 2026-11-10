import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  FileText,
  MapPin,
  Heart,
  Bell,
  MessageSquare,
  Download,
  LogOut,
  CheckCircle2,
  Clock,
  Trash2,
  Plus,
  User,
  Activity,
  Stethoscope,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Eye,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  UserProfile,
  OrderRecord,
  PrescriptionData,
  AddressRecord,
  Product,
  EnquiryRecord,
  ClinicalAppointmentRecord,
  LensType,
  LensCoating,
  CartItem,
} from '../types.ts';
import { OpticalImage, formatNaira } from './OpticalImage.tsx';
import { OrderTrackingTimeline, OPTICAL_ORDER_STAGES } from './OrderTrackingTimeline.tsx';
import { exportPrescriptionToPdf } from '../lib/prescriptionPdfExport.ts';
import { exportClientInvoiceToPdf } from '../lib/pdfDocumentExport.ts';
import { ClinicalAppointmentView } from './ClinicalAppointmentView.tsx';

interface CustomerAccountViewProps {
  user: UserProfile | null;
  orders: OrderRecord[];
  prescriptions: PrescriptionData[];
  addresses: AddressRecord[];
  wishlistProducts: Product[];
  products?: Product[];
  lensTypes?: LensType[];
  lensCoatings?: LensCoating[];
  notifications: Array<{ id: number; userUid?: string; title: string; message: string; isRead: boolean; createdAt: string }>;
  enquiries: EnquiryRecord[];
  appointments?: ClinicalAppointmentRecord[];
  siteConfig?: Record<string, any>;
  initialTrackedOrderId?: number | null;
  initialActiveTab?:
    | 'tracking'
    | 'orders'
    | 'appointments'
    | 'prescriptions'
    | 'wishlist'
    | 'addresses'
    | 'notifications'
    | 'support'
    | 'profile';
  onAppointmentCreated?: (created: ClinicalAppointmentRecord) => void;
  onAppointmentUpdated?: (updated: ClinicalAppointmentRecord) => void;
  onAddToCart?: (item: CartItem, openCheckoutAfter?: boolean) => void;
  onSavePrescriptionToAccount?: (rx: PrescriptionData) => Promise<void>;
  onEmailSessionSignIn?: (payload: {
    email: string;
    password?: string;
    fullName?: string;
    mode?: 'customer' | 'admin';
  }) => Promise<void>;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onUpdateProfile: (data: { fullName: string; phone: string }) => Promise<void>;
  onAddAddress: (data: any) => Promise<void>;
  onDeleteAddress: (id: number) => Promise<void>;
  onSendOrderEnquiry: (data: { orderNumber: string; subject: string; message: string }) => Promise<void>;
  onSelectProduct: (product: Product) => void;
  onRemoveWishlist: (productId: number) => void;
}

const ORDER_STAGES = OPTICAL_ORDER_STAGES.map((s) => s.label);
const CHART_COLORS = ['#0B192C', '#1E40AF', '#0D9488', '#D97706', '#6366F1', '#475569'];

export const CustomerAccountView: React.FC<CustomerAccountViewProps> = ({
  user,
  orders,
  prescriptions,
  addresses,
  wishlistProducts,
  products = [],
  lensTypes = [],
  lensCoatings = [],
  notifications,
  enquiries,
  appointments = [],
  siteConfig = {},
  initialTrackedOrderId = null,
  initialActiveTab = 'tracking',
  onAppointmentCreated = () => {},
  onAppointmentUpdated = () => {},
  onAddToCart,
  onSavePrescriptionToAccount,
  onEmailSessionSignIn,
  onSignIn,
  onSignOut,
  onUpdateProfile,
  onAddAddress,
  onDeleteAddress,
  onSendOrderEnquiry,
  onSelectProduct,
  onRemoveWishlist,
}) => {
  const [activeTab, setActiveTab] = useState<
    'tracking' | 'orders' | 'appointments' | 'prescriptions' | 'wishlist' | 'addresses' | 'notifications' | 'support' | 'profile'
  >(initialActiveTab);
  const [trackedOrderId, setTrackedOrderId] = useState<number | null>(
    initialTrackedOrderId || (orders.length > 0 ? orders[0].id : null)
  );
  const [selectedAnalyticsYear, setSelectedAnalyticsYear] = useState<number>(new Date().getFullYear());
  const [showAnalyticsPanel, setShowAnalyticsPanel] = useState<boolean>(true);
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [authFullName, setAuthFullName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPhone, setAuthPhone] = useState('+234 ');
  const [authPassword, setAuthPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    if (initialActiveTab) {
      setActiveTab(initialActiveTab);
    }
  }, [initialActiveTab]);

  useEffect(() => {
    if (initialTrackedOrderId) {
      setActiveTab('tracking');
      setTrackedOrderId(initialTrackedOrderId);
    } else if (!trackedOrderId && orders.length > 0) {
      setTrackedOrderId(orders[0].id);
    }
  }, [initialTrackedOrderId, orders]);

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '+234 ');
  const [profileSavedMsg, setProfileSavedMsg] = useState('');

  // New Address Form
  const [addrLabel, setAddrLabel] = useState('Home');
  const [addrRecipient, setAddrRecipient] = useState(user?.fullName || '');
  const [addrPhone, setAddrPhone] = useState('+234 ');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('Victoria Island');
  const [addrState, setAddrState] = useState('Lagos');

  // Order Enquiry Form
  const [enqOrderNum, setEnqOrderNum] = useState('');
  const [enqSubject, setEnqSubject] = useState('');
  const [enqMessage, setEnqMessage] = useState('');
  const [enqSuccess, setEnqSuccess] = useState('');

  // Compute Annual Optical Spending & Lens Usage Trends from user's orders & appointments
  const opticalAnalytics = useMemo(() => {
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyMap = monthLabels.map((month) => ({
      month,
      framesAndLensesNgn: 0,
      clinicalCareNgn: 0,
      totalNgn: 0,
      orderCount: 0,
    }));

    const availableYearsSet = new Set<number>([new Date().getFullYear()]);
    const lensCategoryCounts: Record<string, { name: string; count: number; spendNgn: number }> = {};

    let annualTotalSpendNgn = 0;
    let totalOpticalPairsCount = 0;

    orders.forEach((ord) => {
      const d = new Date(ord.createdAt);
      const yr = Number.isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
      availableYearsSet.add(yr);

      if (yr === selectedAnalyticsYear) {
        const mIdx = Number.isNaN(d.getMonth()) ? 0 : d.getMonth();
        const orderTotal = Number(ord.totalNgn || 0);
        monthlyMap[mIdx].framesAndLensesNgn += orderTotal;
        monthlyMap[mIdx].totalNgn += orderTotal;
        monthlyMap[mIdx].orderCount += 1;
        annualTotalSpendNgn += orderTotal;
      }

      (ord.items || []).forEach((item) => {
        const qty = Number(item.quantity || 1);
        totalOpticalPairsCount += qty;
        let categoryLabel = 'Single Vision Rx';
        if (item.orderType === 'frames_only') {
          categoryLabel = 'Frames Only';
        } else if (item.orderType === 'protective_glasses' || (item.lensTypeName || '').toLowerCase().includes('protective')) {
          categoryLabel = 'Protective & Screen (0.00)';
        } else if (item.lensTypeName) {
          categoryLabel = item.lensTypeName;
        }
        if (item.coatingSummary && item.coatingSummary !== 'Standard Uncoated') {
          const shortCoating = item.coatingSummary.split('+')[0].trim();
          if (shortCoating && !categoryLabel.includes(shortCoating)) {
            categoryLabel = `${categoryLabel} · ${shortCoating}`;
          }
        }
        if (!lensCategoryCounts[categoryLabel]) {
          lensCategoryCounts[categoryLabel] = { name: categoryLabel, count: 0, spendNgn: 0 };
        }
        lensCategoryCounts[categoryLabel].count += qty;
        lensCategoryCounts[categoryLabel].spendNgn += Number(item.unitTotalNgn || 0) * qty;
      });
    });

    appointments.forEach((appt) => {
      const d = new Date(appt.preferredDate || appt.createdAt);
      const yr = Number.isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
      availableYearsSet.add(yr);
      if (yr === selectedAnalyticsYear) {
        const mIdx = Number.isNaN(d.getMonth()) ? 0 : d.getMonth();
        const fee = Number((appt as any).totalClinicalFeeNgn || appt.consultationFeeNgn || 0);
        monthlyMap[mIdx].clinicalCareNgn += fee;
        monthlyMap[mIdx].totalNgn += fee;
        annualTotalSpendNgn += fee;
      }
    });

    const lensUsageData = Object.values(lensCategoryCounts).sort((a, b) => b.count - a.count);
    const availableYears = Array.from(availableYearsSet).sort((a, b) => b - a);

    return {
      monthlyData: monthlyMap,
      lensUsageData,
      annualTotalSpendNgn,
      totalOpticalPairsCount,
      availableYears,
    };
  }, [orders, appointments, selectedAnalyticsYear]);

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-6">
        <div className="bg-white border-2 border-[#1E40AF]/20 rounded-2xl p-6 sm:p-10 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-widest text-[#1E40AF]">
                Vision Care Patient Account &amp; Optical Vault
              </span>
              <h1 className="text-2xl sm:text-3xl font-semibold text-[#0B192C]">
                {authMode === 'register'
                  ? 'Create Your Patient Account'
                  : 'Log In to Your Patient Account'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
                Access your eye doctor appointments, confidential Drug Prescriptions (PDF), Doctor/Admin messages, 9-stage laboratory order tracking, saved optical prescriptions, and downloadable invoices.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-[#0B192C] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  authMode === 'login'
                    ? 'bg-[#0B192C] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Log In
              </button>
            </div>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!authEmail.trim()) return;
              setIsAuthenticating(true);
              try {
                if (onEmailSessionSignIn) {
                  await onEmailSessionSignIn({
                    email: authEmail.trim().toLowerCase(),
                    password: authPassword,
                    fullName: authFullName.trim() || authEmail.split('@')[0],
                    mode: 'customer',
                  });
                } else {
                  await onSignIn();
                }
              } finally {
                setIsAuthenticating(false);
              }
            }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs"
          >
            {authMode === 'register' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={authFullName}
                  onChange={(e) => setAuthFullName(e.target.value)}
                  placeholder="e.g. Chinedu Eze"
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5"
                />
              </div>
            )}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Registered Email Address *
              </label>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="patient@example.com"
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5"
              />
            </div>
            {authMode === 'register' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Phone / WhatsApp Number *
                </label>
                <input
                  type="text"
                  required
                  value={authPhone}
                  onChange={(e) => setAuthPhone(e.target.value)}
                  placeholder="+234 803 000 0000"
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 font-tabular"
                />
              </div>
            )}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Account Password *
              </label>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5"
              />
            </div>
            <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="submit"
                disabled={isAuthenticating}
                className="px-6 py-3 bg-[#0B192C] hover:bg-[#162B49] text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                {isAuthenticating
                  ? 'Opening Account...'
                  : authMode === 'register'
                  ? 'Create Patient Account & Continue →'
                  : 'Log In to My Patient Account →'}
              </button>
              <button
                type="button"
                onClick={onSignIn}
                className="text-xs font-semibold text-[#1E40AF] hover:underline cursor-pointer"
              >
                Open Quick Sign-In Modal →
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const handleDownloadInvoice = (order: OrderRecord) => {
    exportClientInvoiceToPdf(order);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#1E40AF]">
            Verified Patient Account · Email Verified
          </p>
          <h1 className="text-3xl font-semibold text-[#0B192C] mt-1">
            Welcome back, {user.fullName || user.email}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
        </div>
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setShowAnalyticsPanel((prev) => !prev)}
            className="px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-[#0B192C] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#1E40AF]" />
            <span>{showAnalyticsPanel ? 'Hide Visual Summary' : 'Show Visual Summary'}</span>
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-medium flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* VISUAL SUMMARY SECTION: Annual Optical Spending & Lens Usage Trends */}
      {showAnalyticsPanel && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#1E40AF]">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Personal Optical Telemetry & Spend Summary</span>
              </div>
              <h2 className="text-lg font-bold text-[#0B192C] mt-0.5">
                Annual Optical Spending & Lens Usage Trends
              </h2>
              <p className="text-xs text-slate-500">
                Real-time breakdown of your annual optical investments, clinical consultations, and prescribed or protective lens configurations.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs font-medium text-slate-500">Year:</span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {opticalAnalytics.availableYears.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setSelectedAnalyticsYear(yr)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                      selectedAnalyticsYear === yr
                        ? 'bg-[#0B192C] text-white'
                        : 'text-slate-600 hover:text-[#0B192C]'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {selectedAnalyticsYear} Optical Investment
              </p>
              <p className="text-xl font-bold text-[#0B192C] mt-1 font-mono">
                {formatNaira(opticalAnalytics.annualTotalSpendNgn)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Includes frames, coatings & clinical care
              </p>
            </div>
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Dispensed Eyewear Pairs
              </p>
              <p className="text-xl font-bold text-[#0B192C] mt-1 font-mono">
                {opticalAnalytics.totalOpticalPairsCount} {opticalAnalytics.totalOpticalPairsCount === 1 ? 'Pair' : 'Pairs'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Across {orders.length} laboratory {orders.length === 1 ? 'order' : 'orders'}
              </p>
            </div>
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Primary Lens Preference
              </p>
              <p className="text-sm font-bold text-[#1E40AF] mt-1.5 truncate">
                {opticalAnalytics.lensUsageData[0]?.name || 'No Lenses Ordered Yet'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {opticalAnalytics.lensUsageData[0]
                  ? `${opticalAnalytics.lensUsageData[0].count} pair(s) configured`
                  : 'Configure Rx or protective lenses'}
              </p>
            </div>
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Saved Prescriptions & Visits
              </p>
              <p className="text-xl font-bold text-[#0B192C] mt-1 font-mono">
                {prescriptions.length} Rx · {appointments.length} Visits
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Active clinical records in vault
              </p>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Annual Monthly Optical Spending BarChart */}
            <div className="lg:col-span-7 border border-slate-200 rounded-xl p-4 bg-white flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B192C] flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-[#1E40AF]" />
                    <span>Monthly Optical Spending ({selectedAnalyticsYear})</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Monthly expenditure across eyewear orders and clinical consultations (₦ NGN)
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#0B192C]" />
                    Eyewear & Lenses
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#1E40AF]" />
                    Clinical Care
                  </span>
                </div>
              </div>

              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={opticalAnalytics.monthlyData}
                    margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(val) => (val >= 1000 ? `₦${Math.round(val / 1000)}k` : `₦${val}`)}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                      width={52}
                    />
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        formatNaira(Number(value || 0)),
                        name === 'framesAndLensesNgn' ? 'Eyewear & Lenses' : 'Clinical Consultations',
                      ]}
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        borderColor: '#E2E8F0',
                        borderRadius: '10px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar
                      dataKey="framesAndLensesNgn"
                      stackId="spend"
                      fill="#0B192C"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="clinicalCareNgn"
                      stackId="spend"
                      fill="#1E40AF"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right: Lens Usage & Coating Trends PieChart + Breakdown */}
            <div className="lg:col-span-5 border border-slate-200 rounded-xl p-4 bg-white flex flex-col justify-between">
              <div className="mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0B192C] flex items-center gap-1.5">
                  <PieChartIcon className="w-4 h-4 text-[#1E40AF]" />
                  <span>Lens & Coating Usage Trends</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Distribution of your optical lens types and anti-reflective treatments
                </p>
              </div>

              {opticalAnalytics.lensUsageData.length === 0 ? (
                <div className="h-60 flex flex-col items-center justify-center text-center px-4 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                  <Eye className="w-7 h-7 text-slate-400 mb-2" />
                  <p className="text-xs font-semibold text-[#0B192C]">No Lens Usage Data Recorded Yet</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                    Once you order Single Vision, Bifocal, Progressive, or Protective Blue Cut Photo AR glasses, your lens usage distribution will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center my-auto">
                  <div className="sm:col-span-5 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={opticalAnalytics.lensUsageData}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={64}
                          paddingAngle={3}
                        >
                          {opticalAnalytics.lensUsageData.map((entry, idx) => (
                            <Cell key={entry.name} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any, _name: any, props: any) => [
                            `${value} pair(s) · ${formatNaira(props?.payload?.spendNgn || 0)}`,
                            props?.payload?.name || 'Lens Type',
                          ]}
                          contentStyle={{
                            backgroundColor: '#FFFFFF',
                            borderColor: '#E2E8F0',
                            borderRadius: '10px',
                            fontSize: '12px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="sm:col-span-7 space-y-2.5 max-h-48 overflow-y-auto pr-1">
                    {opticalAnalytics.lensUsageData.map((item, idx) => {
                      const pct =
                        opticalAnalytics.totalOpticalPairsCount > 0
                          ? Math.round((item.count / opticalAnalytics.totalOpticalPairsCount) * 100)
                          : 0;
                      return (
                        <div key={item.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-slate-700 truncate flex items-center gap-1.5">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                              />
                              <span className="truncate">{item.name}</span>
                            </span>
                            <span className="font-mono font-semibold text-[#0B192C] shrink-0 ml-2">
                              {item.count} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max(8, pct)}%`,
                                backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-6">
        {[
          { id: 'tracking', label: `Live Order Tracking (${orders.length})`, icon: Activity },
          { id: 'orders', label: `All Orders & Invoices (${orders.length})`, icon: Package },
          { id: 'appointments', label: `Eye Appointments & Drug Rx (${appointments.length})`, icon: Stethoscope },
          { id: 'prescriptions', label: `Saved Prescriptions (${prescriptions.length})`, icon: FileText },
          { id: 'wishlist', label: `Saved Frames (${wishlistProducts.length})`, icon: Heart },
          { id: 'addresses', label: `Addresses (${addresses.length})`, icon: MapPin },
          { id: 'notifications', label: `Notifications (${notifications.length})`, icon: Bell },
          { id: 'support', label: 'Order Enquiries & Support', icon: MessageSquare },
          { id: 'profile', label: 'Profile Settings', icon: User },
        ].map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              className={`px-3.5 sm:px-4 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                active
                  ? 'bg-[#0B192C] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB: DEDICATED INTERACTIVE ORDER TRACKING TIMELINE */}
      {activeTab === 'tracking' && (
        <OrderTrackingTimeline
          orders={orders}
          selectedOrderId={trackedOrderId}
          onSelectOrder={(id) => setTrackedOrderId(id)}
          onDownloadInvoice={handleDownloadInvoice}
          onEnquireOrder={(ord) => {
            setEnqOrderNum(ord.orderNumber);
            setEnqSubject(`Enquiry regarding Order ${ord.orderNumber}`);
            setActiveTab('support');
          }}
        />
      )}

      {/* TAB: ALL ORDERS & INVOICES */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {orders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <p className="text-base font-semibold text-[#0B192C]">No Orders Yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Once you place an order for frames, prescription glasses, or protective lenses, you can track all 9 optical laboratory stages here.
              </p>
            </div>
          ) : (
            orders.map((ord) => {
              const currentStageIndex = Math.max(
                0,
                ORDER_STAGES.findIndex((s) => s.toLowerCase() === ord.orderStatus.toLowerCase())
              );

              return (
                <div key={ord.id} className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-tabular">
                        <span className="font-semibold text-[#0B192C] text-sm">{ord.orderNumber}</span>
                        <span>·</span>
                        <span>{new Date(ord.createdAt).toLocaleDateString()}</span>
                        <span>·</span>
                        <span>Payment: {ord.paymentStatus}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Destination: {ord.deliveryAddress}, {ord.deliveryCity}, {ord.deliveryState}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-lg font-tabular font-semibold text-[#0B192C] mr-1">
                        {formatNaira(ord.totalNgn)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setTrackedOrderId(ord.id);
                          setActiveTab('tracking');
                        }}
                        className="px-3.5 py-2 bg-[#0B192C] text-white rounded-lg text-xs font-medium hover:bg-[#162B49] flex items-center gap-1.5"
                      >
                        <Activity className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>Interactive Timeline</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadInvoice(ord)}
                        className="px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-medium text-[#0B192C] hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Invoice (PDF)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEnqOrderNum(ord.orderNumber);
                          setEnqSubject(`Enquiry regarding Order ${ord.orderNumber}`);
                          setActiveTab('support');
                        }}
                        className="px-3.5 py-2 bg-[#E0F2FE] text-[#0B192C] rounded-lg text-xs font-medium hover:bg-sky-200"
                      >
                        Enquire on Order
                      </button>
                    </div>
                  </div>

                  {/* 9-Stage Optical Lab Pipeline */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#1E40AF] mb-3">
                      Live Optical Fulfillment Status: {ord.orderStatus}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2">
                      {ORDER_STAGES.map((stage, idx) => {
                        const completed = idx <= currentStageIndex;
                        return (
                          <div
                            key={stage}
                            className={`p-2.5 rounded-lg border text-[11px] flex flex-col justify-between ${
                              completed
                                ? 'bg-[#0B192C] text-white border-[#0B192C]'
                                : 'bg-slate-50 text-slate-400 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-tabular">0{idx + 1}</span>
                              {completed ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059]" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 opacity-50" />
                              )}
                            </div>
                            <span className="font-medium leading-tight">{stage}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="space-y-3 pt-2">
                    {ord.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-[#0B192C] text-sm">
                            {item.productName} ({item.selectedColor}) × {item.quantity}
                          </span>
                          <p className="text-slate-600 mt-0.5">
                            Lens: {item.lensTypeName} · Coatings: {item.coatingSummary}
                          </p>
                        </div>
                        <span className="font-tabular font-semibold text-[#0B192C]">
                          {formatNaira(item.unitTotalNgn * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB: SAVED PRESCRIPTIONS */}
      {activeTab === 'prescriptions' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {prescriptions.length === 0 ? (
            <div className="col-span-full bg-white border border-slate-200 rounded-xl p-10 text-center">
              <p className="text-base font-semibold text-[#0B192C]">No Saved Prescriptions Yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Prescriptions submitted or extracted via AI OCR in the Smart Ordering Wizard are automatically archived here.
              </p>
            </div>
          ) : (
            prescriptions.map((rx) => (
              <div key={rx.id} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-semibold text-[#0B192C]">{rx.patientName || user.fullName}</h3>
                    <p className="text-xs text-slate-500">
                      {rx.submissionType === 'upload_ocr' ? 'AI OCR Extracted' : 'Manual Entry'} · Date:{' '}
                      {rx.prescriptionDate || 'Recorded'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-medium text-[#1E40AF]">
                      Status: {rx.verificationStatus?.replace(/_/g, ' ') || 'Verified'}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        exportPrescriptionToPdf({
                          prescription: {
                            ...rx,
                            patientName: rx.patientName || user.fullName,
                            customerConfirmed: true,
                          },
                        })
                      }
                      className="px-3 py-1.5 bg-[#0B192C] hover:bg-[#162B49] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#C5A059]" />
                      <span>Export to PDF</span>
                    </button>
                  </div>
                </div>

                <div className="font-tabular text-xs space-y-1.5 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                  <div>
                    <strong>OD (Right):</strong> SPH {rx.odSph} | CYL {rx.odCyl} | AXIS {rx.odAxis}° | ADD {rx.odAdd}
                  </div>
                  <div>
                    <strong>OS (Left):</strong> SPH {rx.osSph} | CYL {rx.osCyl} | AXIS {rx.osAxis}° | ADD {rx.osAdd}
                  </div>
                  <div>
                    <strong>Binocular PD:</strong> {rx.pd} mm {rx.doctorName ? `· Dr: ${rx.doctorName}` : ''}
                  </div>
                </div>

                {rx.adminFeedback && (
                  <p className="text-xs text-[#1E40AF] bg-[#E0F2FE]/50 p-3 rounded-lg">
                    <strong>Optometrist Note:</strong> {rx.adminFeedback}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB: WISHLIST / SAVED FRAMES */}
      {activeTab === 'wishlist' && (
        <div className="space-y-5">
          {wishlistProducts.some((p) => p.discountPriceNgn && p.discountPriceNgn < p.priceNgn) && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-700 text-white shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block">
                    Real-Time Wishlist Price-Drop Alert Active
                  </span>
                  <p className="text-xs text-emerald-950 mt-0.5">
                    One or more frames in your Wishlist have active promotional price drops! Configure your lenses now to lock in your discounted price.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('notifications')}
                className="px-3.5 py-2 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-xs font-semibold hover:bg-emerald-100 shrink-0 cursor-pointer"
              >
                View Price-Drop Notifications
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {wishlistProducts.length === 0 ? (
              <div className="col-span-full bg-white border border-slate-200 rounded-xl p-10 text-center">
                <p className="text-base font-semibold text-[#0B192C]">No Saved Frames in Your Wishlist</p>
                <p className="text-xs text-slate-500 mt-1">
                  Click the heart icon on any eyewear frame to save it for comparison and receive real-time price-drop notifications.
                </p>
              </div>
            ) : (
              wishlistProducts.map((prod) => {
                let img = '';
                try {
                  img = JSON.parse(prod.imagesJson)[0];
                } catch {
                  img = '';
                }
                const hasPriceDrop = Boolean(
                  prod.discountPriceNgn && prod.discountPriceNgn > 0 && prod.discountPriceNgn < prod.priceNgn
                );
                const savingsNgn = hasPriceDrop ? prod.priceNgn - (prod.discountPriceNgn || 0) : 0;

                return (
                  <div
                    key={prod.id}
                    className={`bg-white border rounded-xl overflow-hidden flex flex-col justify-between ${
                      hasPriceDrop ? 'border-emerald-400 ring-1 ring-emerald-400/40' : 'border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="aspect-[4/3] bg-slate-100 relative">
                        <OpticalImage src={img} alt={prod.name} className="w-full h-full object-cover" />
                        {hasPriceDrop && (
                          <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider shadow-xs">
                            Price Drop · Save {formatNaira(savingsNgn)}
                          </span>
                        )}
                      </div>
                      <div className="p-4">
                        <p className="text-xs text-slate-500">{prod.brand}</p>
                        <h4 className="text-base font-semibold text-[#0B192C] mt-0.5">{prod.name}</h4>
                        <div className="mt-1 flex items-baseline gap-2 font-tabular">
                          <span className="text-sm font-semibold text-[#0B192C]">
                            {formatNaira(prod.discountPriceNgn || prod.priceNgn)}
                          </span>
                          {hasPriceDrop && (
                            <span className="text-xs text-slate-400 line-through">
                              {formatNaira(prod.priceNgn)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="p-4 pt-0 flex gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectProduct(prod)}
                        className="flex-1 py-2 bg-[#0B192C] text-white text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        Configure Lenses
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveWishlist(prod.id)}
                        className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB: SAVED ADDRESSES */}
      {activeTab === 'addresses' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {addresses.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
                No saved delivery addresses yet. Add your home or office address on the right.
              </div>
            ) : (
              addresses.map((a) => (
                <div
                  key={a.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between"
                >
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#1E40AF]">
                      {a.label}
                    </span>
                    <h4 className="text-sm font-semibold text-[#0B192C] mt-0.5">
                      {a.recipientName} · <span className="font-tabular">{a.phone}</span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      {a.streetAddress}, {a.city}, {a.state}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteAddress(a.id)}
                    className="p-2 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await onAddAddress({
                label: addrLabel,
                recipientName: addrRecipient || user.fullName,
                phone: addrPhone,
                streetAddress: addrStreet,
                city: addrCity,
                state: addrState,
                isDefault: true,
              });
              setAddrStreet('');
            }}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <h3 className="text-base font-semibold text-[#0B192C] flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#1E40AF]" />
              <span>Add Delivery Address</span>
            </h3>
            <input
              type="text"
              required
              value={addrLabel}
              onChange={(e) => setAddrLabel(e.target.value)}
              placeholder="Label (e.g. Victoria Island Office)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
            />
            <input
              type="text"
              required
              value={addrRecipient}
              onChange={(e) => setAddrRecipient(e.target.value)}
              placeholder="Recipient Full Name"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
            />
            <input
              type="text"
              required
              value={addrPhone}
              onChange={(e) => setAddrPhone(e.target.value)}
              placeholder="Phone (+234...)"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-tabular"
            />
            <input
              type="text"
              required
              value={addrStreet}
              onChange={(e) => setAddrStreet(e.target.value)}
              placeholder="Street Address"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                required
                value={addrCity}
                onChange={(e) => setAddrCity(e.target.value)}
                placeholder="City"
                className="border border-slate-300 rounded-lg px-3 py-2 text-xs"
              />
              <input
                type="text"
                required
                value={addrState}
                onChange={(e) => setAddrState(e.target.value)}
                placeholder="State"
                className="border border-slate-300 rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-[#0B192C] text-white text-xs font-semibold rounded-lg hover:bg-[#162B49]"
            >
              Save Address
            </button>
          </form>
        </div>
      )}

      {/* TAB: NOTIFICATIONS & REGISTERED EMAIL INBOX */}
      {activeTab === 'notifications' && (
        <div className="space-y-5">
          <div className="bg-[#0B192C] text-white border border-[#C5A059]/40 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#C5A059]">
                Synced Client Email Account &amp; Executive Portal Inbox
              </span>
              <h3 className="text-base font-bold text-white mt-1">
                Client Email Inbox: <span className="font-mono text-[#E0F2FE]">{user.email}</span>
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                All official order receipts, product photos, clinical lens prescription PDFs, laboratory stage alerts, and direct messages from the Admin are delivered to <strong>{user.email}</strong> (and any email entered at checkout) and archived below.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <a
                href="https://mail.google.com"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 rounded-lg bg-[#C5A059] hover:bg-[#b58e47] text-[#0B192C] text-xs font-bold transition-colors"
              >
                Open Gmail Inbox ↗
              </a>
            </div>
          </div>

          {notifications.filter((n) => {
            if (!user) return false;
            const cleanEmail = (user.email || '').trim().toLowerCase();
            const cleanUid = (user.uid || '').trim();
            const emailMatch = String(n.message || '').match(/\[Delivered to Email:\s*([^\]]+)\]/i);
            if (emailMatch && emailMatch[1]) {
              const tagEmail = emailMatch[1].trim().toLowerCase();
              if (cleanEmail && tagEmail !== cleanEmail) return false;
            }
            if (n.userUid) {
              const nUid = String(n.userUid).trim();
              if (cleanUid && nUid === cleanUid) return true;
              if (cleanEmail && nUid.toLowerCase() === `email:${cleanEmail}`) return true;
              return false;
            }
            return true;
          }).length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
              No emails or notifications yet. Messages sent by the Admin or Attending Doctor to {user.email} appear exclusively here in your private account.
            </div>
          ) : (
            notifications
              .filter((n) => {
                if (!user) return false;
                const cleanEmail = (user.email || '').trim().toLowerCase();
                const cleanUid = (user.uid || '').trim();
                const emailMatch = String(n.message || '').match(/\[Delivered to Email:\s*([^\]]+)\]/i);
                if (emailMatch && emailMatch[1]) {
                  const tagEmail = emailMatch[1].trim().toLowerCase();
                  if (cleanEmail && tagEmail !== cleanEmail) return false;
                }
                if (n.userUid) {
                  const nUid = String(n.userUid).trim();
                  if (cleanUid && nUid === cleanUid) return true;
                  if (cleanEmail && nUid.toLowerCase() === `email:${cleanEmail}`) return true;
                  return false;
                }
                return true;
              })
              .map((n) => {
              const isPriceDrop =
                n.title.toLowerCase().includes('price-drop') ||
                n.title.toLowerCase().includes('price drop') ||
                n.title.toLowerCase().includes('wishlist');

              const isAppointmentMsg =
                /VC-APT-|APT-/i.test(n.title) ||
                /VC-APT-|APT-/i.test(n.message) ||
                n.title.toLowerCase().includes('appointment') ||
                n.title.toLowerCase().includes('attending doctor') ||
                n.title.toLowerCase().includes('drug prescription');

              const orderMatchRegex = /VC-(?!APT-)\d{6}-\d{3}/i;
              const matchedOrderNumber = isAppointmentMsg
                ? ''
                : (n.title.match(orderMatchRegex) || n.message.match(orderMatchRegex) || [])[0] || '';
              const matchedOrder = matchedOrderNumber
                ? orders.find(
                    (o) => o.orderNumber.toLowerCase() === matchedOrderNumber.toLowerCase()
                  )
                : undefined;

              const deliveredEmailMatch = n.message.match(/\[Delivered to Email:\s*([^\]]+)\]/i);
              const recipientEmail = deliveredEmailMatch ? deliveredEmailMatch[1].trim() : user.email;

              const cleanBodyLines = n.message
                .replace(/\s*\[Delivered to Email:\s*[^\]]+\]/gi, '')
                .replace(/\s*\[PRESCRIPTION_SUMMARY:\s*[^\]]+\]/gi, '')
                .replace(/\s*\[ORDER_PRODUCT_IMAGES:\s*[^\]]+\]/gi, '')
                .split('\n')
                .filter(
                  (line) =>
                    !line.trim().startsWith('[Delivered to Email:') &&
                    !line.trim().startsWith('[Product Image(s):') &&
                    !line.trim().startsWith('[Attached PDF:') &&
                    !line.trim().startsWith('[Track Order Link:')
                )
                .join('\n')
                .trim();

              return (
                <div
                  key={n.id}
                  className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs"
                >
                  {/* Executive Email Envelope Header */}
                  <div className="bg-[#0B192C] text-white px-5 py-3.5 border-b-2 border-[#C5A059] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2 py-0.5 rounded bg-[#C5A059] text-[#0B192C] text-[10px] font-bold uppercase tracking-wider">
                        {isPriceDrop
                          ? 'Wishlist Price Drop'
                          : isAppointmentMsg
                          ? 'Eye Clinic & Doctor Message'
                          : matchedOrder
                          ? 'Official Order & Rx Dispatch'
                          : 'Vision Care Official Email'}
                      </span>
                      <span className="text-xs font-semibold text-slate-200">
                        {isAppointmentMsg
                          ? 'VISION CARE EYE CLINIC & ATTENDING DOCTOR DESK'
                          : 'VISION CARE OPTICAL ATELIER & CLINICAL DISPENSING LAB'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-300 font-tabular">
                      {new Date(n.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Email Metadata Bar (From / To / Subject / Reference) */}
                  <div className="px-5 py-3 bg-[#FAF9F6] border-b border-slate-200 text-xs grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    <div>
                      <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider mr-2">
                        From:
                      </span>
                      <span className="font-semibold text-[#0B192C]">
                        Vision Care Optical Atelier &lt;{siteConfig.supportEmail || 'concierge@visioncare.ng'}&gt;
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider mr-2">
                        To Client Email:
                      </span>
                      <span className="font-mono font-semibold text-[#1E40AF]">
                        {user.fullName} &lt;{recipientEmail}&gt;
                      </span>
                    </div>
                    <div className="md:col-span-2 pt-1">
                      <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider mr-2">
                        Subject:
                      </span>
                      <span className="text-sm font-bold text-[#0B192C]">{n.title}</span>
                    </div>
                  </div>

                  {/* Email Message Body */}
                  <div className="p-5 space-y-4">
                    <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                      {cleanBodyLines}
                    </div>

                    {/* Embedded Product Image(s) & Prescription Details if Order-Linked */}
                    {matchedOrder && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-[#FAF9F6]">
                        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0B192C]">
                            Ordered Product &amp; Optical Dispensing Specification ({matchedOrder.orderNumber})
                          </span>
                          <span className="text-xs font-bold text-emerald-700 font-tabular">
                            Total: {formatNaira(matchedOrder.totalNgn)} · {matchedOrder.orderStatus}
                          </span>
                        </div>
                        <div className="p-4 space-y-3">
                          {(matchedOrder.items || []).map((it, idx) => {
                            let rxObj: any = null;
                            try {
                              if (it.prescriptionSnapshotJson) {
                                rxObj = JSON.parse(it.prescriptionSnapshotJson);
                              }
                            } catch {
                              rxObj = null;
                            }
                            return (
                              <div
                                key={idx}
                                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-3.5 rounded-xl border border-slate-200"
                              >
                                <div className="flex items-center gap-3.5">
                                  <div className="w-20 h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                                    <OpticalImage
                                      src={it.productImage || '/src/assets/images/prod_1.jpg'}
                                      alt={it.productName}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E40AF]">
                                      {(it.orderType || 'prescription_glasses').replace(/_/g, ' ')}
                                    </span>
                                    <h5 className="text-sm font-bold text-[#0B192C]">{it.productName}</h5>
                                    <p className="text-xs text-slate-600">
                                      Lens: <strong>{it.lensOptionSelected || 'Standard'}</strong>
                                      {it.coatingSummary && it.coatingSummary !== 'None'
                                        ? ` · Coating: ${it.coatingSummary}`
                                        : ''}
                                    </p>
                                    {rxObj && (
                                      <p className="text-[11px] text-slate-500 font-tabular mt-0.5">
                                        OD: SPH {rxObj.odSph || '0.00'} / CYL {rxObj.odCyl || '0.00'} / AXIS{' '}
                                        {rxObj.odAxis || '0'} · OS: SPH {rxObj.osSph || '0.00'} / CYL{' '}
                                        {rxObj.osCyl || '0.00'} / AXIS {rxObj.osAxis || '0'} · PD:{' '}
                                        {rxObj.pd || '63'}mm
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right font-tabular shrink-0">
                                  <div className="text-sm font-bold text-[#0B192C]">
                                    {formatNaira(it.unitTotalNgn)}
                                  </div>
                                  <div className="text-[11px] text-slate-500">Qty: {it.quantity || 1}</div>
                                </div>
                              </div>
                            );
                          })}

                          {/* Attached PDF Prescription & Direct Account Tracking Link Bar */}
                          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200">
                            <div className="flex items-center gap-2 text-xs text-[#0B192C]">
                              <FileText className="w-4 h-4 text-[#1E40AF]" />
                              <span>
                                Attached PDF:{' '}
                                <strong className="font-mono">
                                  VisionCare-Lens-Prescription-{matchedOrder.orderNumber}.pdf
                                </strong>
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const firstItem = (matchedOrder.items || [])[0];
                                  let rxObj: any = {};
                                  try {
                                    if (firstItem?.prescriptionSnapshotJson) {
                                      rxObj = JSON.parse(firstItem.prescriptionSnapshotJson);
                                    }
                                  } catch {
                                    rxObj = {};
                                  }
                                  exportPrescriptionToPdf({
                                    prescription: {
                                      patientName:
                                        rxObj.patientName || matchedOrder.customerName || user.fullName,
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
                                        rxObj.prescriptionDate ||
                                        new Date(matchedOrder.createdAt).toISOString().slice(0, 10),
                                      doctorName:
                                        rxObj.doctorName || 'Vision Care Clinical Dispensing Unit',
                                      notes:
                                        rxObj.notes ||
                                        `Order Reference: ${matchedOrder.orderNumber} | Status: ${matchedOrder.orderStatus}`,
                                      customerConfirmed: true,
                                    },
                                    selectedFrameName: firstItem?.productName || 'Vision Care Frame',
                                    selectedLensName:
                                      firstItem?.lensOptionSelected || 'Standard Optical Lens',
                                    selectedCoatingSummary:
                                      firstItem?.coatingSummary || 'Standard Coating',
                                    totalEstimateFormatted: formatNaira(matchedOrder.totalNgn),
                                  });
                                }}
                                className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download Lens Prescription (PDF)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => exportClientInvoiceToPdf(matchedOrder)}
                                className="px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-[#0B192C] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download Invoice (PDF)</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Footer with Direct Vision Care Account Tracking Link */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {matchedOrder && (
                          <button
                            type="button"
                            onClick={() => {
                              setTrackedOrderId(matchedOrder.id);
                              setActiveTab('tracking');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="px-4 py-2 rounded-lg bg-[#1E40AF] hover:bg-blue-800 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shadow-2xs"
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>
                              Track Order {matchedOrder.orderNumber} in Vision Care Account →
                            </span>
                          </button>
                        )}
                        {isPriceDrop && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('wishlist')}
                            className="px-3.5 py-2 rounded-lg bg-[#0B192C] text-white text-xs font-semibold hover:bg-[#162B49] cursor-pointer"
                          >
                            Open Saved Frames Wishlist →
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (matchedOrder) {
                              setEnqOrderNum(matchedOrder.orderNumber);
                            }
                            setEnqSubject(`Re: ${n.title.replace(/^\[.*?\]\s*/, '')}`);
                            setActiveTab('support');
                          }}
                          className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-[#0B192C] text-xs font-semibold cursor-pointer"
                        >
                          Reply to Admin →
                        </button>
                      </div>
                      {matchedOrder && (
                        <span className="text-[11px] font-mono text-slate-500">
                          Tracking Link: /?view=account&amp;trackOrder={matchedOrder.orderNumber}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB: ORDER ENQUIRIES & SUPPORT */}
      {activeTab === 'support' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await onSendOrderEnquiry({
                orderNumber: enqOrderNum,
                subject: enqSubject,
                message: enqMessage,
              });
              setEnqMessage('');
              setEnqSuccess('Your enquiry has been transmitted to our optical concierge desk.');
            }}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <h3 className="text-lg font-semibold text-[#0B192C]">
              Direct Order & Optometrist Enquiry
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Order Number (Optional)
              </label>
              <input
                type="text"
                value={enqOrderNum}
                onChange={(e) => setEnqOrderNum(e.target.value)}
                placeholder="e.g. VC-849201-302"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject *</label>
              <input
                type="text"
                required
                value={enqSubject}
                onChange={(e) => setEnqSubject(e.target.value)}
                placeholder="Prescription adjustment, Varilux corridor query, or delivery..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Message *</label>
              <textarea
                rows={4}
                required
                value={enqMessage}
                onChange={(e) => setEnqMessage(e.target.value)}
                placeholder="Describe how our optometrists or customer care team can assist you..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
              />
            </div>
            {enqSuccess && <p className="text-xs text-emerald-700 font-medium">{enqSuccess}</p>}
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#0B192C] text-white text-xs font-semibold rounded-lg hover:bg-[#162B49]"
            >
              Send Enquiry
            </button>
          </form>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#0B192C]">Your Support History</h3>
            {enquiries.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-6 text-xs text-slate-500">
                No previous support tickets submitted.
              </div>
            ) : (
              enquiries.map((enq) => (
                <div key={enq.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#0B192C]">
                      {enq.subject} {enq.orderNumber ? `(${enq.orderNumber})` : ''}
                    </span>
                    <span className="text-[11px] text-[#1E40AF] font-medium uppercase">{enq.status}</span>
                  </div>
                  <p className="text-xs text-slate-600">{enq.message}</p>
                  {enq.adminReply && (
                    <div className="p-3 bg-[#E0F2FE]/60 rounded-lg text-xs text-[#0B192C]">
                      <strong>Vision Care Concierge Reply:</strong> {enq.adminReply}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB: PROFILE SETTINGS */}
      {activeTab === 'profile' && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await onUpdateProfile({ fullName, phone });
            setProfileSavedMsg('Profile updated.');
          }}
          className="max-w-lg bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-[#0B192C]">Customer Profile Details</h3>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-tabular"
            />
          </div>
          {profileSavedMsg && <p className="text-xs text-emerald-700 font-medium">{profileSavedMsg}</p>}
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#0B192C] text-white text-xs font-semibold rounded-lg"
          >
            Save Profile Changes
          </button>
        </form>
      )}

      {/* TAB: CLINICAL EYE APPOINTMENTS & DRUG PRESCRIPTION (Rx PDF) */}
      {activeTab === 'appointments' && (
        <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-6">
          <ClinicalAppointmentView
            user={user}
            appointments={appointments}
            notifications={notifications as any}
            orders={orders}
            prescriptions={prescriptions}
            enquiries={enquiries}
            products={products}
            lensTypes={lensTypes}
            lensCoatings={lensCoatings}
            siteConfig={siteConfig}
            embeddedInAccount={true}
            onSignIn={onSignIn}
            onSignOut={onSignOut}
            onUpdateProfile={onUpdateProfile}
            onAddToCart={onAddToCart}
            onSavePrescriptionToAccount={onSavePrescriptionToAccount}
            onSendOrderEnquiry={onSendOrderEnquiry}
            onEmailSessionSignIn={onEmailSessionSignIn}
            onAppointmentCreated={onAppointmentCreated}
            onAppointmentUpdated={onAppointmentUpdated}
          />
        </div>
      )}
    </div>
  );
};
