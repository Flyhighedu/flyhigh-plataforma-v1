import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import MobileReviewSignIn from './MobileReviewSignIn';

export default function ReviewMobilePage() {
    if (process.env.FLYHIGH_REVIEW_LAB !== '1' || process.env.FLYHIGH_REVIEW_ENVIRONMENT !== 'isolated-test') notFound();
    return <Suspense fallback={<main className="min-h-[100svh] bg-[#06182c]" />}><MobileReviewSignIn /></Suspense>;
}
