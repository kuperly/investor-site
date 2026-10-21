/**
 * Generic legal texts for /legal/[slug]. They describe only what this site
 * actually does (a contact form delivered by email, hosting logs, a theme
 * preference in localStorage — no analytics or advertising cookies). They are
 * a reasonable baseline, not legal advice: have counsel review them, then drop
 * the noindex in src/app/legal/[slug]/page.tsx.
 *
 * `{email}` in a paragraph renders as a mailto link to the general inbox.
 */
export type LegalSection = {
  heading: string
  paragraphs?: string[]
  list?: string[]
}

export type LegalDocument = {
  title: string
  intro: string
  sections: LegalSection[]
}

export const legalLastUpdated = 'October 18, 2026'

const contactSection: LegalSection = {
  heading: 'Contact',
  paragraphs: ['Questions about this document can be sent to {email}.'],
}

export const legalDocuments = {
  privacy: {
    title: 'Privacy Policy',
    intro:
      'This Privacy Policy explains what information ValeForge Capital ("ValeForge", "we", "us") collects through this website and how we use it.',
    sections: [
      {
        heading: 'Information we collect',
        list: [
          'Information you send us. When you use the contact form or email us, we receive your name, email address, the type of inquiry, your message and anything else you choose to include.',
          'Technical information. Like most websites, our hosting provider automatically processes basic technical data, such as IP address, browser type and the pages requested, to deliver and secure the site.',
          'No tracking cookies. We do not use analytics or advertising cookies. The site remembers your light or dark display preference in your own browser; that setting is never sent to us.',
        ],
      },
      {
        heading: 'How we use it',
        paragraphs: [
          'We use the information you send us to respond to your inquiry, to evaluate the opportunity or relationship you raise, and to keep a record of our correspondence. We use technical information to operate and secure the website, and we may use information where needed to comply with the law.',
          'We do not sell or rent personal information, and we do not use it for advertising.',
        ],
      },
      {
        heading: 'Service providers and disclosure',
        paragraphs: [
          'We rely on a small number of providers to run the site and our email, such as website hosting, email delivery for the contact form, and our business email service. They process information on our behalf to provide those services.',
          'We may also disclose information if required by law, to protect our rights or the safety of others, or as part of a business transaction such as a merger or reorganization.',
        ],
      },
      {
        heading: 'Retention and security',
        paragraphs: [
          'We keep inquiries and correspondence for as long as needed for the purposes above and for our business records, and then delete them. We take reasonable measures to protect information, but no method of transmission or storage is completely secure. Please do not send sensitive information, such as Social Security or bank account numbers, through the contact form.',
        ],
      },
      {
        heading: 'Your choices',
        paragraphs: [
          'You can ask us to access, correct or delete the personal information you have sent us by emailing {email}. We will respond as required by applicable law.',
        ],
      },
      {
        heading: 'Children',
        paragraphs: [
          'This website is intended for adults and is not directed to anyone under 18. We do not knowingly collect information from children.',
        ],
      },
      {
        heading: 'Changes to this policy',
        paragraphs: [
          'We may update this policy from time to time. The date at the top of this page shows when it was last changed.',
        ],
      },
      contactSection,
    ],
  },

  terms: {
    title: 'Terms of Use',
    intro:
      'These Terms of Use govern your use of this website, operated by ValeForge Capital ("ValeForge", "we", "us"). By using the site, you agree to them.',
    sections: [
      {
        heading: 'Information only',
        paragraphs: [
          'The content of this website is provided for general information about ValeForge. It is not an offer or solicitation of any kind, and it is not investment, legal, tax or financial advice. Using the site or contacting us does not create any client, advisory, partnership or other relationship.',
        ],
      },
      {
        heading: 'What you send us',
        paragraphs: [
          'When you send us information, for example about a property or a potential partnership, you confirm that you are entitled to share it. We are not obliged to respond to or act on any submission. Unsolicited submissions are not treated as confidential unless we agree otherwise in writing.',
        ],
      },
      {
        heading: 'Intellectual property',
        paragraphs: [
          'The text, logo, design and other content of this site belong to ValeForge Capital or its licensors. Photographs are used under the licenses of their owners. You may view and share pages for personal, non-commercial purposes, but you may not copy, modify or reuse the content without our permission.',
        ],
      },
      {
        heading: 'Acceptable use',
        paragraphs: [
          'Do not use the site for any unlawful purpose, attempt to interfere with its operation or security, scrape or harvest its content by automated means, or use the contact form to send spam or misleading information.',
        ],
      },
      {
        heading: 'Links to other sites',
        paragraphs: [
          'The site may link to websites we do not control. We are not responsible for their content or practices.',
        ],
      },
      {
        heading: 'No warranties; limitation of liability',
        paragraphs: [
          'The site is provided "as is" and "as available", without warranties of any kind. We try to keep it accurate and current but do not guarantee that it is complete, error-free or always available.',
          'To the fullest extent permitted by law, ValeForge Capital is not liable for any loss or damage arising from your use of, or reliance on, this website.',
        ],
      },
      {
        heading: 'Changes and governing law',
        paragraphs: [
          'We may update these terms at any time by posting a new version here. These terms are governed by the laws of the United States and of the state in which ValeForge Capital is organized, without regard to conflict-of-law rules.',
        ],
      },
      contactSection,
    ],
  },

  disclaimer: {
    title: 'Disclaimer',
    intro: 'Please read this disclaimer before relying on anything on this website.',
    sections: [
      {
        heading: 'No offer or solicitation',
        paragraphs: [
          'Nothing on this website is an offer to sell, or a solicitation of an offer to buy, any security, fund interest or investment product. Any such offer, if ever made, would be made only through formal offering documents and in compliance with applicable securities laws.',
        ],
      },
      {
        heading: 'Not advice',
        paragraphs: [
          'Nothing on this website is investment, legal, tax or financial advice. Consult your own advisers before making any decision.',
        ],
      },
      {
        heading: 'Approach, not results',
        paragraphs: [
          'Descriptions of our approach, the strategies we may consider and the markets we focus on explain how we think about real estate. They are not statements of past results, projections or guarantees of future performance. Real estate investing involves risk, including the possible loss of capital.',
        ],
      },
      {
        heading: 'Photography',
        paragraphs: [
          'Photographs on this website illustrate the markets we focus on. They do not show properties owned, acquired or renovated by ValeForge.',
        ],
      },
      {
        heading: 'Accuracy',
        paragraphs: [
          'We aim to keep this website accurate, but information may be incomplete or change without notice, and we are under no obligation to update it.',
        ],
      },
      contactSection,
    ],
  },
} satisfies Record<string, LegalDocument>

export type LegalSlug = keyof typeof legalDocuments
