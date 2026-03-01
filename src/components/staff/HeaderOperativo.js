'use client';

import { forwardRef } from 'react';
import { CheckCheck, ClipboardList, GraduationCap, School, Send, Truck, Wrench } from 'lucide-react';
import { HEADER_PHASES, getHeaderPhaseForState } from '@/constants/headerPhases';

function toRgba(hexColor, alpha) {
    if (typeof hexColor !== 'string') return `rgba(34,197,94,${alpha})`;
    const clean = hexColor.replace('#', '');
    if (clean.length !== 6) return `rgba(34,197,94,${alpha})`;

    const intValue = Number.parseInt(clean, 16);
    if (Number.isNaN(intValue)) return `rgba(34,197,94,${alpha})`;

    const red = (intValue >> 16) & 255;
    const green = (intValue >> 8) & 255;
    const blue = intValue & 255;
    return `rgba(${red},${green},${blue},${alpha})`;
}

function formatToday() {
    const todayDate = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    return todayDate.charAt(0).toUpperCase() + todayDate.slice(1);
}

function formatCompactToday() {
    return new Date()
        .toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
        .replace(/\./g, '')
        .replace(/,/g, '')
        .trim()
        .toUpperCase();
}

const PHASE_ICONS = {
    checkin: CheckCheck,
    prep_base: ClipboardList,
    traslado: Truck,
    instalacion: Wrench,
    operacion: GraduationCap
};

function getPhaseIcon(phaseId) {
    return PHASE_ICONS[phaseId] || CheckCheck;
}

const HeaderOperativo = forwardRef(function HeaderOperativo(
    {
        firstName,
        roleLabel,
        missionState,
        dateLabel,
        schoolName = '',
        compactProgress = 0,
        waitModeActive = false,
        waitModeText = 'Te esperan',
        bottomStatusText = '',
        statusSlot = null,
        actionsSlot = null,
        className = '',
        style = undefined,
        transitionMs = 350
    },
    ref
) {
    const phase = getHeaderPhaseForState(missionState);
    const isCheckInPhase = phase.id === 'checkin';
    const activeColor = phase.activeColor;
    const transitionStyle = { transitionDuration: `${transitionMs}ms` };
    const displayDate = dateLabel || (isCheckInPhase ? formatToday() : formatCompactToday());
    const name = firstName || 'Operativo';
    const roleText = roleLabel || 'Operativo';
    const normalizedSchoolName = String(schoolName || '').trim();
    const compactSecondaryText = normalizedSchoolName || displayDate;
    const compactSecondaryIsDate = !normalizedSchoolName;
    const parsedCompactProgress = Number(compactProgress);
    const compactAmount = isCheckInPhase
        ? 0
        : Math.max(0, Math.min(1, Number.isFinite(parsedCompactProgress) ? parsedCompactProgress : 0));
    const topRowMarginBottom = isCheckInPhase ? 24 : (12 - (compactAmount * 7));
    const stepperMarginTop = isCheckInPhase ? 24 : (15 - (compactAmount * 11));
    const waitScaleMin = waitModeActive ? (0.9988 + (compactAmount * 0.001)) : 1;
    const waitScaleMax = waitModeActive ? (1.0078 - (compactAmount * 0.0034)) : 1;
    const waitShiftY = waitModeActive ? Math.max(0.2, 0.46 - (compactAmount * 0.24)) : 0;
    const waitTintOpacity = waitModeActive ? Math.max(0.09, 0.16 - (compactAmount * 0.05)) : 0;
    const waitGlowOpacity = waitModeActive ? Math.max(0.16, 0.3 - (compactAmount * 0.1)) : 0;
    const waitEdgeOpacity = waitModeActive ? Math.max(0.2, 0.36 - (compactAmount * 0.14)) : 0;
    const resolvedBottomStatusText = String(bottomStatusText || (waitModeActive ? waitModeText : '')).trim();
    const hasBottomStatus = !isCheckInPhase && resolvedBottomStatusText.length > 0;
    const bottomStatusOpacity = hasBottomStatus ? Math.max(0.84, 0.96 - (compactAmount * 0.12)) : 0;
    const compactBrandOpacity = isCheckInPhase ? 0 : compactAmount;
    const expandedBrandOpacity = isCheckInPhase ? 1 : (1 - compactAmount);
    const headerStyle = waitModeActive
        ? {
            ...(style || {}),
            '--wait-scale-min': waitScaleMin.toFixed(4),
            '--wait-scale-max': waitScaleMax.toFixed(4),
            '--wait-shift-y': `${waitShiftY.toFixed(3)}px`
        }
        : style;

    return (
        <header
            ref={ref}
            className={`relative sticky top-0 z-40 flex items-center justify-between overflow-visible rounded-b-[36px] bg-gradient-to-br from-[#0A4FE2] via-[#1A67F4] to-[#0C41C9] px-5 pb-6 shadow-lg shadow-blue-900/20 sm:px-7 ${waitModeActive ? 'animate-wait-header-shell' : ''} ${className}`}
            style={headerStyle}
        >
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 -bottom-7 h-12 blur-2xl transition-opacity ease-out"
                style={{
                    ...transitionStyle,
                    backgroundColor: toRgba(activeColor, 0.15)
                }}
            />

            {waitModeActive && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-b-[36px]">
                    <div
                        className="absolute inset-0 animate-wait-header-tint"
                        style={{
                            opacity: waitTintOpacity,
                            background:
                                'linear-gradient(135deg, rgba(125,211,252,0.62) 0%, rgba(56,189,248,0.34) 38%, rgba(37,99,235,0.14) 72%, rgba(30,58,138,0.04) 100%)'
                        }}
                    />
                    <div
                        className="animate-wait-header-breathe absolute -left-10 -bottom-16 h-52 w-52 rounded-full blur-3xl"
                        style={{
                            opacity: waitGlowOpacity,
                            background:
                                'radial-gradient(circle at center, rgba(186,230,253,0.98) 0%, rgba(56,189,248,0.55) 36%, rgba(14,165,233,0.16) 58%, rgba(14,165,233,0) 78%)'
                        }}
                    />
                    <div
                        className="animate-wait-header-edge-halo absolute inset-x-6 h-[8px] rounded-full"
                        style={{
                            bottom: `${Math.max(10, 14 - (compactAmount * 4))}px`,
                            opacity: waitEdgeOpacity,
                            background:
                                'linear-gradient(90deg, rgba(125,211,252,0) 0%, rgba(186,230,253,0.86) 50%, rgba(125,211,252,0) 100%)',
                            filter: 'blur(7px)'
                        }}
                    />
                </div>
            )}

            <div className="relative z-10 w-full">
                <div
                    className="relative flex items-center justify-between"
                    style={{ marginBottom: `${topRowMarginBottom}px` }}
                >
                    <div
                        className="flex items-center gap-2 text-white/90"
                        style={{
                            ...transitionStyle,
                            opacity: expandedBrandOpacity,
                            transform: `translateY(${-2 * compactAmount}px)`
                        }}
                    >
                        <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-md">
                            <Send size={20} className="text-white" />
                        </div>
                        <h1 className="text-xl font-extrabold tracking-tighter">FlyHigh</h1>
                    </div>

                    {!isCheckInPhase && (
                        <div
                            className="pointer-events-none absolute inset-x-0 top-1/2 z-0 flex justify-center"
                            style={{
                                ...transitionStyle,
                                opacity: compactBrandOpacity,
                                transform: `translateY(calc(-50% + ${(1 - compactAmount) * 3}px))`
                            }}
                        >
                            <div className="inline-flex items-center gap-2 text-white/95 drop-shadow-[0_1px_8px_rgba(15,23,42,0.24)]">
                                <span className="rounded-lg border border-white/20 bg-white/10 p-1.5 backdrop-blur-md">
                                    <Send size={16} className="text-white" />
                                </span>
                                <span className="text-[1.15rem] font-black tracking-tight leading-none">FlyHigh</span>
                            </div>
                        </div>
                    )}

                    <div className="relative z-10 flex items-center gap-2">
                        {statusSlot}
                        {actionsSlot}
                    </div>
                </div>

                <div className="space-y-1.5">
                    {isCheckInPhase ? (
                        <>
                            <div className="flex items-center gap-2 text-blue-100 text-sm font-medium">
                                <span>¡Buenos días!</span>
                                <span className="w-1 h-1 bg-blue-300 rounded-full opacity-50"></span>
                                <span className="uppercase text-xs tracking-wider opacity-80">{displayDate}</span>
                            </div>

                            <div className="flex flex-wrap items-end gap-x-1 gap-y-0.5">
                                <h2 className="text-3xl font-extrabold leading-none tracking-tight text-white">
                                    {`Hola, ${name}`}
                                </h2>
                                <span className="mb-[1px] text-[9px] font-semibold uppercase tracking-[0.08em] text-blue-100/75 sm:text-[10px]">
                                    {roleText}
                                </span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div
                                className="flex justify-center overflow-hidden"
                                style={{
                                    maxHeight: `${Math.round(38 * compactAmount)}px`,
                                    opacity: compactAmount
                                }}
                            >
                                <div className="flex max-w-full flex-col items-center gap-px">
                                    <div className="inline-flex max-w-full items-center gap-2">
                                        <span className="max-w-[130px] truncate text-[16px] font-black leading-none tracking-tight text-white sm:max-w-[180px] sm:text-[17px]">
                                            {name}
                                        </span>

                                        <span className="h-1 w-1 rounded-full bg-blue-100/70" />

                                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-blue-100/86 sm:text-[11px]">
                                            {roleText}
                                        </span>
                                    </div>

                                    <span
                                        className={`max-w-[220px] truncate text-[9px] font-semibold leading-none sm:max-w-[300px] sm:text-[10px] ${compactSecondaryIsDate ? 'uppercase tracking-[0.08em] text-blue-100/78' : 'text-blue-100/83'}`}
                                    >
                                        {compactSecondaryText}
                                    </span>
                                </div>
                            </div>

                            <div
                                className="overflow-hidden"
                                style={{
                                    maxHeight: `${Math.round(96 * (1 - compactAmount))}px`,
                                    opacity: 1 - compactAmount,
                                    transform: `translateY(${-8 * compactAmount}px)`
                                }}
                            >
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-end gap-x-1 gap-y-0.5">
                                        <h2 className="text-3xl font-extrabold leading-none tracking-tight text-white">
                                            {name}
                                        </h2>
                                        <span className="mb-[1px] text-[9px] font-semibold uppercase tracking-[0.08em] text-blue-100/75 sm:text-[10px]">
                                            {roleText}
                                        </span>
                                    </div>

                                    <div className="flex min-w-0 items-center text-xs font-semibold text-blue-100/85">
                                        {normalizedSchoolName && (
                                            <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                                                <School size={13} className="opacity-80" />
                                                <span className="max-w-[220px] truncate sm:max-w-[300px]">{normalizedSchoolName}</span>
                                            </span>
                                        )}

                                        {!normalizedSchoolName && (
                                            <span className="uppercase tracking-[0.08em]">{displayDate}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div
                    className="flex flex-col"
                    style={{
                        marginTop: `${stepperMarginTop}px`,
                        rowGap: `${2 + ((1 - compactAmount) * 4)}px`
                    }}
                >
                    <div className="flex items-center gap-2">
                        {HEADER_PHASES.map((segment, idx) => {
                            const isActive = idx === phase.index;
                            const isCompleted = idx < phase.index;
                            const isUpcoming = idx > phase.index;
                            const SegmentIcon = getPhaseIcon(segment.id);
                            const segmentFillColor = isActive
                                ? 'rgba(255,255,255,0.96)'
                                : (isCompleted ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.30)');
                            const segmentFillShadow = isActive
                                ? '0 0 0 1px rgba(255,255,255,0.4), 0 0 12px rgba(255,255,255,0.72), 0 0 24px rgba(56,189,248,0.55), inset 0 1px 0 rgba(255,255,255,0.35)'
                                : (isCompleted
                                    ? 'inset 0 1px 0 rgba(255,255,255,0.28)'
                                    : 'inset 0 1px 0 rgba(255,255,255,0.12)');
                            const iconColor = isActive
                                ? 'rgba(255,255,255,0.98)'
                                : (isCompleted ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)');
                            const iconBottomSpacing = 2 + ((1 - compactAmount) * 2);
                            return (
                                <div key={segment.id} className="flex-1">
                                    <div className="flex justify-center" style={{ marginBottom: `${iconBottomSpacing}px` }}>
                                        <SegmentIcon
                                            className="h-[19px] w-[19px] sm:h-[20px] sm:w-[20px]"
                                            strokeWidth={2.05}
                                            style={{
                                                ...transitionStyle,
                                                color: iconColor,
                                                opacity: isUpcoming ? 0.9 : 1,
                                                filter: isActive
                                                    ? 'drop-shadow(0 0 7px rgba(255,255,255,0.9)) drop-shadow(0 0 10px rgba(56,189,248,0.55))'
                                                    : 'none'
                                            }}
                                        />
                                    </div>
                                    <div
                                        className="h-2 w-full rounded-full p-px"
                                        style={{
                                            backgroundColor: 'rgba(255,255,255,0.17)',
                                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.11), inset 0 -1px 0 rgba(8,25,74,0.18)'
                                        }}
                                    >
                                        <div
                                            className="h-full w-full rounded-full transition-all ease-out"
                                            style={{
                                                ...transitionStyle,
                                                backgroundColor: segmentFillColor,
                                                boxShadow: segmentFillShadow,
                                                opacity: isUpcoming ? 0.95 : 1
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div
                        className="grid grid-cols-5 gap-2"
                        style={{
                            minHeight: `${Math.round(8 + ((1 - compactAmount) * 4))}px`,
                            paddingTop: `${Math.max(0, 1.5 - compactAmount)}px`
                        }}
                    >
                        {HEADER_PHASES.map((segment, idx) => (
                            <div key={`${segment.id}-label`} className="min-w-0 text-center">
                                {idx === phase.index && (
                                    <span className="inline-block truncate text-[9px] font-black uppercase tracking-[0.1em] text-white/92 sm:text-[10px]">
                                        {segment.chipLabel}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                </div>

                {hasBottomStatus && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-[-12px] z-20 flex justify-center sm:bottom-[-11px]">
                        <span className="relative inline-flex items-center gap-1.5 px-1.5" style={{ opacity: bottomStatusOpacity }}>
                            <span
                                aria-hidden="true"
                                className="animate-wait-status-focus pointer-events-none absolute -inset-x-2 top-1/2 h-3 rounded-full blur-[6px]"
                                style={{
                                    background:
                                        'linear-gradient(90deg, rgba(186,230,253,0) 0%, rgba(186,230,253,0.76) 50%, rgba(186,230,253,0) 100%)'
                                }}
                            />
                            <span className="relative flex h-2.5 w-2.5 items-center justify-center rounded-full border border-white/55">
                                <span className="animate-wait-status-dot h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.95)]" />
                            </span>
                            <span className="relative text-[10px] font-extrabold tracking-[0.02em] text-white drop-shadow-[0_1px_12px_rgba(186,230,253,0.42)] sm:text-[11px]">
                                {resolvedBottomStatusText}
                            </span>
                        </span>
                    </div>
                )}
            </div>
        </header>
    );
});

export default HeaderOperativo;
