import { db } from './index.ts';
import {
  users,
  categories,
  products,
  lensTypes,
  lensCoatings,
  prescriptions,
  orders,
  orderItems,
  addresses,
  wishlists,
  reviews,
  coupons,
  notifications,
  enquiries,
  siteContent,
} from './schema.ts';
import { eq, desc, and } from 'drizzle-orm';
import { resolveAutomatedStageNotification } from '../lib/orderNotifications.ts';
import {
  dispatchClientEmail,
  type OutboundEmailResult,
  type OutboundEmailPayload,
  buildOrderTrackingUrl,
} from '../lib/emailService.ts';
import type { ClinicalAppointmentRecord } from '../types.ts';

async function loadSiteConfigObject(): Promise<Record<string, any>> {
  try {
    const configRows = await db
      .select()
      .from(siteContent)
      .where(eq(siteContent.key, 'storefront_config'));
    return configRows[0] ? JSON.parse(configRows[0].valueJson) : {};
  } catch {
    return {};
  }
}

export async function deliverEmailAndNotificationToClient(params: {
  userUid?: string;
  toEmail?: string;
  toName?: string;
  title: string;
  message: string;
  orderNumber?: string;
  trackingUrl?: string;
  appBaseUrl?: string;
  orderDetails?: OutboundEmailPayload['orderDetails'];
  siteConfig?: Record<string, any>;
}): Promise<OutboundEmailResult | null> {
  const cleanEmail = (params.toEmail || '').trim().toLowerCase();
  const targetUids = new Set<string>();
  if (params.userUid && params.userUid.trim()) {
    targetUids.add(params.userUid.trim());
  }

  let resolvedEmail = cleanEmail;
  let resolvedName = params.toName || '';

  try {
    const allUsers = await db.select().from(users);
    for (const u of allUsers) {
      if (params.userUid && u.uid === params.userUid) {
        if (!resolvedEmail && u.email) resolvedEmail = u.email.trim().toLowerCase();
        if (!resolvedName && u.fullName) resolvedName = u.fullName;
      }
      if (cleanEmail && u.email && u.email.trim().toLowerCase() === cleanEmail) {
        if (u.uid) targetUids.add(u.uid);
        if (!resolvedName && u.fullName) resolvedName = u.fullName;
      }
    }
  } catch {
    // Continue even if user lookup fails
  }

  if (resolvedEmail) {
    targetUids.add(`email:${resolvedEmail}`);
  }

  const resolvedTrackingUrl =
    params.trackingUrl ||
    (params.orderNumber ? buildOrderTrackingUrl(params.orderNumber, params.appBaseUrl) : undefined);

  const attachmentNotes: string[] = [];
  if (params.orderDetails?.items && params.orderDetails.items.length > 0) {
    attachmentNotes.push(
      `Product Image(s): ${params.orderDetails.items.map((it) => it.productName).join(', ')}`
    );
    attachmentNotes.push(`Attached PDF: VisionCare-Lens-Prescription-${params.orderNumber || 'Order'}.pdf`);
  }
  if (resolvedTrackingUrl) {
    attachmentNotes.push(`Track Order Link: ${resolvedTrackingUrl}`);
  }

  const enrichedMessage = [
    params.message,
    ...attachmentNotes.map((line) => `[${line}]`),
    resolvedEmail ? `[Delivered to Email: ${resolvedEmail}]` : '',
  ]
    .filter(Boolean)
    .join('\n');

  for (const uidTarget of Array.from(targetUids)) {
    try {
      await db.insert(notifications).values({
        userUid: uidTarget,
        title: params.title,
        message: enrichedMessage,
        isRead: false,
      });
    } catch {
      // Ignore individual notification insert errors
    }
  }

  if (!resolvedEmail) {
    return null;
  }

  const siteCfg = params.siteConfig || (await loadSiteConfigObject());
  return await dispatchClientEmail({
    toEmail: resolvedEmail,
    toName: resolvedName || resolvedEmail,
    subject: params.title,
    bodyText: params.message,
    orderNumber: params.orderNumber,
    trackingUrl: resolvedTrackingUrl,
    orderDetails: params.orderDetails,
    siteConfig: siteCfg,
  });
}

export async function sendDirectAdminEmailToClient(params: {
  userUid?: string;
  toEmail: string;
  toName?: string;
  subject: string;
  message: string;
  orderNumber?: string;
}) {
  const cleanEmail = (params.toEmail || '').trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Recipient email address is required.');
  }
  const cleanSubject = (params.subject || 'Official Message from Vision Care Admin').trim();
  const cleanMessage = (params.message || '').trim();
  if (!cleanMessage) {
    throw new Error('Email message body cannot be empty.');
  }

  const emailResult = await deliverEmailAndNotificationToClient({
    userUid: params.userUid,
    toEmail: cleanEmail,
    toName: params.toName,
    title: `[Email from Admin] ${cleanSubject}`,
    message: cleanMessage,
    orderNumber: params.orderNumber,
  });

  return {
    ok: true,
    toEmail: cleanEmail,
    subject: cleanSubject,
    emailResult,
  };
}

const HERO_IMG = '/src/assets/images/hero_vision_care_1793890597331.jpg';
const IMG_AVIATOR = '/src/assets/images/frame_aviator_gold_1793890598064.jpg';
const IMG_ROUND = '/src/assets/images/frame_round_navy_1793890600366.jpg';
const IMG_CATEYE = '/src/assets/images/frame_cateye_tortoise_1793890600804.jpg';
const IMG_SQUARE = '/src/assets/images/frame_square_matte_1793890601011.jpg';

const INITIAL_ADMIN_EMAIL = 'ezehaustine1@gmail.com';

export async function getOrCreateUser(uid: string, email: string, fullName?: string) {
  try {
    const defaultRole = email.toLowerCase() === INITIAL_ADMIN_EMAIL.toLowerCase() ? 'admin' : 'customer';
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        fullName: fullName || email.split('@')[0],
        role: defaultRole,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function updateUserProfile(uid: string, data: { fullName?: string; phone?: string; role?: string }) {
  try {
    const result = await db
      .update(users)
      .set(data)
      .where(eq(users.uid, uid))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in updateUserProfile:', error);
    throw new Error('Failed to update user profile.', { cause: error });
  }
}

export async function getAllUsers() {
  try {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  } catch (error) {
    console.error('Database query failed in getAllUsers:', error);
    throw new Error('Failed to fetch users.', { cause: error });
  }
}

const SEED_AI_GLASSES_PRODUCTS = [
  {
    sku: 'VC-AI-009',
    name: 'Ray-Ban Meta Wayfarer AI Smart Glasses',
    brand: 'META × VISION CARE ATELIER',
    category: 'AI Glasses',
    gender: 'Unisex',
    shape: 'Square',
    rimStyle: 'Full-Rim',
    material: 'Italian Acetate',
    dimensions: '50-22-150 mm',
    priceNgn: 485000,
    discountPriceNgn: 450000,
    colorsJson: JSON.stringify(['Matte Obsidian Black', 'Shiny Havana Tortoise', 'Warm Stone Sapphire']),
    imagesJson: JSON.stringify([IMG_SQUARE, IMG_AVIATOR, IMG_ROUND]),
    stockQuantity: 14,
    isProtectiveReady: true,
    defaultProtectiveType: 'Photochromic Blue Cut Glasses',
    isFeatured: true,
    isBestSeller: true,
    isNewArrival: true,
    isActive: true,
    description:
      'Next-generation AI Smart Glasses featuring an ultra-wide 12MP POV camera, open-ear directional spatial speakers, 5-microphone array, and hands-free Voice AI assistant. Custom-fitted in our optical laboratory with your exact Single Vision, Bifocal, Varilux Progressive, or 0.00 Plano Blue-Cut / Photochromic lenses.',
  },
  {
    sku: 'VC-AI-010',
    name: 'Solos AirGo Vision AI Executive Titanium',
    brand: 'SOLOS OPTIK AI',
    category: 'AI Glasses',
    gender: 'Unisex',
    shape: 'Rectangle',
    rimStyle: 'Half-Rim',
    material: 'Japanese Titanium',
    dimensions: '54-18-145 mm',
    priceNgn: 420000,
    discountPriceNgn: 395000,
    colorsJson: JSON.stringify(['Brushed Gunmetal Titanium', 'Midnight Navy & Gold', 'Stealth Black']),
    imagesJson: JSON.stringify([IMG_AVIATOR, IMG_SQUARE]),
    stockQuantity: 11,
    isProtectiveReady: true,
    defaultProtectiveType: 'Photochromic Glasses',
    isFeatured: true,
    isBestSeller: false,
    isNewArrival: true,
    isActive: true,
    description:
      'Featherweight executive AI smart eyewear engineered for clinicians, executives, and frequent flyers. Includes real-time AI language translation, Whisper® noise-cancelling directional audio, USB-C smart charging temples, and full compatibility with prescription or protective optical lenses.',
  },
  {
    sku: 'VC-AI-011',
    name: 'Halliday Proactive Display AI Round Acetate',
    brand: 'HALLIDAY ATELIER',
    category: 'AI Glasses',
    gender: 'Unisex',
    shape: 'Round',
    rimStyle: 'Full-Rim',
    material: 'Italian Acetate',
    dimensions: '49-20-145 mm',
    priceNgn: 540000,
    discountPriceNgn: 498000,
    colorsJson: JSON.stringify(['Deep Royal Navy', 'Classic Tortoise Shell', 'Obsidian Matte']),
    imagesJson: JSON.stringify([IMG_ROUND, IMG_CATEYE, IMG_SQUARE]),
    stockQuantity: 8,
    isProtectiveReady: true,
    defaultProtectiveType: 'Photochromic Blue Cut Glasses',
    isFeatured: true,
    isBestSeller: true,
    isNewArrival: true,
    isActive: true,
    description:
      'Features the world’s smallest proactive near-eye DigiWindow™ optical module—projecting private AI notes, teleprompter scripts, turn-by-turn navigation, and live audio translation directly into your field of view while looking indistinguishable from luxury Italian optical frames.',
  },
];

export async function ensureSeeded() {
  try {
    const existingProducts = await db.select().from(products);
    if (existingProducts.length > 0) {
      const hasAiGlasses = existingProducts.some(
        (p) => p.category === 'AI Glasses' || p.sku.startsWith('VC-AI-')
      );
      if (!hasAiGlasses) {
        await db
          .insert(categories)
          .values([
            {
              name: 'AI Smart Glasses',
              slug: 'ai-smart-glasses',
              description: 'Camera, open-ear audio, and voice AI smart eyewear compatible with prescription and protective lenses',
              categoryType: 'frame',
            },
          ])
          .onConflictDoNothing();
        await db.insert(products).values(SEED_AI_GLASSES_PRODUCTS).onConflictDoNothing();
      }
      const existingPlano = await db
        .select()
        .from(lensTypes)
        .where(eq(lensTypes.code, 'non_prescription_plano'));
      if (
        existingPlano.length > 0 &&
        existingPlano[0].optionsJson !==
          JSON.stringify([
            'Blue Cut Photo AR (Photochromic + Blue Cut Digital Filter + Anti-Reflective)',
            'Photo AR (Photochromic Sun-Adaptive + Anti-Reflective)',
          ])
      ) {
        await db
          .update(lensTypes)
          .set({
            optionsJson: JSON.stringify([
              'Blue Cut Photo AR (Photochromic + Blue Cut Digital Filter + Anti-Reflective)',
              'Photo AR (Photochromic Sun-Adaptive + Anti-Reflective)',
            ]),
          })
          .where(eq(lensTypes.code, 'non_prescription_plano'));
      }
      return;
    }

    await db.insert(categories).values([
      { name: "Men's Frames", slug: 'mens-frames', description: 'Architectural masculine and tailored optical frames', categoryType: 'frame' },
      { name: "Women's Frames", slug: 'womens-frames', description: 'Refined silhouettes in Italian acetate and titanium', categoryType: 'frame' },
      { name: 'Unisex Frames', slug: 'unisex-frames', description: 'Balanced proportions crafted for every face shape', categoryType: 'frame' },
      { name: "Children's Frames", slug: 'childrens-frames', description: 'Lightweight impact-resistant TR90 frames for kids', categoryType: 'frame' },
      { name: 'Luxury Frames', slug: 'luxury-frames', description: '24k gold-plated and Japanese beta-titanium craftsmanship', categoryType: 'frame' },
      { name: 'Sports Frames', slug: 'sports-frames', description: 'Wrap-around stability and high-impact performance eyewear', categoryType: 'frame' },
      { name: 'AI Smart Glasses', slug: 'ai-smart-glasses', description: 'Camera, open-ear audio, and voice AI smart eyewear compatible with prescription and protective lenses', categoryType: 'frame' },
      { name: 'Protective & Screen Glasses', slug: 'protective-glasses', description: 'Non-prescription blue-cut and photochromic eyewear', categoryType: 'protective' },
    ]).onConflictDoNothing();

    await db.insert(lensTypes).values([
      {
        code: 'single_vision',
        name: 'Single Vision Lens',
        category: 'single_vision',
        tier: 'Precision Standard',
        description: 'Engineered for a single focal point—ideal for crisp distance driving vision or dedicated near reading clarity.',
        optionsJson: JSON.stringify(['Distance Vision (Myopia / Hyperopia)', 'Near Reading Vision', 'Intermediate Computer Distance']),
        priceNgn: 35000,
        isActive: true,
      },
      {
        code: 'bifocal_traditional',
        name: 'Bifocal Lens (Visible Segment)',
        category: 'bifocal',
        tier: 'Dual-Zone Classic',
        description: 'Traditional D-segment visible reader window offering distinct upper distance vision and a dedicated lower reading zone.',
        optionsJson: JSON.stringify(['Flat-Top 28mm Segment', 'Executive Full-Width Bifocal']),
        priceNgn: 55000,
        isActive: true,
      },
      {
        code: 'invisible_bifocal',
        name: 'Invisible Bifocal Lens',
        category: 'invisible_bifocal',
        tier: 'Blended Aesthetics',
        description: 'Seamless blended reading zone with zero visible dividing line—combining youthful aesthetics with dual-power correction.',
        optionsJson: JSON.stringify(['Blended Myodisc Invisible Segment', 'Soft-Transition Digital Bifocal']),
        priceNgn: 72000,
        isActive: true,
      },
      {
        code: 'progressive_varilux_comfort',
        name: 'Progressive Lens — Varilux Comfort Max',
        category: 'progressive_varilux',
        tier: 'Varilux Essential',
        description: 'Genuine multifocal Varilux design providing smooth, natural progression from far distance to intermediate computer and near reading.',
        optionsJson: JSON.stringify(['Varilux Comfort Max (All-Day Ergonomic)', 'Varilux Liberty 3.0 (Standard Corridor)']),
        priceNgn: 115000,
        isActive: true,
      },
      {
        code: 'progressive_varilux_xr',
        name: 'Progressive Lens — Varilux XR Series (Bespoke)',
        category: 'progressive_varilux',
        tier: 'Varilux Bespoke Flagship',
        description: 'Ultra-wide panoramic field of view with zero peripheral swim effect, customized to your exact pupillary posture and frame tilt.',
        optionsJson: JSON.stringify(['Varilux XR Design (Wide Panorama)', 'Varilux Physio 3.0 (High-Resolution Contrast)']),
        priceNgn: 185000,
        isActive: true,
      },
      {
        code: 'special_order_bifocal',
        name: 'Special Order Bifocal Lens',
        category: 'special_order_bifocal',
        tier: 'Special Order Lab',
        description: 'Custom-surfaced special order fused bifocal lens engineered for prescriptions combining Cylinder (CYL), Axis, and Reading ADD.',
        optionsJson: JSON.stringify(['Special Order Flat-Top 28mm Bifocal', 'Special Order Executive Astigmatic Bifocal']),
        priceNgn: 78000,
        isActive: true,
      },
      {
        code: 'special_order_invisible_bifocal',
        name: 'Special Order Invisible Bifocal Lens',
        category: 'special_order_invisible_bifocal',
        tier: 'Special Order Blended',
        description: 'Custom-blended line-free special order invisible bifocal crafted for astigmatic Cylinder (CYL), Axis, and Reading ADD prescriptions.',
        optionsJson: JSON.stringify(['Special Order Blended Invisible Segment', 'Special Order Digital Astigmatic Blended Bifocal']),
        priceNgn: 96000,
        isActive: true,
      },
      {
        code: 'special_order_varilux',
        name: 'Special Order Varilux Lens',
        category: 'special_order_varilux',
        tier: 'Special Order Varilux',
        description: 'Bespoke freeform special order Varilux progressive lens calibrated for complex Cylinder (CYL), Axis, and Reading ADD prescriptions.',
        optionsJson: JSON.stringify(['Special Order Varilux Comfort Max', 'Special Order Varilux Physio Astigmatic']),
        priceNgn: 148000,
        isActive: true,
      },
      {
        code: 'non_prescription_plano',
        name: 'Non-Prescription Protective Lens (0.00 Plano)',
        category: 'non_prescription',
        tier: 'Zero-Power Shield',
        description: 'Optical-grade zero-power plano lenses designed purely for digital screen filtration, UV defense, and outdoor light adaptation.',
        optionsJson: JSON.stringify([
          'Blue Cut Photo AR (Photochromic + Blue Cut Digital Filter + Anti-Reflective)',
          'Photo AR (Photochromic Sun-Adaptive + Anti-Reflective)',
        ]),
        priceNgn: 18000,
        isActive: true,
      },
    ]).onConflictDoNothing();

    await db.insert(lensCoatings).values([
      {
        code: 'clear_standard',
        name: 'Crystal Clear Optical Lens',
        groupType: 'tint_treatment',
        description: '99.4% light transmission ultra-clear optical monomer for pure indoor and outdoor color fidelity.',
        priceNgn: 0,
        compatibleWithJson: JSON.stringify(['all']),
        isActive: true,
      },
      {
        code: 'clear_ar',
        name: 'Clear Lens with Crizal Anti-Reflective (AR) Coating',
        groupType: 'tint_treatment',
        description: 'Eliminates night-driving halo glare,ghost reflections, and camera flash bounce while remaining virtually invisible.',
        priceNgn: 18000,
        compatibleWithJson: JSON.stringify(['all']),
        isActive: true,
      },
      {
        code: 'blue_cut',
        name: 'Blue Cut Digital Filter Lens',
        groupType: 'tint_treatment',
        description: 'Selectively filters high-energy visible (HEV 415–455nm) blue light from monitors, smartphones, and LED lighting.',
        priceNgn: 24000,
        compatibleWithJson: JSON.stringify(['all']),
        isActive: true,
      },
      {
        code: 'blue_cut_ar',
        name: 'Blue Cut with Sapphire Anti-Reflective Coating',
        groupType: 'tint_treatment',
        description: 'Combines HEV blue-light protection with multi-layer anti-glare optics for long coding, finance, and executive screen sessions.',
        priceNgn: 34000,
        compatibleWithJson: JSON.stringify(['all']),
        isActive: true,
      },
      {
        code: 'photochromic',
        name: 'Transitions Photochromic Adaptive Lens',
        groupType: 'tint_treatment',
        description: 'Automatically darkens into sunglasses in outdoor UV sunlight and returns to crystal clear indoors within seconds.',
        priceNgn: 38000,
        compatibleWithJson: JSON.stringify(['all']),
        isActive: true,
      },
      {
        code: 'photochromic_ar',
        name: 'Photochromic + Blue Cut + Anti-Reflective (All-in-One)',
        groupType: 'tint_treatment',
        description: 'Our signature triple-defense lens: indoor blue-light shield, night anti-glare coating, and rapid outdoor sun-darkening.',
        priceNgn: 52000,
        compatibleWithJson: JSON.stringify(['all']),
        isActive: true,
      },
      {
        code: 'index_156',
        name: 'Standard 1.56 Optical Index (Scratch & UV400)',
        groupType: 'index_material',
        description: 'Recommended for sphere powers between -2.50 and +2.00. Includes baseline hard scratch-resistant coat and UV400 block.',
        priceNgn: 0,
        compatibleWithJson: JSON.stringify(['all']),
        isActive: true,
      },
      {
        code: 'index_161_poly',
        name: 'Thin & Impact-Resistant 1.61 High-Index',
        groupType: 'index_material',
        description: '25% thinner and lighter than standard lenses. Ideal for Rimless, Half-Rim frames, and powers from +/-2.25 to +/-4.50.',
        priceNgn: 22000,
        compatibleWithJson: JSON.stringify(['all']),
        isActive: true,
      },
      {
        code: 'index_167_ultra',
        name: 'Ultra-Thin 1.67 Aspheric High-Index',
        groupType: 'index_material',
        description: '40% thinner aspheric profile eliminating eye magnification or minification for stronger prescriptions (+/-4.75 and above).',
        priceNgn: 45000,
        compatibleWithJson: JSON.stringify(['all']),
        isActive: true,
      },
      {
        code: 'addon_hydrophobic',
        name: 'Super-Hydrophobic Smudge & Water Repellent Shield',
        groupType: 'addon_feature',
        description: 'Seals microscopic lens pores so rain droplets, fingerprints, and dust wipe away effortlessly.',
        priceNgn: 12000,
        compatibleWithJson: JSON.stringify(['all']),
        isActive: true,
      },
    ]).onConflictDoNothing();

    await db.insert(products).values([
      {
        sku: 'VC-AV-001',
        name: 'Sovereign Titanium Aviator',
        brand: 'VISION CARE ATELIER',
        category: 'Luxury',
        gender: 'Unisex',
        shape: 'Aviator',
        rimStyle: 'Full-Rim',
        material: 'Japanese Titanium',
        dimensions: '54-17-145 mm',
        priceNgn: 118000,
        discountPriceNgn: 98000,
        colorsJson: JSON.stringify(['Champagne Gold', 'Brushed Platinum', 'Midnight Navy']),
        imagesJson: JSON.stringify([IMG_AVIATOR, IMG_ROUND, IMG_SQUARE]),
        stockQuantity: 18,
        isProtectiveReady: true,
        defaultProtectiveType: 'Photochromic Blue Cut Glasses',
        isFeatured: true,
        isBestSeller: true,
        isNewArrival: false,
        isActive: true,
        description: 'Featherweight 14-gram Japanese beta-titanium double-bridge aviator with hand-engraved temples and hypoallergenic ceramic nose pads.',
      },
      {
        sku: 'VC-RD-002',
        name: 'Mayfair Round Acetate',
        brand: 'LUMIÈRE MILANO',
        category: 'Unisex',
        gender: 'Unisex',
        shape: 'Round',
        rimStyle: 'Full-Rim',
        material: 'Italian Acetate',
        dimensions: '49-20-145 mm',
        priceNgn: 86000,
        discountPriceNgn: null,
        colorsJson: JSON.stringify(['Deep Royal Navy', 'Havana Tortoise', 'Crystal Champagne']),
        imagesJson: JSON.stringify([IMG_ROUND, IMG_AVIATOR, IMG_CATEYE]),
        stockQuantity: 24,
        isProtectiveReady: true,
        defaultProtectiveType: 'Blue Cut Screen Glasses',
        isFeatured: true,
        isBestSeller: true,
        isNewArrival: true,
        isActive: true,
        description: 'Mazzucchelli deep navy acetate rims paired with a knurled 18k champagne-gold bridge and five-barrel precision hinges.',
      },
      {
        sku: 'VC-CE-003',
        name: 'Aeterna Sculpted Cat-Eye',
        brand: 'AETERNA PARIS',
        category: 'Women',
        gender: 'Women',
        shape: 'Cat-Eye',
        rimStyle: 'Full-Rim',
        material: 'Italian Acetate',
        dimensions: '52-18-140 mm',
        priceNgn: 94000,
        discountPriceNgn: 84000,
        colorsJson: JSON.stringify(['Sapphire & Amber Tortoise', 'Obsidian Gold', 'Rose Champagne']),
        imagesJson: JSON.stringify([IMG_CATEYE, IMG_ROUND, IMG_AVIATOR]),
        stockQuantity: 15,
        isProtectiveReady: true,
        defaultProtectiveType: 'Fashion Protective Glasses',
        isFeatured: true,
        isBestSeller: false,
        isNewArrival: true,
        isActive: true,
        description: 'Architectural upswept silhouette laminating sapphire blue outer rims over warm amber crystal to illuminate facial contours.',
      },
      {
        sku: 'VC-SQ-004',
        name: 'Architect Matte Square',
        brand: 'VISION CARE ATELIER',
        category: 'Men',
        gender: 'Men',
        shape: 'Square',
        rimStyle: 'Full-Rim',
        material: 'Italian Acetate',
        dimensions: '55-18-148 mm',
        priceNgn: 78000,
        discountPriceNgn: null,
        colorsJson: JSON.stringify(['Matte Midnight Navy', 'Charcoal Slate', 'Espresso Horn']),
        imagesJson: JSON.stringify([IMG_SQUARE, IMG_AVIATOR, IMG_ROUND]),
        stockQuantity: 32,
        isProtectiveReady: true,
        defaultProtectiveType: 'Blue Cut Screen Glasses',
        isFeatured: true,
        isBestSeller: true,
        isNewArrival: false,
        isActive: true,
        description: 'Commanding rectangular-square executive frame with dual silver temple pins and ergonomic weight distribution for all-day Varilux or single-vision wear.',
      },
      {
        sku: 'VC-RM-005',
        name: 'Zenith Rimless Titanium',
        brand: 'KRONOS OPTIK',
        category: 'Luxury',
        gender: 'Unisex',
        shape: 'Rectangle',
        rimStyle: 'Rimless',
        material: 'Japanese Titanium',
        dimensions: '53-19-145 mm',
        priceNgn: 132000,
        discountPriceNgn: 119000,
        colorsJson: JSON.stringify(['Champagne Gold', 'Gunmetal Titanium', 'Silver Minimal']),
        imagesJson: JSON.stringify([IMG_AVIATOR, IMG_SQUARE]),
        stockQuantity: 9,
        isProtectiveReady: true,
        defaultProtectiveType: 'Non-prescription Anti-Reflective Glasses',
        isFeatured: false,
        isBestSeller: true,
        isNewArrival: true,
        isActive: true,
        description: 'Ultra-minimalist drill-mount rimless chassis crafted for executives seeking an unobstructed field of view and zero facial weight.',
      },
      {
        sku: 'VC-HR-006',
        name: 'Vanguard Half-Rim Browline',
        brand: 'LUMIÈRE MILANO',
        category: 'Men',
        gender: 'Men',
        shape: 'Rectangle',
        rimStyle: 'Half-Rim',
        material: 'Stainless Steel',
        dimensions: '53-18-145 mm',
        priceNgn: 74000,
        discountPriceNgn: null,
        colorsJson: JSON.stringify(['Navy & Gold Rim', 'Black & Silver', 'Tortoise & Gold']),
        imagesJson: JSON.stringify([IMG_SQUARE, IMG_ROUND]),
        stockQuantity: 20,
        isProtectiveReady: true,
        defaultProtectiveType: 'Clear Blue Cut Lenses',
        isFeatured: false,
        isBestSeller: false,
        isNewArrival: true,
        isActive: true,
        description: 'Classic mid-century browline architecture updated with surgical stainless steel lower suspension and spring-flex temples.',
      },
      {
        sku: 'VC-SP-007',
        name: 'AeroFlex Pro Sports Wrap',
        brand: 'KRONOS OPTIK',
        category: 'Sports',
        gender: 'Unisex',
        shape: 'Rectangle',
        rimStyle: 'Full-Rim',
        material: 'TR90 Composite',
        dimensions: '57-16-138 mm',
        priceNgn: 68000,
        discountPriceNgn: null,
        colorsJson: JSON.stringify(['Cobalt Blue Matte', 'Stealth Black', 'Sky Blue Accent']),
        imagesJson: JSON.stringify([IMG_SQUARE, IMG_AVIATOR]),
        stockQuantity: 19,
        isProtectiveReady: true,
        defaultProtectiveType: 'Photochromic Glasses',
        isFeatured: false,
        isBestSeller: false,
        isNewArrival: false,
        isActive: true,
        description: 'High-velocity TR90 memory polymer frame with non-slip hydrophilic temple grips for tennis, cycling, driving, and active outdoor lifestyles.',
      },
      {
        sku: 'VC-KD-008',
        name: 'JuniorNova Flex Round',
        brand: 'VISION CARE JUNIOR',
        category: 'Children',
        gender: 'Children',
        shape: 'Round',
        rimStyle: 'Full-Rim',
        material: 'TR90 Composite',
        dimensions: '44-16-130 mm',
        priceNgn: 48000,
        discountPriceNgn: 42000,
        colorsJson: JSON.stringify(['Sky Blue & Navy', 'Berry Rose', 'Clear Crystal']),
        imagesJson: JSON.stringify([IMG_ROUND, IMG_CATEYE]),
        stockQuantity: 6,
        isProtectiveReady: true,
        defaultProtectiveType: 'Blue Cut Screen Glasses',
        isFeatured: false,
        isBestSeller: false,
        isNewArrival: true,
        isActive: true,
        description: '180-degree flexible memory frame engineered for children and teens—virtually unbreakable for classroom and tablet learning.',
      },
      ...SEED_AI_GLASSES_PRODUCTS,
    ]).onConflictDoNothing();

    await db.insert(coupons).values([
      { code: 'VISION10', discountPercent: 10, minOrderNgn: 50000, isActive: true },
      { code: 'FIRSTCARE15', discountPercent: 15, minOrderNgn: 100000, isActive: true },
      { code: 'VARILUX20', discountPercent: 20, minOrderNgn: 180000, isActive: true },
    ]).onConflictDoNothing();

    await db.insert(reviews).values([
      {
        userUid: 'seed-user-1',
        customerName: 'Dr. Chidinma Okafor',
        customerRole: 'Consultant Ophthalmologist, Victoria Island Lagos',
        rating: 5,
        comment: 'Uploaded my clinic prescription PDF and the AI optical reader populated my astigmatism cylinder and axis down to the degree. My Varilux XR lenses in the Sovereign Titanium Aviator arrived in 48 hours with zero peripheral distortion.',
      },
      {
        userUid: 'seed-user-2',
        customerName: 'Olumide Adeyemi, CFA',
        customerRole: 'Managing Partner, Ikoyi FinTech Advisory',
        rating: 5,
        comment: 'After 11-hour Bloomberg terminal days, switching to the Architect Matte Square with Blue Cut + Sapphire AR eliminated my evening headaches completely. Craftsmanship rivals boutiques in Milan and London.',
      },
      {
        userUid: 'seed-user-3',
        customerName: 'Amina Bello-Suleiman',
        customerRole: 'Principal Architect, Maitama Abuja',
        rating: 5,
        comment: 'Ordered the Aeterna Cat-Eye with Photochromic AR lenses. Stepping out into Abuja afternoon sunlight, they transition into rich sunglasses within seconds and clear up immediately indoors.',
      },
    ]).onConflictDoNothing();

    await db.insert(siteContent).values([
      {
        key: 'storefront_config',
        valueJson: JSON.stringify({
          heroHeadline: 'See Clearly. Look Beautiful. Live Confidently.',
          heroSubheadline: 'Discover bespoke prescription eyewear, AI-verified optical dispensing, Varilux multifocal lenses, and blue-cut protective glasses crafted around your vision and lifestyle.',
          promoBannerText: 'Complimentary Nationwide Express Delivery on orders above ₦120,000 · Use code VISION10 for 10% off your first pair',
          whatsappNumber: '+2348098008474',
          supportEmail: 'concierge@visioncare.ng',
          showroomAddress: 'Plot 1420 Akin Adesola Street, Victoria Island, Lagos & Maitama, Abuja',
          bankName: 'Zenith Bank PLC',
          bankAccountName: 'VISION CARE OPTICAL ATELIER LTD',
          bankAccountNumber: '1018492031',
          appointmentConsultationFeeNgn: 15000,
          appointmentBankName: 'Zenith Bank PLC',
          appointmentBankAccountName: 'DR. AUSTINE EZEH — VISION CARE EYE CLINIC',
          appointmentBankAccountNumber: '1018492031',
          appointmentExtraCharges: [
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
          ],
          deliveryMethods: [
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
          ],
          paymentGatewayPaystackEnabled: true,
          paymentGatewayFlutterwaveEnabled: true,
          paymentGatewayBankTransferEnabled: true,
          paymentGateways: {
            paystack: true,
            flutterwave: true,
            bank_transfer: true,
          },
          heroImage: HERO_IMG,
          aboutMeName: 'Dr. Austine Ezeh, OD',
          aboutMeTitle: 'Chief Consultant Optometrist & Founder, VISION CARE Optical Atelier',
          aboutMeCredentials: 'Doctor of Optometry (OD) · Ocular Therapeutics & Precision Multifocal Specialist',
          aboutMeLicense: 'ODORBN/NG/4829',
          aboutMeExperienceYears: '12+ Years Clinical & Optical Dispensing Excellence',
          aboutMeHeadline: 'Dedicated to Clinical Precision, Ocular Health & Bespoke Eyewear Craftsmanship',
          aboutMePhoto: HERO_IMG,
          aboutMeBio:
            'Welcome to VISION CARE. As an attending Doctor of Optometry and optical dispensing specialist, my mission is to unite comprehensive clinical eye care with world-class prescription eyewear. Every prescription submitted on our platform—whether Single Vision, Fused or Invisible Bifocal, or bespoke Varilux Progressive—undergoes rigorous optometric verification for pupillary centration, astigmatic axis accuracy, and all-day visual comfort. Beyond precision lens surfacing, I personally oversee patient consultations for acute and chronic eye complaints, ensuring every client receives accurate diagnosis, therapeutic care, and crystal-clear vision.',
          aboutMeSpecialties:
            'Comprehensive Refraction & Binocular Vision, Bespoke Varilux Progressive & Special Order Lenses, Anterior Segment & Ocular Infection Therapeutics, Digital Eye Strain & Blue-Light Protection',
        }),
      },
    ]).onConflictDoNothing();
  } catch (error) {
    console.error('Database seed check failed:', error);
  }
}

export async function getCatalogBootstrap() {
  try {
    await ensureSeeded();
    const [allProducts, allCategories, allLensTypes, allCoatings, allReviews, allCoupons, contentRows] = await Promise.all([
      db.select().from(products).orderBy(desc(products.isFeatured), desc(products.id)),
      db.select().from(categories),
      db.select().from(lensTypes),
      db.select().from(lensCoatings),
      db.select().from(reviews).orderBy(desc(reviews.createdAt)),
      db.select().from(coupons),
      db.select().from(siteContent),
    ]);

    const configRow = contentRows.find((r) => r.key === 'storefront_config');
    const rawConfig = configRow ? JSON.parse(configRow.valueJson) : {};
    const siteConfig = {
      appointmentConsultationFeeNgn: 15000,
      appointmentBankName: rawConfig.bankName || 'Zenith Bank PLC',
      appointmentBankAccountName: rawConfig.bankAccountName || 'DR. AUSTINE EZEH — VISION CARE EYE CLINIC',
      appointmentBankAccountNumber: rawConfig.bankAccountNumber || '1018492031',
      aboutMeName: 'Dr. Austine Ezeh, OD',
      aboutMeTitle: 'Chief Consultant Optometrist & Founder, VISION CARE Optical Atelier',
      aboutMeCredentials: 'Doctor of Optometry (OD) · Ocular Therapeutics & Precision Multifocal Specialist',
      aboutMeLicense: 'ODORBN/NG/4829',
      aboutMeExperienceYears: '12+ Years Clinical & Optical Dispensing Excellence',
      aboutMeHeadline: 'Dedicated to Clinical Precision, Ocular Health & Bespoke Eyewear Craftsmanship',
      aboutMePhoto: rawConfig.aboutMePhoto || HERO_IMG,
      aboutMeBio:
        'Welcome to VISION CARE. As an attending Doctor of Optometry and optical dispensing specialist, my mission is to unite comprehensive clinical eye care with world-class prescription eyewear. Every prescription submitted on our platform—whether Single Vision, Fused or Invisible Bifocal, or bespoke Varilux Progressive—undergoes rigorous optometric verification for pupillary centration, astigmatic axis accuracy, and all-day visual comfort. Beyond precision lens surfacing, I personally oversee patient consultations for acute and chronic eye complaints, ensuring every client receives accurate diagnosis, therapeutic care, and crystal-clear vision.',
      aboutMeSpecialties:
        'Comprehensive Refraction & Binocular Vision, Bespoke Varilux Progressive & Special Order Lenses, Anterior Segment & Ocular Infection Therapeutics, Digital Eye Strain & Blue-Light Protection',
      appointmentExtraCharges: [
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
      ],
      deliveryMethods: [
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
      ],
      ...rawConfig,
    };

    return {
      products: allProducts,
      categories: allCategories,
      lensTypes: allLensTypes,
      lensCoatings: allCoatings,
      reviews: allReviews,
      coupons: allCoupons,
      siteConfig,
    };
  } catch (error) {
    console.error('Database query failed in getCatalogBootstrap:', error);
    throw new Error('Failed to load optical store catalog.', { cause: error });
  }
}

export async function createPrescriptionRecord(data: typeof prescriptions.$inferInsert) {
  try {
    const result = await db.insert(prescriptions).values(data).returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in createPrescriptionRecord:', error);
    throw new Error('Failed to save prescription record.', { cause: error });
  }
}

export async function getUserPrescriptions(userUid: string) {
  try {
    return await db
      .select()
      .from(prescriptions)
      .where(eq(prescriptions.userUid, userUid))
      .orderBy(desc(prescriptions.createdAt));
  } catch (error) {
    console.error('Database query failed in getUserPrescriptions:', error);
    throw new Error('Failed to load saved prescriptions.', { cause: error });
  }
}

export async function getAllPrescriptions() {
  try {
    return await db.select().from(prescriptions).orderBy(desc(prescriptions.createdAt));
  } catch (error) {
    console.error('Database query failed in getAllPrescriptions:', error);
    throw new Error('Failed to fetch prescriptions for admin review.', { cause: error });
  }
}

export async function updatePrescriptionRecord(
  id: number,
  updates: Partial<typeof prescriptions.$inferInsert>
) {
  try {
    const result = await db
      .update(prescriptions)
      .set(updates)
      .where(eq(prescriptions.id, id))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in updatePrescriptionRecord:', error);
    throw new Error('Failed to update prescription record.', { cause: error });
  }
}

export async function createOrderWithItems(
  orderData: typeof orders.$inferInsert,
  itemsData: Array<Omit<typeof orderItems.$inferInsert, 'orderId'>>,
  appBaseUrl?: string
) {
  try {
    const insertedOrders = await db.insert(orders).values(orderData).returning();
    const order = insertedOrders[0];

    const insertedItems = [];
    for (const item of itemsData) {
      const res = await db
        .insert(orderItems)
        .values({ ...item, orderId: order.id })
        .returning();
      insertedItems.push(res[0]);

      if (item.productId) {
        const prodRows = await db.select().from(products).where(eq(products.id, item.productId));
        if (prodRows[0]) {
          const nextStock = Math.max(0, prodRows[0].stockQuantity - (item.quantity || 1));
          await db.update(products).set({ stockQuantity: nextStock }).where(eq(products.id, item.productId));
        }
      }
    }

    let channelSummary = 'Email & In-App';
    try {
      if (order.internalAdminNotes && order.internalAdminNotes.trim().startsWith('{')) {
        const meta = JSON.parse(order.internalAdminNotes);
        const ch: string[] = [];
        if (meta.notifySms) ch.push(`SMS (${order.customerPhone})`);
        if (meta.notifyEmail !== false && order.customerEmail) ch.push(`Email (${order.customerEmail})`);
        if (ch.length > 0) channelSummary = ch.join(' & ');
      }
    } catch {
      // Ignore parse errors
    }

    const trackingUrl = buildOrderTrackingUrl(order.orderNumber, appBaseUrl);
    const itemSummaryText = insertedItems
      .map(
        (it) =>
          `• ${it.productName} (${it.lensOptionSelected || 'Standard'}${
            it.coatingSummary && it.coatingSummary !== 'None' ? ` · ${it.coatingSummary}` : ''
          }) — ₦${Number(it.unitTotalNgn || 0).toLocaleString()}`
      )
      .join('\n');

    const emailDispatchResult = await deliverEmailAndNotificationToClient({
      userUid: order.userUid,
      toEmail: order.customerEmail,
      toName: order.customerName,
      title: `Order ${order.orderNumber} Confirmed — Official Receipt & Lens Prescription [${channelSummary}]`,
      message: `Thank you ${order.customerName}! Your Vision Care order (${order.orderNumber}) totaling ₦${order.totalNgn.toLocaleString()} is now in "${order.orderStatus}" status.\n\nOrdered Dispensing Items:\n${itemSummaryText}\n\nYour product photo(s) and official Lens Prescription PDF are included with this email. Click your Vision Care Account link below to track your 9-stage laboratory progress in real time.`,
      orderNumber: order.orderNumber,
      trackingUrl,
      appBaseUrl,
      orderDetails: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        paymentMethod: order.paymentMethod,
        paymentReference: order.paymentReference,
        paymentStatus: order.paymentStatus,
        subtotalNgn: order.subtotalNgn,
        deliveryFeeNgn: order.deliveryFeeNgn,
        discountNgn: order.discountNgn,
        totalNgn: order.totalNgn,
        deliveryAddress: order.deliveryAddress,
        deliveryCity: order.deliveryCity,
        deliveryState: order.deliveryState,
        customerPhone: order.customerPhone,
        createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
        items: insertedItems.map((it) => ({
          productName: it.productName,
          productImage: it.productImage || undefined,
          orderType: it.orderType,
          quantity: it.quantity,
          framePriceNgn: it.framePriceNgn,
          lensOptionSelected: it.lensOptionSelected || undefined,
          lensPriceNgn: it.lensPriceNgn,
          coatingSummary: it.coatingSummary || undefined,
          coatingPriceNgn: it.coatingPriceNgn,
          unitTotalNgn: it.unitTotalNgn,
          prescriptionSnapshotJson: it.prescriptionSnapshotJson || undefined,
        })),
      },
    });

    return { order, items: insertedItems, emailDispatchResult, trackingUrl };
  } catch (error) {
    console.error('Database query failed in createOrderWithItems:', error);
    throw new Error('Failed to create order.', { cause: error });
  }
}

export async function getUserOrdersWithItems(userUid: string, userEmail?: string) {
  try {
    const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    const userOrders = allOrders.filter(
      (ord) =>
        ord.userUid === userUid ||
        (cleanEmail && (ord.customerEmail || '').trim().toLowerCase() === cleanEmail)
    );

    const allItems = await db.select().from(orderItems);
    return userOrders.map((ord) => ({
      ...ord,
      items: allItems.filter((it) => it.orderId === ord.id),
    }));
  } catch (error) {
    console.error('Database query failed in getUserOrdersWithItems:', error);
    throw new Error('Failed to load customer order history.', { cause: error });
  }
}

export async function getAllOrdersWithItems() {
  try {
    const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
    const allItems = await db.select().from(orderItems);
    return allOrders.map((ord) => ({
      ...ord,
      items: allItems.filter((it) => it.orderId === ord.id),
    }));
  } catch (error) {
    console.error('Database query failed in getAllOrdersWithItems:', error);
    throw new Error('Failed to load all orders.', { cause: error });
  }
}

export async function updateOrderByAdmin(
  orderId: number,
  updates: {
    orderStatus?: string;
    paymentStatus?: string;
    internalAdminNotes?: string;
    dispatchAlert?: {
      stage: string;
      message?: string;
      channels?: string[];
    };
  }
) {
  try {
    const existingRows = await db.select().from(orders).where(eq(orders.id, orderId));
    const existing = existingRows[0];
    if (!existing) {
      throw new Error('Order not found');
    }

    let meta: any = {
      notifySms: true,
      notifyEmail: true,
      stages: { labSurfacing: true, qualityControl: true, shipped: true },
      history: [],
      adminNoteText: '',
    };

    const rawNotes = updates.internalAdminNotes ?? existing.internalAdminNotes;
    if (rawNotes && rawNotes.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(rawNotes);
        meta = {
          notifySms: typeof parsed.notifySms === 'boolean' ? parsed.notifySms : true,
          notifyEmail: typeof parsed.notifyEmail === 'boolean' ? parsed.notifyEmail : true,
          stages: {
            labSurfacing: parsed.stages?.labSurfacing ?? true,
            qualityControl: parsed.stages?.qualityControl ?? true,
            shipped: parsed.stages?.shipped ?? true,
          },
          history: Array.isArray(parsed.history) ? parsed.history : [],
          adminNoteText: parsed.adminNoteText || '',
        };
      } catch {
        meta.adminNoteText = rawNotes;
      }
    } else if (rawNotes) {
      meta.adminNoteText = rawNotes;
    }

    const nextStatus = updates.orderStatus || existing.orderStatus;
    const statusChanged = Boolean(updates.orderStatus && updates.orderStatus !== existing.orderStatus);
    const shouldDispatch = Boolean(updates.dispatchAlert || statusChanged);

    let notificationToInsert: { title: string; message: string } | null = null;

    if (shouldDispatch) {
      const stageName = updates.dispatchAlert?.stage || nextStatus;

      const configRows = await db
        .select()
        .from(siteContent)
        .where(eq(siteContent.key, 'storefront_config'));
      const siteConfig = configRows[0] ? JSON.parse(configRows[0].valueJson) : {};

      const resolved = resolveAutomatedStageNotification({
        stageName,
        orderNumber: existing.orderNumber,
        customerName: existing.customerName,
        deliveryCity: existing.deliveryCity,
        deliveryState: existing.deliveryState,
        siteConfig,
        orderMeta: {
          notifySms: meta.notifySms,
          notifyEmail: meta.notifyEmail,
        },
        explicitChannels: updates.dispatchAlert?.channels,
        explicitCustomMessage: updates.dispatchAlert?.message,
      });

      const activeChannels = resolved.channels;
      const channelBadge = activeChannels.length > 0 ? activeChannels.join(' + ') : 'In-App Portal';
      const sentAt = new Date().toISOString();

      meta.history = [
        {
          id: `notif-${Date.now()}`,
          stage: stageName,
          channels: activeChannels,
          message: resolved.message,
          emailSubject: resolved.emailSubject,
          smsMessage: resolved.smsMessage,
          sentAt,
        },
        ...(meta.history || []).slice(0, 19),
      ];

      const recipientTargets = [
        activeChannels.includes('SMS') ? existing.customerPhone : '',
        activeChannels.includes('Email') ? existing.customerEmail : '',
      ].filter(Boolean);

      notificationToInsert = {
        title: `[${channelBadge}] ${resolved.title}`,
        message: `${resolved.message}${
          recipientTargets.length > 0
            ? ` (Sent via ${channelBadge} to ${recipientTargets.join(' & ')})`
            : ''
        }`,
      };
    }

    const dbPayload: Partial<typeof orders.$inferInsert> = {
      orderStatus: nextStatus,
      paymentStatus: updates.paymentStatus ?? existing.paymentStatus,
      internalAdminNotes: JSON.stringify(meta),
    };

    const result = await db.update(orders).set(dbPayload).where(eq(orders.id, orderId)).returning();
    const updated = result[0];

    if (updated && notificationToInsert) {
      const ordItems = await db.select().from(orderItems).where(eq(orderItems.orderId, updated.id));
      await deliverEmailAndNotificationToClient({
        userUid: updated.userUid,
        toEmail: updated.customerEmail,
        toName: updated.customerName,
        title: notificationToInsert.title,
        message: notificationToInsert.message,
        orderNumber: updated.orderNumber,
        orderDetails: {
          orderId: updated.id,
          orderNumber: updated.orderNumber,
          orderStatus: updated.orderStatus,
          paymentMethod: updated.paymentMethod,
          paymentReference: updated.paymentReference,
          paymentStatus: updated.paymentStatus,
          subtotalNgn: updated.subtotalNgn,
          deliveryFeeNgn: updated.deliveryFeeNgn,
          discountNgn: updated.discountNgn,
          totalNgn: updated.totalNgn,
          deliveryAddress: updated.deliveryAddress,
          deliveryCity: updated.deliveryCity,
          deliveryState: updated.deliveryState,
          customerPhone: updated.customerPhone,
          createdAt: updated.createdAt ? new Date(updated.createdAt).toISOString() : undefined,
          items: ordItems.map((it) => ({
            productName: it.productName,
            productImage: it.productImage || undefined,
            orderType: it.orderType,
            quantity: it.quantity,
            framePriceNgn: it.framePriceNgn,
            lensOptionSelected: it.lensOptionSelected || undefined,
            lensPriceNgn: it.lensPriceNgn,
            coatingSummary: it.coatingSummary || undefined,
            coatingPriceNgn: it.coatingPriceNgn,
            unitTotalNgn: it.unitTotalNgn,
            prescriptionSnapshotJson: it.prescriptionSnapshotJson || undefined,
          })),
        },
      });
    }

    return updated;
  } catch (error) {
    console.error('Database query failed in updateOrderByAdmin:', error);
    throw new Error('Failed to update order status.', { cause: error });
  }
}

export async function getUserAccountBundle(userUid: string, userEmail?: string) {
  try {
    let resolvedEmail = (userEmail || '').trim().toLowerCase();
    if (!resolvedEmail) {
      const userRows = await db.select().from(users).where(eq(users.uid, userUid));
      if (userRows[0]?.email) {
        resolvedEmail = userRows[0].email.trim().toLowerCase();
      }
    }

    const [
      userOrders,
      userPrescriptions,
      userAddresses,
      userWishlist,
      allNotifications,
      allEnquiries,
      allAppointments,
    ] = await Promise.all([
      getUserOrdersWithItems(userUid, resolvedEmail),
      getUserPrescriptions(userUid),
      db.select().from(addresses).where(eq(addresses.userUid, userUid)).orderBy(desc(addresses.isDefault)),
      db.select().from(wishlists).where(eq(wishlists.userUid, userUid)),
      db.select().from(notifications).orderBy(desc(notifications.createdAt)),
      db.select().from(enquiries).orderBy(desc(enquiries.createdAt)),
      getAllAppointments(),
    ]);

    const emailKey = resolvedEmail ? `email:${resolvedEmail}` : '';
    const rawMatchedNotifications = allNotifications.filter(
      (n) =>
        n.userUid === userUid ||
        (emailKey && n.userUid.toLowerCase() === emailKey)
    );

    // Deduplicate notifications that were inserted for both uid and email:<address>
    const seenNotifKeys = new Set<string>();
    const userNotifications = rawMatchedNotifications.filter((n) => {
      const dedupeKey = `${n.title}::${n.message}`;
      if (seenNotifKeys.has(dedupeKey)) return false;
      seenNotifKeys.add(dedupeKey);
      return true;
    });

    const userEnquiries = allEnquiries.filter(
      (e) =>
        e.userUid === userUid ||
        (resolvedEmail && (e.customerEmail || '').trim().toLowerCase() === resolvedEmail)
    );

    const userAppointments = allAppointments.filter(
      (a) =>
        a.userUid === userUid ||
        (resolvedEmail && (a.patientEmail || '').trim().toLowerCase() === resolvedEmail)
    );

    return {
      orders: userOrders,
      prescriptions: userPrescriptions,
      addresses: userAddresses,
      wishlistProductIds: userWishlist.map((w) => w.productId),
      notifications: userNotifications,
      enquiries: userEnquiries,
      appointments: userAppointments,
    };
  } catch (error) {
    console.error('Database query failed in getUserAccountBundle:', error);
    throw new Error('Failed to load account dashboard data.', { cause: error });
  }
}

export async function toggleWishlistItem(userUid: string, productId: number) {
  try {
    const existing = await db
      .select()
      .from(wishlists)
      .where(and(eq(wishlists.userUid, userUid), eq(wishlists.productId, productId)));

    if (existing.length > 0) {
      await db.delete(wishlists).where(eq(wishlists.id, existing[0].id));
      return { added: false };
    } else {
      await db.insert(wishlists).values({ userUid, productId });
      return { added: true };
    }
  } catch (error) {
    console.error('Database query failed in toggleWishlistItem:', error);
    throw new Error('Failed to update wishlist.', { cause: error });
  }
}

export async function createAddress(data: typeof addresses.$inferInsert) {
  try {
    const res = await db.insert(addresses).values(data).returning();
    return res[0];
  } catch (error) {
    console.error('Database query failed in createAddress:', error);
    throw new Error('Failed to save delivery address.', { cause: error });
  }
}

export async function deleteAddress(id: number, userUid: string) {
  try {
    await db.delete(addresses).where(and(eq(addresses.id, id), eq(addresses.userUid, userUid)));
    return { deleted: true };
  } catch (error) {
    console.error('Database query failed in deleteAddress:', error);
    throw new Error('Failed to delete address.', { cause: error });
  }
}

export async function createEnquiry(data: typeof enquiries.$inferInsert) {
  try {
    const res = await db.insert(enquiries).values(data).returning();
    return res[0];
  } catch (error) {
    console.error('Database query failed in createEnquiry:', error);
    throw new Error('Failed to submit support enquiry.', { cause: error });
  }
}

export async function getAllEnquiries() {
  try {
    return await db.select().from(enquiries).orderBy(desc(enquiries.createdAt));
  } catch (error) {
    console.error('Database query failed in getAllEnquiries:', error);
    throw new Error('Failed to fetch enquiries.', { cause: error });
  }
}

export async function replyToEnquiry(id: number, adminReply: string) {
  try {
    const res = await db
      .update(enquiries)
      .set({ adminReply, status: 'responded' })
      .where(eq(enquiries.id, id))
      .returning();
    const updated = res[0];
    if (updated) {
      await deliverEmailAndNotificationToClient({
        userUid: updated.userUid || undefined,
        toEmail: updated.customerEmail,
        toName: updated.customerName,
        title: `Support Reply: ${updated.subject}`,
        message: adminReply,
        orderNumber: updated.orderNumber || undefined,
      });
    }
    return updated;
  } catch (error) {
    console.error('Database query failed in replyToEnquiry:', error);
    throw new Error('Failed to reply to enquiry.', { cause: error });
  }
}

export async function dispatchWishlistPriceDropNotifications(
  product: typeof products.$inferSelect,
  previousEffectivePrice?: number,
  includeAllUsersFallback = false
) {
  try {
    const newDiscountPrice = Number(product.discountPriceNgn || 0);
    if (!newDiscountPrice || newDiscountPrice <= 0) {
      return { notifiedCount: 0, wishlistedCount: 0 };
    }

    const regularPrice = Number(product.priceNgn || newDiscountPrice);
    const baselinePrice =
      previousEffectivePrice && previousEffectivePrice > newDiscountPrice
        ? previousEffectivePrice
        : regularPrice;

    const savingsNgn = Math.max(0, baselinePrice - newDiscountPrice);
    const savingsPercent =
      baselinePrice > 0 ? Math.max(1, Math.round((savingsNgn / baselinePrice) * 100)) : 0;

    const wishlistRows = await db
      .select()
      .from(wishlists)
      .where(eq(wishlists.productId, product.id));

    const targetUids = Array.from(new Set(wishlistRows.map((w) => w.userUid).filter(Boolean)));
    const wishlistedCount = targetUids.length;

    if (targetUids.length === 0 && includeAllUsersFallback) {
      const allUserRows = await db.select().from(users);
      for (const u of allUserRows) {
        if (u.uid && !targetUids.includes(u.uid)) {
          targetUids.push(u.uid);
        }
      }
    }

    const title = `Wishlist Price-Drop Alert: ${product.name} is now ₦${newDiscountPrice.toLocaleString()}!`;
    const message =
      savingsNgn > 0
        ? `Good news! "${product.name}" (${product.brand}) in your Saved Frames Wishlist just dropped in price from ₦${baselinePrice.toLocaleString()} to ₦${newDiscountPrice.toLocaleString()} — Save ₦${savingsNgn.toLocaleString()} (${savingsPercent}% OFF). Configure your lenses or order now before promotional stock runs out.`
        : `Price Update Alert: "${product.name}" (${product.brand}) in your Saved Frames Wishlist has been updated to a special promotional price of ₦${newDiscountPrice.toLocaleString()}.`;

    for (const uid of targetUids) {
      await deliverEmailAndNotificationToClient({
        userUid: uid,
        title,
        message,
      });
    }

    return {
      notifiedCount: targetUids.length,
      wishlistedCount,
      title,
      message,
    };
  } catch (error) {
    console.error('Failed to dispatch wishlist price-drop notifications:', error);
    return { notifiedCount: 0, wishlistedCount: 0 };
  }
}

export async function triggerWishlistPriceDropAlert(
  productId: number,
  updates?: { priceNgn?: number; discountPriceNgn?: number | null }
) {
  try {
    const existingRows = await db.select().from(products).where(eq(products.id, productId));
    const existing = existingRows[0];
    if (!existing) {
      throw new Error('Product not found.');
    }

    const previousEffectivePrice = existing.discountPriceNgn || existing.priceNgn;
    let updatedProduct = existing;

    if (updates && (updates.priceNgn !== undefined || updates.discountPriceNgn !== undefined)) {
      const nextPrice =
        updates.priceNgn !== undefined ? Number(updates.priceNgn) : existing.priceNgn;
      const nextDiscount =
        updates.discountPriceNgn === null || updates.discountPriceNgn === undefined || Number(updates.discountPriceNgn) <= 0
          ? null
          : Number(updates.discountPriceNgn);

      const res = await db
        .update(products)
        .set({
          priceNgn: nextPrice,
          discountPriceNgn: nextDiscount,
        })
        .where(eq(products.id, productId))
        .returning();
      if (res[0]) {
        updatedProduct = res[0];
      }
    }

    const alertSummary = await dispatchWishlistPriceDropNotifications(
      updatedProduct,
      previousEffectivePrice,
      true
    );

    return {
      product: updatedProduct,
      ...alertSummary,
    };
  } catch (error) {
    console.error('Database query failed in triggerWishlistPriceDropAlert:', error);
    throw new Error('Failed to update discount price and trigger wishlist alerts.', { cause: error });
  }
}

export async function upsertProduct(
  data: Partial<typeof products.$inferInsert> & {
    id?: number;
    triggerPriceDropAlert?: boolean;
    imageUrl?: string;
    images?: string[];
    colors?: string[];
    colorsCsv?: string;
  }
) {
  try {
    const {
      triggerPriceDropAlert,
      imageUrl,
      images,
      colors,
      colorsCsv,
      ...cleanData
    } = data;

    // Normalize imagesJson if provided via imagesJson, images, or imageUrl
    const resolveImagesJson = (fallback?: string): string | undefined => {
      if (cleanData.imagesJson !== undefined) {
        if (Array.isArray(cleanData.imagesJson)) {
          return JSON.stringify((cleanData.imagesJson as string[]).filter(Boolean));
        }
        const raw = String(cleanData.imagesJson).trim();
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return JSON.stringify(parsed);
          }
        } catch {
          if (raw) return JSON.stringify([raw]);
        }
      }
      if (Array.isArray(images) && images.length > 0) {
        return JSON.stringify(images.filter(Boolean));
      }
      if (imageUrl && String(imageUrl).trim()) {
        return JSON.stringify([String(imageUrl).trim()]);
      }
      return fallback;
    };

    // Normalize colorsJson if provided via colorsJson, colors, or colorsCsv
    const resolveColorsJson = (fallback?: string): string | undefined => {
      if (cleanData.colorsJson !== undefined) {
        if (Array.isArray(cleanData.colorsJson)) {
          return JSON.stringify((cleanData.colorsJson as string[]).filter(Boolean));
        }
        const raw = String(cleanData.colorsJson).trim();
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return JSON.stringify(parsed);
          }
        } catch {
          if (raw) {
            return JSON.stringify(
              raw
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            );
          }
        }
      }
      if (Array.isArray(colors) && colors.length > 0) {
        return JSON.stringify(colors.filter(Boolean));
      }
      if (colorsCsv && String(colorsCsv).trim()) {
        const parts = String(colorsCsv)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length > 0) return JSON.stringify(parts);
      }
      return fallback;
    };

    if (cleanData.id) {
      const { id, ...rest } = cleanData;
      const existingRows = await db.select().from(products).where(eq(products.id, Number(id)));
      const existing = existingRows[0];
      if (!existing) {
        throw new Error(`Frame with ID #${id} was not found in the database.`);
      }
      const previousEffectivePrice = existing.discountPriceNgn || existing.priceNgn;

      const updatePatch: Record<string, any> = { ...rest };
      const normalizedImages = resolveImagesJson();
      if (normalizedImages !== undefined) {
        updatePatch.imagesJson = normalizedImages;
      }
      const normalizedColors = resolveColorsJson();
      if (normalizedColors !== undefined) {
        updatePatch.colorsJson = normalizedColors;
      }
      if (updatePatch.priceNgn !== undefined) {
        updatePatch.priceNgn = Math.max(0, Number(updatePatch.priceNgn) || 0);
      }
      if (updatePatch.stockQuantity !== undefined) {
        updatePatch.stockQuantity = Math.max(0, Number(updatePatch.stockQuantity) || 0);
      }
      if ('discountPriceNgn' in updatePatch) {
        updatePatch.discountPriceNgn =
          updatePatch.discountPriceNgn === null ||
          updatePatch.discountPriceNgn === '' ||
          Number(updatePatch.discountPriceNgn) <= 0
            ? null
            : Number(updatePatch.discountPriceNgn);
      }

      const res = await db
        .update(products)
        .set(updatePatch)
        .where(eq(products.id, Number(id)))
        .returning();
      const updated = res[0];

      if (
        updated &&
        updated.discountPriceNgn &&
        updated.discountPriceNgn > 0 &&
        (triggerPriceDropAlert || updated.discountPriceNgn !== existing.discountPriceNgn)
      ) {
        await dispatchWishlistPriceDropNotifications(
          updated,
          previousEffectivePrice,
          Boolean(triggerPriceDropAlert)
        );
      }

      return updated;
    } else {
      const frameName = String(cleanData.name || '').trim();
      const frameBrand = String(cleanData.brand || 'VISION CARE ATELIER').trim();
      const framePrice = Number(cleanData.priceNgn ?? 0);
      const frameStock = Number(cleanData.stockQuantity ?? 20);

      if (!frameName) {
        throw new Error('Validation Error: Frame Name is required before publishing to the storefront.');
      }
      if (!frameBrand) {
        throw new Error('Validation Error: Frame Brand is required.');
      }
      if (Number.isNaN(framePrice) || framePrice <= 0) {
        throw new Error('Validation Error: Frame Price (NGN) must be greater than ₦0.');
      }
      if (Number.isNaN(frameStock) || frameStock < 0) {
        throw new Error('Validation Error: Stock Quantity cannot be negative.');
      }

      let targetSku =
        String(cleanData.sku || '').trim() ||
        `VC-FRM-${Math.floor(100 + Math.random() * 900)}`;

      // Ensure unique SKU to prevent database unique constraint failures
      const existingBySku = await db
        .select()
        .from(products)
        .where(eq(products.sku, targetSku));
      if (existingBySku.length > 0) {
        targetSku = `${targetSku}-${Math.floor(100 + Math.random() * 900)}`;
      }

      const insertPayload: typeof products.$inferInsert = {
        sku: targetSku,
        name: frameName,
        brand: frameBrand,
        category: String(cleanData.category || 'Unisex').trim() || 'Unisex',
        gender: String(cleanData.gender || 'Unisex').trim() || 'Unisex',
        shape: String(cleanData.shape || 'Round').trim() || 'Round',
        rimStyle: String(cleanData.rimStyle || 'Full-Rim').trim() || 'Full-Rim',
        material: String(cleanData.material || 'Italian Acetate').trim() || 'Italian Acetate',
        dimensions: String(cleanData.dimensions || '51-19-145 mm').trim() || '51-19-145 mm',
        priceNgn: Math.round(framePrice),
        discountPriceNgn:
          cleanData.discountPriceNgn && Number(cleanData.discountPriceNgn) > 0
            ? Math.round(Number(cleanData.discountPriceNgn))
            : null,
        colorsJson:
          resolveColorsJson(JSON.stringify(['Obsidian Black', 'Tortoise'])) ||
          JSON.stringify(['Obsidian Black', 'Tortoise']),
        imagesJson:
          resolveImagesJson(
            JSON.stringify(['/src/assets/images/frame_round_navy_1793890600366.jpg'])
          ) || JSON.stringify(['/src/assets/images/frame_round_navy_1793890600366.jpg']),
        stockQuantity: Math.round(frameStock),
        isProtectiveReady: Boolean(cleanData.isProtectiveReady ?? true),
        defaultProtectiveType:
          String(cleanData.defaultProtectiveType || 'Blue Cut Glasses').trim() ||
          'Blue Cut Glasses',
        isFeatured: Boolean(cleanData.isFeatured ?? true),
        isBestSeller: Boolean(cleanData.isBestSeller ?? false),
        isNewArrival: Boolean(cleanData.isNewArrival ?? true),
        isActive: Boolean(cleanData.isActive ?? true),
        description:
          String(cleanData.description || '').trim() ||
          `${frameName} precision optical frame crafted in ${
            cleanData.material || 'Italian Acetate'
          } by ${frameBrand}.`,
      };

      const res = await db.insert(products).values(insertPayload).returning();
      return res[0];
    }
  } catch (error: any) {
    console.error('Database query failed in upsertProduct:', error);
    const detail = error instanceof Error ? error.message : 'Database error';
    throw new Error(detail.startsWith('Validation Error:') ? detail : `Failed to save product: ${detail}`, {
      cause: error,
    });
  }
}

export async function deleteProductById(id: number) {
  try {
    await db.delete(wishlists).where(eq(wishlists.productId, id));
    await db.delete(products).where(eq(products.id, id));
    return { deleted: true };
  } catch (error) {
    console.error('Database query failed in deleteProductById:', error);
    throw new Error('Failed to delete product.', { cause: error });
  }
}

export async function upsertLensType(data: Partial<typeof lensTypes.$inferInsert> & { id?: number }) {
  try {
    if (data.id) {
      const { id, ...rest } = data;
      const res = await db.update(lensTypes).set(rest).where(eq(lensTypes.id, id)).returning();
      return res[0];
    } else {
      const res = await db.insert(lensTypes).values(data as typeof lensTypes.$inferInsert).returning();
      return res[0];
    }
  } catch (error) {
    console.error('Database query failed in upsertLensType:', error);
    throw new Error('Failed to save lens type.', { cause: error });
  }
}

export async function deleteLensTypeById(id: number) {
  try {
    await db.delete(lensTypes).where(eq(lensTypes.id, id));
    return { deleted: true };
  } catch (error) {
    console.error('Database query failed in deleteLensTypeById:', error);
    throw new Error('Failed to delete lens type.', { cause: error });
  }
}

export async function upsertLensCoating(data: Partial<typeof lensCoatings.$inferInsert> & { id?: number }) {
  try {
    if (data.id) {
      const { id, ...rest } = data;
      const res = await db.update(lensCoatings).set(rest).where(eq(lensCoatings.id, id)).returning();
      return res[0];
    } else {
      const res = await db.insert(lensCoatings).values(data as typeof lensCoatings.$inferInsert).returning();
      return res[0];
    }
  } catch (error) {
    console.error('Database query failed in upsertLensCoating:', error);
    throw new Error('Failed to save lens coating.', { cause: error });
  }
}

export async function deleteLensCoatingById(id: number) {
  try {
    await db.delete(lensCoatings).where(eq(lensCoatings.id, id));
    return { deleted: true };
  } catch (error) {
    console.error('Database query failed in deleteLensCoatingById:', error);
    throw new Error('Failed to delete lens coating.', { cause: error });
  }
}

export async function updateSiteConfig(newConfig: Record<string, any>) {
  try {
    const existingRows = await db
      .select()
      .from(siteContent)
      .where(eq(siteContent.key, 'storefront_config'));
    const currentConfig = existingRows[0] ? JSON.parse(existingRows[0].valueJson) : {};
    const mergedConfig = { ...currentConfig, ...newConfig };

    const res = await db
      .insert(siteContent)
      .values({
        key: 'storefront_config',
        valueJson: JSON.stringify(mergedConfig),
      })
      .onConflictDoUpdate({
        target: siteContent.key,
        set: {
          valueJson: JSON.stringify(mergedConfig),
          updatedAt: new Date(),
        },
      })
      .returning();
    return JSON.parse(res[0].valueJson);
  } catch (error) {
    console.error('Database query failed in updateSiteConfig:', error);
    throw new Error('Failed to update website content.', { cause: error });
  }
}

export async function createReview(data: typeof reviews.$inferInsert) {
  try {
    const res = await db.insert(reviews).values(data).returning();
    return res[0];
  } catch (error) {
    console.error('Database query failed in createReview:', error);
    throw new Error('Failed to post review.', { cause: error });
  }
}

const APPOINTMENTS_KEY = 'clinical_appointments_records';

const SEED_CLINICAL_APPOINTMENTS: ClinicalAppointmentRecord[] = [
  {
    id: 1001,
    appointmentNumber: 'VC-APT-842109',
    userUid: 'vc_user_657a656861757374696e',
    patientName: 'Chinedu Eze',
    patientEmail: 'ezehaustine1@gmail.com',
    patientPhone: '+234 803 412 8900',
    patientAge: '34',
    patientGender: 'Male',
    patientOccupation: 'Senior Software Architect',
    patientAddress: '14 Admiralty Way, Lekki Phase 1, Lagos',
    medicalHistoryAndAllergies: 'No known drug allergies (NKDA). Wears daily computer glasses.',
    complaintCategory: 'Eye Infection / Redness / Mucopurulent Discharge',
    affectedEye: 'Both Eyes (OU)',
    symptomDuration: '3–4 Days',
    urgencyLevel: 'Urgent / Acute',
    complaintDescription:
      'Woke up 3 days ago with sticky yellowish discharge on the eyelashes, diffuse redness in both eyes, gritty foreign-body sensation, and mild photophobia under office lighting.',
    previousMedicationsUsed: 'Saline eye wash only',
    preferredDate: new Date().toISOString().slice(0, 10),
    preferredTimeSlot: '10:30 AM (Morning Clinic)',
    consultationMode: 'In-Clinic Consultation (Victoria Island, Lagos)',
    status: 'prescription_issued',
    consultationFeeNgn: 15000,
    treatmentFeeNgn: 10000,
    totalChargeNgn: 25000,
    chargeReasonNote:
      'Acute Bilateral Bacterial Conjunctivitis consultation + Slit-Lamp Biomicroscopy & Fluorescein Corneal Staining workup.',
    paymentStatus: 'paid',
    paymentMethod: 'paystack',
    paymentReference: 'PSTK-APT-842109',
    doctorName: 'Dr. Austine Ezeh, OD',
    doctorCredentials: 'Consultant Optometrist & Ocular Therapeutics Specialist',
    doctorLicenseNumber: 'ODORBN/NG/4829',
    clinicalDiagnosis: 'Acute Bilateral Bacterial Conjunctivitis (OU) — Cornea Clear, No Ulceration',
    clinicalNotesAndAdvice:
      'Maintain strict ocular hygiene. Do not share towels or pillowcases. Wash hands thoroughly before and after instilling drops. Avoid wearing contact lenses until 48 hours after completing the full 7-day antibiotic course.',
    followUpDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    prescribedDrugs: [
      {
        id: 'rx-1',
        drugName: 'Moxifloxacin 0.5% Ophthalmic Solution (Vigamox)',
        category: 'Broad-Spectrum Fluoroquinolone Antibiotic Eye Drops',
        dosage: '1 Drop',
        route: 'Both Eyes (OU)',
        frequency: 'Every 4 Hours (4x Daily)',
        duration: '7 Days',
        instructions: 'Instill 1 drop into lower conjunctival sac of both eyes. Do not touch dropper tip to eyelashes.',
      },
      {
        id: 'rx-2',
        drugName: 'Ciprofloxacin 0.3% Sterile Ophthalmic Ointment',
        category: 'Nighttime Antibiotic Ocular Ointment',
        dosage: '1 cm Ribbon',
        route: 'Both Eyes (OU)',
        frequency: 'At Bedtime (NOCTE)',
        duration: '5 Nights',
        instructions: 'Apply inside lower eyelid right before sleep to prevent morning eyelid crusting.',
      },
      {
        id: 'rx-3',
        drugName: 'Sodium Hyaluronate 0.2% Preservative-Free Lubricant Drops',
        category: 'Ocular Surface Soothing & Tear Film Stabilizer',
        dosage: '1–2 Drops',
        route: 'Both Eyes (OU)',
        frequency: '3 Times Daily (TDS)',
        duration: '14 Days',
        instructions: 'Wait at least 10 minutes after Moxifloxacin drops before instilling lubricant drops.',
      },
    ],
    prescriptionIssuedAt: new Date().toISOString(),
    allowClientPdfDownload: true,
    createdAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

async function saveAppointmentsList(list: ClinicalAppointmentRecord[]): Promise<ClinicalAppointmentRecord[]> {
  await db
    .insert(siteContent)
    .values({
      key: APPOINTMENTS_KEY,
      valueJson: JSON.stringify(list),
    })
    .onConflictDoUpdate({
      target: siteContent.key,
      set: {
        valueJson: JSON.stringify(list),
        updatedAt: new Date(),
      },
    });
  return list;
}

export async function getAllAppointments(): Promise<ClinicalAppointmentRecord[]> {
  try {
    const rows = await db
      .select()
      .from(siteContent)
      .where(eq(siteContent.key, APPOINTMENTS_KEY));
    if (!rows[0]) {
      await saveAppointmentsList(SEED_CLINICAL_APPOINTMENTS);
      return SEED_CLINICAL_APPOINTMENTS;
    }
    const parsed = JSON.parse(rows[0].valueJson);
    return Array.isArray(parsed) ? parsed : SEED_CLINICAL_APPOINTMENTS;
  } catch (error) {
    console.error('Database query failed in getAllAppointments:', error);
    return SEED_CLINICAL_APPOINTMENTS;
  }
}

export async function getUserAppointments(
  userUid: string,
  email?: string
): Promise<ClinicalAppointmentRecord[]> {
  const all = await getAllAppointments();
  const cleanEmail = (email || '').trim().toLowerCase();
  return all.filter(
    (a) =>
      (userUid && a.userUid === userUid) ||
      (cleanEmail && a.patientEmail.trim().toLowerCase() === cleanEmail)
  );
}

export async function createAppointmentRecord(
  payload: Partial<ClinicalAppointmentRecord>
): Promise<ClinicalAppointmentRecord> {
  const current = await getAllAppointments();
  const nextId = current.reduce((max, item) => Math.max(max, item.id || 1000), 1000) + 1;
  const appointmentNumber =
    payload.appointmentNumber ||
    `VC-APT-${Date.now().toString().slice(-5)}${Math.floor(10 + Math.random() * 89)}`;

  const consultationFeeNgn = Number(payload.consultationFeeNgn ?? 15000);
  const treatmentFeeNgn = Number(payload.treatmentFeeNgn ?? 0);
  const totalChargeNgn = Number(payload.totalChargeNgn ?? consultationFeeNgn + treatmentFeeNgn);

  const newRecord: ClinicalAppointmentRecord = {
    id: nextId,
    appointmentNumber,
    userUid: payload.userUid || '',
    patientName: payload.patientName || 'Vision Care Patient',
    patientEmail: payload.patientEmail || '',
    patientPhone: payload.patientPhone || '',
    patientAge: payload.patientAge || '',
    patientGender: payload.patientGender || 'Not specified',
    patientOccupation: payload.patientOccupation || '',
    patientAddress: payload.patientAddress || '',
    medicalHistoryAndAllergies: payload.medicalHistoryAndAllergies || 'None reported',
    medicalHistoryFileUrl: payload.medicalHistoryFileUrl || '',
    medicalHistoryFileName: payload.medicalHistoryFileName || '',
    complaintCategory: payload.complaintCategory || 'Eye Infection / Redness / Discharge',
    affectedEye: payload.affectedEye || 'Both Eyes (OU)',
    symptomDuration: payload.symptomDuration || '1–3 Days',
    urgencyLevel: payload.urgencyLevel || 'Moderate',
    complaintDescription: payload.complaintDescription || '',
    previousMedicationsUsed: payload.previousMedicationsUsed || 'None',
    preferredDate: payload.preferredDate || new Date().toISOString().slice(0, 10),
    preferredTimeSlot: payload.preferredTimeSlot || '10:00 AM (Morning Clinic)',
    consultationMode:
      payload.consultationMode || 'In-Clinic Consultation (Victoria Island, Lagos)',
    status: 'pending_review',
    consultationFeeNgn,
    treatmentFeeNgn,
    totalChargeNgn,
    selectedExtraCharges: Array.isArray(payload.selectedExtraCharges)
      ? payload.selectedExtraCharges
      : [],
    chargeReasonNote:
      payload.chargeReasonNote ||
      'Standard Consultation Fee + Selected Clinical Workup Charges.',
    paymentStatus: totalChargeNgn > 0 ? 'unpaid' : 'awaiting_doctor_bill',
    paymentMethod: payload.paymentMethod || 'paystack',
    paymentReference: payload.paymentReference || '',
    doctorName: payload.doctorName || 'Dr. Austine Ezeh, OD',
    doctorCredentials:
      payload.doctorCredentials || 'Consultant Optometrist & Ocular Therapeutics Specialist',
    doctorLicenseNumber: payload.doctorLicenseNumber || 'ODORBN/NG/4829',
    clinicalDiagnosis: payload.clinicalDiagnosis || '',
    clinicalNotesAndAdvice: payload.clinicalNotesAndAdvice || '',
    followUpDate: payload.followUpDate || '',
    prescribedDrugs: Array.isArray(payload.prescribedDrugs) ? payload.prescribedDrugs : [],
    allowClientPdfDownload: Boolean(payload.allowClientPdfDownload ?? false),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const nextList = [newRecord, ...current];
  await saveAppointmentsList(nextList);

  if (newRecord.userUid) {
    try {
      await db.insert(notifications).values({
        userUid: newRecord.userUid,
        title: `Eye Appointment ${newRecord.appointmentNumber} Booked`,
        message: `Your clinical complaint (${newRecord.complaintCategory} - ${newRecord.affectedEye}) and medical history have been received by the Doctor. You will be notified as soon as your assessment, bill, and drug prescription are ready.`,
        isRead: false,
      });
    } catch {
      // Ignore notification insert errors
    }
  }

  return newRecord;
}

export async function updateAppointmentByDoctor(
  id: number,
  updates: Partial<ClinicalAppointmentRecord>
): Promise<ClinicalAppointmentRecord> {
  const current = await getAllAppointments();
  const idx = current.findIndex((a) => a.id === id);
  if (idx === -1) {
    throw new Error('Appointment record not found.');
  }

  const existing = current[idx];
  const consultationFeeNgn =
    updates.consultationFeeNgn !== undefined
      ? Number(updates.consultationFeeNgn)
      : existing.consultationFeeNgn;
  const treatmentFeeNgn =
    updates.treatmentFeeNgn !== undefined
      ? Number(updates.treatmentFeeNgn)
      : existing.treatmentFeeNgn;
  const totalChargeNgn =
    updates.totalChargeNgn !== undefined
      ? Number(updates.totalChargeNgn)
      : consultationFeeNgn + treatmentFeeNgn;

  const hasPrescribedDrugs =
    Array.isArray(updates.prescribedDrugs) && updates.prescribedDrugs.length > 0;

  let nextStatus = updates.status || existing.status;
  if (!updates.status) {
    if (hasPrescribedDrugs) {
      nextStatus = 'prescription_issued';
    } else if (totalChargeNgn > 0 && existing.status === 'pending_review') {
      nextStatus = 'assessed_billed';
    }
  }

  let nextPaymentStatus = updates.paymentStatus || existing.paymentStatus;
  if (!updates.paymentStatus && totalChargeNgn > 0 && existing.paymentStatus === 'awaiting_doctor_bill') {
    nextPaymentStatus = 'unpaid';
  }

  const allowClientPdfDownload =
    updates.allowClientPdfDownload !== undefined
      ? Boolean(updates.allowClientPdfDownload)
      : Boolean(existing.allowClientPdfDownload);

  const updated: ClinicalAppointmentRecord = {
    ...existing,
    ...updates,
    id: existing.id,
    appointmentNumber: existing.appointmentNumber,
    consultationFeeNgn,
    treatmentFeeNgn,
    totalChargeNgn,
    status: nextStatus,
    paymentStatus: nextPaymentStatus,
    allowClientPdfDownload,
    prescriptionIssuedAt: hasPrescribedDrugs
      ? updates.prescriptionIssuedAt || existing.prescriptionIssuedAt || new Date().toISOString()
      : existing.prescriptionIssuedAt,
    updatedAt: new Date().toISOString(),
  };

  const nextList = [...current];
  nextList[idx] = updated;
  await saveAppointmentsList(nextList);

  if (updated.userUid || updated.patientEmail) {
    try {
      const rxCount = Array.isArray(updated.prescribedDrugs) ? updated.prescribedDrugs.length : 0;
      const title =
        rxCount > 0
          ? `Doctor's Drug Prescription Ready (${updated.appointmentNumber})`
          : `Doctor's Assessment & Consultation Bill (${updated.appointmentNumber})`;
      const message =
        rxCount > 0
          ? `${updated.doctorName} has issued your official Drug Prescription (${rxCount} medication(s)) and clinical diagnosis ("${updated.clinicalDiagnosis}"). Total charge: ₦${updated.totalChargeNgn.toLocaleString()}. You can now print or download your Drug Prescription PDF.`
          : `${updated.doctorName} reviewed your eye complaint (${updated.complaintCategory}). Total consultation & treatment fee: ₦${updated.totalChargeNgn.toLocaleString()} (${updated.chargeReasonNote}).`;

      await deliverEmailAndNotificationToClient({
        userUid: updated.userUid,
        toEmail: updated.patientEmail,
        toName: updated.patientName,
        title,
        message,
        orderNumber: updated.appointmentNumber,
      });
    } catch {
      // Ignore notification error
    }
  }

  return updated;
}

export async function updateAppointmentPaymentByClient(
  id: number,
  paymentData: {
    paymentMethod: string;
    paymentReference: string;
    paymentStatus: 'paid' | 'pending_verification';
  }
): Promise<ClinicalAppointmentRecord> {
  const current = await getAllAppointments();
  const idx = current.findIndex((a) => a.id === id);
  if (idx === -1) {
    throw new Error('Appointment record not found.');
  }

  const existing = current[idx];
  const updated: ClinicalAppointmentRecord = {
    ...existing,
    paymentMethod: paymentData.paymentMethod,
    paymentReference: paymentData.paymentReference,
    paymentStatus: paymentData.paymentStatus,
    status:
      existing.status === 'assessed_billed' && paymentData.paymentStatus === 'paid'
        ? 'paid'
        : existing.status,
    updatedAt: new Date().toISOString(),
  };

  const nextList = [...current];
  nextList[idx] = updated;
  await saveAppointmentsList(nextList);
  return updated;
}

