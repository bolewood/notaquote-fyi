import type { Metadata } from "next"
import { CompareCars } from "@/components/compare-cars"

export const metadata: Metadata = {
  title: "Compare cars",
  description:
    "Put up to 15 cars side by side and see roughly what each would cost to insure for the same driver. Sort them, star favorites, and download a spreadsheet.",
}

export default async function ComparePage(props: PageProps<"/compare">) {
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
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 lg:px-6">
      <CompareCars key={initialSearch} initialSearch={initialSearch} />
    </div>
  )
}
