import React from "react";

export const metadata = {
  title: "Frequently Asked Questions — SEVOLF Digital",
  description: "Find clear answers on digital downloads, file formats, printing recommendations, and licensing.",
};

export default function FAQPage() {
  const faqs = [
    {
      q: "How do I receive my digital files after purchase?",
      a: "Immediately upon successful checkout, you will receive an on-screen confirmation with direct download links. Simultaneously, a receipt and signed download links are dispatched to your registered email address, and the edition is permanently added to your SEVOLF Digital Library.",
    },
    {
      q: "Can I annotate the digital planners on my iPad or Android tablet?",
      a: "Yes. Our interactive planners and workbooks are fully hyperlinked vector PDF files. They are engineered specifically for apps such as GoodNotes, Notability, Noteshelf, CollaNote, and Acrobat on iOS and Android.",
    },
    {
      q: "What paper do you recommend for printing SEVOLF Little workbooks?",
      a: "We recommend standard A4 or US Letter paper of 80gsm to 100gsm for general pencil and crayon tracing. For watercolor or heavy markers, 120gsm to 160gsm paper yields optimal results without bleed-through.",
    },
    {
      q: "Can I print a workbook multiple times for my own children?",
      a: "Yes. Our Personal Household Licence allows unlimited prints for children and family members living within your single household.",
    },
    {
      q: "Do you offer refunds on digital goods?",
      a: "Because digital goods are delivered immediately in unencrypted formats, standard sales are final once downloaded. However, if you encounter technical corruption or duplicate accidental charges, our support team will promptly assist or replace the item.",
    },
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-12 md:py-20">
      <div className="max-w-3xl mx-auto space-y-10">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-2">
            HELP & GUIDANCE
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#292B27] leading-tight mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-sm md:text-base text-[#77766E] leading-relaxed font-sans">
            Clear, honest answers regarding our digital editions, device compatibility, printing guidance, and licensing.
          </p>
        </div>

        <div className="divide-y divide-[#DDD8CD] border-y border-[#DDD8CD]">
          {faqs.map((faq, idx) => (
            <div key={idx} className="py-6 space-y-2">
              <h3 className="font-serif text-xl font-medium text-[#292B27]">
                {faq.q}
              </h3>
              <p className="text-sm text-[#77766E] leading-relaxed font-sans">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
