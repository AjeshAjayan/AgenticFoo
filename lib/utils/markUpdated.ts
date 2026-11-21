export const UPDATED_ATTRIBUTE = 'data-agent-updated';

const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

function unmark(el: HTMLElement, className?: string) {
    el.removeAttribute(UPDATED_ATTRIBUTE);
    if (className) el.classList.remove(...className.split(/\s+/).filter(Boolean));
}

/**
 * Flags controls the agent just changed with `data-agent-updated` (and `className`, if given)
 * for `duration` ms. Adds no styles: the host app decides what the flag looks like.
 * Re-marking an already-flagged element restarts it, so CSS animations replay.
 * Returns a function that clears every flag set by this call.
 */
export function markUpdated(
    elements: HTMLElement[],
    { className, duration }: { className?: string; duration: number },
): () => void {
    const classes = className?.split(/\s+/).filter(Boolean) ?? [];
    for (const el of elements) {
        clearTimeout(timers.get(el));
        unmark(el, className);
        // Force a reflow so a running animation restarts when the attribute comes back.
        void el.offsetWidth;
        el.setAttribute(UPDATED_ATTRIBUTE, '');
        if (classes.length) el.classList.add(...classes);
        timers.set(el, setTimeout(() => {
            unmark(el, className);
            timers.delete(el);
        }, duration));
    }
    return () => {
        for (const el of elements) {
            clearTimeout(timers.get(el));
            timers.delete(el);
            unmark(el, className);
        }
    };
}
