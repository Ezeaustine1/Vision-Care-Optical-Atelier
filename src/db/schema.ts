import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name').default(''),
  phone: text('phone').default(''),
  role: text('role').default('customer').notNull(), // 'customer' | 'admin'
  emailVerified: boolean('email_verified').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').default(''),
  categoryType: text('category_type').default('frame').notNull(), // 'frame' | 'lens' | 'protective'
  createdAt: timestamp('created_at').defaultNow(),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  brand: text('brand').notNull(),
  category: text('category').notNull(), // 'Men', 'Women', 'Unisex', 'Children', 'Protective', 'Luxury', 'Sports'
  gender: text('gender').notNull(), // 'Men' | 'Women' | 'Unisex' | 'Children'
  shape: text('shape').notNull(), // 'Round' | 'Square' | 'Rectangle' | 'Cat-Eye' | 'Aviator'
  rimStyle: text('rim_style').notNull(), // 'Full-Rim' | 'Half-Rim' | 'Rimless'
  material: text('material').notNull(), // 'Italian Acetate' | 'Japanese Titanium' | 'Stainless Steel' | 'TR90 Composite'
  dimensions: text('dimensions').notNull(), // e.g., '52-18-145 mm'
  priceNgn: integer('price_ngn').notNull(),
  discountPriceNgn: integer('discount_price_ngn'),
  colorsJson: text('colors_json').notNull(), // JSON array of color strings
  imagesJson: text('images_json').notNull(), // JSON array of image URLs
  stockQuantity: integer('stock_quantity').default(25).notNull(),
  isProtectiveReady: boolean('is_protective_ready').default(false).notNull(),
  defaultProtectiveType: text('default_protective_type').default(''),
  isFeatured: boolean('is_featured').default(false).notNull(),
  isBestSeller: boolean('is_best_seller').default(false).notNull(),
  isNewArrival: boolean('is_new_arrival').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const lensTypes = pgTable('lens_types', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(), // 'single_vision' | 'bifocal' | 'invisible_bifocal' | 'progressive_varilux' | 'non_prescription'
  tier: text('tier').default('Standard').notNull(),
  description: text('description').notNull(),
  optionsJson: text('options_json').notNull(), // JSON array of sub-options e.g. ["Distance Vision", "Near Reading"]
  priceNgn: integer('price_ngn').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const lensCoatings = pgTable('lens_coatings', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  groupType: text('group_type').notNull(), // 'tint_treatment' | 'addon_feature' | 'index_material'
  description: text('description').notNull(),
  priceNgn: integer('price_ngn').notNull(),
  compatibleWithJson: text('compatible_with_json').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const prescriptions = pgTable('prescriptions', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  patientName: text('patient_name').notNull(),
  submissionType: text('submission_type').notNull(), // 'manual' | 'upload_ocr'
  odSph: text('od_sph').default('0.00').notNull(),
  odCyl: text('od_cyl').default('0.00').notNull(),
  odAxis: text('od_axis').default('0').notNull(),
  odAdd: text('od_add').default('0.00').notNull(),
  osSph: text('os_sph').default('0.00').notNull(),
  osCyl: text('os_cyl').default('0.00').notNull(),
  osAxis: text('os_axis').default('0').notNull(),
  osAdd: text('os_add').default('0.00').notNull(),
  pd: text('pd').default('63').notNull(),
  monocularPdOd: text('monocular_pd_od').default(''),
  monocularPdOs: text('monocular_pd_os').default(''),
  prescriptionDate: text('prescription_date').default(''),
  doctorName: text('doctor_name').default(''),
  notes: text('notes').default(''),
  documentDataUrl: text('document_data_url').default(''),
  documentFileName: text('document_file_name').default(''),
  ocrConfidenceNotes: text('ocr_confidence_notes').default(''),
  unreadableFieldsJson: text('unreadable_fields_json').default('[]'),
  customerConfirmed: boolean('customer_confirmed').default(true).notNull(),
  verificationStatus: text('verification_status').default('pending_review').notNull(), // 'pending_review' | 'verified' | 'clarification_requested'
  adminFeedback: text('admin_feedback').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  userUid: text('user_uid').notNull(),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  customerPhone: text('customer_phone').notNull(),
  deliveryAddress: text('delivery_address').notNull(),
  deliveryCity: text('delivery_city').notNull(),
  deliveryState: text('delivery_state').notNull(),
  deliveryMethod: text('delivery_method').default('Express Courier (Lagos & Nationwide)').notNull(),
  orderNotes: text('order_notes').default(''),
  subtotalNgn: integer('subtotal_ngn').notNull(),
  deliveryFeeNgn: integer('delivery_fee_ngn').notNull(),
  discountNgn: integer('discount_ngn').default(0).notNull(),
  couponCode: text('coupon_code').default(''),
  totalNgn: integer('total_ngn').notNull(),
  paymentMethod: text('payment_method').notNull(), // 'paystack' | 'flutterwave' | 'bank_transfer'
  paymentReference: text('payment_reference').default('').notNull(),
  paymentStatus: text('payment_status').default('pending').notNull(), // 'paid' | 'pending_verification' | 'pending' | 'refunded'
  orderStatus: text('order_status').default('Order received').notNull(),
  internalAdminNotes: text('internal_admin_notes').default(''),
  prescriptionId: integer('prescription_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id)
    .notNull(),
  productId: integer('product_id'),
  productName: text('product_name').notNull(),
  productBrand: text('product_brand').default('VISION CARE').notNull(),
  productImage: text('product_image').default(''),
  orderType: text('order_type').notNull(), // 'prescription_glasses' | 'frames_only' | 'protective_glasses' | 'replacement_lenses'
  selectedColor: text('selected_color').default('Default').notNull(),
  quantity: integer('quantity').default(1).notNull(),
  framePriceNgn: integer('frame_price_ngn').default(0).notNull(),
  lensTypeName: text('lens_type_name').default('None').notNull(),
  lensOptionSelected: text('lens_option_selected').default(''),
  lensPriceNgn: integer('lens_price_ngn').default(0).notNull(),
  coatingSummary: text('coating_summary').default('Standard Clear').notNull(),
  coatingPriceNgn: integer('coating_price_ngn').default(0).notNull(),
  prescriptionSnapshotJson: text('prescription_snapshot_json').default('{}'),
  unitTotalNgn: integer('unit_total_ngn').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const addresses = pgTable('addresses', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  label: text('label').notNull(), // 'Home', 'Office'
  recipientName: text('recipient_name').notNull(),
  phone: text('phone').notNull(),
  streetAddress: text('street_address').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const wishlists = pgTable('wishlists', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  productId: integer('product_id')
    .references(() => products.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  customerName: text('customer_name').notNull(),
  customerRole: text('customer_role').default('Verified Buyer').notNull(),
  productId: integer('product_id'),
  rating: integer('rating').default(5).notNull(),
  comment: text('comment').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  discountPercent: integer('discount_percent').notNull(),
  minOrderNgn: integer('min_order_ngn').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const enquiries = pgTable('enquiries', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').default(''),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  orderNumber: text('order_number').default(''),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  status: text('status').default('open').notNull(), // 'open' | 'responded'
  adminReply: text('admin_reply').default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

export const siteContent = pgTable('site_content', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  valueJson: text('value_json').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));
