export interface Product {
  id: number;
  sku: string;
  name: string;
  brand: string;
  category: string;
  gender: string;
  shape: string;
  rimStyle: string;
  material: string;
  dimensions: string;
  priceNgn: number;
  discountPriceNgn: number | null;
  colorsJson: string;
  imagesJson: string;
  stockQuantity: number;
  isProtectiveReady: boolean;
  defaultProtectiveType: string;
  isFeatured: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  isActive: boolean;
  description: string;
  createdAt?: string;
}

export interface LensType {
  id: number;
  code: string;
  name: string;
  category: string;
  tier: string;
  description: string;
  optionsJson: string;
  priceNgn: number;
  isActive: boolean;
}

export interface LensCoating {
  id: number;
  code: string;
  name: string;
  groupType: 'tint_treatment' | 'index_material' | 'addon_feature' | string;
  description: string;
  priceNgn: number;
  compatibleWithJson: string;
  isActive: boolean;
}

export interface PrescriptionData {
  id?: number;
  patientName: string;
  submissionType: 'manual' | 'upload_ocr';
  odSph: string;
  odCyl: string;
  odAxis: string;
  odAdd: string;
  osSph: string;
  osCyl: string;
  osAxis: string;
  osAdd: string;
  pd: string;
  monocularPdOd: string;
  monocularPdOs: string;
  prescriptionDate: string;
  doctorName: string;
  notes: string;
  documentDataUrl?: string;
  documentFileName?: string;
  ocrConfidenceNotes?: string;
  unreadableFields?: string[];
  unreadableFieldsJson?: string;
  customerConfirmed: boolean;
  verificationStatus?: string;
  adminFeedback?: string;
  createdAt?: string;
}

export interface CartItem {
  cartItemId: string;
  productId: number | null;
  productName: string;
  productBrand: string;
  productImage: string;
  orderType: 'prescription_glasses' | 'frames_only' | 'protective_glasses' | 'replacement_lenses';
  selectedColor: string;
  quantity: number;
  framePriceNgn: number;
  lensTypeName: string;
  lensOptionSelected: string;
  lensPriceNgn: number;
  coatingSummary: string;
  coatingPriceNgn: number;
  prescriptionSnapshot?: PrescriptionData | null;
  unitTotalNgn: number;
}

export interface OrderRecord {
  id: number;
  orderNumber: string;
  userUid: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryMethod: string;
  orderNotes: string;
  subtotalNgn: number;
  deliveryFeeNgn: number;
  discountNgn: number;
  couponCode: string;
  totalNgn: number;
  paymentMethod: string;
  paymentReference: string;
  paymentStatus: string;
  orderStatus: string;
  internalAdminNotes: string;
  prescriptionId: number | null;
  createdAt: string;
  items: Array<{
    id: number;
    productId: number | null;
    productName: string;
    productBrand: string;
    productImage: string;
    orderType: string;
    selectedColor: string;
    quantity: number;
    framePriceNgn: number;
    lensTypeName: string;
    lensOptionSelected: string;
    lensPriceNgn: number;
    coatingSummary: string;
    coatingPriceNgn: number;
    prescriptionSnapshotJson: string;
    unitTotalNgn: number;
  }>;
}

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  phone: string;
  role: 'customer' | 'admin' | string;
  emailVerified: boolean;
  createdAt?: string;
}

export interface AddressRecord {
  id: number;
  userUid: string;
  label: string;
  recipientName: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  isDefault: boolean;
}

export interface EnquiryRecord {
  id: number;
  userUid: string;
  customerName: string;
  customerEmail: string;
  orderNumber: string;
  subject: string;
  message: string;
  status: string;
  adminReply: string;
  createdAt: string;
}

export interface ReviewRecord {
  id: number;
  userUid: string;
  customerName: string;
  customerRole: string;
  productId: number | null;
  rating: number;
  comment: string;
  isApproved?: boolean;
  createdAt: string;
}

export type ReviewItem = ReviewRecord;

export interface NotificationItem {
  id: number;
  userUid: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface CouponRecord {
  id: number;
  code: string;
  discountPercent: number;
  minOrderNgn: number;
  isActive: boolean;
}

export interface PrescribedDrugItem {
  id: string;
  drugName: string;
  category: string;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface AppointmentChargeOption {
  id: string;
  name: string;
  label?: string;
  description?: string;
  priceNgn: number;
  isMandatory?: boolean;
  isActive?: boolean;
}

export interface DeliveryMethodConfig {
  id: string;
  name: string;
  description?: string;
  estimatedDays?: string;
  estimatedTime?: string;
  priceNgn: number;
  freeThresholdNgn: number | null;
  isActive?: boolean;
}

export interface ClinicalAppointmentRecord {
  id: number;
  appointmentNumber: string;
  userUid: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  patientAge: string;
  patientGender: string;
  patientOccupation: string;
  patientAddress: string;
  medicalHistoryAndAllergies: string;
  medicalHistoryFileUrl?: string;
  medicalHistoryFileName?: string;
  selectedExtraCharges?: Array<{ id: string; name: string; label?: string; priceNgn: number }>;
  allowClientPdfDownload?: boolean;
  complaintCategory: string;
  affectedEye: string;
  symptomDuration: string;
  urgencyLevel: 'Routine' | 'Moderate' | 'Urgent / Acute';
  complaintDescription: string;
  previousMedicationsUsed: string;
  preferredDate: string;
  preferredTimeSlot: string;
  consultationMode: string;
  status: 'pending_review' | 'assessed_billed' | 'paid' | 'prescription_issued' | 'completed';
  consultationFeeNgn: number;
  treatmentFeeNgn: number;
  totalChargeNgn: number;
  chargeReasonNote: string;
  paymentStatus: 'awaiting_doctor_bill' | 'unpaid' | 'pending_verification' | 'paid';
  paymentMethod: string;
  paymentReference: string;
  doctorName: string;
  doctorCredentials: string;
  doctorLicenseNumber: string;
  clinicalDiagnosis: string;
  clinicalNotesAndAdvice: string;
  followUpDate: string;
  prescribedDrugs: PrescribedDrugItem[];
  prescriptionIssuedAt?: string;
  createdAt: string;
  updatedAt?: string;
}


