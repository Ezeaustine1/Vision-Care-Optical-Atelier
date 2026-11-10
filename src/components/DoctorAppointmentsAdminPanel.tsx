import React, { useState, useEffect } from 'react';
import {
  Stethoscope,
  Pill,
  Plus,
  Trash2,
  Download,
  Printer,
  Check,
  Search,
  User,
  Eye,
  CreditCard,
  Lock,
  Unlock,
  FileText,
  Building2,
  Settings2,
  Mail,
  Send,
} from 'lucide-react';
import {
  AppointmentChargeOption,
  ClinicalAppointmentRecord,
  PrescribedDrugItem,
} from '../types.ts';
import { formatNaira } from './OpticalImage.tsx';
import {
  exportDrugPrescriptionToPdf,
  printDrugPrescriptionSlip,
} from '../lib/pdfDocumentExport.ts';

interface DoctorAppointmentsAdminPanelProps {
  appointments: ClinicalAppointmentRecord[];
  siteConfig?: Record<string, any>;
  onSaveSiteConfig?: (patch: Record<string, any>) => Promise<void>;
  onRefresh: () => Promise<void>;
  onStatusFeedback: (msg: string) => void;
}

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

const OPHTHALMIC_DRUG_PRESETS: Array<Omit<PrescribedDrugItem, 'id'>> = [
  {
    drugName: 'Moxifloxacin 0.5% Ophthalmic Solution (Vigamox)',
    category: 'Broad-Spectrum Antibiotic Eye Drops',
    route: 'Both Eyes (OU)',
    dosage: '1 Drop',
    frequency: 'Every 4 Hours (4x Daily)',
    duration: '7 Days',
    instructions: 'Instill 1 drop into affected eye(s). Do not touch dropper tip to eyelashes.',
  },
  {
    drugName: 'Ciprofloxacin 0.3% Sterile Eye Ointment',
    category: 'Nighttime Antibiotic Ocular Ointment',
    route: 'Both Eyes (OU)',
    dosage: '1 cm Ribbon',
    frequency: 'At Bedtime (NOCTE)',
    duration: '5 Nights',
    instructions: 'Apply inside lower eyelid before sleep to prevent morning crusting.',
  },
  {
    drugName: 'Tobramycin 0.3% + Dexamethasone 0.1% Eye Drops (TobraDex)',
    category: 'Antibiotic & Anti-Inflammatory Steroid Combination',
    route: 'Both Eyes (OU)',
    dosage: '1 Drop',
    frequency: 'Every 6 Hours (QDS)',
    duration: '7 Days',
    instructions: 'Shake bottle well before each instillation. Taper as directed by Doctor.',
  },
  {
    drugName: 'Olopatadine 0.1% Ophthalmic Solution (Patanol)',
    category: 'Mast-Cell Stabilizer & Anti-Allergy Eye Drops',
    route: 'Both Eyes (OU)',
    dosage: '1 Drop',
    frequency: 'Twice Daily (BD — Morning & Evening)',
    duration: '14 Days',
    instructions: 'Relieves ocular itching, allergic conjunctivitis, redness, and watering.',
  },
  {
    drugName: 'Sodium Hyaluronate 0.2% Preservative-Free Lubricant Drops',
    category: 'Artificial Tears & Corneal Surface Lubricant',
    route: 'Both Eyes (OU)',
    dosage: '1–2 Drops',
    frequency: '3 to 4 Times Daily (TDS/QDS)',
    duration: '30 Days',
    instructions: 'Wait at least 10 minutes after medicated drops before applying lubricant drops.',
  },
  {
    drugName: 'Ketorolac Tromethamine 0.5% Ophthalmic Solution (Acular)',
    category: 'Non-Steroidal Anti-Inflammatory (NSAID) Pain Relief Drops',
    route: 'Both Eyes (OU)',
    dosage: '1 Drop',
    frequency: '3 Times Daily (TDS)',
    duration: '5 Days',
    instructions: 'For acute ocular pain, photophobia, and surface inflammation.',
  },
  {
    drugName: 'Cetirizine 10mg Oral Tablet',
    category: 'Systemic Oral Antihistamine',
    route: 'Oral (PO)',
    dosage: '1 Tablet (10mg)',
    frequency: 'Once Daily at Night (NOCTE)',
    duration: '7 Days',
    instructions: 'Swallow with water in the evening for systemic allergic eye & lid swelling relief.',
  },
];

export const DoctorAppointmentsAdminPanel: React.FC<DoctorAppointmentsAdminPanelProps> = ({
  appointments,
  siteConfig = {},
  onSaveSiteConfig,
  onRefresh,
  onStatusFeedback,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedId, setSelectedId] = useState<number | null>(
    appointments.length > 0 ? appointments[0].id : null
  );
  const [savingId, setSavingId] = useState<number | null>(null);

  // Admin Tariff & Bank Account Configuration State
  const [showTariffSettings, setShowTariffSettings] = useState(false);
  const [consultationFeeSetting, setConsultationFeeSetting] = useState<number>(
    Number(siteConfig.appointmentConsultationFeeNgn ?? 15000)
  );
  const [doctorBankName, setDoctorBankName] = useState<string>(
    siteConfig.appointmentBankName || siteConfig.bankName || 'Zenith Bank PLC'
  );
  const [doctorBankAccountNumber, setDoctorBankAccountNumber] = useState<string>(
    siteConfig.appointmentBankAccountNumber || siteConfig.bankAccountNumber || '1018492031'
  );
  const [doctorBankAccountName, setDoctorBankAccountName] = useState<string>(
    siteConfig.appointmentBankAccountName ||
      siteConfig.bankAccountName ||
      'DR. AUSTINE EZEH — VISION CARE EYE CLINIC'
  );
  const [extraChargesList, setExtraChargesList] = useState<AppointmentChargeOption[]>(
    Array.isArray(siteConfig.appointmentExtraCharges) &&
      siteConfig.appointmentExtraCharges.length > 0
      ? siteConfig.appointmentExtraCharges
      : DEFAULT_EXTRA_CHARGES
  );
  const [newChargeName, setNewChargeName] = useState('');
  const [newChargePrice, setNewChargePrice] = useState('');
  const [newChargeDesc, setNewChargeDesc] = useState('');
  const [savingTariff, setSavingTariff] = useState(false);

  useEffect(() => {
    if (siteConfig.appointmentConsultationFeeNgn !== undefined) {
      setConsultationFeeSetting(Number(siteConfig.appointmentConsultationFeeNgn));
    }
    if (siteConfig.appointmentBankName || siteConfig.bankName) {
      setDoctorBankName(siteConfig.appointmentBankName || siteConfig.bankName);
    }
    if (siteConfig.appointmentBankAccountNumber || siteConfig.bankAccountNumber) {
      setDoctorBankAccountNumber(
        siteConfig.appointmentBankAccountNumber || siteConfig.bankAccountNumber
      );
    }
    if (siteConfig.appointmentBankAccountName || siteConfig.bankAccountName) {
      setDoctorBankAccountName(
        siteConfig.appointmentBankAccountName || siteConfig.bankAccountName
      );
    }
    if (
      Array.isArray(siteConfig.appointmentExtraCharges) &&
      siteConfig.appointmentExtraCharges.length > 0
    ) {
      setExtraChargesList(siteConfig.appointmentExtraCharges);
    }
  }, [siteConfig]);

  // Local editable drafts keyed by appointment ID
  const [drafts, setDrafts] = useState<Record<number, Partial<ClinicalAppointmentRecord>>>({});

  // Custom new drug inputs per appointment ID
  const [newDrugMap, setNewDrugMap] = useState<
    Record<
      number,
      {
        drugName: string;
        category: string;
        route: string;
        dosage: string;
        frequency: string;
        duration: string;
        instructions: string;
      }
    >
  >({});

  // Direct Doctor/Admin Message to Patient Account & Registered Email
  const [patientMessageMap, setPatientMessageMap] = useState<Record<number, string>>({});
  const [sendingMessageId, setSendingMessageId] = useState<number | null>(null);

  const handleConfirmPaymentAndForwardToDoctor = async (apt: ClinicalAppointmentRecord) => {
    setSavingId(apt.id);
    try {
      updateDraftField(apt, { paymentStatus: 'paid' });
      const res = await fetch(`/api/admin/appointments/${apt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStatus: 'paid',
          status: apt.status === 'pending_review' ? 'assessed_billed' : apt.status,
        }),
      });
      if (res.ok) {
        onStatusFeedback(
          `Confirmed payment of ${formatNaira(apt.totalChargeNgn)} for ${apt.patientName} (${apt.appointmentNumber}), forwarded file to Attending Doctor, and notified patient via Account & Email (${apt.patientEmail}).`
        );
        await onRefresh();
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleSendMessageToPatientAccountAndEmail = async (apt: ClinicalAppointmentRecord) => {
    const msgText = (patientMessageMap[apt.id] || '').trim();
    if (!msgText) return;
    setSendingMessageId(apt.id);
    try {
      await fetch(`/api/admin/appointments/${apt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customMessageToPatient: msgText,
        }),
      });
      setPatientMessageMap((prev) => ({ ...prev, [apt.id]: '' }));
      onStatusFeedback(
        `Sent clinical message to ${apt.patientName}'s Account Dashboard and registered email (${apt.patientEmail}).`
      );
      await onRefresh();
    } finally {
      setSendingMessageId(null);
    }
  };

  const handleSaveAdminTariffAndAccount = async () => {
    setSavingTariff(true);
    try {
      const payload = {
        appointmentConsultationFeeNgn: Number(consultationFeeSetting || 0),
        appointmentBankName: doctorBankName.trim(),
        appointmentBankAccountNumber: doctorBankAccountNumber.trim(),
        appointmentBankAccountName: doctorBankAccountName.trim(),
        appointmentExtraCharges: extraChargesList,
      };
      if (onSaveSiteConfig) {
        await onSaveSiteConfig(payload);
      } else {
        await fetch('/api/admin/site-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        await onRefresh();
      }
      onStatusFeedback(
        `Saved Consultation Fee (${formatNaira(consultationFeeSetting)}), Extra Charges & Doctor Bank Account (${doctorBankAccountNumber}).`
      );
    } finally {
      setSavingTariff(false);
    }
  };

  const handleAddNewExtraCharge = () => {
    if (!newChargeName.trim()) return;
    const item: AppointmentChargeOption = {
      id: `chg_${Date.now()}`,
      name: newChargeName.trim(),
      priceNgn: Number(newChargePrice || 0),
      description: newChargeDesc.trim() || 'Clinical examination / procedure fee',
      isActive: true,
    };
    setExtraChargesList((prev) => [...prev, item]);
    setNewChargeName('');
    setNewChargePrice('');
    setNewChargeDesc('');
  };

  const getDraft = (apt: ClinicalAppointmentRecord): ClinicalAppointmentRecord => {
    const d = drafts[apt.id] || {};
    const consultationFeeNgn =
      d.consultationFeeNgn !== undefined ? Number(d.consultationFeeNgn) : apt.consultationFeeNgn;
    const treatmentFeeNgn =
      d.treatmentFeeNgn !== undefined ? Number(d.treatmentFeeNgn) : apt.treatmentFeeNgn;
    const totalChargeNgn = consultationFeeNgn + treatmentFeeNgn;
    const allowClientPdfDownload =
      d.allowClientPdfDownload !== undefined
        ? Boolean(d.allowClientPdfDownload)
        : Boolean(apt.allowClientPdfDownload);

    return {
      ...apt,
      ...d,
      consultationFeeNgn,
      treatmentFeeNgn,
      totalChargeNgn,
      allowClientPdfDownload,
      prescribedDrugs: d.prescribedDrugs !== undefined ? d.prescribedDrugs : apt.prescribedDrugs || [],
    };
  };

  const updateDraftField = (apt: ClinicalAppointmentRecord, patch: Partial<ClinicalAppointmentRecord>) => {
    const current = getDraft(apt);
    setDrafts((prev) => ({
      ...prev,
      [apt.id]: {
        ...current,
        ...patch,
      },
    }));
  };

  const handleTogglePdfDownloadPermission = async (apt: ClinicalAppointmentRecord) => {
    const current = getDraft(apt);
    const nextAllowed = !current.allowClientPdfDownload;
    updateDraftField(apt, { allowClientPdfDownload: nextAllowed });
    setSavingId(apt.id);
    try {
      const res = await fetch(`/api/admin/appointments/${apt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowClientPdfDownload: nextAllowed,
        }),
      });
      if (res.ok) {
        onStatusFeedback(
          nextAllowed
            ? `Permitted ${apt.patientName} to download & print Drug Prescription PDF (${apt.appointmentNumber}).`
            : `Locked Drug Prescription PDF download & printing for ${apt.patientName} (${apt.appointmentNumber}).`
        );
        await onRefresh();
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleAddPresetDrug = (apt: ClinicalAppointmentRecord, preset: Omit<PrescribedDrugItem, 'id'>) => {
    const current = getDraft(apt);
    const nextDrug: PrescribedDrugItem = {
      ...preset,
      id: `rx-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`,
      route: apt.affectedEye || preset.route,
    };
    updateDraftField(apt, {
      prescribedDrugs: [...(current.prescribedDrugs || []), nextDrug],
    });
  };

  const handleAddCustomDrug = (apt: ClinicalAppointmentRecord) => {
    const form = newDrugMap[apt.id] || {
      drugName: '',
      category: 'Ophthalmic Eye Drops / Medication',
      route: apt.affectedEye || 'Both Eyes (OU)',
      dosage: '1 Drop',
      frequency: '3 Times Daily (TDS)',
      duration: '7 Days',
      instructions: 'Instill strictly as directed by the Doctor.',
    };
    if (!form.drugName.trim()) return;

    const current = getDraft(apt);
    const nextDrug: PrescribedDrugItem = {
      id: `rx-custom-${Date.now()}`,
      drugName: form.drugName.trim(),
      category: form.category.trim() || 'Ophthalmic Medication',
      route: form.route || apt.affectedEye || 'Both Eyes (OU)',
      dosage: form.dosage.trim() || '1 Drop',
      frequency: form.frequency.trim() || '3 Times Daily (TDS)',
      duration: form.duration.trim() || '7 Days',
      instructions: form.instructions.trim() || 'Use as directed by the Attending Doctor.',
    };

    updateDraftField(apt, {
      prescribedDrugs: [...(current.prescribedDrugs || []), nextDrug],
    });

    setNewDrugMap((prev) => ({
      ...prev,
      [apt.id]: {
        drugName: '',
        category: 'Ophthalmic Eye Drops / Medication',
        route: apt.affectedEye || 'Both Eyes (OU)',
        dosage: '1 Drop',
        frequency: '3 Times Daily (TDS)',
        duration: '7 Days',
        instructions: 'Instill strictly as directed by the Doctor.',
      },
    }));
  };

  const handleRemoveDrug = (apt: ClinicalAppointmentRecord, drugId: string) => {
    const current = getDraft(apt);
    updateDraftField(apt, {
      prescribedDrugs: (current.prescribedDrugs || []).filter((d) => d.id !== drugId),
    });
  };

  const handleSaveDoctorAssessmentAndRx = async (apt: ClinicalAppointmentRecord) => {
    const merged = getDraft(apt);
    setSavingId(apt.id);
    try {
      const res = await fetch(`/api/admin/appointments/${apt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultationFeeNgn: Number(merged.consultationFeeNgn || 0),
          treatmentFeeNgn: Number(merged.treatmentFeeNgn || 0),
          totalChargeNgn: Number(merged.consultationFeeNgn || 0) + Number(merged.treatmentFeeNgn || 0),
          chargeReasonNote: merged.chargeReasonNote,
          status:
            merged.prescribedDrugs && merged.prescribedDrugs.length > 0
              ? 'prescription_issued'
              : merged.status,
          paymentStatus: merged.paymentStatus,
          doctorName: merged.doctorName,
          doctorCredentials: merged.doctorCredentials,
          doctorLicenseNumber: merged.doctorLicenseNumber,
          clinicalDiagnosis: merged.clinicalDiagnosis,
          clinicalNotesAndAdvice: merged.clinicalNotesAndAdvice,
          followUpDate: merged.followUpDate,
          prescribedDrugs: merged.prescribedDrugs,
          allowClientPdfDownload: Boolean(merged.allowClientPdfDownload),
        }),
      });

      if (res.ok) {
        onStatusFeedback(
          `Saved Doctor's complaint charge (${formatNaira(merged.totalChargeNgn)}), Drug Prescription & PDF Permission (${
            merged.allowClientPdfDownload ? 'Permitted' : 'Locked'
          }) for ${apt.patientName}.`
        );
        await onRefresh();
      }
    } finally {
      setSavingId(null);
    }
  };

  const filteredList = appointments.filter((a) => {
    const matchesStatus = statusFilter === 'ALL' ? true : a.status === statusFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      a.appointmentNumber.toLowerCase().includes(q) ||
      a.patientName.toLowerCase().includes(q) ||
      a.patientPhone.toLowerCase().includes(q) ||
      a.complaintCategory.toLowerCase().includes(q) ||
      a.complaintDescription.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const activeAppointment =
    filteredList.find((a) => a.id === selectedId) || filteredList[0] || null;

  return (
    <div className="space-y-6">
      {/* Top Clinical Summary Banner */}
      <div className="bg-[#0B192C] text-white rounded-2xl p-6 border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-widest text-[#C5A059] flex items-center gap-2">
            <Stethoscope className="w-4 h-4" />
            <span>Attending Doctor's Ocular Triage, Billing & Drug Prescription Workstation</span>
          </div>
          <h2 className="text-xl font-semibold">
            Patient Eye Complaints, Medical History, Fee Control & PDF Drug Prescriptions ({appointments.length})
          </h2>
          <p className="text-xs text-slate-300">
            Review patient personal data, uploaded medical history, and eye complaints; manage consultation fees, extra charges, and bank account details; and control client permission to download or print Drug Prescription PDFs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowTariffSettings((prev) => !prev)}
            className="px-3.5 py-2 rounded-lg bg-[#C5A059] text-[#0B192C] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>{showTariffSettings ? 'Hide Fee & Account Settings' : 'Edit Consultation Fee & Bank Account'}</span>
          </button>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patient or complaint..."
              className="pl-9 pr-3 py-2 rounded-lg bg-white/10 border border-white/20 text-xs text-white placeholder:text-slate-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-xs text-white"
          >
            <option value="ALL" className="text-slate-900">All Appointments</option>
            <option value="pending_review" className="text-slate-900">Pending Doctor Review</option>
            <option value="assessed_billed" className="text-slate-900">Assessed & Billed</option>
            <option value="prescription_issued" className="text-slate-900">Drug Prescription Issued</option>
          </select>
        </div>
      </div>

      {/* Admin Control Panel: Consultation Fee, Other Charges & Doctor Bank Account Number */}
      {showTariffSettings && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-[#1E40AF] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                <span>Admin Control — Book Eye Appointment Fees & Doctor Bank Account</span>
              </span>
              <h3 className="text-lg font-semibold text-[#0B192C] mt-0.5">
                Edit Consultation Fee, Other Clinical Charges & Your Account Number Any Day
              </h3>
              <p className="text-xs text-slate-500">
                Any changes saved here immediately update the prices and bank account number shown to clients on the Book Eye Appointment page.
              </p>
            </div>
            <button
              type="button"
              disabled={savingTariff}
              onClick={handleSaveAdminTariffAndAccount}
              className="px-5 py-2.5 bg-[#0B192C] hover:bg-[#162B49] text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer shrink-0"
            >
              <Check className="w-4 h-4 text-[#C5A059]" />
              <span>{savingTariff ? 'Saving Settings...' : 'Save Fees & Account Number'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Standard Consultation Fee (₦)
              </label>
              <input
                type="number"
                value={consultationFeeSetting}
                onChange={(e) => setConsultationFeeSetting(Number(e.target.value || 0))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 font-tabular font-bold text-[#1E40AF]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Doctor's Bank Name
              </label>
              <input
                type="text"
                value={doctorBankName}
                onChange={(e) => setDoctorBankName(e.target.value)}
                placeholder="e.g. Zenith Bank PLC"
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Doctor's Account Number
              </label>
              <input
                type="text"
                value={doctorBankAccountNumber}
                onChange={(e) => setDoctorBankAccountNumber(e.target.value)}
                placeholder="e.g. 1018492031"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 font-tabular font-bold text-[#0B192C]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Account Name
              </label>
              <input
                type="text"
                value={doctorBankAccountName}
                onChange={(e) => setDoctorBankAccountName(e.target.value)}
                placeholder="DR. AUSTINE EZEH — VISION CARE EYE CLINIC"
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          {/* Editable Other Charges List */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <span className="block text-xs font-semibold text-[#0B192C]">
              Other Clinical Charges Shown on Book Eye Appointment Page (Edit price, toggle ON/OFF, or add new charges):
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {extraChargesList.map((chg, index) => (
                <div
                  key={chg.id}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                >
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      value={chg.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setExtraChargesList((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, name: val } : item))
                        );
                      }}
                      className="w-full border border-slate-300 rounded px-2.5 py-1 bg-white font-semibold"
                    />
                    <input
                      type="text"
                      value={chg.description || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setExtraChargesList((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, description: val } : item
                          )
                        );
                      }}
                      placeholder="Short description..."
                      className="w-full border border-slate-200 rounded px-2.5 py-1 bg-white text-[11px] text-slate-600"
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      value={chg.priceNgn}
                      onChange={(e) => {
                        const val = Number(e.target.value || 0);
                        setExtraChargesList((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, priceNgn: val } : item
                          )
                        );
                      }}
                      className="w-24 border border-slate-300 rounded px-2.5 py-1.5 bg-white font-tabular font-bold text-[#1E40AF]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setExtraChargesList((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, isActive: item.isActive === false } : item
                          )
                        )
                      }
                      className={`px-2.5 py-1.5 rounded text-[10px] font-bold uppercase cursor-pointer ${
                        chg.isActive !== false
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {chg.isActive !== false ? 'Active' : 'Hidden'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setExtraChargesList((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                      title="Delete charge"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Future Charge Row */}
            <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 text-xs">
              <input
                type="text"
                value={newChargeName}
                onChange={(e) => setNewChargeName(e.target.value)}
                placeholder="New Charge Name (e.g. Corneal Foreign Body Removal)"
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 bg-white"
              />
              <input
                type="number"
                value={newChargePrice}
                onChange={(e) => setNewChargePrice(e.target.value)}
                placeholder="Price (₦)"
                className="w-full sm:w-32 border border-slate-300 rounded-lg px-3 py-2 bg-white font-tabular"
              />
              <input
                type="text"
                value={newChargeDesc}
                onChange={(e) => setNewChargeDesc(e.target.value)}
                placeholder="Optional note / description"
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 bg-white"
              />
              <button
                type="button"
                onClick={handleAddNewExtraCharge}
                className="px-4 py-2 bg-[#0B192C] text-white font-semibold rounded-lg hover:bg-[#162B49] flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-[#C5A059]" />
                <span>Add Charge</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Split Workstation: Left Queue + Right Doctor's Clinical Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Patient Complaint Queue */}
        <div className="lg:col-span-4 space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
          {filteredList.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
              No patient eye appointments match your filter.
            </div>
          ) : (
            filteredList.map((apt) => {
              const isSelected = activeAppointment?.id === apt.id;
              return (
                <button
                  key={apt.id}
                  type="button"
                  onClick={() => setSelectedId(apt.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${
                    isSelected
                      ? 'bg-[#0B192C] text-white border-[#0B192C] shadow-sm'
                      : 'bg-white hover:bg-slate-50 text-[#0B192C] border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-bold font-tabular ${
                        isSelected ? 'text-[#C5A059]' : 'text-[#1E40AF]'
                      }`}
                    >
                      {apt.appointmentNumber}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold flex items-center gap-1 ${
                          apt.allowClientPdfDownload
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {apt.allowClientPdfDownload ? (
                          <>
                            <Unlock className="w-2.5 h-2.5" />
                            <span>PDF Permitted</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-2.5 h-2.5" />
                            <span>PDF Locked</span>
                          </>
                        )}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                          apt.urgencyLevel === 'Urgent / Acute'
                            ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30'
                            : isSelected
                            ? 'bg-white/10 text-slate-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {apt.urgencyLevel}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold">
                      {apt.patientName} ({apt.patientAge} yrs, {apt.patientGender})
                    </h4>
                    <p className={`text-xs mt-0.5 ${isSelected ? 'text-slate-300' : 'text-slate-600'}`}>
                      {apt.complaintCategory} · <strong>{apt.affectedEye}</strong>
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/20 text-[11px] font-tabular">
                    <span>
                      Bill: <strong>{formatNaira(apt.totalChargeNgn || 0)}</strong> ({apt.paymentStatus})
                    </span>
                    <span className={isSelected ? 'text-[#C5A059]' : 'text-[#1E40AF] font-semibold'}>
                      {(apt.prescribedDrugs || []).length} Rx Drug(s) →
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right Column: Active Patient Complaint, Charge Builder & Drug Prescription Writer */}
        <div className="lg:col-span-8">
          {!activeAppointment ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-xs text-slate-500">
              Select a patient appointment on the left to review their complaint, set the charge, and write their drug prescription.
            </div>
          ) : (
            (() => {
              const draft = getDraft(activeAppointment);
              const newDrugForm = newDrugMap[activeAppointment.id] || {
                drugName: '',
                category: 'Ophthalmic Eye Drops / Medication',
                route: activeAppointment.affectedEye || 'Both Eyes (OU)',
                dosage: '1 Drop',
                frequency: '3 Times Daily (TDS)',
                duration: '7 Days',
                instructions: 'Instill strictly as directed by the Doctor.',
              };

              return (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
                  {/* Top Bar with Admin PDF Permission Gate & Doctor PDF Preview */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <span className="text-xs font-bold text-[#1E40AF] font-tabular">
                        {draft.appointmentNumber} · Booked for {draft.preferredDate} ({draft.preferredTimeSlot})
                      </span>
                      <h3 className="text-xl font-semibold text-[#0B192C] mt-0.5">
                        {draft.patientName} — {draft.complaintCategory}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleTogglePdfDownloadPermission(activeAppointment)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                          draft.allowClientPdfDownload
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {draft.allowClientPdfDownload ? (
                          <>
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Client PDF Permitted (Click to Lock)</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>Permit Client to Download & Print PDF</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => exportDrugPrescriptionToPdf(draft)}
                        className="px-3.5 py-2 bg-[#0B192C] hover:bg-[#162B49] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>Doctor PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => printDrugPrescriptionSlip(draft)}
                        className="px-3.5 py-2 border border-slate-300 hover:bg-slate-50 text-[#0B192C] text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-[#1E40AF]" />
                        <span>Print</span>
                      </button>
                    </div>
                  </div>

                  {/* Admin Payment Verification Gate Banner */}
                  <div
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                      draft.paymentStatus === 'paid'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        : draft.paymentStatus === 'pending_verification'
                        ? 'bg-amber-50 border-amber-300 text-amber-950'
                        : 'bg-rose-50 border-rose-200 text-rose-950'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>
                          {draft.paymentStatus === 'paid'
                            ? '✓ Payment Verified by Admin — File Forwarded to Attending Doctor'
                            : draft.paymentStatus === 'pending_verification'
                            ? '⏳ Client Submitted Payment Reference — Awaiting Admin Verification'
                            : '⚠️ Unpaid Booking — Do Not Forward to Doctor Until Payment is Confirmed'}
                        </span>
                      </div>
                      <p className="text-[11px]">
                        <strong>Bill Amount:</strong> {formatNaira(draft.totalChargeNgn)} ·{' '}
                        <strong>Method:</strong> {(draft.paymentMethod || 'N/A').toUpperCase()} ·{' '}
                        <strong>Reference / Teller No:</strong>{' '}
                        <span className="font-tabular font-semibold">
                          {draft.paymentReference || 'No reference submitted yet'}
                        </span>
                      </p>
                    </div>

                    {draft.paymentStatus !== 'paid' && (
                      <button
                        type="button"
                        disabled={savingId === activeAppointment.id}
                        onClick={() => handleConfirmPaymentAndForwardToDoctor(activeAppointment)}
                        className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
                      >
                        <Check className="w-4 h-4" />
                        <span>Confirm Payment &amp; Forward to Doctor</span>
                      </button>
                    )}
                  </div>

                  {/* Direct Doctor / Admin Message Composer (Sends to Patient Account & Registered Email) */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#0B192C] flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-[#1E40AF]" />
                        <span>
                          Send Message to {draft.patientName}&apos;s Account &amp; Registered Email (
                          {draft.patientEmail})
                        </span>
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={patientMessageMap[activeAppointment.id] || ''}
                        onChange={(e) =>
                          setPatientMessageMap((prev) => ({
                            ...prev,
                            [activeAppointment.id]: e.target.value,
                          }))
                        }
                        placeholder="Type message, appointment instruction, or payment confirmation note for this patient..."
                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 bg-white"
                      />
                      <button
                        type="button"
                        disabled={
                          sendingMessageId === activeAppointment.id ||
                          !(patientMessageMap[activeAppointment.id] || '').trim()
                        }
                        onClick={() =>
                          handleSendMessageToPatientAccountAndEmail(activeAppointment)
                        }
                        className="px-4 py-2 bg-[#0B192C] hover:bg-[#162B49] disabled:opacity-50 text-white font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Send className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>
                          {sendingMessageId === activeAppointment.id
                            ? 'Sending...'
                            : 'Send to Account & Email'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Section A: Patient Personal Data, Uploaded Medical History & Eye Complaint Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                      <span className="font-semibold uppercase tracking-wider text-[#1E40AF] text-[11px] flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        <span>Client Personal Data & Secure Medical History</span>
                      </span>
                      <p>
                        <strong>Full Name:</strong> {draft.patientName} ({draft.patientAge} yrs ·{' '}
                        {draft.patientGender})
                      </p>
                      <p>
                        <strong>Phone:</strong> {draft.patientPhone}
                      </p>
                      <p>
                        <strong>Email:</strong> {draft.patientEmail}
                      </p>
                      <p>
                        <strong>Occupation:</strong> {draft.patientOccupation || 'Not specified'}
                      </p>
                      <p>
                        <strong>Address:</strong> {draft.patientAddress || 'Not specified'}
                      </p>
                      <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 space-y-1.5">
                        <p className="font-semibold">
                          Brief Medical History & Drug Allergies:
                        </p>
                        <p className="text-slate-800">
                          {draft.medicalHistoryAndAllergies || 'None reported'}
                        </p>
                        {draft.medicalHistoryFileUrl && (
                          <div className="pt-1.5 border-t border-rose-200/70 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-emerald-800 flex items-center gap-1 truncate">
                                <FileText className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">
                                  {draft.medicalHistoryFileName || 'Patient Medical History Attachment'}
                                </span>
                              </span>
                              <a
                                href={draft.medicalHistoryFileUrl}
                                download={
                                  draft.medicalHistoryFileName ||
                                  `Medical-History-${draft.appointmentNumber}`
                                }
                                className="px-2.5 py-1 rounded bg-[#0B192C] text-white text-[11px] font-semibold shrink-0 hover:bg-[#162B49]"
                              >
                                Download File
                              </a>
                            </div>
                            {draft.medicalHistoryFileUrl.startsWith('data:image/') && (
                              <img
                                src={draft.medicalHistoryFileUrl}
                                alt="Patient uploaded medical history"
                                className="max-h-36 rounded-lg border border-slate-300 object-contain bg-white p-1"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 text-xs space-y-1.5">
                      <span className="font-semibold uppercase tracking-wider text-amber-900 text-[11px] flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        <span>Client's Reported Eye Complaint & Symptoms</span>
                      </span>
                      <p>
                        <strong>Category:</strong> {draft.complaintCategory}
                      </p>
                      <p>
                        <strong>Affected Eye(s):</strong> {draft.affectedEye} ·{' '}
                        <strong>Duration:</strong> {draft.symptomDuration} ·{' '}
                        <strong>Urgency:</strong> {draft.urgencyLevel}
                      </p>
                      <p className="text-[#0B192C] bg-white p-2.5 rounded-lg border border-amber-200/80">
                        “{draft.complaintDescription}”
                      </p>
                      <p>
                        <strong>Medications Already Used:</strong> {draft.previousMedicationsUsed || 'None'}
                      </p>
                      <p>
                        <strong>Consultation Mode:</strong> {draft.consultationMode}
                      </p>
                      {Array.isArray(draft.selectedExtraCharges) &&
                        draft.selectedExtraCharges.length > 0 && (
                          <div className="pt-1 text-[11px] text-[#0B192C]">
                            <strong>Client Selected Extra Charges:</strong>{' '}
                            {draft.selectedExtraCharges
                              .map((c) => `${c.name} (${formatNaira(c.priceNgn)})`)
                              .join(', ')}
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Section B: Doctor's Complaint-Based Charging */}
                  <div className="p-5 rounded-xl bg-[#FAF9F6] border border-slate-200 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#1E40AF] flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>1. Charge Client Based on the Complaint Given</span>
                        </span>
                        <p className="text-xs text-slate-600">
                          Set the consultation fee and complaint/treatment fee based on the complexity of the eye issue, complication, or infection.
                        </p>
                      </div>

                      {/* Quick Complaint Charge Presets */}
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          {
                            label: 'Standard Complaint (₦15k)',
                            consult: 10000,
                            treat: 5000,
                            note: 'Standard Eye Complaint Consultation & Ophthalmic Prescription',
                          },
                          {
                            label: 'Acute Eye Infection (₦25k)',
                            consult: 15000,
                            treat: 10000,
                            note: 'Acute Eye Infection Consultation + Slit-Lamp & Corneal Workup',
                          },
                          {
                            label: 'Severe Complication (₦45k)',
                            consult: 20000,
                            treat: 25000,
                            note: 'Urgent Ocular Complication Evaluation & Intensive Therapeutic Management',
                          },
                        ].map((tier) => (
                          <button
                            key={tier.label}
                            type="button"
                            onClick={() =>
                              updateDraftField(activeAppointment, {
                                consultationFeeNgn: tier.consult,
                                treatmentFeeNgn: tier.treat,
                                chargeReasonNote: tier.note,
                                paymentStatus:
                                  draft.paymentStatus === 'awaiting_doctor_bill'
                                    ? 'unpaid'
                                    : draft.paymentStatus,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-[11px] font-semibold text-[#0B192C] cursor-pointer"
                          >
                            {tier.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Consultation Fee (₦)
                        </label>
                        <input
                          type="number"
                          value={draft.consultationFeeNgn}
                          onChange={(e) =>
                            updateDraftField(activeAppointment, {
                              consultationFeeNgn: Number(e.target.value || 0),
                            })
                          }
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white font-tabular font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Other / Treatment Fee (₦)
                        </label>
                        <input
                          type="number"
                          value={draft.treatmentFeeNgn}
                          onChange={(e) =>
                            updateDraftField(activeAppointment, {
                              treatmentFeeNgn: Number(e.target.value || 0),
                            })
                          }
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white font-tabular font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Total Client Bill (₦)
                        </label>
                        <div className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-slate-100 font-tabular font-bold text-[#1E40AF]">
                          {formatNaira(draft.totalChargeNgn)}
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Payment Status
                        </label>
                        <select
                          value={draft.paymentStatus}
                          onChange={(e) =>
                            updateDraftField(activeAppointment, {
                              paymentStatus: e.target.value as any,
                            })
                          }
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white font-semibold"
                        >
                          <option value="awaiting_doctor_bill">Awaiting Doctor Bill</option>
                          <option value="unpaid">Unpaid (Billed to Client)</option>
                          <option value="pending_verification">Pending Transfer Verification</option>
                          <option value="paid">Paid & Verified</option>
                        </select>
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block font-semibold text-slate-700 mb-1">
                          Charge Breakdown / Billing Explanation Note for Client
                        </label>
                        <input
                          type="text"
                          value={draft.chargeReasonNote}
                          onChange={(e) =>
                            updateDraftField(activeAppointment, {
                              chargeReasonNote: e.target.value,
                            })
                          }
                          placeholder="Explain the charge based on the patient's eye complaint..."
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section C: Doctor's Clinical Diagnosis & Drug Prescription Builder (Rx) */}
                  <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-[#1E40AF] flex items-center gap-1.5">
                          <Pill className="w-3.5 h-3.5" />
                          <span>2. Write Clinical Diagnosis & Drug Prescription (Rx) for Client</span>
                        </span>
                        <p className="text-xs text-slate-500">
                          Enter your clinical findings and prescribe eye drops, ointments, or oral medications. Control whether the client is permitted to download/print the PDF.
                        </p>
                      </div>

                      {/* Explicit Checkbox / Toggle for Client PDF Download Permission */}
                      <label className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5 text-xs font-semibold text-[#0B192C] cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={Boolean(draft.allowClientPdfDownload)}
                          onChange={(e) =>
                            updateDraftField(activeAppointment, {
                              allowClientPdfDownload: e.target.checked,
                            })
                          }
                          className="rounded border-slate-300"
                        />
                        <span>Permit Client to Download & Print Drug Rx PDF</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Attending Doctor Name
                        </label>
                        <input
                          type="text"
                          value={draft.doctorName}
                          onChange={(e) =>
                            updateDraftField(activeAppointment, { doctorName: e.target.value })
                          }
                          className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Doctor Credentials / Specialty
                        </label>
                        <input
                          type="text"
                          value={draft.doctorCredentials}
                          onChange={(e) =>
                            updateDraftField(activeAppointment, {
                              doctorCredentials: e.target.value,
                            })
                          }
                          className="w-full border border-slate-300 rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          License / Reg Number
                        </label>
                        <input
                          type="text"
                          value={draft.doctorLicenseNumber}
                          onChange={(e) =>
                            updateDraftField(activeAppointment, {
                              doctorLicenseNumber: e.target.value,
                            })
                          }
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 font-tabular"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-slate-700 mb-1">
                          Clinical Diagnosis (Based on Complaint & Examination) *
                        </label>
                        <input
                          type="text"
                          value={draft.clinicalDiagnosis}
                          onChange={(e) =>
                            updateDraftField(activeAppointment, {
                              clinicalDiagnosis: e.target.value,
                            })
                          }
                          placeholder="e.g. Acute Bacterial Conjunctivitis (OU), Allergic Keratoconjunctivitis, Corneal Abrasion..."
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Follow-Up Date
                        </label>
                        <input
                          type="date"
                          value={draft.followUpDate}
                          onChange={(e) =>
                            updateDraftField(activeAppointment, { followUpDate: e.target.value })
                          }
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 font-tabular"
                        />
                      </div>
                    </div>

                    {/* Quick-Add Ophthalmic Drug Templates */}
                    <div className="space-y-2">
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                        Quick-Add Common Ophthalmic Medications to Prescription:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {OPHTHALMIC_DRUG_PRESETS.map((preset) => (
                          <button
                            key={preset.drugName}
                            type="button"
                            onClick={() => handleAddPresetDrug(activeAppointment, preset)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-[#0B192C] hover:text-white text-slate-700 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>{preset.drugName.split(' (')[0]}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Drug Entry Row */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                      <span className="font-semibold text-[#0B192C] block">
                        Add Custom Drug / Eye Drop / Ointment / Tablet to Prescription:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <input
                          type="text"
                          value={newDrugForm.drugName}
                          onChange={(e) =>
                            setNewDrugMap((prev) => ({
                              ...prev,
                              [activeAppointment.id]: { ...newDrugForm, drugName: e.target.value },
                            }))
                          }
                          placeholder="Drug Name & Strength (e.g. Gentamicin 0.3% Drops)"
                          className="sm:col-span-2 border border-slate-300 rounded-lg px-3 py-2 bg-white"
                        />
                        <input
                          type="text"
                          value={newDrugForm.category}
                          onChange={(e) =>
                            setNewDrugMap((prev) => ({
                              ...prev,
                              [activeAppointment.id]: { ...newDrugForm, category: e.target.value },
                            }))
                          }
                          placeholder="Category (e.g. Antibiotic Eye Drops)"
                          className="border border-slate-300 rounded-lg px-3 py-2 bg-white"
                        />
                        <select
                          value={newDrugForm.route}
                          onChange={(e) =>
                            setNewDrugMap((prev) => ({
                              ...prev,
                              [activeAppointment.id]: { ...newDrugForm, route: e.target.value },
                            }))
                          }
                          className="border border-slate-300 rounded-lg px-3 py-2 bg-white"
                        >
                          <option value="Both Eyes (OU)">Both Eyes (OU)</option>
                          <option value="Right Eye (OD)">Right Eye (OD)</option>
                          <option value="Left Eye (OS)">Left Eye (OS)</option>
                          <option value="Oral (PO)">Oral Tablet / Capsule (PO)</option>
                        </select>
                        <input
                          type="text"
                          value={newDrugForm.dosage}
                          onChange={(e) =>
                            setNewDrugMap((prev) => ({
                              ...prev,
                              [activeAppointment.id]: { ...newDrugForm, dosage: e.target.value },
                            }))
                          }
                          placeholder="Dosage (e.g. 1 Drop, 1 Tablet)"
                          className="border border-slate-300 rounded-lg px-3 py-2 bg-white"
                        />
                        <input
                          type="text"
                          value={newDrugForm.frequency}
                          onChange={(e) =>
                            setNewDrugMap((prev) => ({
                              ...prev,
                              [activeAppointment.id]: { ...newDrugForm, frequency: e.target.value },
                            }))
                          }
                          placeholder="Frequency (e.g. Every 4 Hours, TDS, BD)"
                          className="border border-slate-300 rounded-lg px-3 py-2 bg-white"
                        />
                        <input
                          type="text"
                          value={newDrugForm.duration}
                          onChange={(e) =>
                            setNewDrugMap((prev) => ({
                              ...prev,
                              [activeAppointment.id]: { ...newDrugForm, duration: e.target.value },
                            }))
                          }
                          placeholder="Duration (e.g. 7 Days, 14 Days)"
                          className="border border-slate-300 rounded-lg px-3 py-2 bg-white"
                        />
                        <input
                          type="text"
                          value={newDrugForm.instructions}
                          onChange={(e) =>
                            setNewDrugMap((prev) => ({
                              ...prev,
                              [activeAppointment.id]: {
                                ...newDrugForm,
                                instructions: e.target.value,
                              },
                            }))
                          }
                          placeholder="Special clinical instructions..."
                          className="sm:col-span-2 border border-slate-300 rounded-lg px-3 py-2 bg-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddCustomDrug(activeAppointment)}
                        className="px-4 py-2 bg-[#0B192C] text-white text-xs font-semibold rounded-lg hover:bg-[#162B49] cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#C5A059]" />
                        <span>Add Medication to Rx List</span>
                      </button>
                    </div>

                    {/* Current Prescribed Drugs Table */}
                    <div className="space-y-2">
                      <span className="block text-xs font-semibold text-[#0B192C]">
                        Prescribed Medications on This Rx ({(draft.prescribedDrugs || []).length}):
                      </span>
                      {(draft.prescribedDrugs || []).length === 0 ? (
                        <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
                          No medications added yet. Click a quick-add drug above or enter a custom drug.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {draft.prescribedDrugs.map((drug, idx) => (
                            <div
                              key={drug.id || idx}
                              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="font-semibold text-[#0B192C]">
                                  {idx + 1}. {drug.drugName}{' '}
                                  <span className="text-[#1E40AF] font-normal">({drug.category})</span>
                                </div>
                                <div className="text-slate-700">
                                  <strong>Route:</strong> {drug.route} · <strong>Dosage:</strong>{' '}
                                  {drug.dosage} · <strong>Frequency:</strong> {drug.frequency} ·{' '}
                                  <strong>Duration:</strong> {drug.duration}
                                </div>
                                <div className="text-slate-500 text-[11px]">
                                  Instructions: {drug.instructions}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveDrug(activeAppointment, drug.id)}
                                className="p-2 text-slate-400 hover:text-rose-600 self-end sm:self-center cursor-pointer"
                                title="Remove drug"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Doctor's Clinical Advice */}
                    <div className="text-xs">
                      <label className="block font-semibold text-slate-700 mb-1">
                        Doctor's Clinical Advice, Ocular Hygiene & Precautions
                      </label>
                      <textarea
                        rows={3}
                        value={draft.clinicalNotesAndAdvice}
                        onChange={(e) =>
                          updateDraftField(activeAppointment, {
                            clinicalNotesAndAdvice: e.target.value,
                          })
                        }
                        placeholder="Enter ocular hygiene advice, contact lens restrictions, warm compress instructions, or red-flag warning signs..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </div>

                    {/* Save & Issue Button */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200">
                      <span className="text-xs text-slate-500">
                        Saving updates the client’s portal with your diagnosis, bill, and PDF permission status.
                      </span>
                      <button
                        type="button"
                        disabled={savingId === activeAppointment.id}
                        onClick={() => handleSaveDoctorAssessmentAndRx(activeAppointment)}
                        className="px-6 py-3 bg-[#1E40AF] hover:bg-blue-800 text-white text-xs font-semibold rounded-xl flex items-center gap-2 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>
                          {savingId === activeAppointment.id
                            ? 'Saving Charge & Issuing Rx...'
                            : 'Save Charge, Rx & Client PDF Permission'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
};
