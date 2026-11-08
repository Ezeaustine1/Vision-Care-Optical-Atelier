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
} from 'lucide-react';
import {
  AppointmentChargeOption,
  ClinicalAppointmentRecord,
  UserProfile,
} from '../types.ts';
import { formatNaira } from './OpticalImage.tsx';
import {
  exportDrugPrescriptionToPdf,
  printDrugPrescriptionSlip,
} from '../lib/pdfDocumentExport.ts';

interface ClinicalAppointmentViewProps {
  user: UserProfile | null;
  appointments: ClinicalAppointmentRecord[];
  siteConfig?: Record<string, any>;
  onAppointmentCreated: (created: ClinicalAppointmentRecord) => void;
  onAppointmentUpdated: (updated: ClinicalAppointmentRecord) => void;
}

const COMPLAINT_CATEGORIES = [
  'Eye Infection / Redness / Mucopurulent Discharge',
  'Acute Eye Pain / Eyelid Swelling / Stye / Chalazion',
  'Sudden Blurred Vision / Double Vision / Halos',
  'Severe Eye Itching / Allergic Conjunctivitis / Watering',
  'Dry Eye Syndrome / Burning / Light Sensitivity (Photophobia)',
  'Eye Trauma / Foreign Body / Post-Surgery Complication',
  'Glaucoma / Cataract / Retinal Complication Evaluation',
  'Other Eye Complaint or Ocular Complication',
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
  siteConfig = {},
  onAppointmentCreated,
  onAppointmentUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'book' | 'records'>('book');

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

  // Clinical Complaint State
  const [complaintCategory, setComplaintCategory] = useState(COMPLAINT_CATEGORIES[0]);
  const [affectedEye, setAffectedEye] = useState('Both Eyes (OU)');
  const [symptomDuration, setSymptomDuration] = useState('1–3 Days');
  const [urgencyLevel, setUrgencyLevel] = useState<'Routine' | 'Moderate' | 'Urgent / Acute'>('Urgent / Acute');
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [bookedSuccessRecord, setBookedSuccessRecord] = useState<ClinicalAppointmentRecord | null>(
    null
  );

  // Lookup & Payment State
  const [lookupQuery, setLookupQuery] = useState('');
  const [payingAppointmentId, setPayingAppointmentId] = useState<number | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<'paystack' | 'flutterwave' | 'bank_transfer'>('paystack');
  const [paymentRefInput, setPaymentRefInput] = useState('');
  const [paymentFeedback, setPaymentFeedback] = useState('');

  useEffect(() => {
    if (user?.fullName && !patientName) setPatientName(user.fullName);
    if (user?.email && !patientEmail) setPatientEmail(user.email);
    if (user?.phone && patientPhone === '+234 ') setPatientPhone(user.phone);
  }, [user]);

  // Admin-configured Consultation Fee, Other Charges, and Doctor Bank Account
  const baseConsultationFeeNgn = Number(siteConfig.appointmentConsultationFeeNgn ?? 15000);
  const availableExtraCharges: AppointmentChargeOption[] = (
    Array.isArray(siteConfig.appointmentExtraCharges) && siteConfig.appointmentExtraCharges.length > 0
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
    if (gw === 'bank_transfer' && typeof siteConfig.paymentGatewayBankTransferEnabled === 'boolean') {
      return siteConfig.paymentGatewayBankTransferEnabled;
    }
    return true;
  };

  const handleSubmitAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!patientName.trim() || !patientPhone.trim() || !complaintDescription.trim()) {
      setSubmitError('Please fill in your Full Name, Phone Number, and your Eye Complaint details.');
      return;
    }

    setIsSubmitting(true);
    try {
      const chargeNoteParts = [
        `Base Consultation Fee (${formatNaira(baseConsultationFeeNgn)})`,
        ...selectedExtraChargeItems.map((c) => `${c.name} (${formatNaira(c.priceNgn)})`),
      ];

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userUid: user?.uid || '',
          patientName: patientName.trim(),
          patientEmail: patientEmail.trim(),
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
          complaintDescription: complaintDescription.trim(),
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
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit clinical appointment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayDoctorBill = async (apt: ClinicalAppointmentRecord) => {
    setPayingAppointmentId(apt.id);
    setPaymentFeedback('');
    try {
      const isInstant = selectedGateway === 'paystack' || selectedGateway === 'flutterwave';
      const reference =
        paymentRefInput.trim() ||
        `${selectedGateway.toUpperCase()}-APT-${apt.appointmentNumber}-${Date.now().toString().slice(-4)}`;

      const res = await fetch(`/api/appointments/${apt.id}/pay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: selectedGateway,
          paymentReference: reference,
          paymentStatus: isInstant ? 'paid' : 'pending_verification',
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onAppointmentUpdated(updated);
        setPaymentRefInput('');
        setPaymentFeedback(
          isInstant
            ? `Payment of ${formatNaira(apt.totalChargeNgn)} confirmed via ${selectedGateway.toUpperCase()} (${reference}).`
            : `Bank transfer reference (${reference}) submitted for verification.`
        );
      }
    } finally {
      setPayingAppointmentId(null);
    }
  };

  const displayedAppointments = appointments.filter((apt) => {
    if (!lookupQuery.trim()) return true;
    const q = lookupQuery.trim().toLowerCase();
    return (
      apt.appointmentNumber.toLowerCase().includes(q) ||
      apt.patientName.toLowerCase().includes(q) ||
      apt.patientEmail.toLowerCase().includes(q) ||
      apt.patientPhone.toLowerCase().includes(q) ||
      apt.complaintCategory.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Clinical Hero Banner */}
      <div className="bg-[#0B192C] text-white rounded-2xl p-6 sm:p-8 border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2.5 max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-widest text-[#C5A059] flex items-center gap-2">
            <Stethoscope className="w-4 h-4" />
            <span>24/7 Doctor Eye Consultation · Ocular Infection & Complication Clinic</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold leading-tight">
            Book an Eye Doctor Appointment & Download Your Drug Prescription (PDF)
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Experiencing an eye infection, redness, pain, discharge, sudden blurry vision, itching, or any ocular complication? Submit your personal data, medical history, and clinical complaint anytime. Review transparent consultation & diagnostic fees, pay directly to the Doctor’s account, and download your official ophthalmic drug prescription (PDF) once permitted by the Admin/Doctor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setBookedSuccessRecord(null);
              setActiveTab('book');
            }}
            className={`px-5 py-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'book'
                ? 'bg-[#C5A059] text-[#0B192C]'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/15'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Book New Eye Appointment</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('records')}
            className={`px-5 py-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'records'
                ? 'bg-[#C5A059] text-[#0B192C]'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/15'
            }`}
          >
            <Pill className="w-4 h-4" />
            <span>My Appointments & Drug Rx PDF ({appointments.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: BOOK EYE COMPLAINT APPOINTMENT */}
      {activeTab === 'book' && (
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
                      Clinical Eye Appointment Logged Successfully
                    </span>
                    <h2 className="text-2xl font-semibold text-[#0B192C]">
                      Appointment Reference: {bookedSuccessRecord.appointmentNumber}
                    </h2>
                    <p className="text-xs text-slate-600">
                      Your personal data, brief medical history, and ocular complaint have been transmitted securely to the Attending Doctor’s Clinical Console in the Admin Dashboard.
                    </p>
                  </div>
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
                      <strong>Email:</strong> {bookedSuccessRecord.patientEmail || 'On file'}
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
                      Submitted Eye Complaint & Fee Summary
                    </p>
                    <p>
                      <strong>Issue Category:</strong> {bookedSuccessRecord.complaintCategory}
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
                      <strong>Total Estimated Bill:</strong> {formatNaira(bookedSuccessRecord.totalChargeNgn)}
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
                    <span>View Doctor's Assessment, Bill & Drug Prescription</span>
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
                    Patient Intake & Ocular Triage Form
                  </span>
                  <h2 className="text-xl sm:text-2xl font-semibold text-[#0B192C] mt-1">
                    1. Your Personal Data & Brief Medical History
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Enter your personal details and manually enter or upload a brief medical history (allergies, past eye conditions) for the Doctor.
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
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={patientEmail}
                      onChange={(e) => setPatientEmail(e.target.value)}
                      placeholder="patient@example.com"
                      className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5"
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
                          Manually type your brief medical history below or upload a medical history document/photo (securely visible to the Doctor in the Admin Dashboard).
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
                            Uploaded Medical History File: {medicalHistoryFileName}
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

                {/* Section 2: Eye Complaint, Infection or Complication */}
                <div className="border-t border-slate-200 pt-6 space-y-5">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-widest text-[#1E40AF]">
                      Ocular Symptoms & Clinical Complaint
                    </span>
                    <h2 className="text-xl sm:text-2xl font-semibold text-[#0B192C] mt-1">
                      2. Describe Your Eye Issue, Infection or Complication
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select the nature of your eye complaint and describe your symptoms clearly so the Doctor can evaluate and prescribe the appropriate treatment.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {COMPLAINT_CATEGORIES.map((cat) => {
                      const active = complaintCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setComplaintCategory(cat)}
                          className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            active
                              ? 'bg-[#0B192C] text-white border-[#0B192C] font-semibold'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span>{cat}</span>
                          {active && <CheckCircle2 className="w-4 h-4 text-[#C5A059] shrink-0" />}
                        </button>
                      );
                    })}
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
                        <option value="Urgent / Acute">Urgent / Acute (Pain, Infection, Discharge)</option>
                        <option value="Moderate">Moderate Discomfort</option>
                        <option value="Routine">Routine Evaluation</option>
                      </select>
                    </div>
                  </div>

                  <div className="text-xs">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Detailed Eye Complaint (Put down all symptoms, pain, discharge, redness, itching, or vision changes) *
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={complaintDescription}
                      onChange={(e) => setComplaintDescription(e.target.value)}
                      placeholder="Describe exactly what you are experiencing in your eye(s), when it started, whether there is sticky discharge, redness, swelling, pain, light sensitivity, or blurry vision..."
                      className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Any Eye Drops or Medications Already Used for This Complaint?
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

                {/* Section 3: Transparent Consultation Fee, Other Charges & Doctor Bank Account */}
                <div className="border-t border-slate-200 pt-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-widest text-[#1E40AF]">
                        Transparent Clinic Tariff & Payment Details
                      </span>
                      <h2 className="text-xl font-semibold text-[#0B192C] mt-0.5">
                        3. Consultation Fee, Other Charges & Doctor’s Account Number
                      </h2>
                      <p className="text-xs text-slate-500">
                        Review the mandatory consultation fee and optional clinical workup charges below.
                      </p>
                    </div>
                    <div className="px-4 py-2 rounded-xl bg-[#0B192C] text-white text-xs font-tabular shrink-0">
                      Estimated Total:{' '}
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
                        Other Clinical & Diagnostic Charges (Select any that apply or as advised by the Doctor):
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

                  {/* Doctor's Account Number Display */}
                  <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#C5A059] flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Doctor's Official Consultation & Treatment Account Number</span>
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
                </div>

                {submitError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-200">
                  <p className="text-xs text-slate-500">
                    Once submitted, the Doctor will review your complaint and medical history, confirm your bill, and issue your Drug Prescription (downloadable once permitted by Admin).
                  </p>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto justify-center px-6 py-3.5 bg-[#0B192C] hover:bg-[#162B49] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-2 shrink-0"
                  >
                    <Stethoscope className="w-4 h-4 text-[#C5A059]" />
                    <span>
                      {isSubmitting ? 'Submitting to Doctor...' : 'Submit Eye Complaint & Book Appointment'}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right Clinical Fee Schedule & Doctor Bank Account Sidebar */}
          <div className="lg:col-span-4 space-y-5">
            {/* Live Consultation Fee & Other Charges Schedule Card */}
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

              {/* Doctor Bank Account Card in Sidebar */}
              <div className="p-4 rounded-xl bg-[#0B192C] text-white space-y-2 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#C5A059] block">
                  Doctor's Bank Account Details
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
                  <strong>Drug Prescription PDF Policy:</strong> Official Drug Prescriptions (PDF & Print) are unlocked for client download once verified and permitted by the Admin / Attending Doctor.
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
                    Attending Eye Physician
                  </h3>
                  <p className="text-xs text-slate-500">
                    Clinical Ophthalmology & Optometric Care
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-slate-200/90 space-y-2 text-xs">
                <span className="font-semibold text-[#1E40AF] uppercase tracking-wider text-[11px] block">
                  Already Booked an Appointment?
                </span>
                <p className="text-slate-600">
                  Check your Doctor’s diagnosis, pay your consultation bill, or download your Drug Prescription PDF anytime.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('records')}
                  className="w-full py-2.5 bg-[#0B192C] text-white font-semibold rounded-lg hover:bg-[#162B49] cursor-pointer mt-1"
                >
                  Open My Appointments & Drug Rx ({appointments.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MY APPOINTMENTS, DOCTOR'S BILL & DRUG PRESCRIPTIONS (PDF / PRINT) */}
      {activeTab === 'records' && (
        <div className="space-y-6">
          {/* Search / Lookup Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[#0B192C]">
                Clinical Eye Appointments & Doctor's Drug Prescriptions (Rx)
              </h2>
              <p className="text-xs text-slate-500">
                View your submitted eye complaints, pay the Doctor's complaint-based charge, and print or download your official Drug Prescription in PDF format once permitted by the Admin.
              </p>
            </div>
            <div className="relative w-full sm:w-auto sm:min-w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                placeholder="Search by Ref (VC-APT...), Name or Phone..."
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

          {displayedAppointments.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
              <Stethoscope className="w-10 h-10 text-[#1E40AF] mx-auto" />
              <h3 className="text-base font-semibold text-[#0B192C]">
                No Eye Clinic Appointments Found
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Have an eye complaint, infection, or vision complication? Book an appointment now to receive a Doctor's clinical assessment and downloadable Drug Prescription PDF.
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
              const hasDrugs = Array.isArray(apt.prescribedDrugs) && apt.prescribedDrugs.length > 0;
              const isPaid = apt.paymentStatus === 'paid';
              const canDownloadPdf = Boolean(apt.allowClientPdfDownload);

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
                            apt.urgencyLevel === 'Urgent / Acute'
                              ? 'bg-rose-500/20 text-rose-200 border border-rose-400/30'
                              : 'bg-sky-500/20 text-sky-200'
                          }`}
                        >
                          {apt.urgencyLevel}
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
                              <span>Awaiting Admin Permission for PDF</span>
                            </>
                          )}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">
                        Patient: <strong className="text-white">{apt.patientName}</strong> ({apt.patientAge} yrs,{' '}
                        {apt.patientGender}) · Affected: <strong className="text-white">{apt.affectedEye}</strong> ·
                        Preferred: {apt.preferredDate} ({apt.preferredTimeSlot})
                      </p>
                    </div>

                    {/* PDF Download & Print Action Buttons (Gated by Admin Permission) */}
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
                            title="Download locked until permitted by the Admin / Doctor"
                            className="px-4 py-2 bg-white/10 text-slate-300 border border-white/15 text-xs font-semibold rounded-xl flex items-center gap-1.5 opacity-75 cursor-not-allowed"
                          >
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                            <span>Download Drug Rx PDF (Admin Permission Required)</span>
                          </button>
                          <button
                            type="button"
                            disabled
                            title="Printing locked until permitted by the Admin / Doctor"
                            className="px-3.5 py-2 bg-white/5 text-slate-400 border border-white/10 text-xs font-semibold rounded-xl flex items-center gap-1.5 opacity-75 cursor-not-allowed"
                          >
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                            <span>Print Locked</span>
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
                          <span>Patient Personal Data & Medical History</span>
                        </span>
                        <p>
                          <strong>Full Name:</strong> {apt.patientName}
                        </p>
                        <p>
                          <strong>Age / Gender:</strong> {apt.patientAge || 'Adult'} yrs · {apt.patientGender}
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
                          <strong>Allergies / Medical Hx:</strong> {apt.medicalHistoryAndAllergies || 'None'}
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
                          <span>Reported Eye Complaint & Symptoms</span>
                        </span>
                        <p>
                          <strong>Category:</strong> {apt.complaintCategory}
                        </p>
                        <p>
                          <strong>Affected Eye:</strong> {apt.affectedEye} · <strong>Duration:</strong>{' '}
                          {apt.symptomDuration}
                        </p>
                        <p>
                          <strong>Patient Complaint:</strong> “{apt.complaintDescription}”
                        </p>
                        <p>
                          <strong>Prior Drops Used:</strong> {apt.previousMedicationsUsed || 'None'}
                        </p>
                        <p>
                          <strong>Consultation Mode:</strong> {apt.consultationMode}
                        </p>
                      </div>

                      {/* Doctor's Complaint-Based Charge & Payment Box */}
                      <div className="p-4 rounded-xl bg-[#FAF9F6] border border-slate-300 text-xs flex flex-col justify-between space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold uppercase tracking-wider text-[#0B192C] text-[11px]">
                              Doctor's Charge & Consultation Fee
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                isPaid
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : apt.totalChargeNgn > 0
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {apt.paymentStatus.replace(/_/g, ' ')}
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
                              <span className="text-[#1E40AF]">{formatNaira(apt.totalChargeNgn || 0)}</span>
                            </div>
                          </div>

                          {apt.chargeReasonNote && (
                            <p className="text-[11px] text-slate-600 pt-1">
                              <strong>Billing Note:</strong> {apt.chargeReasonNote}
                            </p>
                          )}

                          {/* Doctor's Account Number Always Visible for Client Payment */}
                          <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] font-tabular space-y-0.5">
                            <div className="font-semibold text-[#1E40AF]">
                              Doctor's Bank Account:
                            </div>
                            <div>
                              {doctorBankName} · <strong className="text-[#0B192C]">{doctorBankAccountNumber}</strong>
                            </div>
                            <div className="text-slate-500">{doctorBankAccountName}</div>
                          </div>
                        </div>

                        {apt.totalChargeNgn > 0 && !isPaid && (
                          <div className="pt-2 border-t border-slate-200 space-y-2">
                            <span className="block text-[11px] font-semibold text-[#0B192C]">
                              Pay Doctor's Consultation & Treatment Bill:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
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
                            </div>

                            <input
                              type="text"
                              value={paymentRefInput}
                              onChange={(e) => setPaymentRefInput(e.target.value)}
                              placeholder="Optional payment reference / teller number..."
                              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-[11px] bg-white"
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
                                  ? 'Processing...'
                                  : `Pay ${formatNaira(apt.totalChargeNgn)} Now`}
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
                            <span>Official Doctor's Clinical Diagnosis & Drug Prescription (Rx)</span>
                          </span>
                          <h3 className="text-base font-semibold text-[#0B192C] mt-0.5">
                            {apt.clinicalDiagnosis
                              ? `Clinical Diagnosis: ${apt.clinicalDiagnosis}`
                              : 'Attending Doctor is reviewing your eye complaint and preparing your Drug Prescription'}
                          </h3>
                        </div>
                        <div className="text-xs text-slate-500">
                          Attending Physician: <strong className="text-[#0B192C]">{apt.doctorName}</strong> (
                          {apt.doctorLicenseNumber})
                        </div>
                      </div>

                      {!canDownloadPdf && (
                        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
                          <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>
                            <strong>PDF Download & Printing Restricted:</strong> You cannot download or print this Drug Prescription PDF until permitted by the Admin / Attending Doctor. Once the Admin grants permission in the Admin Dashboard, the Download & Print buttons above will unlock automatically.
                          </span>
                        </div>
                      )}

                      {hasDrugs ? (
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-[#0B192C] text-white uppercase text-[11px]">
                                <th className="py-3 px-4">#</th>
                                <th className="py-3 px-4">Prescribed Drug / Eye Drop & Category</th>
                                <th className="py-3 px-4">Route / Eye</th>
                                <th className="py-3 px-4">Dosage & Frequency</th>
                                <th className="py-3 px-4">Duration</th>
                                <th className="py-3 px-4">Doctor's Instructions</th>
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
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                          Your complaint has been logged. As soon as the Doctor writes your ophthalmic drug prescription and grants download permission, your prescribed medications will be listed here and ready to print or download as PDF.
                        </div>
                      )}

                      {(apt.clinicalNotesAndAdvice || apt.followUpDate) && (
                        <div className="p-4 rounded-xl bg-[#E0F2FE]/50 border border-sky-200 text-xs space-y-1">
                          {apt.clinicalNotesAndAdvice && (
                            <p className="text-[#0B192C]">
                              <strong>Doctor's Clinical Advice & Care Precautions:</strong>{' '}
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
    </div>
  );
};
