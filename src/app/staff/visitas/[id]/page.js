import { isLocal3dReview } from '@/lib/google-3d-proxy.mjs';
import VisitScreen from '@/components/staff/preparation/VisitScreen';
export default async function Page({ params }) {
    const { id } = await params;
    return <VisitScreen visitId={id} flightRehearsalEnabled={isLocal3dReview(process.env)} />;
}
