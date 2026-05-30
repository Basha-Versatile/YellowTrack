import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions · Yellow Track",
  description:
    "The terms under which you access and use the Yellow Track fleet management platform.",
};

const LAST_UPDATED = "30 May 2026";

export default function TermsPage() {
  return (
    <article className="prose-policy">
      <header className="mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-600 dark:text-yellow-400 mb-3">
          Legal
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
          Terms &amp; Conditions
        </h1>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <section className="space-y-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        <p>
          These Terms &amp; Conditions (&quot;Terms&quot;) govern your access to and use of
          Yellow Track (the &quot;Service&quot;), a fleet-management platform operated by
          Yellow Track (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By creating an account, signing in,
          or otherwise using the Service, you (&quot;you&quot;, &quot;your&quot;, the &quot;Customer&quot;)
          agree to be bound by these Terms.
        </p>
      </section>

      <Heading>1. Eligibility &amp; Account</Heading>
      <Body>
        <p>
          You must be at least 18 years old and legally capable of entering into a
          binding contract under the Indian Contract Act, 1872, to use the Service.
          When you create a workspace (a &quot;Tenant&quot;), you represent that you are
          authorised to bind that organisation to these Terms.
        </p>
        <p>
          You are responsible for safeguarding your account credentials and for all
          activity that occurs under your account. Notify us immediately at{" "}
          <a href="mailto:hello@theyellowtrack.com">hello@theyellowtrack.com</a> if
          you suspect any unauthorised access.
        </p>
      </Body>

      <Heading>2. Subscriptions &amp; Billing</Heading>
      <Body>
        <p>
          Yellow Track is offered on a subscription basis. The plan tier (Silver,
          Gold, Platinum, Diamond) and the price applicable to your Tenant are the
          ones shown on the pricing page or your invoice at the time of purchase.
          Fees are quoted in Indian Rupees (INR) and are exclusive of applicable
          taxes (including GST) unless otherwise stated.
        </p>
        <p>
          Subscriptions renew automatically at the end of each billing period until
          cancelled. See our <a href="/legal/cancellation">Cancellation &amp; Returns</a>{" "}
          policy for the cancellation process and our{" "}
          <a href="/legal/refund">Refund Policy</a> for refund terms.
        </p>
        <p>
          We may revise pricing or plan limits with at least 30 days&apos; written
          notice (typically by email to the account owner). Continued use of the
          Service after the change date constitutes acceptance of the revised
          pricing.
        </p>
      </Body>

      <Heading>3. Trial</Heading>
      <Body>
        <p>
          New Tenants are entitled to a 15-day free trial of the Service. No payment
          information is required to start the trial. We may discontinue, modify, or
          shorten the trial offer for new sign-ups at any time without notice — the
          trial conditions in force at the time of sign-up apply to existing trials.
        </p>
      </Body>

      <Heading>4. Acceptable Use</Heading>
      <Body>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Service to violate any applicable law or third-party right.</li>
          <li>
            Upload vehicle, driver, or document data you do not have the right to
            process under applicable data-protection law.
          </li>
          <li>
            Attempt to gain unauthorised access to any part of the Service, other
            Tenants&apos; data, or our underlying infrastructure (MongoDB Atlas,
            Vercel, our message providers).
          </li>
          <li>
            Reverse-engineer, decompile, or attempt to extract source code from the
            Service, except to the extent permitted by law.
          </li>
          <li>
            Resell or sublicense the Service to third parties without our prior
            written consent.
          </li>
          <li>
            Use the Service to send unsolicited communications (spam) or to operate
            a competing service.
          </li>
        </ul>
        <p>
          We may suspend or terminate access if we reasonably believe these
          conditions have been breached.
        </p>
      </Body>

      <Heading>5. Customer Data</Heading>
      <Body>
        <p>
          You retain all rights to the data you upload to the Service (&quot;Customer
          Data&quot;), including vehicle records, compliance documents, driver records,
          and financial entries. You grant us a limited, worldwide, royalty-free
          licence to host, process, and display Customer Data only as required to
          provide the Service to you.
        </p>
        <p>
          See our <a href="/legal/privacy">Privacy Policy</a> for how we collect,
          use, and protect personal information within Customer Data.
        </p>
      </Body>

      <Heading>6. Third-Party Integrations</Heading>
      <Body>
        <p>
          The Service integrates with third-party providers (for example: Surepass
          for vehicle registration lookups, ChatBox.biz for WhatsApp alerts, Gmail
          SMTP for email, Vercel Blob for file storage, MongoDB Atlas for the
          database, and payment processors). Your use of those integrations is
          subject to the providers&apos; own terms. We are not responsible for
          third-party services&apos; availability or accuracy.
        </p>
      </Body>

      <Heading>7. Intellectual Property</Heading>
      <Body>
        <p>
          The Service, including its source code, design, trademarks, logos, and
          documentation, is and remains the exclusive property of Yellow Track and
          its licensors. These Terms do not grant you any right, title, or interest
          in our intellectual property except for the limited right to use the
          Service during the subscription term.
        </p>
      </Body>

      <Heading>8. Disclaimers</Heading>
      <Body>
        <p>
          The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis. We do
          not warrant that the Service will be uninterrupted, error-free, or that
          third-party data (for example, RC details fetched from Surepass or
          government portals) will always be complete or accurate. You are
          responsible for verifying information that affects regulatory or financial
          decisions.
        </p>
      </Body>

      <Heading>9. Limitation of Liability</Heading>
      <Body>
        <p>
          To the maximum extent permitted by law, our aggregate liability arising
          out of or relating to the Service in any 12-month period is capped at the
          fees you paid to us during the 12 months immediately preceding the event
          giving rise to the claim. We are not liable for indirect, incidental,
          consequential, or punitive damages, including loss of profits, loss of
          data, or loss of goodwill.
        </p>
      </Body>

      <Heading>10. Indemnity</Heading>
      <Body>
        <p>
          You agree to indemnify and hold Yellow Track and its officers, employees,
          and agents harmless from any claim or demand made by a third party arising
          from your breach of these Terms, your Customer Data, or your misuse of the
          Service.
        </p>
      </Body>

      <Heading>11. Termination</Heading>
      <Body>
        <p>
          Either party may terminate the subscription as described in our{" "}
          <a href="/legal/cancellation">Cancellation &amp; Returns</a> policy. We may
          terminate immediately for material breach of these Terms. Upon
          termination, your right to access the Service ends; we will retain
          Customer Data only for the period described in the Privacy Policy.
        </p>
      </Body>

      <Heading>12. Governing Law &amp; Jurisdiction</Heading>
      <Body>
        <p>
          These Terms are governed by the laws of India. The courts at Hyderabad,
          Telangana, India have exclusive jurisdiction to hear any dispute arising
          out of or in connection with these Terms, except where mandatory consumer
          protection laws provide otherwise.
        </p>
      </Body>

      <Heading>13. Changes to These Terms</Heading>
      <Body>
        <p>
          We may update these Terms from time to time. When we do, we will update
          the &quot;Last updated&quot; date at the top of this page and notify the account
          owner by email if the changes are material. Continued use of the Service
          after the effective date constitutes acceptance of the revised Terms.
        </p>
      </Body>

      <Heading>14. Contact</Heading>
      <Body>
        <p>
          Questions about these Terms can be sent to{" "}
          <a href="mailto:hello@theyellowtrack.com">hello@theyellowtrack.com</a> or
          by post to our registered address in Hyderabad, India.
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
