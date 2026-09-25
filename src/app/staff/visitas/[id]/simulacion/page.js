import { notFound } from 'next/navigation';
import FlightRehearsalScreen from '@/components/staff/preparation/FlightRehearsalScreen';

export default async function Page({ params }) {
    if (process.env.FLYHIGH_REVIEW_LAB !== '1') notFound();
    const { id } = await params;
    return <FlightRehearsalScreen visitId={id} />;
}
