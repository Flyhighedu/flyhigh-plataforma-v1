import { notFound } from 'next/navigation';
import FlightRehearsalScreen from '@/components/staff/preparation/FlightRehearsalScreen';
import { isLocal3dReview } from '@/lib/google-3d-proxy.mjs';

export default async function Page({ params }) {
    if (!isLocal3dReview(process.env)) notFound();
    const { id } = await params;
    return <FlightRehearsalScreen visitId={id} google3d />;
}
