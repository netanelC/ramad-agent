import { z } from 'zod';

export const whatsAppMessageTextSchema = z.object({
  body: z.string(),
});

export const whatsAppIncomingMessageSchema = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string().optional(),
  type: z.string(),
  text: whatsAppMessageTextSchema.optional(),
});

export const whatsAppValueSchema = z.object({
  messaging_product: z.string().optional(),
  metadata: z
    .object({
      display_phone_number: z.string().optional(),
      phone_number_id: z.string().optional(),
    })
    .optional(),
  contacts: z
    .array(
      z.object({
        profile: z.object({ name: z.string().optional() }).optional(),
        wa_id: z.string(),
      })
    )
    .optional(),
  messages: z.array(whatsAppIncomingMessageSchema).optional(),
});

export const whatsAppChangeSchema = z.object({
  value: whatsAppValueSchema,
  field: z.string().optional(),
});

export const whatsAppEntrySchema = z.object({
  id: z.string().optional(),
  changes: z.array(whatsAppChangeSchema).optional(),
});

export const whatsAppWebhookPayloadSchema = z.object({
  object: z.string(),
  entry: z.array(whatsAppEntrySchema).optional(),
});

export type WhatsAppWebhookPayload = z.infer<typeof whatsAppWebhookPayloadSchema>;
export type WhatsAppIncomingMessage = z.infer<typeof whatsAppIncomingMessageSchema>;
export type WhatsAppValue = z.infer<typeof whatsAppValueSchema>;
export type WhatsAppChange = z.infer<typeof whatsAppChangeSchema>;
export type WhatsAppEntry = z.infer<typeof whatsAppEntrySchema>;
export type WhatsAppMessageText = z.infer<typeof whatsAppMessageTextSchema>;
