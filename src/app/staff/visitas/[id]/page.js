import VisitScreen from '@/components/staff/preparation/VisitScreen';
export default async function Page({ params }) {
    const { id } = await params;
    return <VisitScreen visitId={id} />;
}
