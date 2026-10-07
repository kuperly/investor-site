import { z } from 'zod'

export const contactIntentOptions = [
  { value: 'property', label: 'Property Opportunity' },
  { value: 'capital', label: 'Capital Partnership' },
  { value: 'financing', label: 'Financing' },
  { value: 'operating', label: 'Operating Partnership' },
  { value: 'general', label: 'General Inquiry' },
] as const

export const contactIntents = ['property', 'capital', 'financing', 'operating', 'general'] as const
export type ContactIntent = (typeof contactIntents)[number]

export function contactIntentLabel(intent: ContactIntent) {
  return contactIntentOptions.find((option) => option.value === intent)?.label ?? 'General Inquiry'
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
