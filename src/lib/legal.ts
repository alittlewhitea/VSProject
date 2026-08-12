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
    title: "DreamFace License",
    summary: "A practical license for creators and teams using DreamFace assets, AI outputs, prompts, and generated media.",
    updatedAt: "May 18, 2026",
    sections: [
      {
        heading: "Overview",
        body: [
          "DreamFace is designed for creators, marketers, agencies, and teams that need to generate images, videos, visual concepts, and campaign materials without wrestling with complicated licensing language.",
          "When we say Assets, we mean materials made available through dreamface.io, including gallery references, prompts, templates, thumbnails, examples, and any downloadable platform materials. When we say AI Output, we mean the images, videos, previews, variations, or other media you create through DreamFace generation tools."
        ]
      },
      {
        heading: "We cover your projects",
        body: [
          "Subject to these terms, you may use AI Output generated through your DreamFace account in personal projects, social content, websites, ads, product mockups, pitch decks, client work, internal business materials, presentations, ecommerce listings, and published creative campaigns.",
          "You may edit, crop, remix, combine, color grade, annotate, upscale, or otherwise adapt AI Output as part of a broader creative project. Your project can be distributed on social platforms, websites, video platforms, paid media placements, newsletters, presentations, and similar digital channels."
        ]
      },
      {
        heading: "Your finished projects can keep being used",
        body: [
          "Once you create and publish a permitted project using AI Output while your account is active or while you have lawfully purchased credits, you may continue using that finished project after the original generation date.",
          "If your account expires, is closed, or has no remaining credits, you may keep using projects that were already created in compliance with this License. New generations or new uses that require platform access may require an active account or additional credits."
        ]
      },
      {
        heading: "Your clients are covered",
        body: [
          "If you create a permitted project for a client, you may deliver the finished project to that client and your client may use that finished project in accordance with this License.",
          "Only the account holder may access DreamFace, download platform materials, submit prompts, or generate AI Output. Your client receives rights in the finished project, not a separate right to extract, resell, or reuse standalone DreamFace Assets outside that project."
        ]
      },
      {
        heading: "Use outputs as part of your creations",
        body: [
          "DreamFace is made for creating finished work. You may not resell, redistribute, sublicense, publish, or package DreamFace Assets or AI Output as standalone stock files, prompt libraries, image packs, video packs, datasets, templates, marketplace assets, or competing AI-generation resources.",
          "You may not upload DreamFace Assets or substantially unmodified AI Output to stock marketplaces, claim that platform-provided Assets were created entirely by you, or offer them in a way that lets others download them as reusable source materials."
        ]
      },
      {
        heading: "A license means use, not ownership of the platform",
        body: [
          "Purchasing credits or generating AI Output gives you permission to use the resulting work under this License. It does not transfer ownership of DreamFace, dreamface.io, the underlying software, model integrations, gallery curation, platform design, prompts supplied by DreamFace, trademarks, or other proprietary materials.",
          "DreamFace and its licensors retain all rights in the platform and platform-provided Assets. You are responsible for the final way you use generated outputs, including whether your use requires additional permissions."
        ]
      },
      {
        heading: "Social media and monetization",
        body: [
          "You may use permitted projects on social channels and monetize those projects through platform monetization, sponsorships, paid posts, ads, or client campaigns, provided your content follows platform rules and applicable law.",
          "DreamFace does not guarantee acceptance by any social platform, ad network, marketplace, or content-moderation system. Claims, takedowns, ad review decisions, and monetization restrictions may still occur depending on your use and the platform's policies."
        ]
      },
      {
        heading: "AI services and training restrictions",
        body: [
          "You may not use DreamFace Assets, gallery materials, prompts, or outputs to train, fine-tune, evaluate, or build a competing AI model, dataset, content library, prompt marketplace, or generation service without written permission.",
          "You may use AI Output in normal creative workflows and editing tools, provided those tools do not claim ownership over the output or expose your source materials for public reuse in a way that conflicts with this License."
        ]
      },
      {
        heading: "Non-exclusive results",
        body: [
          "AI generation is probabilistic. Similar prompts, model behavior, public visual trends, and provider systems may lead to outputs that resemble outputs created by other users.",
          "This License is non-exclusive. DreamFace cannot promise that a generated concept, style, composition, or result will be unique to you."
        ]
      },
      {
        heading: "Sensitive uses and third-party rights",
        body: [
          "You must not use DreamFace to create unlawful, misleading, defamatory, exploitative, privacy-invasive, or rights-infringing content. You are responsible for checking trademarks, likeness rights, publicity rights, product claims, regulated-industry rules, and copyright concerns before publishing.",
          "If a project uses realistic people, brands, locations, products, or sensitive topics, you should make sure the final use is properly authorized, labeled, and reviewed."
        ]
      },
      {
        heading: "Enterprise and special uses",
        body: [
          "Large teams, regulated businesses, broadcasters, platforms, software products, games, marketplaces, or companies that need unusual usage rights may need a separate enterprise agreement.",
          "Contact DreamFace before using outputs in scenarios that involve sublicensing to many end users, embedding outputs into a software product as reusable assets, large-scale broadcast campaigns, or any use not clearly covered by this License."
        ]
      },
      {
        heading: "Relationship to other terms",
        body: [
          "This License works together with the DreamFace Terms of Use, Business Terms of Use, Copyright Policy, and Privacy Policy. If you use DreamFace on behalf of a company, the Business Terms of Use may also apply.",
          "If any written enterprise agreement conflicts with this public License, the signed agreement controls for that customer."
        ]
      }
    ]
  },
  {
    slug: "terms",
    title: "Terms of Use",
    summary: "The general rules for accessing dreamface.io, creating an account, purchasing credits, and generating AI content.",
    updatedAt: "May 18, 2026",
    sections: [
      {
        heading: "Terms of Use",
        body: [
          "These Terms of Use set the terms and conditions under which you may access and use dreamface.io, the DreamFace application, and any related websites, APIs, tools, or future platforms offered by DreamFace.",
          "By accessing DreamFace, opening an account, purchasing credits, submitting prompts, generating content, or using any platform feature, you accept these Terms, the DreamFace License, the Privacy Policy, the Copyright Policy, and any additional terms that apply to your plan or business arrangement.",
          "You represent that you are legally able to enter into this agreement, that your age does not restrict you from using DreamFace under applicable law, and that if you use DreamFace for an entity, you are authorized to bind that entity."
        ]
      },
      {
        heading: "Opening an account",
        body: [
          "To use paid features, generation history, billing, or other account-based services, you may be required to create an account and provide accurate information such as your name, email address, billing details, and payment method.",
          "You may not provide a false email address, impersonate another person or entity, misrepresent your identity, or use a payment method you are not authorized to use.",
          "You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account. If you believe your account has been accessed without authorization, you must take steps to secure it and notify us promptly.",
          "If DreamFace later offers team accounts, the account owner or administrator will be responsible for invited users, permissions, billing changes, prompt submissions, generated outputs, and all activity within the team workspace."
        ]
      },
      {
        heading: "Sanctioned countries",
        body: [
          "DreamFace is committed to complying with applicable sanctions, export control, anti-money-laundering, and trade compliance laws.",
          "We may restrict, suspend, or refuse service to countries, regions, entities, or individuals where providing access would create legal or compliance risk, including users listed on sanctions or restricted-party lists."
        ]
      },
      {
        heading: "Privacy Policy",
        body: [
          "We care about privacy and aim to explain how information is collected, used, shared, and retained. Please review the DreamFace Privacy Policy carefully before using the service.",
          "By using DreamFace, you acknowledge that your account information, billing events, prompts, task data, and generated output metadata may be processed as described in the Privacy Policy."
        ]
      },
      {
        heading: "Term, renewal, and termination",
        body: [
          "These Terms apply for as long as you access DreamFace or maintain an account. Any license granted for permitted projects is subject to the DreamFace License and your compliance with these Terms.",
          "You may stop using DreamFace at any time. If recurring subscriptions or paid plans are introduced, renewal and cancellation rules will be shown at checkout or in your account settings.",
          "DreamFace may suspend or terminate access if you violate these Terms, misuse the platform, create legal or security risk, fail to pay required fees, or use the service in a way that harms DreamFace, its providers, users, or third parties.",
          "After termination, you must stop accessing the service and stop using platform materials except for finished projects that remain covered under the DreamFace License."
        ]
      },
      {
        heading: "Switching between plans",
        body: [
          "If DreamFace offers multiple plans, you may be able to upgrade, downgrade, or change plans through account settings or customer support.",
          "Plan changes may affect available features, credits, usage limits, team seats, commercial coverage, storage, provider access, and renewal pricing."
        ]
      },
      {
        heading: "Payments and billing",
        body: [
          "Payments may be processed by Stripe, PayPal, or other third-party payment providers. You must provide accurate billing information and promptly update changes to your payment method, billing address, tax information, or account details.",
          "DreamFace uses credits for generation tasks. Credits are prepaid units and are generally deducted when a generation task is submitted. Credit costs may vary by media type, provider, model, duration, quality setting, queue behavior, or future product changes.",
          "If a supported task fails due to provider or platform error, DreamFace may automatically return the estimated credits for that task. Credits are not a bank account, stored-value product, cash equivalent, or transferable currency.",
          "Taxes may be calculated based on your billing information and applicable law. You are responsible for any taxes, duties, bank charges, exchange fees, or similar costs that apply to your purchase.",
          "Refunds, if any, are handled at DreamFace's discretion unless mandatory consumer law requires otherwise. You may not be eligible for a refund after credits have been used, content has been generated, or a plan benefit has been consumed."
        ]
      },
      {
        heading: "Intellectual property rights",
        body: [
          "DreamFace, dreamface.io, the platform interface, software, source code, design, workflows, trademarks, logos, documentation, gallery curation, platform-provided prompts, templates, examples, and other materials are protected by intellectual-property laws and belong to DreamFace or its licensors.",
          "You receive only the limited rights expressly granted in these Terms and the DreamFace License. You do not receive ownership of DreamFace, its technology, model integrations, provider systems, source code, trademarks, or platform-provided proprietary materials.",
          "You may not use DreamFace's name, trademarks, logos, branding, or proprietary content in a way that suggests endorsement, partnership, ownership, or affiliation without written permission.",
          "You may not reverse engineer, decompile, disassemble, bypass, disable, scrape, copy, monitor, extract, or misuse any non-public part of the platform, its security measures, rate limits, source code, provider integrations, or data systems.",
          "Feedback, ideas, suggestions, bug reports, or product comments you send to DreamFace may be used without restriction or compensation, and you grant DreamFace the rights needed to use them to improve the service."
        ]
      },
      {
        heading: "Copyright infringement notification policy",
        body: [
          "DreamFace takes intellectual-property concerns seriously. If you believe that content available through DreamFace infringes your rights, please follow the process described in the DreamFace Copyright Policy.",
          "We may remove, disable, restrict, or review content, outputs, accounts, or platform materials that are alleged to infringe third-party rights, without prior notice where appropriate."
        ]
      },
      {
        heading: "Company rights in case of violation",
        body: [
          "Any unauthorized use of DreamFace, platform materials, generated outputs, credentials, or services may violate these Terms and may also violate copyright, privacy, publicity, trademark, contract, security, or other laws.",
          "DreamFace may investigate suspected violations using automated systems, user reports, provider notices, payment signals, and human review. We may request proof of your rights to inputs, references, brand materials, likenesses, or other submitted content.",
          "We may refuse generation, remove outputs, restrict downloads, suspend accounts, disable features, reverse credits, block access, or take other action where we believe these Terms, provider policies, law, or third-party rights may be violated."
        ]
      },
      {
        heading: "Exemption from liability",
        body: [
          "To the maximum extent permitted by law, DreamFace is provided as is and as available, without warranties of merchantability, fitness for a particular purpose, non-infringement, availability, accuracy, uniqueness, uninterrupted operation, or error-free performance.",
          "DreamFace does not guarantee that any model, provider, feature, asset, output, storage function, billing integration, or third-party service will remain available or produce a desired result.",
          "You are responsible for reviewing and approving all generated outputs before use. DreamFace is not liable for your use of outputs, your publication decisions, your inputs, third-party claims, platform moderation decisions, lost profits, indirect damages, or consequential damages to the extent permitted by law."
        ]
      },
      {
        heading: "Indemnification",
        body: [
          "You agree to defend, indemnify, and hold harmless DreamFace, its affiliates, service providers, officers, employees, contractors, licensors, and partners from claims, losses, liabilities, damages, fees, and expenses arising from your use of the service, your inputs, your outputs, your projects, your breach of these Terms, or your violation of law or third-party rights.",
          "This includes claims related to copyright, trademarks, privacy, publicity rights, false advertising, regulated claims, unauthorized references, and misuse of AI-generated content."
        ]
      },
      {
        heading: "Third-party services",
        body: [
          "DreamFace may rely on third-party services for authentication, hosting, databases, payments, analytics, email, logging, storage, AI models, generation infrastructure, and content delivery.",
          "Those third parties may have their own terms and policies. DreamFace is not responsible for third-party platforms where you publish your projects, such as social media sites, ad networks, marketplaces, app stores, or video platforms.",
          "If a third-party provider changes pricing, access, rules, model behavior, safety policies, latency, or availability, DreamFace may change or remove related features."
        ]
      },
      {
        heading: "AI services",
        body: [
          "DreamFace provides AI Services that allow you to submit text, images, references, settings, prompts, or other materials as input and receive AI-generated output through models made available through DreamFace or third-party providers.",
          "You represent that you have all rights, permissions, licenses, and consents needed to provide your inputs and to allow DreamFace and its service providers to process those inputs and create outputs.",
          "As between you and DreamFace, you retain your rights in your inputs. DreamFace does not claim ownership of outputs you generate, subject to your compliance with these Terms, the DreamFace License, provider policies, and applicable law.",
          "You acknowledge that outputs may be inaccurate, incomplete, offensive, biased, similar to outputs generated for other users, not protectable under intellectual-property law, or unsuitable for your intended purpose.",
          "DreamFace may screen, block, modify, reformat, refuse, or remove inputs or outputs to enforce these Terms, comply with law, follow model provider requirements, improve reliability, or protect the service.",
          "DreamFace is not a storage, archival, or backup service. You are responsible for downloading and preserving copies of outputs you want to keep. We may apply storage limits, retention periods, file size limits, or deletion rules."
        ]
      },
      {
        heading: "Forbidden uses",
        body: [
          "You may not use DreamFace, inputs, outputs, assets, or projects in any way that is illegal, violates court orders, violates these Terms, harms DreamFace or others, or infringes third-party rights.",
          "You may not generate, request, upload, or distribute child sexual abuse material; sexual exploitation of minors; non-consensual intimate content; unlawful pornography; graphic sexual violence; threats; harassment; hate; extremist support; self-harm encouragement; fraud; phishing; malware; weapon development; illicit goods or services; or content designed to evade law enforcement or platform safety systems.",
          "You may not use DreamFace to mislead people about whether content is synthetic, impersonate a real person or entity, create deceptive deepfakes, manipulate elections, spread disinformation, violate privacy or publicity rights, or make automated decisions in sensitive domains such as credit, employment, housing, healthcare, insurance, migration, legal services, or social welfare.",
          "You may not submit protected health information, biometric data, confidential information, private personal data, or sensitive information unless you have all required rights and legal basis and the use is appropriate for the service.",
          "You may not request outputs that infringe or closely replicate protected works, trademarks, characters, products, artists, living persons, brands, confidential materials, or other rights without authorization.",
          "You may not use DreamFace assets or outputs to train, fine-tune, evaluate, benchmark, or build competing AI models, datasets, stock libraries, prompt marketplaces, or generation services without written permission."
        ]
      },
      {
        heading: "Amendments to these Terms",
        body: [
          "DreamFace may update these Terms, the License, the Business Terms, the Privacy Policy, the Copyright Policy, product features, credit pricing, plan rules, and provider availability from time to time.",
          "Updated terms will be posted on dreamface.io or otherwise made available. If you do not agree to updated terms, you must stop using the service. Continued use after updates means you accept the updated terms."
        ]
      },
      {
        heading: "Assignment",
        body: [
          "DreamFace may assign, transfer, delegate, or subcontract its rights and obligations under these Terms in connection with a merger, acquisition, reorganization, sale of assets, financing, corporate change, service-provider relationship, or other business transaction.",
          "You may not assign or transfer your account, credits, license rights, or obligations without DreamFace's written permission, except where mandatory law provides otherwise."
        ]
      },
      {
        heading: "Notices",
        body: [
          "DreamFace may send notices by email, account message, product notice, dashboard banner, or posting on dreamface.io. You are responsible for keeping your account email current.",
          "Operational, billing, security, legal, and service notices may be sent even if you opt out of marketing communications."
        ]
      },
      {
        heading: "DreamFace entity",
        body: [
          "Until DreamFace publishes additional contracting-entity details or enters into a separate written agreement with you, your relationship is with the operator of dreamface.io.",
          "Payment processing may be handled by Stripe, PayPal, or another payment provider on behalf of DreamFace. Receipts, taxes, and billing records may identify the relevant payment processor or merchant information available at checkout."
        ]
      },
      {
        heading: "General",
        body: [
          "These Terms, together with the DreamFace License, Business Terms of Use, Privacy Policy, Copyright Policy, and any written agreement that applies to you, form the agreement governing your use of DreamFace.",
          "If any provision is found invalid or unenforceable, the remaining provisions will continue in effect. DreamFace's failure to enforce a provision does not waive its right to enforce it later.",
          "Sections concerning intellectual property, payment obligations, disclaimers, indemnification, limits of liability, assignment, governing law, and any provisions intended to survive will survive termination."
        ]
      },
      {
        heading: "Governing law and jurisdiction",
        body: [
          "The governing law and venue for disputes will be determined by the DreamFace entity, your location, and any written agreement that applies to you. If no specific jurisdiction is stated, DreamFace may designate governing law and venue in a later update or written agreement.",
          "Nothing in these Terms limits mandatory consumer rights that cannot be waived under applicable law."
        ]
      },
      {
        heading: "Operating requirements for tools",
        body: [
          "If DreamFace offers downloadable tools, plugins, desktop helpers, browser extensions, or integrations, you are responsible for checking system requirements, maintaining compatible software, and installing updates required for continued use.",
          "Tools may be modified, suspended, limited, or discontinued. You may not bypass restrictions, share tools outside your account, host them for third-party access, or use them in a way that violates these Terms."
        ]
      },
      {
        heading: "Technical problems",
        body: [
          "If you experience technical problems, contact support with relevant details such as your account email, task ID, browser, operating system, prompt settings, error messages, and approximate time of the issue.",
          "DreamFace may offer troubleshooting, repair, replacement, credit refund, or other assistance at its discretion. We are not responsible for problems caused by unsupported systems, modified software, network restrictions, misuse, provider outages, or failure to follow instructions."
        ]
      }
    ]
  },
  {
    slug: "business-terms",
    title: "Business Terms of Use",
    summary: "Additional terms for agencies, teams, companies, and commercial organizations using DreamFace.",
    updatedAt: "May 18, 2026",
    sections: [
      {
        heading: "Business Terms of Use",
        body: [
          "These Business Terms of Use apply when a company, agency, studio, team, or other organization accesses dreamface.io, purchases credits, manages users, generates content, or uses DreamFace for commercial operations.",
          "By accessing DreamFace on behalf of an organization, you confirm that you are authorized to bind that organization. The organization and DreamFace are each a party to these Business Terms.",
          "These Business Terms supplement the DreamFace License, Terms of Use, Privacy Policy, and Copyright Policy. If a written enterprise agreement is signed by DreamFace and your organization, that written agreement controls where it conflicts with these public terms.",
          "For these Business Terms, Assets include platform-provided materials, gallery references, prompts, examples, templates, and AI-generated content made available by or on behalf of DreamFace. Outputs are content generated by your organization or its users through DreamFace AI Services. Assets and Outputs are treated differently where the DreamFace License says so."
        ]
      },
      {
        heading: "Opening an account",
        body: [
          "To use DreamFace for business purposes, your organization may need to create an account, designate an administrator, provide accurate company and billing information, and pay applicable fees, taxes, or credit charges.",
          "You may not provide false company information, use a payment method without authorization, impersonate another organization, or mislead DreamFace about your identity, users, billing details, or intended use.",
          "The administrator controls important account actions, including purchasing credits, inviting users, managing permissions, reviewing usage, changing plan settings, and removing users. Actions taken by administrators or authorized users are treated as actions of the organization.",
          "Your organization is responsible for all activity under its account, including activity by employees, contractors, agencies, clients, freelancers, and any other users invited or allowed to access the account. You must promptly notify DreamFace if you suspect unauthorized access."
        ]
      },
      {
        heading: "Sanctioned countries",
        body: [
          "Your organization represents that it and its affiliates, directors, officers, employees, contractors, and users comply with applicable sanctions, export control, anti-boycott, anti-money-laundering, and trade compliance laws.",
          "You represent that neither your organization nor its users are located in, organized under the laws of, ordinarily resident in, owned by, controlled by, or acting for any country, region, person, or entity subject to comprehensive sanctions or restricted-party lists that would prohibit DreamFace from providing the service.",
          "DreamFace may suspend or refuse service where it believes access would violate sanctions, export controls, provider restrictions, payment rules, or other compliance requirements."
        ]
      },
      {
        heading: "Privacy",
        body: [
          "Each party is responsible for complying with privacy and data-protection laws that apply to its own processing of personal data. Where required by law, each party acts as an independent controller for the personal data it determines how to process.",
          "Your organization is responsible for giving required notices and obtaining required consents before submitting personal data, likenesses, references, employee information, customer information, voice, images, or other regulated data to DreamFace.",
          "DreamFace processes account, billing, task, prompt, usage, and output information as described in the Privacy Policy. Business users should review that policy and ensure their internal users understand it."
        ]
      },
      {
        heading: "Term, renewal, and termination",
        body: [
          "These Business Terms apply for as long as your organization accesses DreamFace or maintains an account. Any business license remains subject to the DreamFace License and your organization's compliance with the agreement.",
          "If DreamFace offers recurring business plans, subscriptions may renew according to the plan terms shown at checkout, in account settings, or in a written agreement. If your organization cancels, access may continue until the end of the then-current billing period unless otherwise stated.",
          "Upon termination, your organization and its users must stop accessing DreamFace and stop using platform Assets except for finished projects that remain covered by the DreamFace License. DreamFace may suspend or terminate access for non-payment, security risk, legal risk, provider restrictions, or violation of these terms."
        ]
      },
      {
        heading: "Payments and billing",
        body: [
          "Business payments may be processed through Stripe, PayPal, or other payment providers. Your organization must provide accurate billing information, maintain an authorized payment method, and promptly update billing contacts, tax information, and address details.",
          "Credits are prepaid units used to submit generation tasks. Credit cost may depend on model, provider, media type, duration, quality setting, queue behavior, or future product changes. Credits are not cash, stored value, or transferable currency.",
          "Subscription fees, credit purchases, and other charges are generally final and non-refundable except where mandatory law or a written agreement requires otherwise. Unused credits may be subject to plan limits, expiration rules, or account restrictions shown in your plan or written agreement.",
          "Your organization is responsible for taxes, duties, bank charges, currency conversion, chargebacks, and payment disputes. Unauthorized or unjustified chargebacks may result in account suspension or termination."
        ]
      },
      {
        heading: "Intellectual property rights",
        body: [
          "DreamFace, dreamface.io, the platform, software, source code, workflows, user interface, trademarks, logos, documentation, gallery curation, prompts, examples, templates, and other proprietary materials are owned by DreamFace or its licensors.",
          "Your organization receives only the limited rights described in the DreamFace License, these Business Terms, and any applicable written agreement. No ownership in DreamFace technology, provider integrations, models, platform data, or proprietary materials is transferred.",
          "Your organization may not scrape, extract, reverse engineer, decompile, bypass technical protections, overload systems, copy non-public functionality, or use DreamFace proprietary materials to build, train, benchmark, or improve a competing product or AI service.",
          "Unless you tell us otherwise in writing, DreamFace may identify your organization as a customer in customer lists, internal sales materials, or investor materials. Public logo use in marketing will be handled according to your plan, agreement, or written approval where required.",
          "Feedback provided by your organization or users may be used by DreamFace without restriction or compensation to improve products, services, documentation, reliability, and support."
        ]
      },
      {
        heading: "AI Services",
        body: [
          "DreamFace provides AI Services that let business users submit prompts, text, images, references, settings, and other materials as input and receive AI-generated outputs through models operated by DreamFace or third-party providers.",
          "Your organization represents that it has all rights, licenses, authorizations, and consents needed to submit inputs and permit DreamFace and its service providers to process them to provide the AI Services and outputs.",
          "As between DreamFace and your organization, your organization retains rights in its inputs. DreamFace does not claim ownership of outputs generated by your organization, subject to these Business Terms, the DreamFace License, provider policies, and applicable law.",
          "Outputs may be inaccurate, incomplete, biased, offensive, similar to outputs generated for other users, not protectable under intellectual-property law, or unsuitable for your intended use. Your organization must review and approve outputs before publishing, distributing, or relying on them.",
          "DreamFace may screen, reformat, refuse, remove, or disable access to inputs or outputs to enforce policies, comply with law, follow provider rules, protect rights, improve reliability, or prevent abuse.",
          "DreamFace is not a storage, archival, or backup service. Your organization is responsible for exporting and preserving any outputs, prompts, or project materials it needs to retain. Storage limits, retention periods, file limits, and deletion rules may apply.",
          "DreamFace may share inputs, outputs, and usage data with third-party model providers only as reasonably necessary to provide, secure, troubleshoot, and operate AI Services, and as otherwise described in the Privacy Policy or applicable provider terms."
        ]
      },
      {
        heading: "Forbidden uses",
        body: [
          "Your organization and its users may not use DreamFace, Assets, inputs, outputs, or projects in any way that is illegal, violates court orders, violates these terms, harms DreamFace or others, or infringes third-party rights.",
          "Forbidden uses include child sexual abuse material; sexual exploitation of minors; non-consensual intimate content; unlawful pornography; graphic sexual violence; threats; harassment; hate; extremist support; self-harm encouragement; fraud; phishing; malware; weapon development; illicit goods or services; or content designed to evade safety systems or law enforcement.",
          "Your organization may not use DreamFace to mislead people about synthetic content, create deceptive deepfakes, impersonate real people or organizations, manipulate elections, spread disinformation, violate privacy or publicity rights, or make automated decisions in sensitive domains such as credit, employment, housing, healthcare, insurance, migration, legal services, or social welfare.",
          "You may not submit protected health information, biometric data, confidential information, trade secrets, private personal data, or sensitive information unless your organization has all required rights, notices, legal basis, and safeguards and the use is appropriate for DreamFace.",
          "You may not request outputs that infringe or closely replicate protected works, trademarks, characters, products, artists, living persons, brands, confidential materials, or other rights without authorization.",
          "Your organization may not use DreamFace Assets, inputs, outputs, platform data, or prompts to train, fine-tune, evaluate, benchmark, or build competing AI models, stock libraries, prompt marketplaces, generation services, or datasets without written permission."
        ]
      },
      {
        heading: "DreamFace learning resources",
        body: [
          "DreamFace may provide tutorials, guides, examples, prompt education, workflow notes, or other learning materials for business users. These materials are provided for internal learning and product use only.",
          "Unless a written agreement says otherwise, learning materials may not be copied, resold, published, sublicensed, redistributed, or used to create a competing training product, course, content library, or service.",
          "DreamFace may update, remove, suspend, or add learning materials at any time. Links to third-party websites or resources do not mean DreamFace controls or endorses them."
        ]
      },
      {
        heading: "Copyright infringement notification policy",
        body: [
          "DreamFace takes copyright and intellectual-property concerns seriously. If your organization believes Assets, outputs, or platform materials infringe rights, please follow the DreamFace Copyright Policy.",
          "If DreamFace receives a notice alleging that Assets, inputs, outputs, or projects infringe third-party rights, DreamFace may remove, restrict, investigate, or disable access to the relevant material or account features without prior notice where appropriate."
        ]
      },
      {
        heading: "DreamFace rights in case of violation",
        body: [
          "Unauthorized use by your organization, users, contractors, clients, or anyone acting through your account may breach these Business Terms and may violate copyright, privacy, publicity, trademark, security, contract, or other laws.",
          "Your organization is responsible for violations by employees, contractors, clients, administrators, invited users, and anyone who accesses DreamFace through your account or credentials. You must take reasonable steps to stop any violation immediately.",
          "DreamFace may use automated systems, user reports, provider notices, payment signals, and human review to assess suspected violations. We may request proof of rights for inputs, references, likenesses, brand materials, voice, or other submitted content.",
          "DreamFace may block generation, remove outputs, disable downloads, suspend accounts, terminate access, reverse credits, or take other action where it believes law, provider policies, these terms, or third-party rights may be violated."
        ]
      },
      {
        heading: "Exemption from liability",
        body: [
          "To the maximum extent permitted by law, DreamFace, AI Services, outputs, Assets, and business features are provided as is and as available, without warranties of merchantability, title, fitness for a particular purpose, non-infringement, uninterrupted operation, or error-free performance.",
          "DreamFace does not guarantee that any provider, model, feature, output, storage function, billing integration, or third-party service will remain available, complete a task, produce a desired result, or satisfy your organization's legal, brand, advertising, or compliance requirements.",
          "Your organization is solely responsible for reviewing outputs, approving final projects, validating claims, obtaining permissions, maintaining backups, and deciding whether legal, brand, regulatory, or professional review is required.",
          "To the extent permitted by law, DreamFace will not be liable for indirect, incidental, special, punitive, exemplary, consequential damages, lost profits, lost data, lost goodwill, provider outages, platform moderation decisions, or third-party claims arising from your organization's use of the service."
        ]
      },
      {
        heading: "Indemnification",
        body: [
          "Your organization agrees to defend, indemnify, and hold harmless DreamFace, its affiliates, service providers, officers, employees, contractors, licensors, and partners from claims, losses, liabilities, damages, fees, and expenses arising from your organization's use of DreamFace, inputs, outputs, projects, breach of these terms, or violation of law or third-party rights.",
          "This includes claims involving copyright, trademarks, privacy, publicity rights, false advertising, regulated claims, confidential information, unauthorized brand or likeness use, and misuse of AI-generated content.",
          "If a written enterprise agreement provides a different indemnity process, that written agreement controls for the parties covered by it."
        ]
      },
      {
        heading: "Third-party services",
        body: [
          "DreamFace may rely on third-party services for authentication, hosting, databases, payments, analytics, logging, email, storage, content delivery, AI models, and generation infrastructure.",
          "Your organization may also use third-party platforms where projects are published, such as social networks, ad platforms, video platforms, ecommerce marketplaces, app stores, or client systems. Those third parties may have their own terms, policies, fees, and review rules.",
          "DreamFace is not responsible for third-party services, provider outages, payment processor decisions, platform moderation, ad review outcomes, marketplace rejections, or your organization's compliance with third-party policies."
        ]
      },
      {
        heading: "Amendments to these Terms and fees",
        body: [
          "DreamFace may update these Business Terms, the License, Privacy Policy, Copyright Policy, provider availability, plan features, credit pricing, usage limits, and fees from time to time.",
          "If changes are material, DreamFace may provide notice by email, account message, product notice, dashboard banner, or posting on dreamface.io. Continued use after changes become effective means your organization accepts the updated terms.",
          "Plan prices, taxes, provider costs, and credit calculations may change. Unless otherwise stated, pricing changes for recurring plans will apply at the next renewal or as described in the applicable notice or written agreement."
        ]
      },
      {
        heading: "Assignment",
        body: [
          "DreamFace may assign, transfer, delegate, subcontract, or deliver its rights and obligations under these Business Terms in connection with a merger, acquisition, financing, reorganization, sale of assets, corporate transaction, service-provider relationship, or other business need.",
          "Your organization may not assign or transfer its account, credits, license rights, or obligations without DreamFace's written permission, except where mandatory law provides otherwise or a written agreement allows it."
        ]
      },
      {
        heading: "Notices",
        body: [
          "DreamFace may send notices by email, account message, product notice, dashboard banner, or posting on dreamface.io. Your organization is responsible for keeping billing, security, legal, and administrator contacts current.",
          "Operational, billing, security, legal, and service notices may be sent even if individual users opt out of marketing communications. Notices sent to the account administrator are deemed notices to the organization."
        ]
      },
      {
        heading: "DreamFace entity",
        body: [
          "Until DreamFace publishes additional contracting-entity details or enters into a separate written agreement with your organization, your business relationship is with the operator of dreamface.io.",
          "Payment processing may be handled by Stripe, PayPal, or another payment provider on behalf of DreamFace. Receipts, taxes, and billing records may identify the relevant payment processor or merchant information available at checkout."
        ]
      },
      {
        heading: "General",
        body: [
          "These Business Terms, together with the DreamFace License, Terms of Use, Privacy Policy, Copyright Policy, and any written agreement that applies to your organization, form the agreement governing business use of DreamFace.",
          "If any provision is found invalid or unenforceable, the remaining provisions will continue in effect. DreamFace's failure to enforce a provision does not waive its right to enforce it later.",
          "Your organization is responsible for taxes, fees, compliance obligations, user management, and project approvals that apply to its use of DreamFace.",
          "Sections concerning intellectual property, payments, disclaimers, indemnification, limits of liability, assignment, governing law, and any provisions intended to survive will survive termination."
        ]
      },
      {
        heading: "Governing law and jurisdiction",
        body: [
          "The governing law and venue for business disputes will be determined by the DreamFace entity, your organization's location, and any written agreement that applies. If no specific jurisdiction is stated, DreamFace may designate governing law and venue in a later update or written agreement.",
          "Nothing in these Business Terms limits mandatory rights that cannot be waived under applicable law."
        ]
      },
      {
        heading: "Operating requirements for tools and technical problems",
        body: [
          "If DreamFace offers downloadable tools, plugins, desktop helpers, browser extensions, APIs, or integrations, your organization is responsible for checking system requirements, maintaining compatible software, managing installation, and installing updates required for continued use.",
          "Tools may be modified, suspended, limited, or discontinued. Your organization may not bypass restrictions, share tools outside authorized users, host tools for third-party access, or use them in a way that violates these Business Terms.",
          "For technical problems, contact support with relevant details such as account email, organization name, task ID, browser, operating system, prompt settings, logs, error messages, and approximate time of the issue. DreamFace may provide troubleshooting, replacement, credit refund, or other assistance at its discretion.",
          "DreamFace is not responsible for problems caused by unsupported systems, modified software, network restrictions, misuse, provider outages, third-party platform changes, or failure to follow instructions."
        ]
      }
    ]
  },
  {
    slug: "copyright-policy",
    title: "Copyright Policy",
    summary: "How DreamFace handles copyright infringement notices, takedown requests, and counter-notifications.",
    updatedAt: "May 18, 2026",
    sections: [
      {
        heading: "Copyright Policy",
        body: [
          "DreamFace respects copyright and other intellectual-property rights. If you believe that any content, Asset, prompt, output, gallery item, page, or project available through DreamFace infringes your rights, you may submit a Copyright Infringement Notification as described below.",
          "This policy is intended to support an orderly notice-and-response process under the DMCA and similar laws. It is not legal advice. If you are unsure about your rights or obligations, you should consult an attorney."
        ]
      },
      {
        heading: "Before you file a Copyright Infringement Notification",
        body: [
          "Only the copyright owner or a person authorized to act on behalf of the copyright owner should submit a Copyright Infringement Notification.",
          "Please consider whether the disputed use may be authorized by law, license, fair use, fair dealing, or another exception before submitting a notice.",
          "Information you provide, including your name, email address, claim details, and the materials identified in your notice, may be shared with the user, creator, account holder, service provider, or other party associated with the disputed content so the claim can be reviewed or resolved.",
          "Do not abuse the notice process or submit false, misleading, or bad-faith claims. Misuse of the process may result in account termination and may expose you to legal liability."
        ]
      },
      {
        heading: "When filing a Copyright Infringement Notification",
        body: [
          "Your notice should include your complete contact information, including your full legal name, mailing address, telephone number, and email address.",
          "Identify each copyrighted work you claim has been infringed. If multiple works are involved, provide a representative list and enough detail for us to understand the claim.",
          "Identify the material on DreamFace that you claim is infringing and provide reasonably sufficient information for us to locate it, such as a URL, gallery item, task ID, output URL, screenshot, account name, or other identifying details.",
          "Include a statement that you have a good-faith belief that the disputed use is not authorized by the copyright owner, its agent, or the law.",
          "Include a statement that the information in your notice is accurate and that, under penalty of perjury where applicable, you are the copyright owner or are authorized to act on behalf of the copyright owner.",
          "Include a physical or electronic signature of the copyright owner or the authorized representative. Missing information may delay review or prevent us from processing the notice."
        ]
      },
      {
        heading: "Our response to notices",
        body: [
          "After receiving a notice, DreamFace may remove, disable, restrict, or investigate the allegedly infringing material without contacting the account holder in advance where appropriate.",
          "We may notify the account holder or creator and provide information from the notice so they can understand the claim and, where available, submit a counter-notification.",
          "Repeated or serious infringement claims may lead to account restrictions, loss of access, removal of content, or termination. DreamFace may also preserve records needed for legal, security, fraud-prevention, or dispute-resolution purposes."
        ]
      },
      {
        heading: "Copyright Infringement Counter-Notification",
        body: [
          "If content was removed or disabled and the affected user believes the removal was a mistake or misidentification, the user or an authorized representative may submit a counter-notification.",
          "A counter-notification should identify the removed material, explain why the user believes the removal was mistaken or authorized, include complete contact information, and include any statements or consent to jurisdiction required by applicable law.",
          "After receiving a valid counter-notification, DreamFace may forward it to the party that submitted the original notice. If that party does not notify us that it has filed a court action or similar legal proceeding within the applicable period, DreamFace may restore or stop disabling access to the material where appropriate.",
          "Only the person who posted, generated, or provided the disputed material, or that person's authorized representative, should submit a counter-notification. Submitting false information may have legal consequences."
        ]
      },
      {
        heading: "Contact for copyright matters",
        body: [
          "Until DreamFace publishes a dedicated copyright email or mailing address, notices should be sent through the contact or support channel made available on dreamface.io. Include the words Copyright Notice in the subject or first line of your message.",
          "If DreamFace later publishes a designated copyright agent, email address, or postal address, notices should be sent to that designated contact."
        ]
      }
    ]
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    summary: "What information DreamFace collects, how it is used, shared, retained, and protected when you use dreamface.io.",
    updatedAt: "May 18, 2026",
    sections: [
      {
        heading: "Our commitment to you",
        body: [
          "DreamFace is committed to transparency and responsible handling of personal information. To provide our services, we need to collect and process certain information about users, accounts, billing activity, prompts, generation tasks, and platform usage.",
          "This Privacy Policy explains what information we collect, how we use it, with whom we share it, how long we retain it, and the choices and rights that may be available to you.",
          "If you do not agree with this Privacy Policy, please do not use DreamFace. This policy does not replace any additional privacy terms that may apply under a written enterprise agreement."
        ]
      },
      {
        heading: "Grounds for data collection",
        body: [
          "You are not legally required to provide personal data to DreamFace, but without certain information we may not be able to provide account access, billing, generation history, support, security, or the full service experience.",
          "We process personal data where needed to perform our contract with you, operate and secure the service, comply with legal obligations, protect legitimate interests, respond to requests, process payments, prevent fraud and abuse, and, where required, based on your consent."
        ]
      },
      {
        heading: "What type of data we collect?",
        body: [
          "Registration and account data may include your name, email address, login provider identifiers, company name, job title, billing contact details, account settings, administrator status, and support communications.",
          "Payment and billing data may include transaction IDs, purchased credit packs, checkout session data, payment status, billing address, tax information, receipts, and limited payment details received from payment processors. DreamFace does not intentionally store full credit card numbers.",
          "Information you provide may include prompts, uploaded references, images, videos, files, brand materials, source URLs, feedback, survey responses, support messages, and any personal data you choose to include in inputs.",
          "Usage and technical data may include IP address, approximate location, browser, device type, operating system, referral URL, page views, session events, account ID, task IDs, provider choices, credit usage, generation settings, output metadata, logs, errors, and interactions with the service.",
          "Third-party login data may include information supplied by providers such as Google, depending on your settings and the provider's policies, such as email address, profile name, and authentication identifiers.",
          "Aggregated or de-identified data may be created from the above information for analytics, reporting, debugging, security, and product improvement. If aggregated data is combined with personal data in a way that identifies you, we treat the combined data as personal data."
        ]
      },
      {
        heading: "AI Services",
        body: [
          "DreamFace AI Services do not require you to include personal data in prompts or uploads. If you voluntarily include personal data, likenesses, names, images, private information, or sensitive data in inputs, you are responsible for ensuring that you have the required rights, notices, consents, and legal basis.",
          "Inputs, uploaded files, task settings, provider choices, and AI-generated outputs may be processed by DreamFace and third-party model providers as needed to generate, deliver, troubleshoot, secure, and maintain the service.",
          "DreamFace is not intended for processing protected health information, biometric data, children's data, or other sensitive categories of personal data unless a specific written agreement permits that use and appropriate safeguards are in place.",
          "You may be able to delete certain task history, outputs, or account data through product features or support requests. Some hashed prompts, logs, billing records, abuse-prevention records, or security records may be retained where needed for legal, security, fraud-prevention, or system-integrity purposes."
        ]
      },
      {
        heading: "Tracking Technologies",
        body: [
          "DreamFace and third parties may use cookies, pixels, local storage, session identifiers, analytics events, tracking links, and similar technologies to operate the service, keep you signed in, remember settings, measure usage, improve performance, detect abuse, and understand how users interact with the product.",
          "Some tracking technologies are first-party technologies set by DreamFace. Others may be set by analytics, hosting, payment, marketing, or embedded third-party providers.",
          "You can manage cookies through your browser settings. Blocking cookies or local storage may cause login, billing, generation history, preferences, or other features to work incorrectly. If DreamFace implements a cookie preference tool, you may also manage eligible preferences there."
        ]
      },
      {
        heading: "How do we use the data we collect?",
        body: [
          "We use data to create and manage accounts, authenticate users, process payments, allocate credits, submit generation tasks, store creations, display task history, provide support, send service notifications, and operate DreamFace features.",
          "We use data to improve the service, debug errors, monitor provider performance, analyze usage, develop features, personalize product experience, test reliability, and understand how users move through workflows.",
          "We use data for security, fraud prevention, abuse detection, policy enforcement, copyright and rights review, payment dispute handling, compliance with law, and protection of DreamFace, users, providers, and third parties.",
          "We may send marketing or product communications where permitted. You may opt out of marketing emails, but we may still send transactional, billing, security, legal, and service-related messages."
        ]
      },
      {
        heading: "Purposes and legal bases for processing personal data",
        body: [
          "Contract performance: we process account, billing, support, prompt, task, and output information to provide the service, complete purchases, manage credits, and respond to user requests.",
          "Legitimate interests: we process usage, analytics, logs, security, fraud-prevention, support, product-improvement, and business-operation data to maintain and improve DreamFace and protect users and the platform.",
          "Consent: where required, we may rely on consent for certain cookies, marketing communications, optional surveys, or other optional processing. You may withdraw consent where applicable.",
          "Legal obligation: we may process information to comply with tax, accounting, sanctions, payment, consumer-protection, law-enforcement, court order, or regulatory obligations."
        ]
      },
      {
        heading: "With whom do we share your personal data?",
        body: [
          "We may share information with internal personnel, contractors, affiliates, and service providers who need access to operate, secure, support, or improve DreamFace.",
          "Service providers may include hosting providers, database providers, authentication providers, payment processors such as Stripe and PayPal, analytics providers, email providers, logging and monitoring vendors, storage providers, content delivery networks, AI model providers, and support tools.",
          "If you use third-party login, payments, embedded tools, or integrations, those third parties may process information according to their own privacy policies and terms.",
          "We may disclose information to comply with law, legal process, government request, fraud prevention, security investigation, rights enforcement, payment disputes, copyright claims, or protection of the safety and rights of DreamFace, users, or third parties.",
          "If DreamFace is involved in a merger, acquisition, financing, reorganization, bankruptcy, or sale of assets, information may be transferred or disclosed as part of that transaction, subject to appropriate safeguards where required."
        ]
      },
      {
        heading: "Transfer of data outside the EEA",
        body: [
          "If you are located in the EEA, UK, or Switzerland, your personal data may be processed in countries outside your region, including countries that may not provide the same level of data protection.",
          "Where required, DreamFace will rely on appropriate safeguards such as adequacy decisions, standard contractual clauses, data processing agreements, or other lawful transfer mechanisms."
        ]
      },
      {
        heading: "How we protect your information",
        body: [
          "DreamFace uses administrative, technical, and organizational safeguards designed to protect personal data against unauthorized access, loss, misuse, alteration, or disclosure.",
          "Access to personal data is limited to personnel and service providers with a need to know. We use account security, provider controls, environment separation, logging, and operational practices intended to protect the service.",
          "No internet-based service can guarantee absolute security. You are responsible for protecting your login credentials, using secure devices and networks, and limiting access to your account."
        ]
      },
      {
        heading: "Retention",
        body: [
          "We retain personal data for as long as reasonably necessary to provide the service, maintain accounts, process payments, preserve task history, comply with legal obligations, resolve disputes, prevent abuse, enforce terms, and maintain security.",
          "Retention periods depend on the type of information, the purpose for collection, legal requirements, user settings, account status, billing history, and security needs. We may delete or de-identify outdated information when it is no longer needed.",
          "Some records, such as billing, tax, security, fraud-prevention, support, and legal records, may be retained after account closure where required or reasonably necessary."
        ]
      },
      {
        heading: "User rights",
        body: [
          "Depending on your location, you may have rights to access, correct, delete, export, restrict, or object to certain processing of your personal data, and to withdraw consent where processing is based on consent.",
          "To exercise rights, contact DreamFace through the support or contact channel available on dreamface.io. We may need to verify your identity and authority before responding.",
          "Rights are not absolute. Requests may be limited by legal obligations, security needs, fraud prevention, accounting requirements, dispute resolution, provider records, or other legitimate reasons."
        ]
      },
      {
        heading: "Our policy toward children",
        body: [
          "DreamFace is not designed for or directed to children under 16, and we do not knowingly collect personal data from children under 16.",
          "If a parent or guardian believes that a child has provided personal data to DreamFace, they should contact us so we can review and take appropriate action."
        ]
      },
      {
        heading: "Additional information for California residents",
        body: [
          "California residents may have rights under the CCPA and CPRA, including rights to know, access, correct, delete, limit use of sensitive personal information, opt out of certain sharing or sale, and not be discriminated against for exercising privacy rights.",
          "DreamFace may collect categories of personal information such as identifiers, commercial information, internet or electronic network activity, approximate geolocation, inferences, account information, and payment-related records. Sources may include you, your device, service providers, payment processors, authentication providers, analytics providers, and business partners.",
          "DreamFace does not sell personal information in the traditional sense. If we use advertising or analytics technologies that may be considered selling or sharing under California law, eligible users may request opt-out through available preference tools or by contacting us.",
          "Authorized agents may submit requests where permitted by law, but DreamFace may require proof of authorization and identity verification before responding."
        ]
      },
      {
        heading: "How to contact us?",
        body: [
          "If you want to exercise privacy rights, request deletion, ask questions, or receive more information about this Privacy Policy, contact DreamFace through the support or contact channel available on dreamface.io.",
          "Until DreamFace publishes dedicated privacy contact details, please include Privacy Request in the subject or first line of your message and provide enough information for us to identify your account and understand your request."
        ]
      },
      {
        heading: "Updates to this policy",
        body: [
          "DreamFace may update this Privacy Policy from time to time. The most current version will be posted on dreamface.io with the updated date.",
          "If changes are material, we may provide notice by email, product notice, dashboard banner, or another appropriate method. Continued use after an update means you acknowledge the updated policy."
        ]
      }
    ]
  },

] as const satisfies LegalDocument[];

export type LegalSlug = (typeof LEGAL_DOCUMENTS)[number]["slug"];

export function getLegalDocument(slug: string) {
  return LEGAL_DOCUMENTS.find((document) => document.slug === slug) || null;
}
