import type { Metadata } from "next"
import { CountLedgerPanel } from "@/components/count-ledger"
import { TrustArticle } from "@/components/trust-article"
import { PUBLISHER } from "@/lib/copy"

export const metadata: Metadata = {
  title: "Privacy",
}

export default function PrivacyPage() {
  return (
    <TrustArticle title="Privacy">
      <p>
        {PUBLISHER} publishes NotAQuote.FYI. This version does not collect a
        name, email address, phone number, date of birth, driver license number,
        street address, ZIP code, policy number, or carrier name. There is no
        field for those items.
      </p>
      <p>
        The labeled sample and the factor engine both run in the browser.
        Changing a control does not send the scenario to a server. The vehicle
        catalog, the factor bundle, and the source manifest are static files on
        this site. Choosing a year, make, model, or trim does not create a
        profile on a server.
      </p>
      <p>
        An optional VIN can be decoded. This browser sends that VIN to the NHTSA
        vPIC decode service and then clears the field. The VIN is not written to
        storage on this site, a cookie, or a log this site keeps. Reloading the
        page clears it. A decode that does not resolve leaves the year, make,
        model, and trim controls as they were.
      </p>
      <p>
        The optional current annual premium is an anchor for the open scenario.
        Leaving it empty keeps the labeled sample. Choosing Molly, Jayden, or
        Ava clears the open field. Reloading a page that is not a share link
        clears the open field. This page does not send the amount to a server.
        The count tally does not record that amount.
      </p>
      <p>
        Saving a comparison writes that scenario to local storage on this
        browser. There is no account and no copy on a server. Refreshing the
        page keeps those saved scenarios. If the saved scenario includes the
        optional premium, that amount stays in local storage on this browser
        only. Removing the scenario, or clearing this site’s data in the
        browser, removes it.
      </p>
      <p>
        A share link puts the scenario inputs and the model and data-bundle
        versions in the address. It does not put a finished low, likely, or
        high figure in the address. Opening the link recalculates on this page
        and shows the disclaimer. If the model version in the link is not the
        model on this page, the page says so. The optional premium is added to
        the link only as the amount entered, and the page still calls that
        amount the visitor’s anchor, not a cleared baseline. Copying the link
        does not send the link. The count tally records that a copy happened,
        and it does not record the address or any amount in it.
      </p>
      <p>
        Printing uses the browser’s own print dialog. The worksheet is part of
        this page. Nothing is uploaded.
      </p>
      <p>
        There is no account, no document upload, and no visitor database. Product
        counts stay in this browser. This version does not set a cookie for
        them. There is no advertising pixel, no session replay, and no
        fingerprint. Pages send a noindex, nofollow request to crawlers.
      </p>
      <p>
        The corrections form asks for a state, a page on this site, a source
        URL, and one category: wrong minimum, stale source, vehicle mapping,
        display error, or other. It does not ask for a name, an email address,
        a phone number, a carrier, a premium, or a written note. When the queue
        is not configured, the form stays disabled and does not save a row.
        This page does not publish a contact address.
      </p>
      <CountLedgerPanel />
      <p>
        Location is a state and a region class: urban, suburban, or rural.
        Springfield appears only as the label for Molly’s Illinois urban
        stand-in. It is not a city field.
      </p>
    </TrustArticle>
  )
}
