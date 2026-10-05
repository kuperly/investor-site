import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="card text-center">
      <h1 className="text-lg font-semibold">Deal not found</h1>
      <Link href="/" className="text-brand underline">Back to all deals</Link>
    </div>
  )
}
