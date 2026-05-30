import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · Yellow Track",
  description:
    "How Yellow Track collects, uses, and protects personal information.",
};

const LAST_UPDATED = "30 May 2026";

export default function PrivacyPage() {
  return (
    <article>
      <header className="mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-600 dark:text-yellow-400 mb-3">
          Legal
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <section className="space-y-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        <p>
          This Privacy Policy explains how Yellow Track (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;)
          collects, uses, and protects personal information when you use the Yellow
          Track fleet-management platform (the &quot;Service&quot;). It applies to anyone who
          interacts with the Service, including workspace owners, invited users,
          drivers, and visitors to public vehicle / driver verification pages.
        </p>
        <p>
          Our processing of personal data is governed by the laws of India,
          including the Digital Personal Data Protection Act, 2023 (DPDP Act) and
          the Information Technology Act, 2000, and the rules made thereunder.
        </p>
      </section>

      <Heading>1. Information We Collect</Heading>
      <Body>
        <p>
          <strong>Account &amp; tenant data:</strong> name, email, phone number, password
          hash, profile photo, organisation name, GST/PAN identifiers, registered
          address, and your role in the workspace.
        </p>
        <p>
          <strong>Fleet operating data:</strong> vehicle registration numbers,
          insurance / RC / permit / fitness / PUC / FASTag records, EMI plans, debit
          accounts (masked), expense entries, challan records, driver profiles, and
          uploaded documents. Some of this data is fetched on your behalf from
          government and third-party data providers (for example, Surepass).
        </p>
        <p>
          <strong>Driver data:</strong> for drivers added to a workspace — name,
          contact details, licence records, identity documents, photo, and
          assignment history. You are responsible for obtaining each driver&apos;s
          consent before adding them.
        </p>
        <p>
          <strong>Communications:</strong> emails we send (renewals, OTPs, alerts),
          in-app notifications, and WhatsApp messages dispatched via our messaging
          provider.
        </p>
        <p>
          <strong>Technical &amp; usage data:</strong> IP address, browser, device
          information, log timestamps, pages visited, and activity-log entries
          generated when you act in the Service.
        </p>
      </Body>

      <Heading>2. How We Use Your Information</Heading>
      <Body>
        <p>We use the information to:</p>
        <ul>
          <li>Provide, operate, and maintain the Service.</li>
          <li>
            Authenticate users, send one-time passwords (OTPs) for sensitive
            actions, and protect against unauthorised access.
          </li>
          <li>
            Send transactional emails (renewal reminders, compliance alerts,
            payment receipts, OTP codes, account notifications).
          </li>
          <li>Process subscription payments and issue GST-compliant invoices.</li>
          <li>
            Generate aggregate, de-identified analytics to improve the Service.
          </li>
          <li>
            Comply with applicable law, respond to lawful requests, and enforce our
            Terms.
          </li>
        </ul>
      </Body>

      <Heading>3. Lawful Bases</Heading>
      <Body>
        <p>
          We process personal data on one or more of the following lawful bases:
          your consent (e.g. when you sign up or add a driver), performance of the
          contract between you and us, our legitimate interests in operating and
          securing the Service, and compliance with legal obligations.
        </p>
      </Body>

      <Heading>4. Sharing &amp; Sub-Processors</Heading>
      <Body>
        <p>
          We do not sell personal data. We share it only with the third-party
          service providers we need to operate the Service:
        </p>
        <ul>
          <li>
            <strong>Vercel</strong> — application hosting and file storage (Vercel
            Blob).
          </li>
          <li>
            <strong>MongoDB Atlas</strong> — primary database, hosted in an Indian
            region where available.
          </li>
          <li>
            <strong>Surepass</strong> — RC and document lookups against government
            registries.
          </li>
          <li>
            <strong>Gmail / Google Workspace SMTP</strong> — transactional email
            delivery.
          </li>
          <li>
            <strong>ChatBox.biz</strong> — WhatsApp Business message dispatch.
          </li>
          <li>
            <strong>Payment processors</strong> — secure handling of card / UPI /
            netbanking transactions for subscription billing.
          </li>
        </ul>
        <p>
          Each sub-processor is bound by confidentiality obligations and is only
          permitted to process your data for the limited purposes described above.
        </p>
      </Body>

      <Heading>5. Cross-Border Transfers</Heading>
      <Body>
        <p>
          Some of our sub-processors operate infrastructure outside India. Where
          this is the case, we rely on the safeguards permitted under the DPDP Act
          and applicable rules, and require sub-processors to maintain protections
          consistent with this Policy.
        </p>
      </Body>

      <Heading>6. Data Retention</Heading>
      <Body>
        <p>
          We retain Customer Data for as long as your account is active. After
          cancellation, we keep data for up to 90 days to allow for re-activation or
          export, and then we permanently delete it from production systems.
          Encrypted database backups roll over within an additional 30 days.
          Statutory records (e.g. GST invoices) are retained for the period required
          by law.
        </p>
      </Body>

      <Heading>7. Security</Heading>
      <Body>
        <p>
          We implement reasonable security practices in line with the IT Act, 2000
          and the rules made thereunder, including TLS in transit, encrypted
          credentials at rest, OTP-gated destructive actions, tenant-scoped access
          controls, and audit logging of sensitive events. No method of transmission
          or storage is 100% secure; we cannot guarantee absolute security.
        </p>
      </Body>

      <Heading>8. Your Rights</Heading>
      <Body>
        <p>
          Subject to applicable law, you have the right to access, correct, update,
          export, and delete the personal data we hold about you. You may also
          withdraw consent at any time where processing is based on consent. To
          exercise any of these rights, write to{" "}
          <a href="mailto:hello@theyellowtrack.com">hello@theyellowtrack.com</a>{" "}
          from the email registered on your account.
        </p>
        <p>
          Where you upload personal data about a driver or other individual (the
          &quot;Data Principal&quot;), you remain responsible for honouring that
          individual&apos;s rights; we will support you in doing so on request.
        </p>
      </Body>

      <Heading>9. Children</Heading>
      <Body>
        <p>
          The Service is not intended for children under 18. We do not knowingly
          collect personal data of children. If we learn that we have collected such
          data, we will delete it.
        </p>
      </Body>

      <Heading>10. Cookies</Heading>
      <Body>
        <p>
          We use a small number of essential cookies and local-storage entries to
          keep you signed in and remember your preferences. We do not use
          advertising cookies. You can clear these at any time through your
          browser&apos;s settings; doing so will sign you out.
        </p>
      </Body>

      <Heading>11. Public Pages</Heading>
      <Body>
        <p>
          The Service exposes a small number of public, unguessable URLs (e.g.{" "}
          <code>/public/vehicle/[id]</code> QR landing pages and{" "}
          <code>/public/driver/verify/[token]</code> verification pages). These
          render limited information you have chosen to share — sharing the URL is
          how access is granted. Do not share these URLs more widely than you
          intend.
        </p>
      </Body>

      <Heading>12. Changes</Heading>
      <Body>
        <p>
          We may update this Policy from time to time. When we do, we will update
          the &quot;Last updated&quot; date at the top and notify the account owner by email
          if the changes are material.
        </p>
      </Body>

      <Heading>13. Contact &amp; Grievances</Heading>
      <Body>
        <p>
          For privacy questions or grievances under the IT Act / DPDP Act, write to
          us at{" "}
          <a href="mailto:hello@theyellowtrack.com">hello@theyellowtrack.com</a>.
          The Grievance Officer&apos;s details will be provided on written request.
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
    <div className="space-y-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300 [&_a]:text-yellow-700 dark:[&_a]:text-yellow-400 [&_a]:font-semibold [&_a:hover]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_code]:bg-gray-100 dark:[&_code]:bg-gray-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.85em] [&_code]:font-mono">
      {children}
    </div>
  );
}
