import type { Metadata } from "next"
import { TrustArticle } from "@/components/trust-article"
import { BUNDLE_VERSION, MODEL_VERSION } from "@/lib/copy"

export const metadata: Metadata = {
  title: "Model version",
}

export default function ModelVersionPage() {
  return (
    <TrustArticle title="Model version">
      <dl className="grid gap-3">
        <div>
          <dt className="font-medium">Model</dt>
          <dd className="font-mono">{MODEL_VERSION}</dd>
        </div>
        <div>
          <dt className="font-medium">Data bundle</dt>
          <dd className="font-mono">{BUNDLE_VERSION}</dd>
        </div>
      </dl>
      <h2 className="text-base font-semibold">Changelog</h2>
      <section aria-labelledby="changelog-010" className="grid gap-2">
        <h3 id="changelog-010" className="font-medium">
          0.1.0-sample
        </h3>
        <p>
          Adds sample display weights so Molly, Jayden, and Ava move a labeled
          sample range. The baseline is not cleared. There is no rating engine,
          no vehicle catalog, and no statutory dollar minimum. The credit factor
          is locked at 1.00. Trend is not applied.
        </p>
        <p>
          An optional current annual premium can replace the sample baseline for
          the open page. That amount is not stored.
        </p>
      </section>
      <p>
        A later version that changes a weight will add a row here and will keep
        the previous version readable. This page is the public changelog.
      </p>
    </TrustArticle>
  )
}
