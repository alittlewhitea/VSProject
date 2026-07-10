import type { ReactNode } from "react";
import { SiteFooter } from "../../components/site-footer";
import { TopNav } from "../../components/top-nav";

type ComparisonPageShellProps = {
  children: ReactNode;
  structuredData: unknown;
};

export function ComparisonPageShell({ children, structuredData }: ComparisonPageShellProps) {
  return (
    <main className="comparison-page min-h-screen text-[#1f2430]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <div className="comparison-page-frame">
        <div className="comparison-page-surface">
          <div className="comparison-page-nav">
            <TopNav />
          </div>
          {children}
          <div className="comparison-page-footer">
            <SiteFooter />
          </div>
        </div>
      </div>
    </main>
  );
}
