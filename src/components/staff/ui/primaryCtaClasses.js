export const PRIMARY_CTA_BASE_CLASSES = 'inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 text-base font-extrabold leading-none tracking-wide transition-all duration-200 active:scale-[0.99]';

export const PRIMARY_CTA_ENABLED_CLASSES = 'bg-sky-600 text-white shadow-[0_14px_28px_-18px_rgba(2,132,199,0.6)] hover:bg-sky-700';

export const PRIMARY_CTA_DISABLED_CLASSES = 'cursor-not-allowed bg-slate-200 text-slate-400 opacity-80';

export function getPrimaryCtaClasses(disabled, extraClasses = '') {
    return `${PRIMARY_CTA_BASE_CLASSES} ${disabled ? PRIMARY_CTA_DISABLED_CLASSES : PRIMARY_CTA_ENABLED_CLASSES} ${extraClasses}`.trim();
}
