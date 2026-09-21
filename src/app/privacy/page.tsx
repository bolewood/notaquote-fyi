import type { Metadata } from "next"
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
        clears the open field. This page does not send the amount to a server
        or to analytics.
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
        does not send it to an analytics service.
      </p>
      <p>
        Printing uses the browser’s own print dialog. The worksheet is part of
        this page. Nothing is uploaded.
      </p>
      <p>
        There is no account, no document upload, and no visitor database. This
        version does not set analytics cookies. Pages send a noindex, nofollow
        request to crawlers.
      </p>
      <p>
        A corrections form is not part of this version. This page does not ask
        you to send a personal story, and it does not publish a contact address.
      </p>
      <p>
        Location is a state and a region class: urban, suburban, or rural.
        Springfield appears only as the label for Molly’s Illinois urban
        stand-in. It is not a city field.
      </p>
    </TrustArticle>
  )
}
