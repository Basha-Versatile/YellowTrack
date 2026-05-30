import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy · Yellow Track",
  description: "When and how Yellow Track issues refunds for subscription fees.",
};

const LAST_UPDATED = "30 May 2026";

export default function RefundPage() {
  return (
    <article>
      <header className="mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-600 dark:text-yellow-400 mb-3">
          Legal
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
          Refund Policy
        </h1>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <section className="space-y-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        <p>
          Yellow Track is a subscription-based fleet management service. This policy
          explains the limited circumstances under which we issue refunds. Read it
          alongside our{" "}
          <a
            href="/legal/terms"
            className="text-yellow-700 dark:text-yellow-400 font-semibold hover:underline"
          >
            Terms &amp; Conditions
          </a>{" "}
          and{" "}
          <a
            href="/legal/cancellation"
            className="text-yellow-700 dark:text-yellow-400 font-semibold hover:underline"
          >
            Cancellation &amp; Returns
          </a>{" "}
          policy.
        </p>
      </section>

      <Heading>1. Free Trial</Heading>
      <Body>
        <p>
          Every new Tenant gets a 15-day free trial. No payment is collected during
          the trial, so no refund applies. If you choose not to subscribe, your
          account simply moves to a read-only state at the end of the trial and you
          can export your data before deletion.
        </p>
      </Body>

      <Heading>2. Monthly Subscriptions</Heading>
      <Body>
        <p>
          Monthly fees are non-refundable. When you cancel a monthly plan, you keep
          access to the Service until the end of the billing period already paid
          for, and we do not auto-renew for the next month.
        </p>
        <p>
          Partial-month refunds are not issued for plan downgrades, unused
          features, or unused users / vehicles within a paid month.
        </p>
      </Body>

      <Heading>3. Annual Subscriptions</Heading>
      <Body>
        <p>
          Annual subscriptions can be cancelled at any time. If you cancel within{" "}
          <strong>7 days of the initial purchase</strong> and have not extensively
          used the Service (we will assess usage in good faith), we will issue a
          full refund of the annual fee.
        </p>
        <p>
          After the 7-day window, the annual fee is non-refundable. You will retain
          access until the end of the prepaid annual term, and we will not
          auto-renew for the next year.
        </p>
      </Body>

      <Heading>4. Service Outages &amp; Errors</Heading>
      <Body>
        <p>
          If the Service is materially unavailable for a continuous period that we,
          acting reasonably, judge to constitute a material breach, you may request
          a service credit equal to the pro-rated fees for the affected period. We
          will issue the credit against your next invoice rather than a cash refund,
          unless your account is being closed.
        </p>
      </Body>

      <Heading>5. Add-Ons &amp; Usage Fees</Heading>
      <Body>
        <p>
          One-time charges for paid add-ons, additional usage credits (e.g. extra
          Surepass lookups), and SMS / WhatsApp throughput packs are non-refundable
          once dispatched or consumed.
        </p>
      </Body>

      <Heading>6. Taxes</Heading>
      <Body>
        <p>
          GST and any other taxes collected on your behalf are refunded only where
          permitted by applicable tax law. Where a refund is issued, the GST
          component of the original invoice is reversed via a credit note.
        </p>
      </Body>

      <Heading>7. How to Request a Refund</Heading>
      <Body>
        <p>To request a refund:</p>
        <ul>
          <li>
            Email{" "}
            <a href="mailto:hello@theyellowtrack.com">hello@theyellowtrack.com</a>{" "}
            from the email registered as the account owner.
          </li>
          <li>
            Include the workspace name, the invoice number, and the reason for the
            request.
          </li>
          <li>
            We will acknowledge within 2 business days and complete the review
            within 7 business days.
          </li>
        </ul>
        <p>
          Approved refunds are returned to the original payment instrument within
          5–10 business days of approval, subject to the processing times of your
          bank / card network.
        </p>
      </Body>

      <Heading>8. Chargebacks</Heading>
      <Body>
        <p>
          We encourage you to contact us before raising a chargeback with your card
          issuer. Disputes resolved cooperatively are usually faster and avoid your
          account being suspended pending review.
        </p>
      </Body>

      <Heading>9. Changes</Heading>
      <Body>
        <p>
          We may update this Refund Policy from time to time. The version in force
          when you made the relevant payment continues to govern that payment.
        </p>
      </Body>

      <Heading>10. Contact</Heading>
      <Body>
        <p>
          For refund questions, write to{" "}
          <a href="mailto:hello@theyellowtrack.com">hello@theyellowtrack.com</a>.
        </p>
      </Body>
    </article>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 mb-3 text-lg font-bold text-gray-900 dark:text-white">
      {children}
    </h2>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300 [&_a]:text-yellow-700 dark:[&_a]:text-yellow-400 [&_a]:font-semibold [&_a:hover]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
      {children}
    </div>
  );
}
