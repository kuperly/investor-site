/** §31 Deal notes. */
export const NOTE_CATEGORIES = [
  { key: 'general', label: 'General notes' },
  { key: 'realtor', label: 'Realtor notes' },
  { key: 'contractor', label: 'Contractor notes' },
  { key: 'lender', label: 'Lender notes' },
  { key: 'comp', label: 'Comp notes' },
  { key: 'risks', label: 'Risks' },
  { key: 'nextSteps', label: 'Next steps' },
] as const
export type NoteKey = (typeof NOTE_CATEGORIES)[number]['key']
export type DealNotes = Partial<Record<NoteKey, string>>
