import { redirect } from 'next/navigation'

/** Candidates moved to Deal Sourcing (layer 4). Old links keep working. */
export default function CandidatesMoved() {
  redirect('/sourcing/leads')
}
