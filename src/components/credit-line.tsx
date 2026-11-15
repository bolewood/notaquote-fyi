import { CREDIT_RULES_HREF, creditLine } from "@/lib/credit-line"
import Link from "next/link"

/** One plain line about credit in the visitor's state, linking to the credit rules. */
export function CreditLine({ state }: { state: string }) {
  return (
    <p className="mt-1" data-testid="credit-line">
      {creditLine(state)}{" "}
      <Link href={CREDIT_RULES_HREF} className="link">
        Credit rules by state
      </Link>
    </p>
  )
}
