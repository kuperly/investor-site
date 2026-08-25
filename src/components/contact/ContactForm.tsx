'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { contactFormSchema, type ContactFormValues } from '@/lib/contact-schema'

type FieldErrors = Partial<Record<keyof ContactFormValues, string>>
type Status = 'idle' | 'submitting' | 'success' | 'error'

const initialValues: ContactFormValues = {
  intent: 'investor',
  name: '',
  email: '',
  message: '',
  honeypot: '',
}

export function ContactForm() {
  const [values, setValues] = useState<ContactFormValues>(initialValues)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [status, setStatus] = useState<Status>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const successHeadingRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (status === 'success') {
      successHeadingRef.current?.focus()
    }
  }, [status])

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
        <p ref={successHeadingRef} tabIndex={-1} className="font-heading text-xl">
          Thank you — your message is on its way.
        </p>
        <p className="mt-2 text-muted-foreground">We read every message and will follow up directly.</p>
      </div>
    )
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-6">
      <input
        type="text"
        name="honeypot"
        value={values.honeypot}
        onChange={(e) => handleChange('honeypot', e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px' }}
      />

      <fieldset>
        <legend className="mb-3 font-medium text-foreground">I am reaching out as a...</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { value: 'investor', label: 'Investor' },
              { value: 'deal', label: 'I have a deal or listing' },
            ] as const
          ).map((option) => {
            const selected = values.intent === option.value
            return (
              <label
                key={option.value}
                className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors duration-200 ${
                  selected
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                }`}
              >
                <input
                  type="radio"
                  name="intent"
                  value={option.value}
                  checked={selected}
                  onChange={() => handleChange('intent', option.value)}
                  className="h-5 w-5 accent-primary"
                />
                <span className="font-medium">{option.label}</span>
              </label>
            )
          })}
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
          className="min-h-[44px] w-full rounded-md border border-border bg-card px-4 py-2.5 text-foreground transition-colors duration-200 placeholder:text-muted-foreground focus:border-primary"
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
          className="min-h-[44px] w-full rounded-md border border-border bg-card px-4 py-2.5 text-foreground transition-colors duration-200 placeholder:text-muted-foreground focus:border-primary"
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
          className="w-full rounded-md border border-border bg-card px-4 py-2.5 leading-relaxed text-foreground transition-colors duration-200 placeholder:text-muted-foreground focus:border-primary"
        />
        {errors.message && (
          <p id="message-error" role="alert" className="mt-1 text-sm text-destructive">
            {errors.message}
          </p>
        )}
      </div>

      {status === 'error' && submitError && (
        <p role="alert" className="text-sm text-destructive">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="inline-flex min-h-[44px] items-center rounded-md bg-primary px-7 py-2.5 font-medium text-primary-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-secondary hover:shadow-lg hover:shadow-primary/25 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
      >
        {status === 'submitting' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}
