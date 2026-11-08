export interface OrderNotificationMeta {
  notifySms: boolean;
  notifyEmail: boolean;
  stages: {
    labSurfacing: boolean;
    qualityControl: boolean;
    shipped: boolean;
  };
  history: Array<{
    id: string;
    stage: string;
    channels: string[];
    message: string;
    emailSubject?: string;
    smsMessage?: string;
    sentAt: string;
  }>;
  adminNoteText?: string;
}

export interface NotificationStageTemplateConfig {
  stageKey: string;
  stageLabel: string;
  smsEnabled: boolean;
  emailEnabled: boolean;
  smsTemplate: string;
  emailSubjectTemplate: string;
  emailBodyTemplate: string;
}

export type NotificationStageTemplateMap = Record<string, NotificationStageTemplateConfig>;

export const DEFAULT_STAGE_NOTIFICATION_TEMPLATES: NotificationStageTemplateMap = {
  'Order received': {
    stageKey: 'Order received',
    stageLabel: 'Order Received',
    smsEnabled: true,
    emailEnabled: true,
    smsTemplate:
      'VISION CARE: Hello {customerName}, your order {orderNumber} has been received and logged at our optical atelier.',
    emailSubjectTemplate: 'Order Confirmation — Vision Care Order {orderNumber}',
    emailBodyTemplate:
      'Hello {customerName}, thank you for choosing Vision Care. Your order {orderNumber} has been received and assigned to our dispensing team for {deliveryCity}, {deliveryState}.',
  },
  'Prescription under review': {
    stageKey: 'Prescription under review',
    stageLabel: 'Prescription Under Review',
    smsEnabled: true,
    emailEnabled: true,
    smsTemplate:
      'VISION CARE: Hello {customerName}, our chief optometrist is now reviewing your prescription parameters for order {orderNumber}.',
    emailSubjectTemplate: 'Clinical Prescription Review — Order {orderNumber}',
    emailBodyTemplate:
      'Hello {customerName}, your optical prescription for order {orderNumber} is currently under clinical verification by our chief optometrist prior to digital lens surfacing.',
  },
  'Awaiting confirmation': {
    stageKey: 'Awaiting confirmation',
    stageLabel: 'Awaiting Confirmation',
    smsEnabled: true,
    emailEnabled: true,
    smsTemplate:
      'VISION CARE: Hello {customerName}, please review your optical specification confirmation for order {orderNumber}.',
    emailSubjectTemplate: 'Action Required: Confirm Optical Specs — Order {orderNumber}',
    emailBodyTemplate:
      'Hello {customerName}, our dispensing desk has prepared the final optical parameters for order {orderNumber} and is awaiting your confirmation.',
  },
  Processing: {
    stageKey: 'Processing',
    stageLabel: 'Processing',
    smsEnabled: true,
    emailEnabled: true,
    smsTemplate:
      'VISION CARE: Hello {customerName}, your frame chassis and lens blanks for order {orderNumber} have been allocated.',
    emailSubjectTemplate: 'Order Processing & Blank Allocation — Order {orderNumber}',
    emailBodyTemplate:
      'Hello {customerName}, your eyewear frame and optical lens blanks for order {orderNumber} have been allocated and queued for laboratory surfacing.',
  },
  'Lens preparation': {
    stageKey: 'Lens preparation',
    stageLabel: 'Lab Surfacing (Lens Preparation)',
    smsEnabled: true,
    emailEnabled: true,
    smsTemplate:
      'VISION CARE LAB: Hello {customerName}, your prescription lenses for order {orderNumber} are now in Lab Surfacing & Digital Freeform Edging.',
    emailSubjectTemplate: 'Lab Surfacing Update — Vision Care Order {orderNumber}',
    emailBodyTemplate:
      'Hello {customerName}, your prescription lenses for order {orderNumber} are now being surfaced, multi-layer coated, and precision-edged in our optical laboratory.',
  },
  'Quality control': {
    stageKey: 'Quality control',
    stageLabel: 'Quality Control',
    smsEnabled: true,
    emailEnabled: true,
    smsTemplate:
      'VISION CARE QC: Hello {customerName}, your eyewear for order {orderNumber} is now in Clinical Quality Control & Lensometer Verification.',
    emailSubjectTemplate: 'Quality Control Inspection — Vision Care Order {orderNumber}',
    emailBodyTemplate:
      'Hello {customerName}, your completed eyewear for order {orderNumber} is undergoing multi-axis digital lensometer verification, PD alignment, and ultrasonic cleaning.',
  },
  'Ready for dispatch': {
    stageKey: 'Ready for dispatch',
    stageLabel: 'Ready for Dispatch',
    smsEnabled: true,
    emailEnabled: true,
    smsTemplate:
      'VISION CARE: Hello {customerName}, your eyewear order {orderNumber} has passed QC and is packed for courier dispatch to {deliveryCity}.',
    emailSubjectTemplate: 'Packed & Ready for Dispatch — Order {orderNumber}',
    emailBodyTemplate:
      'Hello {customerName}, your Vision Care eyewear for order {orderNumber} has passed all clinical quality checks and is sealed in its protective hard case for dispatch to {deliveryCity}, {deliveryState}.',
  },
  Shipped: {
    stageKey: 'Shipped',
    stageLabel: 'Shipped',
    smsEnabled: true,
    emailEnabled: true,
    smsTemplate:
      'VISION CARE DISPATCH: Hello {customerName}, your order {orderNumber} has been Shipped via insured courier to {deliveryCity}, {deliveryState}.',
    emailSubjectTemplate: 'Your Eyewear Has Shipped — Vision Care Order {orderNumber}',
    emailBodyTemplate:
      'Hello {customerName}, great news! Your Vision Care order {orderNumber} has been dispatched via insured optical courier to {deliveryCity}, {deliveryState}.',
  },
  Delivered: {
    stageKey: 'Delivered',
    stageLabel: 'Delivered',
    smsEnabled: true,
    emailEnabled: true,
    smsTemplate:
      'VISION CARE: Hello {customerName}, your eyewear order {orderNumber} has been delivered. Enjoy crystal-clear vision!',
    emailSubjectTemplate: 'Order Delivered — Vision Care Order {orderNumber}',
    emailBodyTemplate:
      'Hello {customerName}, your Vision Care order {orderNumber} has been marked as Delivered in {deliveryCity}, {deliveryState}. Thank you for trusting Vision Care Optical Atelier.',
  },
};

export const DEFAULT_NOTIFICATION_META: OrderNotificationMeta = {
  notifySms: true,
  notifyEmail: true,
  stages: {
    labSurfacing: true,
    qualityControl: true,
    shipped: true,
  },
  history: [],
  adminNoteText: '',
};

/**
 * Parses OrderNotificationMeta stored inside order.internalAdminNotes (JSON or plain text fallback).
 */
export function parseOrderNotificationMeta(internalAdminNotes?: string | null): OrderNotificationMeta {
  if (!internalAdminNotes) {
    return {
      ...DEFAULT_NOTIFICATION_META,
      stages: { ...DEFAULT_NOTIFICATION_META.stages },
      history: [],
    };
  }

  const trimmed = internalAdminNotes.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
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
      // Fallback to plain text note
    }
  }

  return {
    ...DEFAULT_NOTIFICATION_META,
    stages: { ...DEFAULT_NOTIFICATION_META.stages },
    history: [],
    adminNoteText: internalAdminNotes,
  };
}

export function serializeOrderNotificationMeta(meta: OrderNotificationMeta): string {
  return JSON.stringify(meta);
}

/**
 * Maps any milestone label (e.g. "Lab Surfacing", "Quality Control", "Shipped")
 * to its canonical stageKey in DEFAULT_STAGE_NOTIFICATION_TEMPLATES.
 */
export function normalizeNotificationStageKey(stageOrStatus: string): string {
  if (DEFAULT_STAGE_NOTIFICATION_TEMPLATES[stageOrStatus]) {
    return stageOrStatus;
  }
  const lower = (stageOrStatus || '').toLowerCase();
  if (lower.includes('lab') || lower.includes('surfacing') || lower.includes('lens preparation')) {
    return 'Lens preparation';
  }
  if (lower.includes('quality') || lower.includes('qc')) {
    return 'Quality control';
  }
  if (lower.includes('ship')) {
    return 'Shipped';
  }
  if (lower.includes('deliver')) {
    return 'Delivered';
  }
  if (lower.includes('dispatch')) {
    return 'Ready for dispatch';
  }
  if (lower.includes('prescription') || lower.includes('review')) {
    return 'Prescription under review';
  }
  if (lower.includes('awaiting') || lower.includes('confirm')) {
    return 'Awaiting confirmation';
  }
  if (lower.includes('process')) {
    return 'Processing';
  }
  return 'Order received';
}

/**
 * Merges default stage notification templates with Admin customizations stored in siteConfig.notificationStageTemplates.
 */
export function getNotificationStageTemplates(
  siteConfig?: Record<string, any>
): NotificationStageTemplateMap {
  const customMap = siteConfig?.notificationStageTemplates || {};
  const merged: NotificationStageTemplateMap = {};

  for (const [key, def] of Object.entries(DEFAULT_STAGE_NOTIFICATION_TEMPLATES)) {
    const custom = customMap[key] || {};
    merged[key] = {
      stageKey: key,
      stageLabel: custom.stageLabel || def.stageLabel,
      smsEnabled: typeof custom.smsEnabled === 'boolean' ? custom.smsEnabled : def.smsEnabled,
      emailEnabled: typeof custom.emailEnabled === 'boolean' ? custom.emailEnabled : def.emailEnabled,
      smsTemplate:
        typeof custom.smsTemplate === 'string' && custom.smsTemplate.trim()
          ? custom.smsTemplate
          : def.smsTemplate,
      emailSubjectTemplate:
        typeof custom.emailSubjectTemplate === 'string' && custom.emailSubjectTemplate.trim()
          ? custom.emailSubjectTemplate
          : def.emailSubjectTemplate,
      emailBodyTemplate:
        typeof custom.emailBodyTemplate === 'string' && custom.emailBodyTemplate.trim()
          ? custom.emailBodyTemplate
          : def.emailBodyTemplate,
    };
  }

  return merged;
}

export function interpolateNotificationTemplate(
  template: string,
  variables: {
    customerName: string;
    orderNumber: string;
    orderStatus: string;
    deliveryCity?: string;
    deliveryState?: string;
  }
): string {
  return (template || '')
    .replace(/\{customerName\}/g, variables.customerName || 'Valued Client')
    .replace(/\{orderNumber\}/g, variables.orderNumber || 'VC-000000')
    .replace(/\{orderStatus\}/g, variables.orderStatus || 'Updated')
    .replace(/\{deliveryCity\}/g, variables.deliveryCity || 'Lagos')
    .replace(/\{deliveryState\}/g, variables.deliveryState || 'Lagos State');
}

/**
 * Resolves the active notification channels (SMS / Email) and interpolated template messages
 * for an automated order status update.
 */
export function resolveAutomatedStageNotification(params: {
  stageName: string;
  orderNumber: string;
  customerName: string;
  deliveryCity?: string;
  deliveryState?: string;
  siteConfig?: Record<string, any>;
  orderMeta?: { notifySms?: boolean; notifyEmail?: boolean };
  explicitChannels?: string[];
  explicitCustomMessage?: string;
}): {
  canonicalStageKey: string;
  channels: string[];
  title: string;
  message: string;
  smsMessage: string;
  emailSubject: string;
  emailBody: string;
} {
  const canonicalStageKey = normalizeNotificationStageKey(params.stageName);
  const templates = getNotificationStageTemplates(params.siteConfig);
  const stageConfig =
    templates[canonicalStageKey] || DEFAULT_STAGE_NOTIFICATION_TEMPLATES['Order received'];

  // Global admin channel switches (default true)
  const globalSmsChannelEnabled = params.siteConfig?.adminSmsChannelEnabled !== false;
  const globalEmailChannelEnabled = params.siteConfig?.adminEmailChannelEnabled !== false;

  // Combine order-level preference with Admin stage channel definition
  const orderAllowsSms = params.orderMeta?.notifySms !== false;
  const orderAllowsEmail = params.orderMeta?.notifyEmail !== false;

  const computedChannels: string[] = [];
  if (globalSmsChannelEnabled && stageConfig.smsEnabled && orderAllowsSms) {
    computedChannels.push('SMS');
  }
  if (globalEmailChannelEnabled && stageConfig.emailEnabled && orderAllowsEmail) {
    computedChannels.push('Email');
  }

  const finalChannels =
    params.explicitChannels && params.explicitChannels.length > 0
      ? params.explicitChannels
      : computedChannels.length > 0
      ? computedChannels
      : ['In-App'];

  const vars = {
    customerName: params.customerName || 'Valued Client',
    orderNumber: params.orderNumber,
    orderStatus: params.stageName || stageConfig.stageLabel,
    deliveryCity: params.deliveryCity || 'Lagos',
    deliveryState: params.deliveryState || 'Lagos',
  };

  const smsMessage = params.explicitCustomMessage
    ? params.explicitCustomMessage
    : interpolateNotificationTemplate(stageConfig.smsTemplate, vars);

  const emailSubject = interpolateNotificationTemplate(stageConfig.emailSubjectTemplate, vars);
  const emailBody = params.explicitCustomMessage
    ? params.explicitCustomMessage
    : interpolateNotificationTemplate(stageConfig.emailBodyTemplate, vars);

  const primaryMessage =
    finalChannels.includes('SMS') && !finalChannels.includes('Email') ? smsMessage : emailBody;

  return {
    canonicalStageKey,
    channels: finalChannels,
    title: emailSubject,
    message: primaryMessage,
    smsMessage,
    emailSubject,
    emailBody,
  };
}

export function buildStageNotificationMessage(
  orderNumber: string,
  customerName: string,
  stageLabel: string,
  siteConfig?: Record<string, any>
): { title: string; message: string; mappedOrderStatus: string } {
  const resolved = resolveAutomatedStageNotification({
    stageName: stageLabel,
    orderNumber,
    customerName,
    siteConfig,
  });
  return {
    title: resolved.title,
    message: resolved.message,
    mappedOrderStatus: resolved.canonicalStageKey,
  };
}
