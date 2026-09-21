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
        The sample range is calculated in the browser. Changing a control does
        not send the scenario to a server. The vehicle catalog is a static file
        on this site. Choosing a year, make, model, or trim does not create a
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
        The optional current annual premium stays on the open page. This version
        does not write it to storage, a cookie, or a server. Reloading the page
        clears it. Switching to Molly, Jayden, or Ava clears it as well.
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
