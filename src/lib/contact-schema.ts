import { z } from 'zod'

export const contactIntents = ['investor', 'deal'] as const
export type ContactIntent = (typeof contactIntents)[number]

export const contactFormSchema = z.object({
  intent: z.enum(contactIntents, {
    errorMap: () => ({ message: 'Select whether you are an investor or have a deal to share.' }),
  }),
  name: z.string().trim().min(2, 'Enter your full name.').max(120),
  email: z.string().trim().email('Enter a valid email address.'),
  message: z.string().trim().min(10, 'Message must be at least 10 characters.').max(2000),
})

export type ContactFormValues = z.infer<typeof contactFormSchema>
