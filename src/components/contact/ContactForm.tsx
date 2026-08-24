'use client'

import { useState, type FormEvent } from 'react'
import { contactFormSchema, type ContactFormValues } from '@/lib/contact-schema'

type FieldErrors = Partial<Record<keyof ContactFormValues, string>>
type Status = 'idle' | 'submitting' | 'success' | 'error'

const initialValues: ContactFormValues = {
  intent: 'investor',
  name: '',
  email: '',
  message: '',
}

export function ContactForm() {
  const [values, setValues] = useState<ContactFormValues>(initialValues)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [status, setStatus] = useState<Status>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)

  function validateField(field: keyof ContactFormValues, nextValues: ContactFormValues) {
    const result = contactFormSchema.safeParse(nextValues)
    if (result.success) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
      return
    }
    const issue = result.error.issues.find((i) => i.path[0] === field)
    setErrors((prev) => ({ ...prev, [field]: issue?.message }))
  }

  function handleChange<K extends keyof ContactFormValues>(field: K, value: ContactFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function handleBlur(field: keyof ContactFormValues) {
    validateField(field, values)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = contactFormSchema.safeParse(values)
    if (!result.success) {
      const nextErrors: FieldErrors = {}
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof ContactFormValues
        nextErrors[field] = issue.message
      }
      setErrors(nextErrors)
      return
    }

    setStatus('submitting')
    setSubmitError(null)

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(body?.message ?? 'Something went wrong. Please try again.')
      }

      setStatus('success')
      setValues(initialValues)
      setErrors({})
    } catch (error) {
      setStatus('error')
      setSubmitError(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
    }
  }

  if (status === 'success') {
    return (
      <div role="status" className="rounded-lg border border-border bg-card p-6 text-foreground">
        <p className="font-heading text-xl">Thank you — your message is on its way.</p>
        <p className="mt-2 text-muted-foreground">We read every message and will follow up directly.</p>
      </div>
    )
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-6">
      <fieldset>
        <legend className="mb-2 font-medium text-foreground">I am reaching out as a...</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="intent"
              value="investor"
              checked={values.intent === 'investor'}
              onChange={() => handleChange('intent', 'investor')}
              className="h-5 w-5 accent-primary"
            />
            Investor
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="intent"
              value="deal"
              checked={values.intent === 'deal'}
              onChange={() => handleChange('intent', 'deal')}
              className="h-5 w-5 accent-primary"
            />
            I have a deal or listing
          </label>
        </div>
      </fieldset>

      <div>
        <label htmlFor="name" className="mb-1 block font-medium text-foreground">
          Full name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          value={values.name}
          onChange={(e) => handleChange('name', e.target.value)}
          onBlur={() => handleBlur('name')}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'name-error' : undefined}
          className="min-h-[44px] w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        {errors.name && (
          <p id="name-error" role="alert" className="mt-1 text-sm text-destructive">
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block font-medium text-foreground">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => handleChange('email', e.target.value)}
          onBlur={() => handleBlur('email')}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'email-error' : undefined}
          className="min-h-[44px] w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        {errors.email && (
          <p id="email-error" role="alert" className="mt-1 text-sm text-destructive">
            {errors.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="message" className="mb-1 block font-medium text-foreground">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          value={values.message}
          onChange={(e) => handleChange('message', e.target.value)}
          onBlur={() => handleBlur('message')}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? 'message-error' : undefined}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        {errors.message && (
          <p id="message-error" role="alert" className="mt-1 text-sm text-destructive">
            {errors.message}
          </p>
        )}
      </div>

      {status === 'error' && submitError && (
        <p role="alert" aria-live="polite" className="text-sm text-destructive">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="min-h-[44px] rounded-md bg-primary px-6 py-2 font-medium text-primary-foreground transition-colors duration-200 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === 'submitting' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}
