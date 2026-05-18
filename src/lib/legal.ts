export type LegalSection = {
  heading: string;
  body: string[];
};

export type LegalDocument = {
  slug: string;
  title: string;
  summary: string;
  updatedAt: string;
  sections: LegalSection[];
};

export const LEGAL_DOCUMENTS = [
  {
    slug: "license",
    title: "Artlist License",
    summary: "How generated and curated assets may be used inside Nova Studio workflows.",
    updatedAt: "May 18, 2026",
    sections: [
      {
        heading: "License scope",
        body: [
          "Subject to these terms, Nova Studio grants customers a non-exclusive, non-transferable right to use outputs generated through the platform for personal, editorial, internal business, and commercial projects.",
          "A valid license is tied to the account that generated or lawfully downloaded the asset. You are responsible for keeping records of project use, source prompts, and any third-party materials you provide."
        ]
      },
      {
        heading: "Permitted use",
        body: [
          "You may use licensed assets in advertisements, social posts, websites, presentations, product mockups, internal creative work, client deliverables, and published media, provided your use complies with law and these terms.",
          "You may edit, crop, adapt, combine, or otherwise transform assets as part of a larger creative project."
        ]
      },
      {
        heading: "Restrictions",
        body: [
          "You may not resell, redistribute, sublicense, or package standalone assets as stock content, templates, datasets, model-training material, or a competing asset library.",
          "You may not use the service to create unlawful, misleading, infringing, defamatory, or privacy-invasive materials."
        ]
      },
      {
        heading: "Third-party rights",
        body: [
          "AI outputs may be influenced by prompts, reference images, model behavior, and external services. You must ensure that any input you upload or describe is cleared for your intended use.",
          "Nova Studio does not guarantee that every output is free from third-party claims, trademarks, likeness rights, or copyright concerns."
        ]
      }
    ]
  },
  {
    slug: "terms",
    title: "Terms of Use",
    summary: "The rules for accessing Nova Studio, creating assets, and using account features.",
    updatedAt: "May 18, 2026",
    sections: [
      {
        heading: "Acceptance",
        body: [
          "By accessing Nova Studio, creating an account, purchasing credits, or generating content, you agree to these Terms of Use and any product-specific policies shown in the service.",
          "If you use Nova Studio on behalf of an organization, you represent that you are authorized to bind that organization."
        ]
      },
      {
        heading: "Accounts and security",
        body: [
          "You are responsible for maintaining the security of your account credentials and for activity that occurs under your account.",
          "You must provide accurate account and billing information and notify us promptly if you suspect unauthorized access."
        ]
      },
      {
        heading: "Credits and payments",
        body: [
          "Credits are prepaid units used to submit generation tasks. The credit cost may vary by model, media type, duration, and provider.",
          "Credits are deducted when a task is submitted. If a supported task fails due to provider or system failure, Nova Studio may automatically return the estimated credits for that task."
        ]
      },
      {
        heading: "Acceptable use",
        body: [
          "You may not misuse the service, attempt to bypass security, interfere with platform operation, scrape private areas, or use outputs in ways that violate law or third-party rights.",
          "We may suspend access, remove content, or limit features when necessary to protect users, providers, or the service."
        ]
      },
      {
        heading: "Changes and availability",
        body: [
          "Features, models, providers, prices, and credit estimates may change as underlying services evolve.",
          "We aim to keep the platform reliable, but we do not guarantee uninterrupted access or that every generation request will complete successfully."
        ]
      }
    ]
  },
  {
    slug: "business-terms",
    title: "Business Terms of Use",
    summary: "Additional terms for teams, agencies, and commercial organizations.",
    updatedAt: "May 18, 2026",
    sections: [
      {
        heading: "Business accounts",
        body: [
          "Business users may use Nova Studio to create assets for internal operations, client work, campaigns, product launches, and other professional projects.",
          "The organization is responsible for users it invites, the prompts they submit, and how generated assets are reviewed and approved."
        ]
      },
      {
        heading: "Client work",
        body: [
          "Agencies and service providers may deliver finished work to clients, provided standalone platform assets are not redistributed as stock files or raw libraries.",
          "You are responsible for ensuring that any client-specific claims, brand marks, likenesses, products, or regulated messages are authorized and accurate."
        ]
      },
      {
        heading: "Compliance",
        body: [
          "Businesses must maintain appropriate review workflows for advertising, endorsements, regulated industries, privacy, and intellectual-property clearance.",
          "Nova Studio may request additional information or restrict use where business activity creates legal, security, or platform-integrity risk."
        ]
      },
      {
        heading: "Procurement and billing",
        body: [
          "Credit purchases, usage records, and billing activity are made available through account pages or Stripe receipts where applicable.",
          "Unless a written agreement says otherwise, prepaid credits are not a banking product, stored-value account, or cash equivalent."
        ]
      }
    ]
  },
  {
    slug: "copyright-policy",
    title: "Copyright Policy",
    summary: "How Nova Studio handles copyright concerns and takedown requests.",
    updatedAt: "May 18, 2026",
    sections: [
      {
        heading: "Respect for rights",
        body: [
          "Nova Studio respects intellectual-property rights and expects users to submit prompts, references, images, and source materials they are allowed to use.",
          "Users should not request outputs that imitate protected work in a way that creates infringement risk or falsely suggests endorsement."
        ]
      },
      {
        heading: "Reporting concerns",
        body: [
          "If you believe content on Nova Studio infringes your rights, send a notice identifying the work, the allegedly infringing material, your contact information, and a statement that you have a good-faith belief the use is unauthorized.",
          "Include enough detail for us to locate the material, such as a gallery URL, task ID, image URL, or account information."
        ]
      },
      {
        heading: "Response process",
        body: [
          "We may remove or restrict access to disputed material while reviewing a notice. We may also contact the account holder for context or a counter-notice.",
          "Repeated or serious violations may lead to account restrictions or termination."
        ]
      },
      {
        heading: "No legal determination",
        body: [
          "Our review process is designed to manage platform risk and user safety. It is not a court ruling or final legal determination about ownership or infringement."
        ]
      }
    ]
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    summary: "What data Nova Studio collects and how it is used to operate the service.",
    updatedAt: "May 18, 2026",
    sections: [
      {
        heading: "Information we collect",
        body: [
          "We collect account information such as email address, authentication identifiers, billing events, credit balances, task history, prompts, provider choices, and generated output metadata.",
          "When you use third-party login, payments, hosting, or AI providers, those providers may process information according to their own policies."
        ]
      },
      {
        heading: "How we use information",
        body: [
          "We use information to authenticate users, process payments, deduct and refund credits, submit generation tasks, display creation history, prevent abuse, and improve the service.",
          "Operational logs may be used to diagnose reliability, performance, security, and billing issues."
        ]
      },
      {
        heading: "Sharing",
        body: [
          "We share information with service providers only as needed to operate Nova Studio, including authentication, database, payment, hosting, analytics, and AI-generation vendors.",
          "We may disclose information if required by law, to protect rights and safety, or to investigate fraud, abuse, or security incidents."
        ]
      },
      {
        heading: "Retention and controls",
        body: [
          "We retain account, billing, and task information for as long as needed to provide the service, comply with legal obligations, resolve disputes, and maintain security.",
          "You may request account assistance, data corrections, or deletion where applicable by contacting the site operator."
        ]
      }
    ]
  }
] as const satisfies LegalDocument[];

export type LegalSlug = (typeof LEGAL_DOCUMENTS)[number]["slug"];

export function getLegalDocument(slug: string) {
  return LEGAL_DOCUMENTS.find((document) => document.slug === slug) || null;
}
