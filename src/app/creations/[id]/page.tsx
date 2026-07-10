import { CreationDetailClient } from "./creation-detail-client";

export const dynamic = "force-dynamic";

export default async function CreationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <CreationDetailClient taskId={(await params).id} />;
}
