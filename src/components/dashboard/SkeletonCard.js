"use client";

/* ── Skeleton primitives — pure CSS pulse, zero spinners ── */

function Bone({ className = '', style }) {
    return (
        <div
            className={`animate-pulse rounded-lg bg-muted ${className}`}
            style={style}
        />
    );
}

export function SkeletonMetricCard() {
    return (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <Bone className="h-4 w-24" />
            <Bone className="h-9 w-32" />
            <Bone className="h-3 w-20" />
        </div>
    );
}

export function SkeletonChart({ height = 280 }) {
    return (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
                <Bone className="h-5 w-36" />
                <Bone className="h-5 w-20" />
            </div>
            <Bone style={{ height }} />
        </div>
    );
}

export function SkeletonTable({ rows = 5 }) {
    return (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {/* Header */}
            <div className="flex gap-4 p-4 border-b border-border">
                {[120, 200, 80, 80, 80].map((w, i) => (
                    <Bone key={i} className="h-4" style={{ width: w }} />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex gap-4 p-4 border-b border-border last:border-0">
                    {[120, 200, 80, 80, 80].map((w, j) => (
                        <Bone key={j} className="h-4" style={{ width: w, opacity: 1 - i * 0.12 }} />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function SkeletonProgressCircle() {
    return (
        <div className="flex flex-col items-center gap-3">
            <Bone className="rounded-full" style={{ width: 140, height: 140 }} />
            <Bone className="h-4 w-24" />
            <Bone className="h-3 w-16" />
        </div>
    );
}

export function SkeletonPanel() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <SkeletonMetricCard />
                <SkeletonMetricCard />
                <SkeletonMetricCard />
            </div>
            <SkeletonChart />
        </div>
    );
}
