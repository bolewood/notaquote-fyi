import type { Metadata } from "next"
import { pageMetadata } from "@/lib/site-meta"
import Link from "next/link"
import { CountLedgerPanel } from "@/components/count-ledger"
import { TrustArticle } from "@/components/trust-article"
import { PUBLISHER } from "@/lib/copy"

export const metadata: Metadata = pageMetadata({
  title: "Privacy",
  description: "Everything you type stays in your browser. No account, no cookies, no tracking scripts, and nothing to sell.",
  path: "/privacy",
})

export default function PrivacyPage() {
  return (
    <TrustArticle
      title="Privacy"
      lead={`The short version: what you type stays on your device, except a VIN if you choose to look one up. There's no account, no tracking, and nothing to sell. ${PUBLISHER} publishes this site and never sees what you type into it. An AI assistant using our read-only service is the one difference; see below.`}
    >
      <h2>What we don&apos;t ask for</h2>
      <p>
        No name, email, phone number, birthday, address, ZIP code, driver&apos;s license, policy number, or insurance
        company. The only location we ask about is your state, and whether the car is kept in a city, the suburbs, or a
        small town.
      </p>

      <h2>Where the math happens</h2>
      <p>
        On your device. The list of cars, the numbers, and the sources are ordinary files this site sends to every visitor,
        the same for everyone. Changing a choice doesn&apos;t send anything anywhere.
      </p>

      <h2>The one exception: looking up a VIN</h2>
      <p>
        Only if you use it. If you type a VIN (vehicle identification number, the 17-character ID on your car), your browser sends it straight to the National Highway Traffic Safety Administration (NHTSA),
        whose free decoder tells your browser which car it is. It doesn&apos;t pass through us, and we
        don&apos;t keep it: the box clears afterward and the VIN isn&apos;t saved anywhere.
      </p>

      <h2>What stays on your device</h2>
      <p>
        So the pages remember your choices, this browser keeps them in its own storage: your situation on the What-if page
        (including what you pay now, if you entered it) and your list of cars on the Compare page. They never leave your
        device. To remove them, clear this site&apos;s data in your browser settings.
      </p>

      <h2>Share links</h2>
      <p>
        A share link puts your choices after the &ldquo;#&rdquo; in the web address. Browsers never send that part to any
        server, so that part never reaches us or our host. When you open a link, the page reads it and then removes
        it from the address bar.
      </p>
      <ul className="bullets">
        <li>
          The link carries your choices, not our estimates. It includes what you pay only if you check the box
          (&ldquo;Include what I pay now&rdquo;), and that&apos;s never saved on the other person&apos;s device. Compare
          links never include it.
        </li>
        <li>The numbers are worked out fresh when the link is opened.</li>
        <li>Opening a shared list never replaces your own list unless you choose to.</li>
      </ul>

      <h2>Printing and spreadsheets</h2>
      <p>
        Printing uses your browser&apos;s own print window. The spreadsheet is made on your device from the table you see.
        Nothing is uploaded.
      </p>

      <h2>No tracking</h2>
      <p>
        No cookies, ad trackers, analytics scripts, or session recording. The only counts are the simple tallies below, kept
        in this browser and never sent. Each one records that something happened, never what you chose or any amount.
      </p>

      <h2>AI assistants</h2>
      <p>
        An AI assistant can&apos;t run this page, so there&apos;s a small read-only service it can ask instead (see{" "}
        <a href="/llms.txt">notaquote.fyi/llms.txt</a>). Unlike the page, what it asks does reach our host. It only takes
        a state, a few choices like an age band or coverage level, and car names. There&apos;s no place to send a premium,
        a VIN, a ZIP code, or a name, and we turn away requests that plainly include one. We don&apos;t store what it
        asks. Our host keeps its standard request logs, and answers are saved by their web address for up to a day so
        repeat questions are quick.
      </p>

      <h2>Telling us about a problem</h2>
      <p>
        The <Link href="/corrections">&ldquo;Tell us&rdquo;</Link> links open a form on GitHub, filled in with the
        site&apos;s own labels, like the car&apos;s name. You see the whole thing and decide whether to post it. Reports are
        public, so leave out what you pay, your VIN, and anything about you.
      </p>

      <CountLedgerPanel />
    </TrustArticle>
  )
}
