import { Calculator } from "@/components/calculator"

export default async function HomePage(props: PageProps<"/">) {
  const searchParams = await props.searchParams
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") query.set(key, value)
    else if (Array.isArray(value)) {
      for (const item of value) query.append(key, item)
    }
  }
  const initialSearch = query.toString()

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-1 lg:px-6">
      <Calculator key={initialSearch} initialSearch={initialSearch} />
    </div>
  )
}
