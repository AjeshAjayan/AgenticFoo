import type { FormUpdates } from '../types';

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export type ApplyResult = {
    applied: string[];
    /** Keys that matched no enabled field in the form. */
    unknown: string[];
};

function isControl(el: Element): el is Control {
    return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
}

/**
 * React tracks the value of controlled inputs, so assigning `el.value` directly is ignored.
 * Going through the prototype setter and dispatching a real event makes React (and any
 * plain `onChange` / `onInput` listener) see the change, controlled or not.
 */
function setNativeValue(el: Control, value: string) {
    const proto =
        el instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : el instanceof HTMLSelectElement
              ? HTMLSelectElement.prototype
              : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
}

const toList = (value: string | string[] | boolean): string[] =>
    Array.isArray(value) ? value.map(String) : [String(value)];

function applyToControls(controls: Control[], value: string | string[] | boolean) {
    const [first] = controls;

    if (first instanceof HTMLInputElement && first.type === 'radio') {
        const wanted = String(value);
        const target = (controls as HTMLInputElement[]).find((r) => r.value === wanted);
        // click() toggles state and fires the events React listens to.
        if (target && !target.checked) target.click();
        return;
    }

    if (first instanceof HTMLInputElement && first.type === 'checkbox') {
        const boxes = controls as HTMLInputElement[];
        const wanted = Array.isArray(value) || boxes.length > 1 ? toList(value) : null;
        for (const box of boxes) {
            const desired = wanted ? wanted.includes(box.value) : value === true || value === 'true';
            if (box.checked !== desired) box.click();
        }
        return;
    }

    if (first instanceof HTMLSelectElement && first.multiple) {
        const wanted = toList(value);
        for (const option of Array.from(first.options)) option.selected = wanted.includes(option.value);
        first.dispatchEvent(new Event('change', { bubbles: true }));
        return;
    }

    const text = Array.isArray(value) ? value.join(', ') : String(value);
    setNativeValue(first, text);
    first.dispatchEvent(new Event(first instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

/** Writes the agent's `updates` into the rendered `<form>`, firing the events a user's edit would. */
export function applyFormUpdates(form: HTMLFormElement, updates: FormUpdates): ApplyResult {
    const controls = Array.from(form.elements).filter(isControl);
    const result: ApplyResult = { applied: [], unknown: [] };

    for (const [key, value] of Object.entries(updates)) {
        const matches = controls.filter(
            (c) => !c.disabled && c.type !== 'file' && (c.name === key || c.id === key),
        );
        if (matches.length === 0) {
            result.unknown.push(key);
            continue;
        }
        applyToControls(matches, value);
        result.applied.push(key);
    }
    return result;
}
