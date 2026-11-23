import React from "react";
import Link from "next/link";
import { Scale, ShieldCheck, Download, AlertCircle, HelpCircle, FileText } from "lucide-react";

export const metadata = {
  title: "Terms and Conditions — SEVOLF Digital",
  description: "Terms and Conditions governing digital product purchases, intellectual property licenses, and usage on the SEVOLF Digital storefront.",
};

export default function TermsPage() {
  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-12 md:py-20">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-2">
            LEGAL AGREEMENT & COMMERCE POLICIES
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#292B27] leading-tight mb-4">
            Terms & Conditions
          </h1>
          <p className="text-sm text-[#77766E] font-sans">
            Effective Date: January 1, 2026 • SEVOLF Digital Storefront
          </p>
        </div>

        <div className="prose text-sm text-[#77766E] leading-relaxed space-y-6 font-sans">
          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#657052]" />
              1. Platform Ownership & Agreement
            </h2>
            <p>
              Welcome to SEVOLF Digital (<code className="text-xs bg-[#EAE5DA] px-1.5 py-0.5 rounded text-[#292B27]">sevolf-digital.vercel.app</code>). These Terms and Conditions constitute a legally binding agreement between you (&ldquo;Customer&rdquo;, &ldquo;User&rdquo;) and SEVOLF Digital (&ldquo;SEVOLF&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;), governing your browsing, purchase, and consumption of digital products sold through our storefront.
            </p>
            <p>
              By accessing this site, registering an account, or purchasing any electronic work, you acknowledge that you have read, understood, and agreed to be bound by these Terms and our companion policies: <Link href="/privacy" className="underline text-[#292B27] hover:text-[#657052]">Privacy Policy</Link>, <Link href="/shipping-policy" className="underline text-[#292B27] hover:text-[#657052]">Shipping & Digital Delivery Policy</Link>, and <Link href="/refund-policy" className="underline text-[#292B27] hover:text-[#657052]">Cancellation & Refund Policy</Link>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <Download className="w-4 h-4 text-[#657052]" />
              2. Nature of Digital Products & Instant Fulfilment
            </h2>
            <p>
              SEVOLF Digital operates exclusively as a digital product publishing studio. Products offered on this platform consist of downloadable electronic assets—including PDF workbooks, digital templates, and instructional media.
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>No physical goods or tangible parcels are manufactured, shipped, or delivered.</li>
              <li>Delivery takes place automatically and immediately upon successful payment verification via direct browser redirect and an automated confirmation email.</li>
              <li>Purchased download links remain active for thirty (30) calendar days and permit up to ten (10) lifetime download executions per entitlement.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#657052]" />
              3. Intellectual Property & Personal License Grant
            </h2>
            <p>
              All digital products, original designs, illustrations, brand trademarks, and editorial works accessible on SEVOLF are the sole and exclusive intellectual property of SEVOLF.
            </p>
            <p>
              Upon complete payment, SEVOLF grants you a non-exclusive, non-transferable, revocable license to download and view the purchased work for your personal, non-commercial use. You may NOT:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Resell, sublicense, rent, lease, or redistribute original or modified copies of our digital files.</li>
              <li>Upload our digital assets to public file-sharing networks, torrent indexes, or generative AI training datasets.</li>
              <li>Extract design components or illustrations for inclusion in commercial templates or derivative retail products.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#657052]" />
              4. Pricing, Currency & Payment Processing
            </h2>
            <p>
              All product prices are clearly displayed prior to checkout. Payment processing is facilitated through authorized, PCI-DSS compliant third-party payment gateways (Razorpay). 
            </p>
            <p>
              By submitting payment information, you authorize our payment gateway partners to process the stated order total. SEVOLF servers do not collect, process, or store credit card numbers, CVVs, or UPI credentials.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#657052]" />
              5. Cancellations & Refunds
            </h2>
            <p>
              Due to the immediate electronic delivery and intangible nature of digital data, orders cannot be cancelled once digital files or secure download tokens have been accessed or delivered.
            </p>
            <p>
              Refunds and technical replacements are governed strictly by our <Link href="/refund-policy" className="underline text-[#292B27] hover:text-[#657052]">Cancellation & Refund Policy</Link>, and are honored in cases of proven file corruption, duplicate transactions, or billing errors.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#657052]" />
              6. Customer Support & Inquiries
            </h2>
            <p>
              If you encounter technical issues, download access difficulties, or licensing questions, our customer care team is available to assist you:
            </p>
            <p className="bg-[#FAF8F5] border border-[#DDD8CD] p-4 rounded-xs text-xs text-[#292B27]">
              <strong>Support Email:</strong> support@sevolf.store<br />
              <strong>Contact Page:</strong> <Link href="/contact" className="underline hover:text-[#657052]">https://sevolf-digital.vercel.app/contact</Link><br />
              <strong>Operating Hours:</strong> Monday through Friday, 9:00 AM – 6:00 PM IST (Response within 24–48 hours)
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
