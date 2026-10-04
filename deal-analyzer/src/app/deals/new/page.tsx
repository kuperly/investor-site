import { DealForm } from '@/components/DealForm'
import { emptyInputs } from '@/engine/fields'
import { toFormValues } from '@/lib/parse-inputs'

export default function NewDealPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">New Deal</h1>
      <DealForm initialValues={toFormValues(emptyInputs())} initialNotes={{}} initialStatus="Lead" />
    </div>
  )
}
