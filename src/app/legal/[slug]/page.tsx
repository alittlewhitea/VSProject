import Link from "next/link";
import { notFound } from "next/navigation";
import { TopNav } from "../../../components/top-nav";
import { getLegalDocument, LEGAL_DOCUMENTS } from "../../../lib/legal";

export function generateStaticParams() {
  return LEGAL_DOCUMENTS.map((document) => ({ slug: document.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const document = getLegalDocument((await params).slug);
  return {
    title: document ? `${document.title} | DreamFace` : "Legal | DreamFace",
    description: document?.summary || "DreamFace legal information."
  };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const document = getLegalDocument((await params).slug);
  if (!document) notFound();

  return (
    <main className="bg-grid min-h-screen pb-14">
      <div className="mx-auto max-w-5xl px-4 pt-4 md:px-8 md:pt-5">
        <TopNav />

        <section className="rounded-[2rem] border border-black/5 bg-white/92 p-6 shadow-[0_24px_60px_rgba(13,18,35,0.08)] md:p-10">
          <div className="flex flex-col gap-5 border-b border-black/10 pb-7 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[#6e6e73]">License & Terms</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">{document.title}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[#5c6374] md:text-base">{document.summary}</p>
            </div>
            <p className="shrink-0 rounded-full border border-black/10 bg-[#f8fbff] px-4 py-2 text-xs font-semibold text-[#4c5a70]">
              Updated {document.updatedAt}
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-[220px_1fr]">
            <aside className="h-max rounded-2xl border border-black/10 bg-[#f8fbff] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667084]">Documents</p>
              <div className="mt-3 grid gap-2">
                {LEGAL_DOCUMENTS.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/legal/${item.slug}`}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                      item.slug === document.slug ? "bg-[#1d1d1f] text-white" : "text-[#4f596b] hover:bg-white"
                    }`}
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            </aside>

            <div className="space-y-5">
              {document.sections.map((section) => (
                <section key={section.heading} className="rounded-2xl border border-black/10 bg-white p-5">
                  <h2 className="text-2xl font-semibold tracking-tight">{section.heading}</h2>
                  <div className="mt-3 space-y-3">
                    {section.body.map((paragraph) => (
                      <p key={paragraph} className="text-sm leading-7 text-[#536071]">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
