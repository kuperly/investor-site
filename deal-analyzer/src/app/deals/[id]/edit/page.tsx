import { notFound } from 'next/navigation'
import { DealForm } from '@/components/DealForm'
import { toFormValues } from '@/lib/parse-inputs'
import { repo } from '@/lib/repo'

export const dynamic = 'force-dynamic'

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const deal = await (await repo()).get(id)
  if (!deal) notFound()
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Edit — {deal.inputs.address}</h1>
      <DealForm id={deal.id} initialValues={toFormValues(deal.inputs)} initialNotes={deal.notes} initialStatus={deal.status} />
    </div>
  )
}
