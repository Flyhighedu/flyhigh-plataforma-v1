export function swipeDestination({ index, count, dx, dy, elapsed, width }) {
    if (Math.abs(dx) < Math.abs(dy) * 1.5) return index;
    const fast = Math.abs(dx) > 30 && Math.abs(dx) / Math.max(elapsed, 1) > .5;
    if (!fast && Math.abs(dx) < Math.min(90, width * .22)) return index;
    return Math.max(0, Math.min(count - 1, index + (dx < 0 ? 1 : -1)));
}
