import { Suspense } from "react";
import { PricingContent } from "../billing/page";

export default function PricePage() {
  return (
    <Suspense fallback={null}>
      <PricingContent surface="price" />
    </Suspense>
  );
}
