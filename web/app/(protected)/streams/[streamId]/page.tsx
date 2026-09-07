import { StreamDetailView } from '../../../../components/streams/stream-detail';

export default async function StreamDetailPage({ params }: { params: Promise<{ streamId: string }> }) {
  const { streamId } = await params;
  return <StreamDetailView streamId={streamId} />;
}
