import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Package,
  FileSearch,
  ShieldCheck,
  Cpu,
  Sparkles,
  Award,
  Box,
  Truck,
  Home,
  Download,
  MessageSquare,
  MapPin,
  Calendar,
  ChevronRight,
  Search,
  Eye,
} from 'lucide-react';
import { OrderRecord } from '../types.ts';
import { formatNaira } from './OpticalImage.tsx';

export interface StageDefinition {
  id: number;
  label: string;
  department: string;
  description: string;
  clinicalDetail: string;
  estimatedOffsetHours: number;
  icon: React.FC<{ className?: string }>;
}

export const OPTICAL_ORDER_STAGES: StageDefinition[] = [
  {
    id: 1,
    label: 'Order received',
    department: 'Client Concierge Desk',
    description: 'Your eyewear order and payment reference have been logged in the Vision Care system.',
    clinicalDetail: 'Order manifest generated and assigned a unique optical laboratory tracking ID.',
    estimatedOffsetHours: 0,
    icon: Package,
  },
  {
    id: 2,
    label: 'Prescription under review',
    department: 'Clinical Optometry Board',
    description: 'A licensed optometrist is verifying your OD/OS sphere, cylinder, axis, ADD, and PD values.',
    clinicalDetail: 'Cross-checking diopter balance, astigmatism axis tolerance, and pupillary centration.',
    estimatedOffsetHours: 4,
    icon: FileSearch,
  },
  {
    id: 3,
    label: 'Awaiting confirmation',
    department: 'Optical Dispensing Desk',
    description: 'Final confirmation of lens index compatibility with your selected frame curvature.',
    clinicalDetail: 'Verifying minimum blank size and edge thickness profile for your frame dimensions.',
    estimatedOffsetHours: 8,
    icon: Eye,
  },
  {
    id: 4,
    label: 'Processing',
    department: 'Atelier Vault & Inventory',
    description: 'Your selected frame and optical lens blanks have been allocated for laboratory production.',
    clinicalDetail: 'Frame chassis inspected for hinge tension and structural symmetry prior to glazing.',
    estimatedOffsetHours: 16,
    icon: Cpu,
  },
  {
    id: 5,
    label: 'Lens preparation',
    department: 'Freeform Optical Surfacing Lab',
    description: 'Precision digital surfacing, multi-layer coating application, and CNC bevel edging.',
    clinicalDetail: 'Applying requested UV400, anti-reflective, blue-cut, or photochromic treatments.',
    estimatedOffsetHours: 36,
    icon: Sparkles,
  },
  {
    id: 6,
    label: 'Quality control',
    department: 'ISO Optical QA Lab',
    description: 'Multi-point digital lensometer verification for optical power and axis accuracy.',
    clinicalDetail: 'Strict ANSI/ISO tolerance check, ultrasonic bath cleaning, and 4-point frame alignment.',
    estimatedOffsetHours: 48,
    icon: Award,
  },
  {
    id: 7,
    label: 'Ready for dispatch',
    department: 'Atelier Fulfilment Suite',
    description: 'Packed in a signature Vision Care hard case with microfiber cloth and authenticity card.',
    clinicalDetail: 'Sealed in tamper-evident optical transit packaging and assigned to insured courier.',
    estimatedOffsetHours: 54,
    icon: Box,
  },
  {
    id: 8,
    label: 'Shipped',
    department: 'Insured Optical Logistics',
    description: 'In transit via priority courier to your designated delivery address.',
    clinicalDetail: 'Shock-protected parcel routed to your destination city hub with live dispatch manifest.',
    estimatedOffsetHours: 72,
    icon: Truck,
  },
  {
    id: 9,
    label: 'Delivered',
    department: 'Client Handover Complete',
    description: 'Your custom eyewear has been delivered to your destination address.',
    clinicalDetail: 'Includes 30-day complimentary optical fit & progressive adaptation support.',
    estimatedOffsetHours: 96,
    icon: Home,
  },
];

interface OrderTrackingTimelineProps {
  orders: OrderRecord[];
  selectedOrderId?: number | null;
  onSelectOrder?: (orderId: number) => void;
  onDownloadInvoice: (order: OrderRecord) => void;
  onEnquireOrder: (order: OrderRecord) => void;
}

export const OrderTrackingTimeline: React.FC<OrderTrackingTimelineProps> = ({
  orders,
  selectedOrderId,
  onSelectOrder,
  onDownloadInvoice,
  onEnquireOrder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeOrderId, setActiveOrderId] = useState<number | null>(
    selectedOrderId ?? (orders.length > 0 ? orders[0].id : null)
  );
  const [inspectedStageIndex, setInspectedStageIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'interactive' | 'vertical'>('interactive');

  if (orders.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
        <Package className="w-10 h-10 text-[#1E40AF] mx-auto opacity-80" />
        <p className="text-base font-semibold text-[#0B192C]">No Active Orders to Track</p>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          Once you place an order for prescription eyewear, protective glasses, or frames, your interactive 9-stage optical laboratory timeline will appear here.
        </p>
      </div>
    );
  }

  const filteredOrders = orders.filter((o) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.orderStatus.toLowerCase().includes(q) ||
      o.deliveryCity.toLowerCase().includes(q) ||
      o.items.some((it) => it.productName.toLowerCase().includes(q))
    );
  });

  const currentOrder =
    orders.find((o) => o.id === (selectedOrderId ?? activeOrderId)) ||
    filteredOrders[0] ||
    orders[0];

  const currentStageIndex = Math.max(
    0,
    OPTICAL_ORDER_STAGES.findIndex(
      (s) => s.label.toLowerCase() === currentOrder.orderStatus.toLowerCase()
    )
  );

  const focusedStageIndex = inspectedStageIndex !== null ? inspectedStageIndex : currentStageIndex;
  const focusedStage = OPTICAL_ORDER_STAGES[focusedStageIndex] || OPTICAL_ORDER_STAGES[0];
  const FocusedIcon = focusedStage.icon;

  const progressPercentage = Math.round(
    ((currentStageIndex + 1) / OPTICAL_ORDER_STAGES.length) * 100
  );

  const getStageTimestamp = (orderCreatedAt: string, offsetHours: number, idx: number) => {
    const baseDate = new Date(orderCreatedAt);
    if (Number.isNaN(baseDate.getTime())) return 'Scheduled';
    const stageDate = new Date(baseDate.getTime() + offsetHours * 3600 * 1000);
    const prefix = idx <= currentStageIndex ? 'Logged' : 'Est.';
    return `${prefix} ${stageDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    })} · ${stageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const handleOrderChange = (order: OrderRecord) => {
    setActiveOrderId(order.id);
    setInspectedStageIndex(null);
    if (onSelectOrder) {
      onSelectOrder(order.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Order Selector & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[#1E40AF]">
              Interactive Optical Laboratory Telemetry
            </span>
            <h2 className="text-xl font-semibold text-[#0B192C] mt-0.5">
              Live Order & Laboratory Stage Tracker
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:flex-initial sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order # or frame..."
                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs text-[#0B192C] focus:outline-none focus:border-[#1E40AF]"
              />
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setViewMode('interactive')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'interactive'
                    ? 'bg-[#0B192C] text-white'
                    : 'text-slate-600 hover:text-[#0B192C]'
                }`}
              >
                Horizontal Pipeline
              </button>
              <button
                type="button"
                onClick={() => setViewMode('vertical')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === 'vertical'
                    ? 'bg-[#0B192C] text-white'
                    : 'text-slate-600 hover:text-[#0B192C]'
                }`}
              >
                Detailed Timeline
              </button>
            </div>
          </div>
        </div>

        {/* Order Switcher Tabs when customer has multiple orders */}
        {filteredOrders.length > 0 ? (
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-1">
            {filteredOrders.map((ord) => {
              const isSelected = ord.id === currentOrder.id;
              return (
                <button
                  key={ord.id}
                  type="button"
                  onClick={() => handleOrderChange(ord)}
                  className={`px-3.5 py-2.5 rounded-xl border text-left transition-all shrink-0 flex items-center gap-3 ${
                    isSelected
                      ? 'bg-[#0B192C] text-white border-[#0B192C] shadow-xs'
                      : 'bg-slate-50/80 hover:bg-slate-100 text-[#0B192C] border-slate-200'
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold font-tabular flex items-center gap-2">
                      <span>{ord.orderNumber}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          isSelected
                            ? 'bg-[#C5A059]/20 text-[#C5A059]'
                            : 'bg-[#E0F2FE] text-[#1E40AF]'
                        }`}
                      >
                        {ord.orderStatus}
                      </span>
                    </div>
                    <p
                      className={`text-[11px] mt-0.5 font-tabular ${
                        isSelected ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {new Date(ord.createdAt).toLocaleDateString()} · {formatNaira(ord.totalNgn)}
                    </p>
                  </div>
                  <ChevronRight
                    className={`w-3.5 h-3.5 ${isSelected ? 'text-[#C5A059]' : 'text-slate-400'}`}
                  />
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 py-2">
            No orders matched "{searchQuery}". Showing your most recent order below.
          </p>
        )}
      </div>

      {/* Main Active Order Tracking Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        {/* Order Header Summary */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-lg font-semibold text-[#0B192C] font-tabular">
                Order {currentOrder.orderNumber}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#0B192C] text-[#C5A059]">
                Stage {currentStageIndex + 1} of {OPTICAL_ORDER_STAGES.length}: {currentOrder.orderStatus}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                Payment: {currentOrder.paymentStatus.toUpperCase()}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5 font-tabular">
                <Calendar className="w-3.5 h-3.5 text-[#1E40AF]" />
                Ordered {new Date(currentOrder.createdAt).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#1E40AF]" />
                {currentOrder.deliveryAddress}, {currentOrder.deliveryCity}, {currentOrder.deliveryState}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="mr-2 text-right">
              <span className="block text-[10px] uppercase tracking-wider text-slate-400">
                Total Dispensed
              </span>
              <span className="text-lg font-tabular font-semibold text-[#0B192C]">
                {formatNaira(currentOrder.totalNgn)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onDownloadInvoice(currentOrder)}
              className="px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-medium text-[#0B192C] hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Invoice (PDF)</span>
            </button>
            <button
              type="button"
              onClick={() => onEnquireOrder(currentOrder)}
              className="px-3.5 py-2 bg-[#E0F2FE] text-[#0B192C] rounded-lg text-xs font-medium hover:bg-sky-200 flex items-center gap-1.5 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#1E40AF]" />
              <span>Concierge Support</span>
            </button>
          </div>
        </div>

        {/* Overall Completion Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#0B192C]">
              Laboratory & Fulfilment Progress
            </span>
            <span className="font-tabular font-semibold text-[#1E40AF]">
              {progressPercentage}% Complete ({currentStageIndex + 1}/{OPTICAL_ORDER_STAGES.length} Milestones)
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0B192C] via-[#1E40AF] to-[#C5A059] transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Click any stage node below to inspect the clinical protocol, responsible optical department, and schedule details.
          </p>
        </div>

        {/* VIEW MODE 1: Interactive Horizontal Pipeline & Stage Inspector */}
        {viewMode === 'interactive' ? (
          <div className="space-y-5">
            {/* 9-Node Interactive Stepper Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-9 gap-2.5">
              {OPTICAL_ORDER_STAGES.map((stage, idx) => {
                const Icon = stage.icon;
                const isCompleted = idx < currentStageIndex;
                const isCurrent = idx === currentStageIndex;
                const isInspected = idx === focusedStageIndex;

                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => setInspectedStageIndex(idx)}
                    className={`group relative p-3 rounded-xl border text-left transition-all flex flex-col justify-between min-h-[112px] ${
                      isCurrent
                        ? 'bg-[#0B192C] text-white border-[#0B192C] shadow-sm'
                        : isCompleted
                        ? 'bg-slate-900/95 text-white border-slate-800 hover:bg-[#0B192C]'
                        : 'bg-slate-50/90 text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-white'
                    } ${
                      isInspected
                        ? 'ring-2 ring-[#C5A059] ring-offset-2'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <span
                        className={`text-[11px] font-tabular font-semibold ${
                          isCompleted || isCurrent ? 'text-[#C5A059]' : 'text-slate-400'
                        }`}
                      >
                        0{stage.id}
                      </span>
                      <div className="flex items-center gap-1">
                        {isCurrent && (
                          <span className="w-2 h-2 rounded-full bg-[#C5A059] animate-ping" />
                        )}
                        {isCompleted || isCurrent ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#C5A059]" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                        )}
                      </div>
                    </div>

                    <div className="my-1">
                      <Icon
                        className={`w-4 h-4 mb-1.5 ${
                          isCompleted || isCurrent
                            ? 'text-sky-300'
                            : 'text-slate-400 group-hover:text-[#1E40AF]'
                        }`}
                      />
                      <p
                        className={`text-xs font-semibold leading-snug ${
                          isCompleted || isCurrent ? 'text-white' : 'text-[#0B192C]'
                        }`}
                      >
                        {stage.label}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-tabular mt-1.5 block ${
                        isCompleted || isCurrent ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      {isCurrent ? 'Active Now' : isCompleted ? 'Verified' : 'Pending'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Interactive Stage Inspector Spotlight Panel */}
            <div className="rounded-xl bg-gradient-to-br from-[#0B192C] to-[#132847] text-white p-5 border border-slate-800 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 text-[#C5A059]">
                    <FocusedIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-tabular uppercase tracking-widest text-[#C5A059] font-semibold">
                        Stage 0{focusedStage.id} · {focusedStage.department}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                          focusedStageIndex === currentStageIndex
                            ? 'bg-[#C5A059] text-[#0B192C]'
                            : focusedStageIndex < currentStageIndex
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                            : 'bg-white/10 text-slate-300'
                        }`}
                      >
                        {focusedStageIndex === currentStageIndex
                          ? 'Current Active Stage'
                          : focusedStageIndex < currentStageIndex
                          ? 'Completed Milestone'
                          : 'Scheduled Milestone'}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-white mt-1">
                      {focusedStage.label}
                    </h3>
                  </div>
                </div>

                <div className="text-xs font-tabular text-slate-300 bg-white/5 px-3.5 py-2 rounded-lg border border-white/10 self-start md:self-auto">
                  {getStageTimestamp(
                    currentOrder.createdAt,
                    focusedStage.estimatedOffsetHours,
                    focusedStageIndex
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-sky-300 font-semibold">
                    Stage Overview
                  </span>
                  <p className="text-slate-200 leading-relaxed">{focusedStage.description}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-[#C5A059] font-semibold">
                    Clinical & Laboratory Protocol
                  </span>
                  <p className="text-slate-300 leading-relaxed">{focusedStage.clinicalDetail}</p>
                </div>
              </div>

              {inspectedStageIndex !== null && inspectedStageIndex !== currentStageIndex && (
                <div className="pt-3 mt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
                  <span>
                    Inspecting Stage 0{focusedStage.id}. Your order is currently at Stage 0
                    {currentStageIndex + 1} ({currentOrder.orderStatus}).
                  </span>
                  <button
                    type="button"
                    onClick={() => setInspectedStageIndex(null)}
                    className="text-[#C5A059] hover:underline font-medium"
                  >
                    Return to Active Stage
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* VIEW MODE 2: Detailed Vertical Timeline Visualization */
          <div className="relative pl-4 sm:pl-6 space-y-4 before:content-[''] before:absolute before:left-[23px] sm:before:left-[31px] before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200">
            {OPTICAL_ORDER_STAGES.map((stage, idx) => {
              const Icon = stage.icon;
              const isCompleted = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;

              return (
                <div
                  key={stage.id}
                  onClick={() => setInspectedStageIndex(idx)}
                  className={`relative flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-[#0B192C] text-white border-[#0B192C] shadow-xs'
                      : isCompleted
                      ? 'bg-white border-slate-200 text-[#0B192C] hover:border-slate-300'
                      : 'bg-slate-50/70 border-slate-200/70 text-slate-400'
                  }`}
                >
                  <div
                    className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                      isCurrent
                        ? 'bg-[#C5A059] text-[#0B192C] border-[#C5A059]'
                        : isCompleted
                        ? 'bg-[#0B192C] text-[#C5A059] border-[#0B192C]'
                        : 'bg-white text-slate-400 border-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-tabular font-semibold ${
                            isCurrent
                              ? 'text-[#C5A059]'
                              : isCompleted
                              ? 'text-[#1E40AF]'
                              : 'text-slate-400'
                          }`}
                        >
                          0{stage.id} · {stage.department}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[#C5A059]/20 text-[#C5A059] font-semibold">
                            Active Stage
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[11px] font-tabular ${
                          isCurrent ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {getStageTimestamp(
                          currentOrder.createdAt,
                          stage.estimatedOffsetHours,
                          idx
                        )}
                      </span>
                    </div>

                    <h4
                      className={`text-sm font-semibold mt-0.5 ${
                        isCurrent
                          ? 'text-white'
                          : isCompleted
                          ? 'text-[#0B192C]'
                          : 'text-slate-500'
                      }`}
                    >
                      {stage.label}
                    </h4>
                    <p
                      className={`text-xs mt-1 leading-relaxed ${
                        isCurrent
                          ? 'text-slate-200'
                          : isCompleted
                          ? 'text-slate-600'
                          : 'text-slate-400'
                      }`}
                    >
                      {stage.description}
                    </p>
                    <p
                      className={`text-[11px] mt-1 ${
                        isCurrent
                          ? 'text-sky-300'
                          : isCompleted
                          ? 'text-slate-500'
                          : 'text-slate-400'
                      }`}
                    >
                      Protocol: {stage.clinicalDetail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ordered Eyewear & Optical Specification Breakdown */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Dispensed Eyewear & Lens Specifications ({currentOrder.items.length})
            </h4>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1E40AF]" />
              ISO-Certified Optical Glazing
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentOrder.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-[#0B192C] text-sm">
                    {item.productName} ({item.selectedColor}) × {item.quantity}
                  </div>
                  <p className="text-slate-600">
                    Lens: <span className="font-medium text-[#0B192C]">{item.lensTypeName}</span> (
                    {item.lensOptionSelected})
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    Coatings: {item.coatingSummary}
                  </p>
                </div>
                <span className="font-tabular font-semibold text-[#0B192C] text-sm shrink-0">
                  {formatNaira(item.unitTotalNgn * item.quantity)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
