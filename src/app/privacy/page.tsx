import type { Metadata } from "next"
import Link from "next/link"
import { CountLedgerPanel } from "@/components/count-ledger"
import { TrustArticle } from "@/components/trust-article"
import { PUBLISHER } from "@/lib/copy"

export const metadata: Metadata = {
  title: "Privacy",
}

export default function PrivacyPage() {
  return (
    <TrustArticle title="Privacy">
      <p className="text-base leading-7">
        The short version: everything you type stays in your browser. There&apos;s no account, no sign-up, and nothing to
        sell. {PUBLISHER} publishes this site and never sees your answers.
      </p>

      <h2 className="text-base font-semibold">What we don&apos;t ask for</h2>
      <p>
        No name, email, phone number, birthday, address, ZIP code, driver&apos;s license, policy number, or insurance
        company. Location is just a state and whether the car is kept in a city, the suburbs, or the country.
      </p>

      <h2 className="text-base font-semibold">Where the math happens</h2>
      <p>
        On your device. The list of cars, the factors, and the sources are ordinary files this site sends to your browser,
        the same for everyone. Changing a choice doesn&apos;t send anything anywhere.
      </p>

      <h2 className="text-base font-semibold">The one exception: a VIN lookup, only if you use it</h2>
      <p>
        If you type a VIN (the 17-character vehicle ID), your browser sends it straight to NHTSA&apos;s free vehicle decoder
        to find the car. It doesn&apos;t pass through us, and we don&apos;t keep it: the field clears afterward and the VIN
        isn&apos;t saved anywhere.
      </p>

      <h2 className="text-base font-semibold">What stays on your device</h2>
      <p>
        So the pages remember your choices, this browser keeps them in its local storage: your situation on the What-if
        page (including what you pay now, if you entered it), and your list of cars on the Compare page. They never leave
        your device. To remove them, clear this site&apos;s data in your browser settings.
      </p>

      <h2 className="text-base font-semibold">Share links</h2>
      <p>
        A share link puts your choices in the web address, so whoever opens it sees the same thing. It never includes
        prices: the numbers are worked out fresh when the link is opened. On the What-if page, what you pay now goes into the
        link only if you tick &ldquo;Include what I pay now&rdquo;. Compare links never include it. Share a link the way
        you&apos;d share any personal note. Copying a link doesn&apos;t send it anywhere.
      </p>

      <h2 className="text-base font-semibold">Printing and spreadsheets</h2>
      <p>
        Printing uses your browser&apos;s own print window. The spreadsheet download is made on your device from the table
        you see. Nothing is uploaded.
      </p>

      <h2 className="text-base font-semibold">No tracking</h2>
      <p>
        No cookies, ad trackers, analytics scripts, or session recording. The only counts are the simple tallies below,
        kept in this browser and never sent. Each one records that something happened (like &ldquo;a share link was
        copied&rdquo;), never what you chose or any amount.
      </p>

      <h2 className="text-base font-semibold">Telling us about a problem</h2>
      <p>
        The{" "}
        <Link href="/corrections" className="link">
          Spot something wrong?
        </Link>{" "}
        links open a form on GitHub, filled in with the site&apos;s own labels, like the car&apos;s name. You see the whole
        thing and decide whether to post it. Reports are public, so leave out what you pay, your VIN, and anything about
        you.
      </p>

      <CountLedgerPanel />
    </TrustArticle>
  )
}
