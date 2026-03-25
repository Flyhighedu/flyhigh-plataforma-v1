"use client";

import {
    BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
    AreaChart as RechartsAreaChart, Area,
} from 'recharts';

/* ── Color Palette ── */
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];
const CHART_STYLE = {
    fontSize: 12,
    fontFamily: 'var(--font-inter, Inter, sans-serif)',
};

/* ── Bar Chart ── */
export function TremorBarChart({ data = [], index = 'month', categories = [], colors, height = 320, valueFormatter }) {
    const palette = colors || COLORS;

    const fmt = valueFormatter || ((v) => v.toLocaleString());

    return (
        <ResponsiveContainer width="100%" height={height}>
            <RechartsBarChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 4 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e2e8f0)" strokeOpacity={0.5} />
                <XAxis
                    dataKey={index}
                    tick={{ ...CHART_STYLE, fill: 'var(--muted-foreground, #94a3b8)' }}
                    axisLine={false}
                    tickLine={false}
                />
                <YAxis
                    tick={{ ...CHART_STYLE, fill: 'var(--muted-foreground, #94a3b8)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={fmt}
                />
                <Tooltip
                    formatter={(value) => fmt(value)}
                    contentStyle={{
                        background: 'var(--card, #fff)',
                        border: '1px solid var(--border, #e2e8f0)',
                        borderRadius: 12,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                        fontSize: 13,
                    }}
                    cursor={{ fill: 'var(--accent, #f1f5f9)', opacity: 0.4 }}
                />
                {categories.map((cat, i) => (
                    <Bar
                        key={cat}
                        dataKey={cat}
                        fill={palette[i % palette.length]}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={48}
                    />
                ))}
            </RechartsBarChart>
        </ResponsiveContainer>
    );
}

/* ── Donut Chart ── */
export function TremorDonutChart({ data = [], nameKey = 'name', valueKey = 'value', colors, height = 300, centerLabel }) {
    const palette = colors || COLORS;

    return (
        <ResponsiveContainer width="100%" height={height}>
            <PieChart>
                <Pie
                    data={data}
                    dataKey={valueKey}
                    nameKey={nameKey}
                    cx="50%"
                    cy="50%"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={3}
                    strokeWidth={0}
                >
                    {data.map((_, i) => (
                        <Cell key={i} fill={palette[i % palette.length]} />
                    ))}
                </Pie>
                <Tooltip
                    formatter={(value) => `$${value.toLocaleString()}`}
                    contentStyle={{
                        background: 'var(--card, #fff)',
                        border: '1px solid var(--border, #e2e8f0)',
                        borderRadius: 12,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                        fontSize: 13,
                    }}
                />
                <Legend
                    wrapperStyle={{ ...CHART_STYLE, color: 'var(--muted-foreground, #94a3b8)' }}
                />
                {centerLabel && (
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
                        style={{ fontSize: 22, fontWeight: 700, fill: 'var(--foreground, #1e293b)' }}>
                        {centerLabel}
                    </text>
                )}
            </PieChart>
        </ResponsiveContainer>
    );
}

/* ── Progress Circle (SVG) ── */
export function ProgressCircle({ value = 0, size = 140, strokeWidth = 12, color, label, sublabel }) {
    const resolvedColor = color || (value >= 75 ? '#10b981' : value >= 40 ? '#f59e0b' : '#ef4444');
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (Math.min(value, 100) / 100) * circumference;

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="transform -rotate-90">
                    <circle
                        cx={size / 2} cy={size / 2} r={radius}
                        fill="none" stroke="currentColor" className="text-border"
                        strokeWidth={strokeWidth} opacity={0.2}
                    />
                    <circle
                        cx={size / 2} cy={size / 2} r={radius}
                        fill="none" stroke={resolvedColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold" style={{ color: resolvedColor }}>{value}%</span>
                </div>
            </div>
            {label && <span className="text-sm font-semibold text-foreground">{label}</span>}
            {sublabel && <span className="text-xs text-muted-foreground">{sublabel}</span>}
        </div>
    );
}

/* ── Progress Bar ── */
export function TremorProgressBar({ value = 0, label, sublabel, color, showValue = true }) {
    const resolvedColor = color || '#6366f1';
    const clampedValue = Math.min(Math.max(value, 0), 100);

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{label}</span>
                {showValue && (
                    <span className="text-sm font-semibold" style={{ color: resolvedColor }}>
                        {clampedValue}%
                    </span>
                )}
            </div>
            {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
            <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${clampedValue}%`, backgroundColor: resolvedColor }}
                />
            </div>
        </div>
    );
}

/* ── Area Chart ── */
export function TremorAreaChart({ data = [], index = 'label', categories = [], colors, height = 280, valueFormatter }) {
    const palette = colors || COLORS;
    const fmt = valueFormatter || ((v) => v.toLocaleString());

    return (
        <ResponsiveContainer width="100%" height={height}>
            <RechartsAreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
                <defs>
                    {categories.map((cat, i) => (
                        <linearGradient key={cat} id={`gradient-${cat}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={palette[i % palette.length]} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={palette[i % palette.length]} stopOpacity={0.02} />
                        </linearGradient>
                    ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e2e8f0)" strokeOpacity={0.5} />
                <XAxis
                    dataKey={index}
                    tick={{ ...CHART_STYLE, fill: 'var(--muted-foreground, #94a3b8)' }}
                    axisLine={false} tickLine={false}
                />
                <YAxis
                    tick={{ ...CHART_STYLE, fill: 'var(--muted-foreground, #94a3b8)' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={fmt}
                />
                <Tooltip
                    formatter={(value) => fmt(value)}
                    contentStyle={{
                        background: 'var(--card, #fff)',
                        border: '1px solid var(--border, #e2e8f0)',
                        borderRadius: 12,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                        fontSize: 13,
                    }}
                    cursor={{ stroke: 'var(--muted-foreground, #94a3b8)', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                {categories.map((cat, i) => (
                    <Area
                        key={cat}
                        type="monotone"
                        dataKey={cat}
                        stroke={palette[i % palette.length]}
                        strokeWidth={2.5}
                        fill={`url(#gradient-${cat})`}
                        dot={{ r: 4, fill: palette[i % palette.length], strokeWidth: 2, stroke: 'var(--card, #fff)' }}
                        activeDot={{ r: 6, strokeWidth: 2 }}
                    />
                ))}
            </RechartsAreaChart>
        </ResponsiveContainer>
    );
}
