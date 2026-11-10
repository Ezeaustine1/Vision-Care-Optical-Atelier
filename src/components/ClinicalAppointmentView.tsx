import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  Calendar,
  FileText,
  Download,
  Printer,
  CheckCircle2,
  AlertCircle,
  User,
  Eye,
  CreditCard,
  Search,
  Pill,
  Upload,
  Lock,
  Unlock,
  Copy,
  Check,
  Building2,
  ShieldCheck,
  Mail,
  Bell,
  Package,
  MessageSquare,
  LogOut,
  ArrowRight,
  ShoppingBag,
  Sparkles,
  Glasses,
} from 'lucide-react';
import {
  AppointmentChargeOption,
  CartItem,
  ClinicalAppointmentRecord,
  EnquiryRecord,
  LensCoating,
  LensType,
  NotificationItem,
  OrderRecord,
  PrescriptionData,
  Product,
  UserProfile,
} from '../types.ts';
import { OpticalImage, formatNaira, parseFirstImage } from './OpticalImage.tsx';
import { PrescriptionWizard } from './PrescriptionWizard.tsx';
import {
  exportDrugPrescriptionToPdf,
  exportClientInvoiceToPdf,
  printDrugPrescriptionSlip,
} from '../lib/pdfDocumentExport.ts';
import { exportPrescriptionToPdf } from '../lib/prescriptionPdfExport.ts';

interface ClinicalAppointmentViewProps {
  user: UserProfile | null;
  appointments: ClinicalAppointmentRecord[];
  notifications?: NotificationItem[];
  orders?: OrderRecord[];
  prescriptions?: PrescriptionData[];
  enquiries?: EnquiryRecord[];
  products?: Product[];
  lensTypes?: LensType[];
  lensCoatings?: LensCoating[];
  siteConfig?: Record<string, any>;
  embeddedInAccount?: boolean;
  onSignIn?: () => void;
  onSignOut?: () => Promise<void> | void;
  onOpenFullAccount?: () => void;
  onUpdateProfile?: (data: { fullName: string; phone: string }) => Promise<void>;
  onAddToCart?: (item: CartItem, openCheckoutAfter?: boolean) => void;
  onSavePrescriptionToAccount?: (rx: PrescriptionData) => Promise<void>;
  onSendOrderEnquiry?: (data: {
    orderNumber: string;
    subject: string;
    message: string;
  }) => Promise<void>;
  onEmailSessionSignIn?: (payload: {
    email: string;
    password?: string;
    fullName?: string;
    mode?: 'customer' | 'admin';
  }) => Promise<void>;
  onAppointmentCreated: (created: ClinicalAppointmentRecord) => void;
  onAppointmentUpdated: (updated: ClinicalAppointmentRecord) => void;
}

const INDIVIDUAL_SYMPTOM_SIGNS = [
  'Eye Redness',
  'Eye Pain / Ache',
  'Sticky / Yellow Discharge',
  'Watery / Tearing Eyes',
  'Eye Itching',
  'Eyelid Swelling / Stye',
  'Blurry Vision',
  'Light Sensitivity',
  'Dryness / Burning',
  'Foreign Body Sensation',
  'Double Vision',
  'Halos Around Lights',
  'Floaters / Flashes',
  'Eye Trauma / Injury',
  'Eye Strain / Headache',
  'Routine Eye Checkup',
];

const DEFAULT_EXTRA_CHARGES: AppointmentChargeOption[] = [
  {
    id: 'chg_slitlamp',
    name: 'Slit-Lamp Biomicroscopy & Corneal Staining',
    priceNgn: 10000,
    description: 'Microscopic anterior segment & corneal evaluation',
    isActive: true,
  },
  {
    id: 'chg_iop',
    name: 'Intraocular Pressure (IOP / Glaucoma Tonometry)',
    priceNgn: 8000,
    description: 'Ocular pressure screening',
    isActive: true,
  },
  {
    id: 'chg_fundus',
    name: 'Dilated Funduscopy & Retinal Assessment',
    priceNgn: 12000,
    description: 'Optic nerve and macula examination',
    isActive: true,
  },
  {
    id: 'chg_emergency',
    name: 'Urgent / Same-Day Acute Infection Workup',
    priceNgn: 15000,
    description: 'Priority acute ocular care & therapeutic starter pack',
    isActive: true,
  },
];

export const ClinicalAppointmentView: React.FC<ClinicalAppointmentViewProps> = ({
  user,
  appointments,
  notifications = [],
  orders = [],
  prescriptions = [],
  enquiries = [],
  products = [],
  lensTypes = [],
  lensCoatings = [],
  siteConfig = {},
  embeddedInAccount = false,
  onSignIn,
  onSignOut,
  onOpenFullAccount,
  onAddToCart,
  onSavePrescriptionToAccount,
  onSendOrderEnquiry,
  onEmailSessionSignIn,
  onAppointmentCreated,
  onAppointmentUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'book' | 'records' | 'messages' | 'orders_rx'>(
    'book'
  );
  const [inAccountShopTab, setInAccountShopTab] = useState<
    'rx_glasses' | 'frames' | 'ai_glasses' | 'my_orders'
  >('rx_glasses');
  const [wizardInitialProduct, setWizardInitialProduct] = useState<Product | null>(null);
  const [wizardInitialOrderType, setWizardInitialOrderType] = useState<
    'prescription_glasses' | 'frames_only' | 'protective_glasses' | 'replacement_lenses'
  >('prescription_glasses');
  const [frameSearchQuery, setFrameSearchQuery] = useState('');
  const [frameCategoryFilter, setFrameCategoryFilter] = useState<string>('all');
  const [inAccountOrderFeedback, setInAccountOrderFeedback] = useState('');

  // Inline Patient Account Registration / Login State (when !user)
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [authFullName, setAuthFullName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPhone, setAuthPhone] = useState('+234 ');
  const [authPassword, setAuthPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState('');

  // Personal Data & Medical History State
  const [patientName, setPatientName] = useState(user?.fullName || '');
  const [patientEmail, setPatientEmail] = useState(user?.email || '');
  const [patientPhone, setPatientPhone] = useState(user?.phone || '+234 ');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('Male');
  const [patientOccupation, setPatientOccupation] = useState('');
  const [patientAddress, setPatientAddress] = useState('');
  const [medicalHistoryAndAllergies, setMedicalHistoryAndAllergies] = useState('');
  const [medicalHistoryFileUrl, setMedicalHistoryFileUrl] = useState('');
  const [medicalHistoryFileName, setMedicalHistoryFileName] = useState('');

  // Streamlined Single-Click Symptom / Sign Picker State
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(['Eye Redness']);
  const [affectedEye, setAffectedEye] = useState('Both Eyes (OU)');
  const [symptomDuration, setSymptomDuration] = useState('1–3 Days');
  const [urgencyLevel, setUrgencyLevel] = useState<'Routine' | 'Moderate' | 'Urgent / Acute'>(
    'Urgent / Acute'
  );
  const [complaintDescription, setComplaintDescription] = useState('');
  const [previousMedicationsUsed, setPreviousMedicationsUsed] = useState('');
  const [preferredDate, setPreferredDate] = useState(new Date().toISOString().slice(0, 10));
  const [preferredTimeSlot, setPreferredTimeSlot] = useState('10:30 AM (Morning Clinic)');
  const [consultationMode, setConsultationMode] = useState(
    'In-Clinic Consultation (Victoria Island, Lagos)'
  );

  // Selected Extra Charges from Admin-configured list
  const [selectedChargeIds, setSelectedChargeIds] = useState<string[]>([]);
  const [copiedAccount, setCopiedAccount] = useState(false);

  // Initial Booking Payment Reference (Optional at intake, verified by Admin before forwarding)
  const [bookingPaymentGateway, setBookingPaymentGateway] = useState<
    'paystack' | 'flutterwave' | 'bank_transfer'
  >('bank_transfer');
  const [bookingPaymentReference, setBookingPaymentReference] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [bookedSuccessRecord, setBookedSuccessRecord] = useState<ClinicalAppointmentRecord | null>(
    null
  );

  // Lookup & Payment State
  const [lookupQuery, setLookupQuery] = useState('');
  const [payingAppointmentId, setPayingAppointmentId] = useState<number | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<
    'paystack' | 'flutterwave' | 'bank_transfer'
  >('bank_transfer');
  const [paymentRefInputMap, setPaymentRefInputMap] = useState<Record<number, string>>({});
  const [paymentFeedback, setPaymentFeedback] = useState('');
  const [paymentError, setPaymentError] = useState('');

  // Patient Direct Message to Doctor / Admin State (inside Messages tab)
  const [msgAppointmentRef, setMsgAppointmentRef] = useState('');
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [msgFeedback, setMsgFeedback] = useState('');

  useEffect(() => {
    if (user?.fullName) {
      setPatientName(user.fullName);
    }
    if (user?.email) setPatientEmail(user.email);
    if (user?.phone && (patientPhone === '+234 ' || !patientPhone)) {
      setPatientPhone(user.phone);
    }
  }, [user]);

  // Strictly Confidential Filter: A client ONLY sees their own appointments when logged in
  const myConfidentialAppointments = React.useMemo(() => {
    if (!user) return [];
    const cleanUid = (user.uid || '').trim();
    const cleanEmail = (user.email || '').trim().toLowerCase();
    return appointments.filter((apt) => {
      if (cleanUid && apt.userUid && apt.userUid === cleanUid) return true;
      if (cleanEmail && apt.patientEmail && apt.patientEmail.trim().toLowerCase() === cleanEmail)
        return true;
      return false;
    });
  }, [appointments, user]);

  // Strictly Isolated Client Messages: Only messages addressed to this specific logged-in user/email
  const doctorMessages = React.useMemo(() => {
    if (!user) return [];
    const cleanUid = (user.uid || '').trim();
    const cleanEmail = (user.email || '').trim().toLowerCase();
    return notifications
      .filter((n) => {
        const msgText = String(n.message || '');
        const emailMatch = msgText.match(/\[Delivered to Email:\s*([^\]]+)\]/i);
        if (emailMatch && emailMatch[1]) {
          const tagEmail = emailMatch[1].trim().toLowerCase();
          if (cleanEmail && tagEmail !== cleanEmail) return false;
        }
        if (n.userUid) {
          const nUid = String(n.userUid).trim();
          const nUidLower = nUid.toLowerCase();
          if (cleanUid && nUid === cleanUid) return true;
          if (cleanEmail && nUidLower === `email:${cleanEmail}`) return true;
          return false;
        }
        return true;
      })
      .map((n) => {
        const cleanedMessage = String(n.message || '')
          .replace(/\s*\[Delivered to Email:\s*[^\]]+\]/gi, '')
          .replace(/\s*\[PRESCRIPTION_SUMMARY:\s*[^\]]+\]/gi, '')
          .replace(/\s*\[ORDER_PRODUCT_IMAGES:\s*[^\]]+\]/gi, '')
          .trim();
        return {
          ...n,
          message: cleanedMessage,
        };
      });
  }, [notifications, user]);

  const complaintCategory =
    selectedSymptoms.length > 0 ? selectedSymptoms.join(' · ') : 'General Eye Consultation';

  const handleToggleSingleSymptom = (symptom: string) => {
    setSelectedSymptoms((prev) => {
      if (prev.includes(symptom)) {
        const next = prev.filter((s) => s !== symptom);
        return next.length > 0 ? next : [symptom];
      }
      return [...prev, symptom];
    });
  };

  // Admin-configured Consultation Fee, Other Charges, and Doctor Bank Account
  const baseConsultationFeeNgn = Number(siteConfig.appointmentConsultationFeeNgn ?? 15000);
  const availableExtraCharges: AppointmentChargeOption[] = (
    Array.isArray(siteConfig.appointmentExtraCharges) &&
    siteConfig.appointmentExtraCharges.length > 0
      ? siteConfig.appointmentExtraCharges
      : DEFAULT_EXTRA_CHARGES
  ).filter((c: AppointmentChargeOption) => c.isActive !== false);

  const selectedExtraChargeItems = availableExtraCharges.filter((c) =>
    selectedChargeIds.includes(c.id)
  );
  const extraChargesTotalNgn = selectedExtraChargeItems.reduce(
    (sum, item) => sum + Number(item.priceNgn || 0),
    0
  );
  const estimatedBookingTotalNgn = baseConsultationFeeNgn + extraChargesTotalNgn;

  const doctorBankName =
    siteConfig.appointmentBankName || siteConfig.bankName || 'Zenith Bank PLC';
  const doctorBankAccountNumber =
    siteConfig.appointmentBankAccountNumber || siteConfig.bankAccountNumber || '1018492031';
  const doctorBankAccountName =
    siteConfig.appointmentBankAccountName ||
    siteConfig.bankAccountName ||
    'DR. AUSTINE EZEH — VISION CARE EYE CLINIC';

  const handleCopyAccountNumber = () => {
    navigator.clipboard?.writeText(doctorBankAccountNumber);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2500);
  };

  const toggleExtraCharge = (id: string) => {
    setSelectedChargeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleMedicalHistoryFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setMedicalHistoryFileUrl(reader.result);
        setMedicalHistoryFileName(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const isGatewayEnabled = (gw: 'paystack' | 'flutterwave' | 'bank_transfer'): boolean => {
    if (siteConfig.paymentGateways && typeof siteConfig.paymentGateways[gw] === 'boolean') {
      return siteConfig.paymentGateways[gw];
    }
    if (gw === 'paystack' && typeof siteConfig.paymentGatewayPaystackEnabled === 'boolean') {
      return siteConfig.paymentGatewayPaystackEnabled;
    }
    if (gw === 'flutterwave' && typeof siteConfig.paymentGatewayFlutterwaveEnabled === 'boolean') {
      return siteConfig.paymentGatewayFlutterwaveEnabled;
    }
    if (
      gw === 'bank_transfer' &&
      typeof siteConfig.paymentGatewayBankTransferEnabled === 'boolean'
    ) {
      return siteConfig.paymentGatewayBankTransferEnabled;
    }
    return true;
  };

  const handlePatientAccountAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const cleanEmail = authEmail.trim().toLowerCase();
    const cleanName = authFullName.trim();
    if (!cleanEmail) {
      setAuthError('Please enter your email address.');
      return;
    }
    if (authMode === 'register' && !cleanName) {
      setAuthError('Please enter your full name to create your confidential patient account.');
      return;
    }
    setIsAuthenticating(true);
    try {
      if (onEmailSessionSignIn) {
        await onEmailSessionSignIn({
          email: cleanEmail,
          password: authPassword,
          fullName: cleanName || cleanEmail.split('@')[0],
          mode: 'customer',
        });
        if (authPhone.trim() && authPhone.trim() !== '+234') {
          setPatientPhone(authPhone.trim());
        }
      } else if (onSignIn) {
        onSignIn();
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Unable to sign in. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSendDirectMessageToDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !msgSubject.trim() || !msgBody.trim()) return;
    setIsSendingMsg(true);
    setMsgFeedback('');
    try {
      if (onSendOrderEnquiry) {
        await onSendOrderEnquiry({
          orderNumber: msgAppointmentRef.trim(),
          subject: `[Doctor / Appointment Message] ${msgSubject.trim()}`,
          message: msgBody.trim(),
        });
      } else {
        await fetch('/api/enquiries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userUid: user.uid,
            customerName: user.fullName || 'Patient',
            customerEmail: user.email,
            orderNumber: msgAppointmentRef.trim(),
            subject: `[Doctor / Appointment Message] ${msgSubject.trim()}`,
            message: msgBody.trim(),
          }),
        });
      }
      setMsgBody('');
      setMsgSubject('');
      setMsgFeedback(
        `Your message has been delivered to the Attending Doctor & Admin Desk. Replies will appear in your Account Inbox and Registered Email (${user.email}).`
      );
    } catch {
      setMsgFeedback('Could not send message right now. Please try again.');
    } finally {
      setIsSendingMsg(false);
    }
  };

  const handleSubmitAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!user) {
      setSubmitError(
        'Please create a patient account or sign in before booking your appointment.'
      );
      return;
    }

    const finalSymptomsText =
      selectedSymptoms.length > 0 ? `Selected Symptoms/Signs: ${selectedSymptoms.join(', ')}.` : '';
    const combinedDescription = [finalSymptomsText, complaintDescription.trim()]
      .filter(Boolean)
      .join(' ');

    if (!patientName.trim() || !patientPhone.trim() || selectedSymptoms.length === 0) {
      setSubmitError(
        'Please enter your Full Name, Phone Number, and click at least one symptom or sign.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const chargeNoteParts = [
        `Base Consultation Fee (${formatNaira(baseConsultationFeeNgn)})`,
        ...selectedExtraChargeItems.map((c) => `${c.name} (${formatNaira(c.priceNgn)})`),
      ];

      const cleanBookingRef = bookingPaymentReference.trim();

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userUid: user.uid,
          patientName: patientName.trim(),
          patientEmail: (user.email || patientEmail).trim(),
          patientPhone: patientPhone.trim(),
          patientAge: patientAge.trim() || 'Adult',
          patientGender,
          patientOccupation: patientOccupation.trim(),
          patientAddress: patientAddress.trim(),
          medicalHistoryAndAllergies: medicalHistoryAndAllergies.trim() || 'None reported',
          medicalHistoryFileUrl,
          medicalHistoryFileName,
          complaintCategory,
          affectedEye,
          symptomDuration,
          urgencyLevel,
          complaintDescription: combinedDescription,
          previousMedicationsUsed: previousMedicationsUsed.trim() || 'None',
          preferredDate,
          preferredTimeSlot,
          consultationMode,
          consultationFeeNgn: baseConsultationFeeNgn,
          treatmentFeeNgn: extraChargesTotalNgn,
          totalChargeNgn: estimatedBookingTotalNgn,
          selectedExtraCharges: selectedExtraChargeItems.map((c) => ({
            id: c.id,
            name: c.name,
            priceNgn: c.priceNgn,
          })),
          chargeReasonNote: chargeNoteParts.join(' + '),
          paymentMethod: bookingPaymentGateway,
          paymentReference: cleanBookingRef,
          paymentStatus: cleanBookingRef ? 'pending_verification' : 'unpaid',
          allowClientPdfDownload: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not submit clinical appointment.');
      }

      setBookedSuccessRecord(data);
      onAppointmentCreated(data);
      setComplaintDescription('');
      setPreviousMedicationsUsed('');
      setBookingPaymentReference('');
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit clinical appointment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayDoctorBill = async (apt: ClinicalAppointmentRecord) => {
    setPaymentFeedback('');
    setPaymentError('');
    const enteredRef = (paymentRefInputMap[apt.id] || '').trim();
    if (!enteredRef) {
      setPaymentError(
        'Please enter your Bank Transfer Teller / Session ID or Payment Transaction Reference so the Admin can verify your payment before forwarding your file to the Doctor.'
      );
      return;
    }

    setPayingAppointmentId(apt.id);
    try {
      const res = await fetch(`/api/appointments/${apt.id}/pay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: selectedGateway,
          paymentReference: enteredRef,
          paymentStatus: 'pending_verification',
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onAppointmentUpdated(updated);
        setPaymentRefInputMap((prev) => ({ ...prev, [apt.id]: '' }));
        setPaymentFeedback(
          `Payment reference "${enteredRef}" (${selectedGateway.toUpperCase()}) submitted! Your booking is now awaiting Admin payment confirmation before being forwarded to the Attending Doctor.`
        );
      } else {
        setPaymentError('Could not submit payment reference. Please try again.');
      }
    } finally {
      setPayingAppointmentId(null);
    }
  };

  const displayedAppointments = myConfidentialAppointments.filter((apt) => {
    if (!lookupQuery.trim()) return true;
    const q = lookupQuery.trim().toLowerCase();
    return (
      apt.appointmentNumber.toLowerCase().includes(q) ||
      apt.patientName.toLowerCase().includes(q) ||
      apt.complaintCategory.toLowerCase().includes(q) ||
      apt.complaintDescription.toLowerCase().includes(q)
    );
  });

  // ============================================================================
  // UNAUTHENTICATED VIEW: DIRECT CLIENT TO CREATE ACCOUNT / SIGN IN FIRST
  // ============================================================================
  if (!user) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="bg-[#0B192C] text-white rounded-2xl p-6 sm:p-8 border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-widest text-[#C5A059] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Confidential Patient Account Required · Eye Clinic &amp; Doctor Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold leading-tight">
              Create Your Patient Account or Log In to Book an Eye Appointment
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              For strict medical confidentiality, every patient has a private account. Once you create your account or log in below, your account workspace gives you full access to book eye appointments, track Admin payment confirmation, receive Doctor/Admin messages in your account &amp; registered email, download Drug Prescription PDFs, and manage your optical orders.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setAuthMode('register')}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                authMode === 'register'
                  ? 'bg-[#C5A059] text-[#0B192C]'
                  : 'bg-white/10 text-white hover:bg-white/20 border border-white/15'
              }`}
            >
              Create New Account
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                authMode === 'login'
                  ? 'bg-[#C5A059] text-[#0B192C]'
                  : 'bg-white/10 text-white hover:bg-white/20 border border-white/15'
              }`}
            >
              Log In to Account
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 7 Cols: Create Account / Login Card */}
          <div className="lg:col-span-7 bg-white border-2 border-[#1E40AF]/20 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-[#1E40AF]">
                  {authMode === 'register'
                    ? 'New Patient Registration'
                    : 'Returning Patient Sign-In'}
                </span>
                <h2 className="text-xl sm:text-2xl font-semibold text-[#0B192C] mt-0.5">
                  {authMode === 'register'
                    ? 'Create Your Confidential Patient Account'
                    : 'Log In to Your Confidential Patient Account'}
                </h2>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0B192C] text-[#C5A059]">
                <Lock className="w-5 h-5" />
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setAuthError('');
                }}
                className={`py-2.5 rounded-lg font-semibold cursor-pointer transition-colors ${
                  authMode === 'register'
                    ? 'bg-[#0B192C] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-[#0B192C]'
                }`}
              >
                1. Create Patient Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthError('');
                }}
                className={`py-2.5 rounded-lg font-semibold cursor-pointer transition-colors ${
                  authMode === 'login'
                    ? 'bg-[#0B192C] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-[#0B192C]'
                }`}
              >
                2. Log In to Existing Account
              </button>
            </div>

            <form onSubmit={handlePatientAccountAuth} className="space-y-4 text-xs">
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
                    placeholder="e.g. Adaeze Nwosu"
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Registered Email Address (For Doctor Messages &amp; Drug Rx PDF Alerts) *
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
                  placeholder="Enter your confidential account password..."
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5"
                />
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full py-3.5 px-5 bg-[#0B192C] hover:bg-[#162B49] text-white text-xs sm:text-sm font-semibold rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-[#C5A059]" />
                <span>
                  {isAuthenticating
                    ? 'Opening Your Patient Account...'
                    : authMode === 'register'
                    ? 'Create Patient Account & Enter Appointment Portal →'
                    : 'Log In & Open My Patient Account →'}
                </span>
              </button>
            </form>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <span>
                <Lock className="w-3.5 h-3.5 inline mr-1 text-emerald-700" />
                100% Private Medical Records · No third party can view your appointments.
              </span>
              {onSignIn && (
                <button
                  type="button"
                  onClick={onSignIn}
                  className="text-[#1E40AF] font-semibold hover:underline cursor-pointer"
                >
                  Use Quick Sign-In Modal →
                </button>
              )}
            </div>
          </div>

          {/* Right 5 Cols: Everything Included Inside the Patient Account */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 space-y-5 shadow-xs">
            <div className="space-y-1 border-b border-slate-100 pb-4">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[#1E40AF]">
                All-In-One Patient Account Portal
              </span>
              <h3 className="text-lg font-semibold text-[#0B192C]">
                What Is Inside Your Patient Account
              </h3>
              <p className="text-xs text-slate-500">
                Everything you need for clinical eye consultations, doctor communication, and eyewear orders is organized inside your account:
              </p>
            </div>

            <div className="space-y-3.5 text-xs">
              {[
                {
                  title: '1. Book Eye Doctor Appointment & Symptom Picker',
                  desc: 'Click individual symptoms or signs one after the other, attach medical history, and book your preferred clinic or tele-optometry slot anytime.',
                },
                {
                  title: '2. Confidential Medical Files & Drug Rx (PDF)',
                  desc: 'Your files are strictly private. View your appointment status, submit payment references for Admin confirmation, and download official Doctor Drug Prescriptions (PDF).',
                },
                {
                  title: '3. Doctor & Admin Messages + Registered Email Sync',
                  desc: 'Receive direct clinical advice, payment confirmation, and prescription updates inside your account inbox and in your registered email address.',
                },
                {
                  title: '4. Order Frames, Lens Prescription Glasses & AI Smart Glasses In-Account',
                  desc: 'Want a Designer Frame, have your Lens Prescription and want Glasses, or want AI Smart Glasses? Order directly inside your account without logging out or creating another account.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="p-3.5 rounded-xl bg-[#FAF9F6] border border-slate-200/80 space-y-1"
                >
                  <div className="font-semibold text-[#0B192C] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{item.title}</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed pl-5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Logged-in Patient Account & Clinical Appointment Header */}
      <div className="bg-[#0B192C] text-white rounded-2xl p-6 sm:p-8 border border-white/10 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-widest text-[#C5A059] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>
                Verified Patient Account Active · {user.fullName || user.email} ({user.email})
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold leading-tight">
              Patient Account — Eye Appointments, Doctor Messages &amp; Drug Prescriptions
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Welcome to your confidential patient account. Book new eye appointments whenever needed, track Admin payment confirmation before forwarding to the Attending Doctor, read &amp; reply to Doctor/Admin messages (synced with <strong>{user.email}</strong>), download Drug Rx PDFs, and view your optical orders.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {!embeddedInAccount && onOpenFullAccount && (
              <button
                type="button"
                onClick={onOpenFullAccount}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Package className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Full Optical Account &amp; Analytics</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onSignOut && (
              <button
                type="button"
                onClick={() => onSignOut()}
                className="px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>

        {/* Complete Patient Account Navigation Bar (4 Tabs — Profile Tab Removed as Requested) */}
        <div className="pt-4 border-t border-white/10 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {[
            {
              id: 'book',
              label: '1. Book New Eye Appointment',
              icon: Calendar,
            },
            {
              id: 'records',
              label: `2. My Confidential Appointments & Drug Rx (${myConfidentialAppointments.length})`,
              icon: Pill,
            },
            {
              id: 'messages',
              label: `3. Doctor / Admin Messages & Email Inbox (${doctorMessages.length})`,
              icon: Mail,
            },
            {
              id: 'orders_rx',
              label: `4. Get Frames, Lens Rx Glasses, AI Glasses & My Orders (${orders.length + prescriptions.length})`,
              icon: Glasses,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (tab.id === 'book') setBookedSuccessRecord(null);
                  setActiveTab(tab.id as any);
                }}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#C5A059] text-[#0B192C] shadow-xs'
                    : 'bg-white/10 text-white hover:bg-white/20 border border-white/15'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: BOOK EYE COMPLAINT APPOINTMENT */}
      {user && activeTab === 'book' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8">
            {bookedSuccessRecord ? (
              <div className="bg-white border-2 border-emerald-600/30 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                      Confidential Eye Appointment Logged · Awaiting Admin Payment Verification
                    </span>
                    <h2 className="text-2xl font-semibold text-[#0B192C]">
                      Appointment Reference: {bookedSuccessRecord.appointmentNumber}
                    </h2>
                    <p className="text-xs text-slate-600">
                      Your appointment has been saved to your private account (<strong>{user.email}</strong>). Please note: <strong>Your booking will only be forwarded to the Attending Doctor once your payment of {formatNaira(bookedSuccessRecord.totalChargeNgn)} is verified and confirmed by the Admin.</strong>
                    </p>
                  </div>
                </div>

                {/* Mandatory Payment Verification Notice */}
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5 text-amber-900">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                      Current Payment Status:{' '}
                      {bookedSuccessRecord.paymentStatus === 'pending_verification'
                        ? 'Payment Reference Submitted — Awaiting Admin Verification'
                        : 'Unpaid — Awaiting Payment & Admin Confirmation'}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Bookings are not forwarded to the Doctor without confirmed payment. If you have not yet submitted your payment reference/teller number, please pay to the Doctor&apos;s official bank account below and submit your reference in <strong>My Private Appointments</strong>.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-[#1E40AF] uppercase tracking-wider text-[11px]">
                      Patient Personal Details & Medical History
                    </p>
                    <p>
                      <strong>Name:</strong> {bookedSuccessRecord.patientName} ({bookedSuccessRecord.patientAge} yrs,{' '}
                      {bookedSuccessRecord.patientGender})
                    </p>
                    <p>
                      <strong>Phone:</strong> {bookedSuccessRecord.patientPhone}
                    </p>
                    <p>
                      <strong>Registered Email:</strong> {bookedSuccessRecord.patientEmail || user.email}
                    </p>
                    <p>
                      <strong>Medical History & Allergies:</strong> {bookedSuccessRecord.medicalHistoryAndAllergies}
                    </p>
                    {bookedSuccessRecord.medicalHistoryFileName && (
                      <p className="text-emerald-700 font-semibold">
                        <strong>Uploaded Medical Record:</strong> {bookedSuccessRecord.medicalHistoryFileName}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-[#1E40AF] uppercase tracking-wider text-[11px]">
                      Selected Symptoms & Fee Summary
                    </p>
                    <p>
                      <strong>Symptoms / Signs:</strong> {bookedSuccessRecord.complaintCategory}
                    </p>
                    <p>
                      <strong>Affected Eye:</strong> {bookedSuccessRecord.affectedEye} ·{' '}
                      <strong>Urgency:</strong> {bookedSuccessRecord.urgencyLevel}
                    </p>
                    <p>
                      <strong>Consultation Fee:</strong> {formatNaira(bookedSuccessRecord.consultationFeeNgn)}
                    </p>
                    <p>
                      <strong>Other Selected Charges:</strong> {formatNaira(bookedSuccessRecord.treatmentFeeNgn)}
                    </p>
                    <p className="font-bold text-[#0B192C]">
                      <strong>Total Bill Due:</strong> {formatNaira(bookedSuccessRecord.totalChargeNgn)}
                    </p>
                  </div>
                </div>

                {/* Bank Account Box on Confirmation */}
                <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#C5A059]/50 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E40AF] block">
                      Official Doctor / Clinic Bank Account for Consultation & Treatment Payment
                    </span>
                    <p className="text-slate-700">
                      Bank: <strong>{doctorBankName}</strong> · Account Name:{' '}
                      <strong>{doctorBankAccountName}</strong>
                    </p>
                    <p className="text-sm font-bold font-tabular text-[#0B192C]">
                      Account Number: {doctorBankAccountNumber}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyAccountNumber}
                    className="px-3.5 py-2 rounded-lg bg-[#0B192C] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {copiedAccount ? <Check className="w-3.5 h-3.5 text-[#C5A059]" /> : <Copy className="w-3.5 h-3.5 text-[#C5A059]" />}
                    <span>{copiedAccount ? 'Copied!' : 'Copy Account Number'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('records')}
                    className="px-5 py-2.5 bg-[#0B192C] hover:bg-[#162B49] text-white text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4 text-[#C5A059]" />
                    <span>Submit Payment Reference / View Status</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInAccountShopTab('rx_glasses');
                      setActiveTab('orders_rx');
                    }}
                    className="px-4 py-2.5 bg-[#1E40AF] hover:bg-[#1e3a8a] text-white text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    <Glasses className="w-4 h-4 text-[#C5A059]" />
                    <span>Get Frame, Lens Rx Glasses or AI Glasses In-Account →</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookedSuccessRecord(null)}
                    className="px-4 py-2.5 border border-slate-300 text-[#0B192C] hover:bg-slate-50 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Book Another Appointment
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmitAppointment}
                className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-8 shadow-xs"
              >
                <div className="border-b border-slate-200 pb-4">
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#1E40AF]">
                    Confidential Patient Intake & Ocular Triage Form
                  </span>
                  <h2 className="text-xl sm:text-2xl font-semibold text-[#0B192C] mt-1">
                    1. Your Personal Data & Brief Medical History
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Your details are encrypted and visible only to you and the Attending Doctor.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Patient Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="e.g. Chinedu Eze"
                      className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Age (Years) *
                    </label>
                    <input
                      type="text"
                      required
                      value={patientAge}
                      onChange={(e) => setPatientAge(e.target.value)}
                      placeholder="e.g. 34"
                      className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 font-tabular"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Gender</label>
                    <select
                      value={patientGender}
                      onChange={(e) => setPatientGender(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Prefer not to say</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Phone / WhatsApp Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={patientPhone}
                      onChange={(e) => setPatientPhone(e.target.value)}
                      placeholder="+234 803 000 0000"
                      className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 font-tabular"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Registered Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={patientEmail}
                      onChange={(e) => setPatientEmail(e.target.value)}
                      placeholder="patient@example.com"
                      className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 bg-slate-50"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Occupation</label>
                    <input
                      type="text"
                      value={patientOccupation}
                      onChange={(e) => setPatientOccupation(e.target.value)}
                      placeholder="e.g. Banker, Engineer, Student"
                      className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Residential / Office Address
                    </label>
                    <input
                      type="text"
                      value={patientAddress}
                      onChange={(e) => setPatientAddress(e.target.value)}
                      placeholder="Street, City & State (e.g. Victoria Island, Lagos)"
                      className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5"
                    />
                  </div>

                  {/* Manual Brief Medical History Entry + Document/Image Upload */}
                  <div className="sm:col-span-3 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <label className="block font-semibold text-[#0B192C]">
                          Brief Medical History (Allergies, Past Eye Conditions, Surgeries, Diabetes/Glaucoma)
                        </label>
                        <p className="text-[11px] text-slate-500">
                          Type your brief medical history below or upload a document/photo (strictly confidential for the Attending Doctor only).
                        </p>
                      </div>
                      <label className="px-3.5 py-2 rounded-lg bg-[#0B192C] hover:bg-[#162B49] text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 shrink-0">
                        <Upload className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>Upload Medical History (PDF / Image)</span>
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          onChange={handleMedicalHistoryFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <textarea
                      rows={2}
                      value={medicalHistoryAndAllergies}
                      onChange={(e) => setMedicalHistoryAndAllergies(e.target.value)}
                      placeholder="e.g. No known drug allergies (NKDA), allergic to sulfa/penicillin, past cataract or glaucoma history, contact lens wearer..."
                      className="w-full border border-slate-300 rounded-lg px-3.5 py-2 bg-white"
                    />

                    {medicalHistoryFileName && (
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-semibold truncate">
                            Uploaded Confidential File: {medicalHistoryFileName}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMedicalHistoryFileUrl('');
                            setMedicalHistoryFileName('');
                          }}
                          className="text-rose-600 hover:underline font-semibold shrink-0 cursor-pointer"
                        >
                          Remove File
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 2: Streamlined Single-Symptom / Sign Click-One-by-One Selector */}
                <div className="border-t border-slate-200 pt-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-widest text-[#1E40AF]">
                        Ocular Symptoms & Clinical Signs
                      </span>
                      <h2 className="text-xl sm:text-2xl font-semibold text-[#0B192C] mt-1">
                        2. Describe Your Eye Issue, Infection or Complication
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Click on a single complaint, symptom, or sign one after the other to build your clinical profile. Click any selected item again to remove it.
                      </p>
                    </div>
                    {selectedSymptoms.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSelectedSymptoms([selectedSymptoms[0]])}
                        className="text-[11px] font-semibold text-rose-600 hover:underline self-start sm:self-center cursor-pointer shrink-0"
                      >
                        Reset to Single Symptom
                      </button>
                    )}
                  </div>

                  {/* Concise Individual Symptom / Sign Grid (4 per row on desktop) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {INDIVIDUAL_SYMPTOM_SIGNS.map((symptom) => {
                      const orderIndex = selectedSymptoms.indexOf(symptom);
                      const isSelected = orderIndex !== -1;
                      return (
                        <button
                          key={symptom}
                          type="button"
                          onClick={() => handleToggleSingleSymptom(symptom)}
                          className={`px-3 py-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer flex items-center justify-between gap-1.5 ${
                            isSelected
                              ? 'bg-[#0B192C] text-white border-[#0B192C] font-semibold shadow-2xs'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span className="truncate">{symptom}</span>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-[#C5A059] text-[#0B192C] text-[10px] font-bold flex items-center justify-center shrink-0">
                              {orderIndex + 1}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Symptoms Summary Bar */}
                  <div className="p-3 rounded-xl bg-[#FAF9F6] border border-slate-200 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-[#0B192C]">
                      Selected Symptom(s) / Sign(s) ({selectedSymptoms.length}):
                    </span>
                    {selectedSymptoms.map((sym, idx) => (
                      <span
                        key={sym}
                        onClick={() => handleToggleSingleSymptom(sym)}
                        className="px-2.5 py-1 rounded-lg bg-[#0B192C] text-white text-[11px] font-medium flex items-center gap-1.5 cursor-pointer"
                        title="Click to remove"
                      >
                        <span className="text-[#C5A059] font-bold">{idx + 1}.</span>
                        <span>{sym}</span>
                        <span className="text-slate-400 hover:text-white ml-0.5">×</span>
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Affected Eye(s) *
                      </label>
                      <select
                        value={affectedEye}
                        onChange={(e) => setAffectedEye(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white font-medium"
                      >
                        <option value="Both Eyes (OU)">Both Eyes (OU)</option>
                        <option value="Right Eye (OD)">Right Eye Only (OD)</option>
                        <option value="Left Eye (OS)">Left Eye Only (OS)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        How Long Have You Had This Issue? *
                      </label>
                      <select
                        value={symptomDuration}
                        onChange={(e) => setSymptomDuration(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white"
                      >
                        <option value="Started Today (< 24 Hours)">Started Today (&lt; 24 Hours)</option>
                        <option value="1–3 Days">1–3 Days</option>
                        <option value="4–7 Days">4–7 Days</option>
                        <option value="1–4 Weeks">1–4 Weeks</option>
                        <option value="Over 1 Month">Over 1 Month</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Severity / Urgency Level *
                      </label>
                      <select
                        value={urgencyLevel}
                        onChange={(e) => setUrgencyLevel(e.target.value as any)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white font-semibold"
                      >
                        <option value="Urgent / Acute">Urgent / Acute</option>
                        <option value="Moderate">Moderate Discomfort</option>
                        <option value="Routine">Routine Evaluation</option>
                      </select>
                    </div>
                  </div>

                  <div className="text-xs">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Additional Notes About Your Eye Complaint (Optional if symptoms are selected above)
                    </label>
                    <textarea
                      rows={3}
                      value={complaintDescription}
                      onChange={(e) => setComplaintDescription(e.target.value)}
                      placeholder="Add any extra details you want the Doctor to know about when it started or how it feels..."
                      className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Any Eye Drops or Medications Already Used?
                      </label>
                      <input
                        type="text"
                        value={previousMedicationsUsed}
                        onChange={(e) => setPreviousMedicationsUsed(e.target.value)}
                        placeholder="e.g. None, or Chloramphenicol drops, Saline wash..."
                        className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Consultation Channel
                      </label>
                      <select
                        value={consultationMode}
                        onChange={(e) => setConsultationMode(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white"
                      >
                        <option value="In-Clinic Consultation (Victoria Island, Lagos)">
                          In-Clinic Consultation (Victoria Island, Lagos)
                        </option>
                        <option value="In-Clinic Consultation (Maitama, Abuja)">
                          In-Clinic Consultation (Maitama, Abuja)
                        </option>
                        <option value="Tele-Ophthalmology / Priority Online Doctor Assessment & Drug Rx">
                          Tele-Ophthalmology / Priority Online Doctor Assessment & Drug Rx
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Preferred Appointment Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={preferredDate}
                        onChange={(e) => setPreferredDate(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 font-tabular"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Preferred Time Slot *
                      </label>
                      <select
                        value={preferredTimeSlot}
                        onChange={(e) => setPreferredTimeSlot(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white"
                      >
                        <option value="09:00 AM (Morning Clinic)">09:00 AM (Morning Clinic)</option>
                        <option value="10:30 AM (Morning Clinic)">10:30 AM (Morning Clinic)</option>
                        <option value="12:00 PM (Midday Clinic)">12:00 PM (Midday Clinic)</option>
                        <option value="02:30 PM (Afternoon Clinic)">02:30 PM (Afternoon Clinic)</option>
                        <option value="04:30 PM (Evening Clinic)">04:30 PM (Evening Clinic)</option>
                        <option value="Immediate / Urgent Same-Day Review">
                          Immediate / Urgent Same-Day Doctor Review
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 3: Transparent Consultation Fee, Other Charges & Mandatory Payment Verification */}
                <div className="border-t border-slate-200 pt-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-widest text-[#1E40AF]">
                        Transparent Clinic Tariff & Payment Verification
                      </span>
                      <h2 className="text-xl font-semibold text-[#0B192C] mt-0.5">
                        3. Consultation Fee, Other Charges & Payment Confirmation
                      </h2>
                      <p className="text-xs text-slate-500">
                        Your booking is only forwarded to the Attending Doctor after payment is verified and confirmed by the Admin.
                      </p>
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-[#0B192C] text-white text-xs font-tabular shrink-0">
                      Total Bill:{' '}
                      <strong className="text-[#C5A059] text-sm">
                        {formatNaira(estimatedBookingTotalNgn)}
                      </strong>
                    </div>
                  </div>

                  {/* Base Consultation Fee Card */}
                  <div className="p-4 rounded-xl bg-[#FAF9F6] border border-slate-300 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-[#0B192C] block">
                        Standard Eye Doctor Consultation Fee (Mandatory)
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        Comprehensive case review, ocular triage & ophthalmic prescription assessment
                      </span>
                    </div>
                    <span className="text-sm font-bold font-tabular text-[#1E40AF]">
                      {formatNaira(baseConsultationFeeNgn)}
                    </span>
                  </div>

                  {/* Other Charges (Editable by Admin) */}
                  {availableExtraCharges.length > 0 && (
                    <div className="space-y-2">
                      <span className="block text-xs font-semibold text-slate-700">
                        Other Clinical & Diagnostic Charges (Select any that apply):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {availableExtraCharges.map((chg) => {
                          const checked = selectedChargeIds.includes(chg.id);
                          return (
                            <label
                              key={chg.id}
                              onClick={() => toggleExtraCharge(chg.id)}
                              className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start justify-between gap-3 ${
                                checked
                                  ? 'bg-[#0B192C] text-white border-[#0B192C]'
                                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="font-semibold flex items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {}}
                                    className="rounded border-slate-300"
                                  />
                                  <span>{chg.name}</span>
                                </div>
                                {chg.description && (
                                  <p
                                    className={`text-[11px] pl-5 ${
                                      checked ? 'text-slate-300' : 'text-slate-500'
                                    }`}
                                  >
                                    {chg.description}
                                  </p>
                                )}
                              </div>
                              <span
                                className={`font-bold font-tabular shrink-0 ${
                                  checked ? 'text-[#C5A059]' : 'text-[#1E40AF]'
                                }`}
                              >
                                +{formatNaira(chg.priceNgn)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Doctor's Account Number + Payment Reference Submission at Booking */}
                  <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 space-y-4 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#C5A059] flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5" />
                          <span>Doctor&apos;s Official Consultation & Treatment Account Number</span>
                        </div>
                        <p className="text-slate-300">
                          Bank: <strong className="text-white">{doctorBankName}</strong> · Account Name:{' '}
                          <strong className="text-white">{doctorBankAccountName}</strong>
                        </p>
                        <p className="text-base font-bold font-tabular text-[#C5A059]">
                          Account Number: {doctorBankAccountNumber}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyAccountNumber}
                        className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        {copiedAccount ? (
                          <Check className="w-4 h-4 text-[#C5A059]" />
                        ) : (
                          <Copy className="w-4 h-4 text-[#C5A059]" />
                        )}
                        <span>{copiedAccount ? 'Account Copied!' : 'Copy Account No.'}</span>
                      </button>
                    </div>

                    <div className="pt-3 border-t border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Payment Channel Used
                        </label>
                        <select
                          value={bookingPaymentGateway}
                          onChange={(e) => setBookingPaymentGateway(e.target.value as any)}
                          className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-xs text-white"
                        >
                          <option value="bank_transfer" className="text-slate-900">
                            Direct Bank Transfer ({doctorBankName})
                          </option>
                          <option value="paystack" className="text-slate-900">
                            Paystack Payment
                          </option>
                          <option value="flutterwave" className="text-slate-900">
                            Flutterwave Payment
                          </option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Payment Transaction Reference / Bank Transfer Session ID (For Admin Verification)
                        </label>
                        <input
                          type="text"
                          value={bookingPaymentReference}
                          onChange={(e) => setBookingPaymentReference(e.target.value)}
                          placeholder="Enter your bank transfer session ID or payment ref (or submit later in My Appointments)..."
                          className="w-full rounded-lg bg-white text-slate-900 px-3 py-2 text-xs font-tabular"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {submitError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-200">
                  <p className="text-xs text-slate-500">
                    Your booking will be verified by the Admin upon payment confirmation and then forwarded to the Attending Doctor.
                  </p>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto justify-center px-6 py-3.5 bg-[#0B192C] hover:bg-[#162B49] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-2 shrink-0"
                  >
                    <Stethoscope className="w-4 h-4 text-[#C5A059]" />
                    <span>
                      {isSubmitting ? 'Saving Confidential Booking...' : 'Submit Eye Complaint & Book Appointment'}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right Clinical Fee Schedule & Doctor Bank Account Sidebar */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#0B192C] text-[#C5A059]">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#0B192C]">
                    Consultation Fee & Other Charges
                  </h3>
                  <p className="text-xs text-slate-500">
                    Official Clinic Schedule & Doctor Account
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs font-tabular">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="font-semibold text-[#0B192C]">Consultation Fee</span>
                  <span className="font-bold text-[#1E40AF]">
                    {formatNaira(baseConsultationFeeNgn)}
                  </span>
                </div>
                {availableExtraCharges.map((chg) => (
                  <div
                    key={chg.id}
                    className="flex items-center justify-between py-1 text-slate-600"
                  >
                    <span>{chg.name}</span>
                    <span className="font-semibold text-[#0B192C]">
                      {formatNaira(chg.priceNgn)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-sm font-bold text-[#0B192C]">
                  <span>Your Selected Estimate</span>
                  <span className="text-[#1E40AF]">
                    {formatNaira(estimatedBookingTotalNgn)}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#0B192C] text-white space-y-2 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#C5A059] block">
                  Doctor&apos;s Bank Account Details
                </span>
                <p className="text-slate-300">
                  Bank: <strong className="text-white">{doctorBankName}</strong>
                </p>
                <p className="text-slate-300">
                  Account Name: <strong className="text-white">{doctorBankAccountName}</strong>
                </p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-base font-bold font-tabular text-[#C5A059]">
                    {doctorBankAccountNumber}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyAccountNumber}
                    className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] font-semibold cursor-pointer"
                  >
                    {copiedAccount ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Admin Payment Confirmation Policy:</strong> Bookings are only forwarded to the Attending Doctor after payment is verified by the Admin. Official Drug Prescriptions (PDF &amp; Print) unlock once permitted by the Admin/Doctor.
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#0B192C] text-[#C5A059]">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#0B192C]">
                    My Private Appointments
                  </h3>
                  <p className="text-xs text-slate-500">
                    Confidential Clinical Records & Messages
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-slate-200/90 space-y-2 text-xs">
                <span className="font-semibold text-[#1E40AF] uppercase tracking-wider text-[11px] block">
                  Check Doctor Messages & Drug Rx
                </span>
                <p className="text-slate-600">
                  View your confidential appointments, submit your payment reference for Admin verification, or read messages sent to your account and email.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('records')}
                  className="w-full py-2.5 bg-[#0B192C] text-white font-semibold rounded-lg hover:bg-[#162B49] cursor-pointer mt-1"
                >
                  Open My Private Appointments ({myConfidentialAppointments.length})
                </button>
              </div>

              {/* Direct In-Account Optical & AI Glasses Ordering Shortcut */}
              <div className="p-4 rounded-xl bg-[#0B192C] text-white border border-[#C5A059]/40 space-y-2.5 text-xs">
                <span className="font-semibold text-[#C5A059] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Glasses className="w-3.5 h-3.5" />
                  <span>Order Inside This Account (No Logout Needed)</span>
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Wish to get a Designer Frame, have your Lens Prescription and want Glasses, or want AI Smart Glasses? Order right here inside your appointment account:
                </p>
                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setWizardInitialOrderType('prescription_glasses');
                      setInAccountShopTab('rx_glasses');
                      setActiveTab('orders_rx');
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-[#C5A059] hover:bg-[#b58e47] text-[#0B192C] font-bold text-left flex items-center justify-between cursor-pointer"
                  >
                    <span>1. Use My Lens Prescription to Get Glasses</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInAccountShopTab('frames');
                      setActiveTab('orders_rx');
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-left flex items-center justify-between cursor-pointer"
                  >
                    <span>2. Browse &amp; Get Designer Frames</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#C5A059]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInAccountShopTab('ai_glasses');
                      setActiveTab('orders_rx');
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-left flex items-center justify-between cursor-pointer"
                  >
                    <span>3. Get AI Smart Glasses</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#C5A059]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MY CONFIDENTIAL APPOINTMENTS, MESSAGES & DRUG PRESCRIPTIONS (PDF / PRINT) */}
      {user && activeTab === 'records' && (
        <div className="space-y-6">
          {/* Doctor & Admin Messages Inbox for This Patient */}
          {doctorMessages.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#1E40AF]">
                  <Bell className="w-4 h-4" />
                  <span>
                    Messages & Updates from Attending Doctor / Admin (Also Sent to {user.email})
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-tabular">
                  {doctorMessages.length} Message(s)
                </span>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {doctorMessages.slice(0, 6).map((msg) => (
                  <div
                    key={msg.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#0B192C] flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-[#1E40AF]" />
                        <span>{msg.title}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-tabular">
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : 'Recent'}
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{msg.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search / Lookup Bar (Within Logged-In Patient's Confidential Files Only) */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#0B192C]">
                My Confidential Eye Appointments & Doctor&apos;s Drug Prescriptions (Rx)
              </h2>
              <p className="text-xs text-slate-500">
                Showing only appointments belonging to <strong>{user.fullName}</strong> ({user.email}). No other client can view your files.
              </p>
            </div>
            <div className="relative w-full sm:w-auto sm:min-w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                placeholder="Filter my appointments by Ref or Symptom..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          {paymentFeedback && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{paymentFeedback}</span>
            </div>
          )}

          {paymentError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{paymentError}</span>
            </div>
          )}

          {displayedAppointments.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
              <Stethoscope className="w-10 h-10 text-[#1E40AF] mx-auto" />
              <h3 className="text-base font-semibold text-[#0B192C]">
                You Have No Eye Appointments Yet
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Book a confidential appointment under your account to receive a Doctor&apos;s clinical assessment, email updates, and downloadable Drug Prescription PDF.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('book')}
                className="px-5 py-2.5 bg-[#0B192C] text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Book Eye Appointment Now
              </button>
            </div>
          ) : (
            displayedAppointments.map((apt) => {
              const hasDrugs =
                Array.isArray(apt.prescribedDrugs) && apt.prescribedDrugs.length > 0;
              const isPaidVerified = apt.paymentStatus === 'paid';
              const isPendingVerification = apt.paymentStatus === 'pending_verification';
              const canDownloadPdf = Boolean(apt.allowClientPdfDownload) && isPaidVerified;

              return (
                <div
                  key={apt.id}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs"
                >
                  {/* Top Header Bar */}
                  <div className="bg-[#0B192C] text-white px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-sm font-bold font-tabular text-[#C5A059]">
                          {apt.appointmentNumber}
                        </span>
                        <span className="text-xs px-2.5 py-0.5 rounded bg-white/10 text-white font-medium">
                          {apt.complaintCategory}
                        </span>
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded font-semibold uppercase ${
                            isPaidVerified
                              ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                              : isPendingVerification
                              ? 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
                              : 'bg-rose-500/20 text-rose-200 border border-rose-400/30'
                          }`}
                        >
                          {isPaidVerified
                            ? '✓ Payment Verified by Admin · Forwarded to Doctor'
                            : isPendingVerification
                            ? '⏳ Payment Submitted · Awaiting Admin Confirmation'
                            : 'Payment Required Before Doctor Forwarding'}
                        </span>
                        <span
                          className={`text-[11px] px-2.5 py-0.5 rounded font-semibold flex items-center gap-1 ${
                            canDownloadPdf
                              ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                              : 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
                          }`}
                        >
                          {canDownloadPdf ? (
                            <>
                              <Unlock className="w-3 h-3" />
                              <span>Admin Permitted PDF Download</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" />
                              <span>PDF Locked Until Admin Verification</span>
                            </>
                          )}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">
                        Patient: <strong className="text-white">{apt.patientName}</strong> (
                        {apt.patientAge} yrs, {apt.patientGender}) · Affected:{' '}
                        <strong className="text-white">{apt.affectedEye}</strong> · Preferred:{' '}
                        {apt.preferredDate} ({apt.preferredTimeSlot})
                      </p>
                    </div>

                    {/* PDF Download & Print Action Buttons (Gated by Admin Payment Confirmation & Permission) */}
                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      {canDownloadPdf ? (
                        <>
                          <button
                            type="button"
                            onClick={() => exportDrugPrescriptionToPdf(apt)}
                            className="px-4 py-2 bg-[#C5A059] hover:bg-[#b58e47] text-[#0B192C] text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Drug Prescription (PDF)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => printDrugPrescriptionSlip(apt)}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5 text-[#C5A059]" />
                            <span>Print Drug Prescription</span>
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled
                            title="Download locked until payment is verified and permitted by the Admin / Doctor"
                            className="px-4 py-2 bg-white/10 text-slate-300 border border-white/15 text-xs font-semibold rounded-xl flex items-center gap-1.5 opacity-75 cursor-not-allowed"
                          >
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                            <span>Download Drug Rx PDF (Admin Confirmation Required)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-6 space-y-6">
                    {/* Row 1: Patient Personal Data + Reported Complaint + Doctor's Charge */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                      {/* Personal Data & Medical History */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                        <span className="font-semibold uppercase tracking-wider text-[#1E40AF] text-[11px] flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          <span>Confidential Patient Profile & Medical History</span>
                        </span>
                        <p>
                          <strong>Full Name:</strong> {apt.patientName}
                        </p>
                        <p>
                          <strong>Age / Gender:</strong> {apt.patientAge || 'Adult'} yrs ·{' '}
                          {apt.patientGender}
                        </p>
                        <p>
                          <strong>Phone / Email:</strong> {apt.patientPhone} · {apt.patientEmail}
                        </p>
                        {apt.patientOccupation && (
                          <p>
                            <strong>Occupation:</strong> {apt.patientOccupation}
                          </p>
                        )}
                        {apt.patientAddress && (
                          <p>
                            <strong>Address:</strong> {apt.patientAddress}
                          </p>
                        )}
                        <p>
                          <strong>Allergies / Medical Hx:</strong>{' '}
                          {apt.medicalHistoryAndAllergies || 'None'}
                        </p>
                        {apt.medicalHistoryFileName && (
                          <p className="text-emerald-700 font-semibold">
                            <strong>Uploaded Medical Record:</strong> {apt.medicalHistoryFileName}
                          </p>
                        )}
                      </div>

                      {/* Eye Complaint */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                        <span className="font-semibold uppercase tracking-wider text-[#1E40AF] text-[11px] flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5" />
                          <span>Selected Symptoms & Clinical Complaint</span>
                        </span>
                        <p>
                          <strong>Symptoms / Signs:</strong> {apt.complaintCategory}
                        </p>
                        <p>
                          <strong>Affected Eye:</strong> {apt.affectedEye} ·{' '}
                          <strong>Duration:</strong> {apt.symptomDuration}
                        </p>
                        <p>
                          <strong>Clinical Notes:</strong> “{apt.complaintDescription}”
                        </p>
                        <p>
                          <strong>Prior Drops Used:</strong> {apt.previousMedicationsUsed || 'None'}
                        </p>
                        <p>
                          <strong>Consultation Mode:</strong> {apt.consultationMode}
                        </p>
                      </div>

                      {/* Doctor's Complaint-Based Charge & Admin Verification Payment Box */}
                      <div className="p-4 rounded-xl bg-[#FAF9F6] border border-slate-300 text-xs flex flex-col justify-between space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold uppercase tracking-wider text-[#0B192C] text-[11px]">
                              Consultation Bill & Verification Status
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                isPaidVerified
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isPendingVerification
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isPaidVerified
                                ? 'Verified Paid'
                                : isPendingVerification
                                ? 'Awaiting Admin Verification'
                                : 'Unpaid'}
                            </span>
                          </div>

                          <div className="pt-1 space-y-1 font-tabular">
                            <div className="flex justify-between text-slate-600">
                              <span>Consultation Fee:</span>
                              <span>{formatNaira(apt.consultationFeeNgn || 0)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>Other / Treatment Charges:</span>
                              <span>{formatNaira(apt.treatmentFeeNgn || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold text-[#0B192C] pt-1 border-t border-slate-200">
                              <span>Total Doctor Charge:</span>
                              <span className="text-[#1E40AF]">
                                {formatNaira(apt.totalChargeNgn || 0)}
                              </span>
                            </div>
                          </div>

                          {apt.paymentReference && (
                            <p className="text-[11px] text-slate-700 pt-1 font-tabular">
                              <strong>Submitted Payment Ref:</strong> {apt.paymentReference} (
                              {apt.paymentMethod?.toUpperCase()})
                            </p>
                          )}

                          {/* Doctor's Account Number Always Visible for Client Payment */}
                          <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] font-tabular space-y-0.5">
                            <div className="font-semibold text-[#1E40AF]">
                              Doctor&apos;s Bank Account:
                            </div>
                            <div>
                              {doctorBankName} ·{' '}
                              <strong className="text-[#0B192C]">{doctorBankAccountNumber}</strong>
                            </div>
                            <div className="text-slate-500">{doctorBankAccountName}</div>
                          </div>
                        </div>

                        {apt.totalChargeNgn > 0 && !isPaidVerified && (
                          <div className="pt-2 border-t border-slate-200 space-y-2">
                            <span className="block text-[11px] font-semibold text-[#0B192C]">
                              {isPendingVerification
                                ? 'Update Payment Reference (Awaiting Admin Confirmation):'
                                : 'Submit Payment Details for Admin Confirmation:'}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {isGatewayEnabled('bank_transfer') && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedGateway('bank_transfer')}
                                  className={`px-2.5 py-1 rounded text-[11px] font-semibold border cursor-pointer ${
                                    selectedGateway === 'bank_transfer'
                                      ? 'bg-[#0B192C] text-white border-[#0B192C]'
                                      : 'bg-white text-slate-700 border-slate-300'
                                  }`}
                                >
                                  Bank Transfer
                                </button>
                              )}
                              {isGatewayEnabled('paystack') && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedGateway('paystack')}
                                  className={`px-2.5 py-1 rounded text-[11px] font-semibold border cursor-pointer ${
                                    selectedGateway === 'paystack'
                                      ? 'bg-[#0B192C] text-white border-[#0B192C]'
                                      : 'bg-white text-slate-700 border-slate-300'
                                  }`}
                                >
                                  Paystack
                                </button>
                              )}
                              {isGatewayEnabled('flutterwave') && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedGateway('flutterwave')}
                                  className={`px-2.5 py-1 rounded text-[11px] font-semibold border cursor-pointer ${
                                    selectedGateway === 'flutterwave'
                                      ? 'bg-[#0B192C] text-white border-[#0B192C]'
                                      : 'bg-white text-slate-700 border-slate-300'
                                  }`}
                                >
                                  Flutterwave
                                </button>
                              )}
                            </div>

                            <input
                              type="text"
                              value={paymentRefInputMap[apt.id] || ''}
                              onChange={(e) =>
                                setPaymentRefInputMap((prev) => ({
                                  ...prev,
                                  [apt.id]: e.target.value,
                                }))
                              }
                              placeholder="Enter Teller No. / Session ID / Payment Ref *"
                              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-[11px] bg-white font-tabular"
                            />
                            <button
                              type="button"
                              disabled={payingAppointmentId === apt.id}
                              onClick={() => handlePayDoctorBill(apt)}
                              className="w-full py-2 bg-[#1E40AF] hover:bg-blue-800 text-white font-semibold rounded-lg text-xs cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>
                                {payingAppointmentId === apt.id
                                  ? 'Submitting for Admin Verification...'
                                  : `Submit ${formatNaira(apt.totalChargeNgn)} Payment Ref for Admin Confirmation`}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Doctor's Clinical Diagnosis & Official Drug Prescription (Rx) */}
                    <div className="border-t border-slate-200 pt-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-widest text-[#1E40AF] flex items-center gap-1.5">
                            <Pill className="w-4 h-4" />
                            <span>Official Doctor&apos;s Clinical Diagnosis & Drug Prescription (Rx)</span>
                          </span>
                          <h3 className="text-base font-semibold text-[#0B192C] mt-0.5">
                            {!isPaidVerified
                              ? 'Awaiting Admin Payment Confirmation Before Forwarding to Attending Doctor'
                              : apt.clinicalDiagnosis
                              ? `Clinical Diagnosis: ${apt.clinicalDiagnosis}`
                              : 'Payment Confirmed — Attending Doctor is preparing your clinical diagnosis & Drug Prescription'}
                          </h3>
                        </div>
                        <div className="text-xs text-slate-500">
                          Attending Physician: <strong className="text-[#0B192C]">{apt.doctorName}</strong> (
                          {apt.doctorLicenseNumber})
                        </div>
                      </div>

                      {!isPaidVerified && (
                        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
                          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>
                            <strong>Payment Confirmation Required:</strong> Your appointment booking will be forwarded to the Attending Doctor as soon as your payment of{' '}
                            <strong>{formatNaira(apt.totalChargeNgn)}</strong> is confirmed by the Admin. You will receive an instant notification in your Account and Registered Email (<strong>{apt.patientEmail}</strong>).
                          </span>
                        </div>
                      )}

                      {isPaidVerified && hasDrugs ? (
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-[#0B192C] text-white uppercase text-[11px]">
                                <th className="py-3 px-4">#</th>
                                <th className="py-3 px-4">Prescribed Drug / Eye Drop & Category</th>
                                <th className="py-3 px-4">Route / Eye</th>
                                <th className="py-3 px-4">Dosage & Frequency</th>
                                <th className="py-3 px-4">Duration</th>
                                <th className="py-3 px-4">Doctor&apos;s Instructions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {apt.prescribedDrugs.map((drug, idx) => (
                                <tr key={drug.id || idx} className="hover:bg-slate-50">
                                  <td className="py-3 px-4 font-bold text-[#0B192C]">{idx + 1}</td>
                                  <td className="py-3 px-4">
                                    <div className="font-semibold text-[#0B192C]">{drug.drugName}</div>
                                    <div className="text-[11px] text-[#1E40AF]">{drug.category}</div>
                                  </td>
                                  <td className="py-3 px-4 font-semibold text-[#0B192C]">{drug.route}</td>
                                  <td className="py-3 px-4">
                                    <span className="font-semibold">{drug.dosage}</span> · {drug.frequency}
                                  </td>
                                  <td className="py-3 px-4 font-semibold text-[#0B192C]">{drug.duration}</td>
                                  <td className="py-3 px-4 text-slate-600">{drug.instructions}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        isPaidVerified && (
                          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                            Your payment has been verified and your file is with the Attending Doctor. As soon as your ophthalmic drug prescription is issued, it will appear here and in your registered email.
                          </div>
                        )
                      )}

                      {isPaidVerified && (apt.clinicalNotesAndAdvice || apt.followUpDate) && (
                        <div className="p-4 rounded-xl bg-[#E0F2FE]/50 border border-sky-200 text-xs space-y-1">
                          {apt.clinicalNotesAndAdvice && (
                            <p className="text-[#0B192C]">
                              <strong>Doctor&apos;s Clinical Advice & Care Precautions:</strong>{' '}
                              {apt.clinicalNotesAndAdvice}
                            </p>
                          )}
                          {apt.followUpDate && (
                            <p className="text-[#1E40AF] font-semibold">
                              Next Scheduled Follow-Up Date: {apt.followUpDate}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: DOCTOR / ADMIN MESSAGES & REGISTERED EMAIL INBOX */}
      {user && activeTab === 'messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 7 Cols: Synced Registered Email & Account Inbox */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-[#0B192C] text-white rounded-2xl p-5 border border-[#C5A059]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#C5A059]">
                  Synced Patient Account &amp; Registered Email Inbox
                </span>
                <h2 className="text-lg font-semibold mt-0.5">
                  Doctor &amp; Admin Messages for {user.email}
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  All clinical updates, payment verification confirmations, Drug Prescription alerts, and direct messages from the Doctor/Admin are delivered here and to <strong>{user.email}</strong>.
                </p>
              </div>
              <a
                href="https://mail.google.com"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-[#C5A059] hover:bg-[#b58e47] text-[#0B192C] text-xs font-bold shrink-0 self-start sm:self-center"
              >
                Open Email Inbox ↗
              </a>
            </div>

            {doctorMessages.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
                <Mail className="w-8 h-8 text-[#1E40AF] mx-auto" />
                <p className="text-sm font-semibold text-[#0B192C]">
                  No Messages in Your Patient Inbox Yet
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  When the Admin confirms your appointment payment or the Attending Doctor sends you a clinical update or Drug Prescription, it will appear here and in {user.email}.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {doctorMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs"
                  >
                    <div className="bg-[#0B192C] text-white px-5 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#C5A059]/40">
                      <span className="text-xs font-semibold flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>{msg.title}</span>
                      </span>
                      <span className="text-[11px] text-slate-300 font-tabular">
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : 'Recent'}
                      </span>
                    </div>
                    <div className="p-4 space-y-2 text-xs">
                      <div className="text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                        <span>
                          <strong>From:</strong> Attending Doctor &amp; Vision Care Admin Desk
                        </span>
                        <span>
                          <strong>Delivered to Email:</strong>{' '}
                          <span className="font-mono text-[#1E40AF]">{user.email}</span>
                        </span>
                      </div>
                      <p className="text-slate-700 whitespace-pre-line leading-relaxed">
                        {msg.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right 5 Cols: Send Direct Message / Question to Doctor or Admin */}
          <div className="lg:col-span-5 space-y-5">
            <form
              onSubmit={handleSendDirectMessageToDoctor}
              className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs text-xs"
            >
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="p-2 rounded-xl bg-[#0B192C] text-[#C5A059]">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#0B192C]">
                    Message the Doctor / Admin Desk
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Send a follow-up question regarding your appointment, payment, or prescription
                  </p>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Link to My Appointment (Optional)
                </label>
                <select
                  value={msgAppointmentRef}
                  onChange={(e) => setMsgAppointmentRef(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">General Clinical / Appointment Enquiry</option>
                  {myConfidentialAppointments.map((apt) => (
                    <option key={apt.id} value={apt.appointmentNumber}>
                      {apt.appointmentNumber} — {apt.complaintCategory} ({apt.preferredDate})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subject *</label>
                <input
                  type="text"
                  required
                  value={msgSubject}
                  onChange={(e) => setMsgSubject(e.target.value)}
                  placeholder="e.g. Payment confirmation or eye drop dosage question..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Your Message *</label>
                <textarea
                  rows={4}
                  required
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  placeholder="Write your message to the Attending Doctor or Admin..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>

              {msgFeedback && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                  {msgFeedback}
                </div>
              )}

              <button
                type="submit"
                disabled={isSendingMsg}
                className="w-full py-2.5 bg-[#0B192C] hover:bg-[#162B49] text-white font-semibold rounded-xl cursor-pointer"
              >
                {isSendingMsg ? 'Sending Message...' : 'Send Message to Doctor / Admin'}
              </button>
            </form>

            {enquiries.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 text-xs">
                <h4 className="font-semibold text-[#0B192C]">
                  Your Sent Enquiries &amp; Doctor/Admin Replies ({enquiries.length})
                </h4>
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {enquiries.map((enq) => (
                    <div
                      key={enq.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#0B192C]">
                          {enq.subject} {enq.orderNumber ? `(${enq.orderNumber})` : ''}
                        </span>
                        <span className="text-[10px] font-bold uppercase text-[#1E40AF]">
                          {enq.status}
                        </span>
                      </div>
                      <p className="text-slate-600">{enq.message}</p>
                      {enq.adminReply && (
                        <div className="p-2.5 rounded-lg bg-[#E0F2FE]/70 text-[#0B192C]">
                          <strong>Doctor / Admin Reply:</strong> {enq.adminReply}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: IN-ACCOUNT FRAMES, LENS PRESCRIPTION GLASSES, AI SMART GLASSES & MY EYEWEAR ORDERS */}
      {user && activeTab === 'orders_rx' && (
        <div className="space-y-6">
          {/* Header Banner & Sub-Navigation inside the Patient Account */}
          <div className="bg-[#0B192C] text-white rounded-2xl p-6 border border-[#C5A059]/40 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1 max-w-3xl">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#C5A059] flex items-center gap-1.5">
                  <Glasses className="w-4 h-4" />
                  <span>Unified Patient &amp; Optical Account · No Logout or Second Account Required</span>
                </span>
                <h2 className="text-xl sm:text-2xl font-semibold">
                  Get a Frame, Order Glasses with Your Lens Prescription, or Get AI Smart Glasses
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Everything you order here is linked directly to your confidential account (<strong>{user.email}</strong>). Choose an option below to configure prescription lenses, pick a designer frame, order AI Smart Glasses, or view your orders.
                </p>
              </div>
              {inAccountOrderFeedback && (
                <div className="px-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-semibold flex items-center gap-2 shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span>{inAccountOrderFeedback}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-white/10 flex flex-wrap items-center gap-2">
              {[
                {
                  id: 'rx_glasses',
                  label: '1. Have Lens Prescription? Get Glasses / Lenses',
                  icon: Eye,
                },
                {
                  id: 'frames',
                  label: `2. Get a Designer Frame (${products.filter((p) => p.category !== 'ai_glasses').length})`,
                  icon: Glasses,
                },
                {
                  id: 'ai_glasses',
                  label: `3. Get AI Smart Glasses (${products.filter((p) => p.category === 'ai_glasses').length})`,
                  icon: Sparkles,
                },
                {
                  id: 'my_orders',
                  label: `4. My Eyewear Orders (${orders.length}) & Saved Lens Rx (${prescriptions.length})`,
                  icon: Package,
                },
              ].map((sub) => {
                const SubIcon = sub.icon;
                const active = inAccountShopTab === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setInAccountShopTab(sub.id as any)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 ${
                      active
                        ? 'bg-[#C5A059] text-[#0B192C]'
                        : 'bg-white/10 text-white hover:bg-white/20 border border-white/15'
                    }`}
                  >
                    <SubIcon className="w-3.5 h-3.5" />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SUB-TAB 1: ORDER GLASSES WITH LENS PRESCRIPTION (EMBEDDED PRESCRIPTION WIZARD) */}
          {inAccountShopTab === 'rx_glasses' && (
            <div className="space-y-4">
              {products.length > 0 && lensTypes.length > 0 && onAddToCart ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs">
                  <PrescriptionWizard
                    products={products}
                    lensTypes={lensTypes}
                    lensCoatings={lensCoatings}
                    savedPrescriptions={prescriptions}
                    siteConfig={siteConfig}
                    initialProduct={wizardInitialProduct}
                    initialOrderType={wizardInitialOrderType}
                    onAddToCart={(item, openCheckoutAfter) => {
                      onAddToCart(item, openCheckoutAfter);
                      setInAccountOrderFeedback(
                        `Added "${item.productName}" to your Optical Bag under ${user.email}!`
                      );
                    }}
                    onSavePrescriptionToAccount={onSavePrescriptionToAccount}
                  />
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-500">
                  Loading optical laboratory catalog...
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 2: SHOP DESIGNER FRAMES DIRECTLY INSIDE ACCOUNT */}
          {inAccountShopTab === 'frames' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-[#1E40AF]">
                    In-Account Optical Frame Showroom
                  </span>
                  <h3 className="text-lg font-semibold text-[#0B192C]">
                    Choose a Designer Frame (Frame Only or Add Your Lens Prescription)
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={frameSearchQuery}
                      onChange={(e) => setFrameSearchQuery(e.target.value)}
                      placeholder="Search frame or brand..."
                      className="pl-8 pr-3 py-2 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                  <select
                    value={frameCategoryFilter}
                    onChange={(e) => setFrameCategoryFilter(e.target.value)}
                    className="border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white"
                  >
                    <option value="all">All Frame Categories</option>
                    <option value="optical">Optical Rx Frames</option>
                    <option value="sunglasses">Designer Sunglasses</option>
                    <option value="blue_light">Blue-Light / Computer Frames</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {products
                  .filter((p) => p.category !== 'ai_glasses')
                  .filter((p) =>
                    frameCategoryFilter === 'all' ? true : p.category === frameCategoryFilter
                  )
                  .filter((p) => {
                    if (!frameSearchQuery.trim()) return true;
                    const q = frameSearchQuery.trim().toLowerCase();
                    return (
                      p.name.toLowerCase().includes(q) ||
                      p.brand.toLowerCase().includes(q) ||
                      (p.shape || '').toLowerCase().includes(q)
                    );
                  })
                  .map((frame) => {
                    const effectivePrice = frame.discountPriceNgn ?? frame.priceNgn;
                    const frameImg = parseFirstImage(frame.imagesJson);
                    return (
                      <div
                        key={frame.id}
                        className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between hover:border-[#1E40AF]/40 transition-all shadow-2xs"
                      >
                        <div>
                          <div className="aspect-[16/10] bg-slate-100 relative overflow-hidden">
                            <OpticalImage
                              src={frameImg}
                              alt={frame.name}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-[#0B192C]/85 text-white text-[9px] font-semibold">
                              {frame.brand}
                            </span>
                          </div>
                          <div className="p-2.5 space-y-1">
                            <h4 className="text-xs font-semibold text-[#0B192C] line-clamp-1">
                              {frame.name}
                            </h4>
                            <p className="text-[10px] text-slate-500">
                              {frame.shape} · {frame.material}
                            </p>
                            <div className="text-xs font-bold text-[#1E40AF] font-tabular">
                              {formatNaira(effectivePrice)}
                            </div>
                          </div>
                        </div>
                        <div className="p-2.5 pt-0 space-y-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (onAddToCart) {
                                onAddToCart(
                                  {
                                    cartItemId: `${frame.id}-frame-${Date.now()}`,
                                    productId: frame.id,
                                    productName: frame.name,
                                    productBrand: frame.brand,
                                    productImage: frameImg,
                                    orderType: 'frames_only',
                                    selectedColor: 'Standard',
                                    quantity: 1,
                                    framePriceNgn: effectivePrice,
                                    lensTypeName: 'Frames Only (No Lenses)',
                                    lensOptionSelected: 'Standard Frame Only',
                                    lensPriceNgn: 0,
                                    coatingSummary: 'None',
                                    coatingPriceNgn: 0,
                                    prescriptionSnapshot: null,
                                    unitTotalNgn: effectivePrice,
                                  },
                                  true
                                );
                                setInAccountOrderFeedback(
                                  `"${frame.name}" (Frame Only) added to your bag!`
                                );
                              }
                            }}
                            className="w-full py-1.5 px-2 rounded-lg bg-[#0B192C] hover:bg-[#162B49] text-white text-[10px] font-semibold cursor-pointer flex items-center justify-center gap-1"
                          >
                            <ShoppingBag className="w-3 h-3 text-[#C5A059]" />
                            <span>Get Frame Only</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setWizardInitialProduct(frame);
                              setWizardInitialOrderType('prescription_glasses');
                              setInAccountShopTab('rx_glasses');
                            }}
                            className="w-full py-1.5 px-2 rounded-lg border border-[#1E40AF]/30 bg-[#E0F2FE]/50 hover:bg-[#E0F2FE] text-[#0B192C] text-[10px] font-semibold cursor-pointer"
                          >
                            + Add My Lens Rx
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* SUB-TAB 3: GET AI SMART GLASSES DIRECTLY INSIDE ACCOUNT */}
          {inAccountShopTab === 'ai_glasses' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
              <div className="border-b border-slate-100 pb-4">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-[#1E40AF]">
                  In-Account AI Smart Glasses &amp; Neural Audio Eyewear
                </span>
                <h3 className="text-lg font-semibold text-[#0B192C]">
                  Order AI Smart Glasses (Standard AI Frame, 0.00 Blue-Cut Shield, or With Your Lens Prescription)
                </h3>
                <p className="text-xs text-slate-500">
                  Select any AI Smart Glasses below to order directly from your patient account without logging out.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {products
                  .filter((p) => p.category === 'ai_glasses')
                  .map((aiProd) => {
                    const effectivePrice = aiProd.discountPriceNgn ?? aiProd.priceNgn;
                    const aiImg = parseFirstImage(aiProd.imagesJson);
                    return (
                      <div
                        key={aiProd.id}
                        className="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between shadow-2xs"
                      >
                        <div>
                          <div className="aspect-[16/10] bg-slate-900 relative overflow-hidden">
                            <OpticalImage
                              src={aiImg}
                              alt={aiProd.name}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#0B192C]/90 text-[#C5A059] text-[10px] font-bold">
                              AI Smart Glasses
                            </span>
                          </div>
                          <div className="p-4 space-y-1.5">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              {aiProd.brand}
                            </div>
                            <h4 className="text-sm font-semibold text-[#0B192C] line-clamp-1">
                              {aiProd.name}
                            </h4>
                            <p className="text-[11px] text-slate-500 line-clamp-2">
                              {aiProd.description}
                            </p>
                            <div className="text-sm font-bold text-[#1E40AF] font-tabular pt-1">
                              {formatNaira(effectivePrice)}
                            </div>
                          </div>
                        </div>
                        <div className="p-4 pt-0 space-y-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (onAddToCart) {
                                onAddToCart(
                                  {
                                    cartItemId: `${aiProd.id}-ai-${Date.now()}`,
                                    productId: aiProd.id,
                                    productName: aiProd.name,
                                    productBrand: aiProd.brand,
                                    productImage: aiImg,
                                    orderType: 'frames_only',
                                    selectedColor: 'Standard',
                                    quantity: 1,
                                    framePriceNgn: effectivePrice,
                                    lensTypeName: 'AI Smart Glasses Hardware',
                                    lensOptionSelected: 'Standard AI Smart Glasses',
                                    lensPriceNgn: 0,
                                    coatingSummary: 'None',
                                    coatingPriceNgn: 0,
                                    prescriptionSnapshot: null,
                                    unitTotalNgn: effectivePrice,
                                  },
                                  true
                                );
                                setInAccountOrderFeedback(
                                  `"${aiProd.name}" added to your bag!`
                                );
                              }
                            }}
                            className="w-full py-2 px-3 rounded-xl bg-[#0B192C] hover:bg-[#162B49] text-white text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <ShoppingBag className="w-3.5 h-3.5 text-[#C5A059]" />
                            <span>Order AI Glasses Now</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setWizardInitialProduct(aiProd);
                              setWizardInitialOrderType('prescription_glasses');
                              setInAccountShopTab('rx_glasses');
                            }}
                            className="w-full py-2 px-3 rounded-xl border border-[#1E40AF]/30 bg-[#E0F2FE]/50 hover:bg-[#E0F2FE] text-[#0B192C] text-xs font-semibold cursor-pointer"
                          >
                            + Fit With My Lens Prescription
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* SUB-TAB 4: MY EYEWEAR ORDERS & SAVED LENS PRESCRIPTIONS */}
          {inAccountShopTab === 'my_orders' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Left: Eyewear Orders & Invoices */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-semibold text-[#0B192C]">
                      My Eyewear Orders &amp; Invoices ({orders.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Track your optical laboratory orders and download official PDF invoices
                    </p>
                  </div>
                  {onOpenFullAccount && (
                    <button
                      type="button"
                      onClick={onOpenFullAccount}
                      className="text-xs font-semibold text-[#1E40AF] hover:underline cursor-pointer"
                    >
                      9-Stage Live Tracker →
                    </button>
                  )}
                </div>

                {orders.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3 text-xs text-slate-500">
                    <p>You have no eyewear frame or lens orders yet.</p>
                    <button
                      type="button"
                      onClick={() => setInAccountShopTab('rx_glasses')}
                      className="px-4 py-2 rounded-xl bg-[#0B192C] text-white font-semibold cursor-pointer"
                    >
                      Order Frame, Lens Rx Glasses or AI Glasses →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-[#0B192C]">
                            {ord.orderNumber} · {formatNaira(ord.totalNgn)}
                          </div>
                          <div className="text-slate-500 mt-0.5">
                            Status: <strong className="text-[#1E40AF]">{ord.orderStatus}</strong> ·
                            Payment: {ord.paymentStatus}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => exportClientInvoiceToPdf(ord)}
                          className="px-3.5 py-2 rounded-lg bg-[#0B192C] text-white font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-[#C5A059]" />
                          <span>Invoice PDF</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Saved Optical Lens Prescriptions */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-semibold text-[#0B192C]">
                      My Saved Optical Lens Prescriptions ({prescriptions.length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Saved OD/OS refraction records for ordering prescription eyeglasses
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInAccountShopTab('rx_glasses')}
                    className="text-xs font-semibold text-[#1E40AF] hover:underline cursor-pointer"
                  >
                    + Enter New Lens Rx →
                  </button>
                </div>

                {prescriptions.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3 text-xs text-slate-500">
                    <p>No saved lens prescriptions yet.</p>
                    <button
                      type="button"
                      onClick={() => setInAccountShopTab('rx_glasses')}
                      className="px-4 py-2 rounded-xl bg-[#0B192C] text-white font-semibold cursor-pointer"
                    >
                      Enter Lens Prescription &amp; Order Glasses →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {prescriptions.map((rx) => (
                      <div
                        key={rx.id}
                        className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-[#0B192C]">
                            {rx.patientName || user.fullName}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setInAccountShopTab('rx_glasses')}
                              className="px-3 py-1.5 rounded-lg bg-[#1E40AF] text-white font-semibold cursor-pointer"
                            >
                              Order Glasses With Rx
                            </button>
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
                              className="px-3 py-1.5 rounded-lg bg-[#0B192C] text-white font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Download className="w-3 h-3 text-[#C5A059]" />
                              <span>Export PDF</span>
                            </button>
                          </div>
                        </div>
                        <div className="font-tabular text-[11px] text-slate-600">
                          OD: SPH {rx.odSph} / CYL {rx.odCyl} / AXIS {rx.odAxis}° | OS: SPH {rx.osSph} /
                          CYL {rx.osCyl} / AXIS {rx.osAxis}° | PD: {rx.pd}mm
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

