import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { contactFormSchema } from '@/lib/contact-schema'
import { siteConfig } from '@/lib/site-config'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = contactFormSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Please check the form and try again.', issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const apiKey = process.env.RESEND_API_KEY
  const toEmail = process.env.CONTACT_TO_EMAIL
  const fromEmail = process.env.CONTACT_FROM_EMAIL

  if (!apiKey || !toEmail || !fromEmail) {
    console.error(
      'Contact form submitted but RESEND_API_KEY/CONTACT_TO_EMAIL/CONTACT_FROM_EMAIL is not configured.',
    )
    return NextResponse.json(
      { message: 'The contact form is not configured yet. Please email us directly.' },
      { status: 503 },
    )
  }

  const resend = new Resend(apiKey)
  const { intent, name, email, message } = parsed.data
  const intentLabel = intent === 'investor' ? 'Investor inquiry' : 'Deal / listing submission'

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: toEmail,
    replyTo: email,
    subject: `${intentLabel} — ${siteConfig.name}`,
    text: `From: ${name} <${email}>\nType: ${intentLabel}\n\n${message}`,
  })

  if (error) {
    console.error('Resend send failed', error)
    return NextResponse.json(
      { message: 'We could not send your message. Please try again in a moment.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ message: 'Sent' }, { status: 200 })
}
