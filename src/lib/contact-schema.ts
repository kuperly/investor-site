import { z } from 'zod'

/**
 * Inquiry types and the inbox each one is routed to: deal flow goes to
 * `deals@`, capital/financing/general goes to `investment@`.
 */
export const contactIntentOptions = [
  { value: 'property', label: 'Property Opportunity', inbox: 'deals' },
  { value: 'capital', label: 'Capital Partnership', inbox: 'investment' },
  { value: 'financing', label: 'Financing', inbox: 'investment' },
  { value: 'operating', label: 'Operating Partnership', inbox: 'deals' },
  { value: 'general', label: 'General Inquiry', inbox: 'investment' },
] as const

export const contactIntents = ['property', 'capital', 'financing', 'operating', 'general'] as const
export type ContactIntent = (typeof contactIntents)[number]

function optionFor(intent: ContactIntent) {
  return contactIntentOptions.find((option) => option.value === intent) ?? contactIntentOptions[4]
}

export function contactIntentLabel(intent: ContactIntent) {
  return optionFor(intent).label
}

/** Which public inbox (`siteConfig.emails` key) handles this inquiry type. */
export function contactIntentInbox(intent: ContactIntent) {
  return optionFor(intent).inbox
}

export const contactFormSchema = z.object({
  intent: z.enum(contactIntents, {
    errorMap: () => ({ message: 'Select what you would like to discuss.' }),
  }),
  name: z.string().trim().min(2, 'Enter your full name.').max(120),
  email: z.string().trim().email('Enter a valid email address.'),
  message: z.string().trim().min(10, 'Message must be at least 10 characters.').max(2000),
  honeypot: z.string().max(0).optional(),
})

export type ContactFormValues = z.infer<typeof contactFormSchema>
