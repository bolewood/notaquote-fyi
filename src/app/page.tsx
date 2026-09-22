import { Calculator } from "@/components/calculator"

/**
 * A static page: share links keep their data after the "#", which never
 * reaches a server, and the page reads it in the browser.
 */
export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 lg:px-6">
      <Calculator />
    </div>
  )
}
