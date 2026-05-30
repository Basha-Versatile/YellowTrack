import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cancellation & Returns · Yellow Track",
  description:
    "How to cancel your Yellow Track subscription and what happens to your data.",
};

const LAST_UPDATED = "30 May 2026";

export default function CancellationPage() {
  return (
    <article>
      <header className="mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-600 dark:text-yellow-400 mb-3">
          Legal
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
          Cancellation &amp; Returns
        </h1>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <section className="space-y-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        <p>
          Yellow Track is a software-as-a-service product — there are no physical
          goods to return. This page explains how to cancel a subscription, what
          happens to your data when you do, and how to permanently close your
          workspace.
        </p>
        <p>
          For refund eligibility against a cancellation, see our{" "}
          <a
            href="/legal/refund"
            className="text-yellow-700 dark:text-yellow-400 font-semibold hover:underline"
          >
            Refund Policy
          </a>
          .
        </p>
      </section>

      <Heading>1. Cancelling Your Subscription</Heading>
      <Body>
        <p>
          You can cancel at any time. Two options:
        </p>
        <ul>
          <li>
            <strong>Self-service</strong> — sign in as the workspace owner, open{" "}
            <em>Settings → Billing</em>, and click{" "}
            <em>Cancel subscription</em>. We&apos;ll ask you to confirm.
          </li>
          <li>
            <strong>By email</strong> — write to{" "}
            <a href="mailto:hello@theyellowtrack.com">hello@theyellowtrack.com</a>{" "}
            from the email registered as the account owner. Include the workspace
            name in the subject line.
          </li>
        </ul>
        <p>
          Cancellation takes effect at the end of your current billing period. You
          keep full access to the Service until that date.
        </p>
      </Body>

      <Heading>2. Trial Cancellation</Heading>
      <Body>
        <p>
          If you&apos;re on the 15-day free trial, you don&apos;t need to cancel — no
          payment is taken at the end of the trial. Simply not subscribing moves
          your workspace into a read-only state, and we eventually delete it as
          described in section 4.
        </p>
      </Body>

      <Heading>3. Data Export</Heading>
      <Body>
        <p>
          Before your workspace closes, you can export your data:
        </p>
        <ul>
          <li>
            <strong>Vehicles, drivers, compliance, expenses, EMIs</strong> — CSV
            export is available from each list screen.
          </li>
          <li>
            <strong>Documents &amp; photos</strong> — downloadable from each
            vehicle&apos;s detail page.
          </li>
          <li>
            <strong>Activity log</strong> — exportable as JSON from the Activity
            Log screen.
          </li>
        </ul>
        <p>
          If you need a bulk export, write to{" "}
          <a href="mailto:hello@theyellowtrack.com">hello@theyellowtrack.com</a>{" "}
          before the end of your billing period and we&apos;ll work with you.
        </p>
      </Body>

      <Heading>4. Data Retention After Cancellation</Heading>
      <Body>
        <p>
          Once the cancellation effective date passes:
        </p>
        <ul>
          <li>
            We mark the workspace inactive. You can re-activate within{" "}
            <strong>30 days</strong> by signing in and resubscribing — all data is
            preserved.
          </li>
          <li>
            After 30 days, we move data into a deletion queue. It is permanently
            removed from production systems within 90 days of cancellation.
          </li>
          <li>
            Encrypted backups roll over within an additional 30 days, after which
            the data cannot be recovered.
          </li>
          <li>
            Statutory records (e.g. GST invoices) are retained for the period
            required by Indian tax law, even after deletion of operational data.
          </li>
        </ul>
      </Body>

      <Heading>5. Immediate Deletion Request</Heading>
      <Body>
        <p>
          If you require us to delete your data sooner than the 30-day re-activation
          window, the workspace owner can email{" "}
          <a href="mailto:hello@theyellowtrack.com">hello@theyellowtrack.com</a>{" "}
          with the subject &quot;Immediate deletion request&quot;. We may verify your
          identity before proceeding. Subject to legal-retention obligations,
          deletion will then be completed within 7 business days.
        </p>
      </Body>

      <Heading>6. Termination by Yellow Track</Heading>
      <Body>
        <p>
          We may suspend or terminate access where you have materially breached our{" "}
          <a
            href="/legal/terms"
            className="text-yellow-700 dark:text-yellow-400 font-semibold hover:underline"
          >
            Terms &amp; Conditions
          </a>
          , failed to pay outstanding fees, or where we are legally required to do
          so. Where reasonably practical, we will give you notice and an
          opportunity to remedy first.
        </p>
      </Body>

      <Heading>7. Returns</Heading>
      <Body>
        <p>
          As Yellow Track is a digital service, there are no physical returns. The
          equivalent process — recovering / exporting your data and closing the
          account — is described in sections 3, 4, and 5 above. Refund eligibility,
          if any, is governed by the{" "}
          <a
            href="/legal/refund"
            className="text-yellow-700 dark:text-yellow-400 font-semibold hover:underline"
          >
            Refund Policy
          </a>
          .
        </p>
      </Body>

      <Heading>8. Contact</Heading>
      <Body>
        <p>
          Questions about cancelling your subscription or closing your account can
          be sent to{" "}
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
    <div className="space-y-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300 [&_a]:text-yellow-700 dark:[&_a]:text-yellow-400 [&_a]:font-semibold [&_a:hover]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_em]:italic [&_em]:text-gray-800 dark:[&_em]:text-gray-200">
      {children}
    </div>
  );
}
