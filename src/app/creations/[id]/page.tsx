import { CreationDetailClient } from "./creation-detail-client";

export const dynamic = "force-dynamic";

export default function CreationDetailPage({ params }: { params: { id: string } }) {
  return <CreationDetailClient taskId={params.id} />;
}
