import { notFound } from 'next/navigation';
import { isLocal3dReview } from '@/lib/google-3d-proxy.mjs';
import FreeFlightScreen from '@/components/staff/preparation/FreeFlightScreen';
export default function Page() {
    if (!isLocal3dReview(process.env)) notFound();
    return <FreeFlightScreen/>;
}
