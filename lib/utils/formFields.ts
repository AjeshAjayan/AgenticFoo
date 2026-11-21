import * as React from 'react';

export type FormFieldOption = { value: string; label: string; selected?: boolean };

export type FormField = {
    kind: 'input' | 'textarea' | 'select';
    type: string;
    name?: string;
    id?: string;
    label?: string;
    placeholder?: string;
    required: boolean;
    disabled: boolean;
    /** The `defaultValue` / `value` prop as written (used to describe the form definition). */
    defaultValue?: string;
    options?: FormFieldOption[];
    constraints: string[];
    /** Raw constraint props, used to validate the current value. */
    rules: FieldRules;
    /** Current value read from props (`value`, falling back to `defaultValue` / selected options). */
    currentValue?: string | string[];
    /** Current state of checkboxes (and of an individual radio before grouping). */
    checked?: boolean;
};

export type FieldRules = {
    min?: string;
    max?: string;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
};

export type AnyProps = Record<string, any>;

const SKIPPED_INPUT_TYPES = new Set(['submit', 'reset', 'button', 'image', 'hidden']);

/** Flattens any renderable node (strings, numbers, nested elements) into plain text. */
export function getText(node: React.ReactNode): string {
    return React.Children.toArray(node)
        .map((child) => {
            if (typeof child === 'string' || typeof child === 'number') return String(child);
            if (React.isValidElement<AnyProps>(child)) return getText(child.props.children);
            return '';
        })
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Walks the element tree depth-first, calling `visit` on every element. */
export function walk(node: React.ReactNode, visit: (el: React.ReactElement<AnyProps>) => void) {
    React.Children.forEach(node, (child) => {
        if (!React.isValidElement<AnyProps>(child)) return;
        visit(child);
        walk(child.props.children, visit);
    });
}

export function str(value: unknown): string | undefined {
    return value === undefined || value === null || value === '' ? undefined : String(value);
}

/** Returns the `<form>` element when `children` is a single form, otherwise `undefined`. */
export function getForm(children: React.ReactNode): React.ReactElement<AnyProps> | undefined {
    const [form] = React.Children.toArray(children);
    return React.isValidElement<AnyProps>(form) && form.type === 'form' ? form : undefined;
}

export function getFormName(form: React.ReactElement<AnyProps>): string | undefined {
    return str(form.props.name) ?? str(form.props.id) ?? str(form.props['aria-label']);
}

function getOptions(select: React.ReactElement<AnyProps>): FormFieldOption[] {
    const options: FormFieldOption[] = [];
    walk(select.props.children, (el) => {
        if (el.type !== 'option') return;
        const label = getText(el.props.children);
        options.push({
            value: str(el.props.value) ?? label,
            label,
            selected: Boolean(el.props.selected),
        });
    });
    return options;
}

function getConstraints(props: AnyProps): string[] {
    const constraints: string[] = [];
    if (props.min !== undefined) constraints.push(`min ${props.min}`);
    if (props.max !== undefined) constraints.push(`max ${props.max}`);
    if (props.step !== undefined) constraints.push(`step ${props.step}`);
    if (props.minLength !== undefined) constraints.push(`min length ${props.minLength}`);
    if (props.maxLength !== undefined) constraints.push(`max length ${props.maxLength}`);
    if (props.pattern !== undefined) constraints.push(`must match pattern /${props.pattern}/`);
    if (props.multiple) constraints.push('multiple values allowed');
    return constraints;
}

function getRules(props: AnyProps): FieldRules {
    return {
        min: str(props.min),
        max: str(props.max),
        minLength: props.minLength === undefined ? undefined : Number(props.minLength),
        maxLength: props.maxLength === undefined ? undefined : Number(props.maxLength),
        pattern: str(props.pattern),
    };
}

function getCurrentValue(
    tag: FormField['kind'],
    props: AnyProps,
    options: FormFieldOption[] | undefined,
): string | string[] | undefined {
    const raw = props.value ?? props.defaultValue;

    if (tag !== 'select') return str(raw);

    if (props.multiple) {
        if (raw !== undefined) return (Array.isArray(raw) ? raw : [raw]).map(String);
        return options!.filter((o) => o.selected).map((o) => o.value);
    }
    if (raw !== undefined) return str(Array.isArray(raw) ? raw[0] : raw);
    // Like a browser: a single select shows its selected option, else the first one.
    return (options!.find((o) => o.selected) ?? options![0])?.value;
}

export function extractFields(form: React.ReactElement<AnyProps>): FormField[] {
    const labelsByFor = new Map<string, string>();
    const wrappedLabels = new Map<React.ReactElement, string>();

    // First pass: resolve labels (<label htmlFor> and <label> wrapping a control).
    walk(form.props.children, (el) => {
        if (el.type !== 'label') return;
        const text = getText(el.props.children);
        if (el.props.htmlFor) labelsByFor.set(el.props.htmlFor, text);
        walk(el.props.children, (inner) => {
            if (['input', 'textarea', 'select'].includes(inner.type as string)) {
                // Strip the control's own text (e.g. <option>s) from the label.
                const ownText = getText(inner.props.children);
                wrappedLabels.set(inner, ownText ? text.replace(ownText, '').trim() : text);
            }
        });
    });

    // Second pass: collect the controls.
    const fields: FormField[] = [];
    walk(form.props.children, (el) => {
        const tag = el.type;
        if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') return;

        const p = el.props;
        const type = tag === 'input' ? String(p.type ?? 'text') : tag;
        if (tag === 'input' && SKIPPED_INPUT_TYPES.has(type)) return;

        const options = tag === 'select' ? getOptions(el) : undefined;
        const isToggle = type === 'checkbox' || type === 'radio';

        fields.push({
            kind: tag,
            type,
            name: str(p.name),
            id: str(p.id),
            label: wrappedLabels.get(el) || (p.id && labelsByFor.get(p.id)) || str(p['aria-label']),
            placeholder: str(p.placeholder),
            required: Boolean(p.required),
            disabled: Boolean(p.disabled),
            defaultValue: str(p.defaultValue ?? p.value),
            options,
            constraints: getConstraints(p),
            rules: getRules(p),
            currentValue: getCurrentValue(tag, p, options),
            checked: isToggle ? Boolean(p.checked ?? p.defaultChecked) : undefined,
        });
    });
    return fields;
}

/**
 * Merges radio inputs sharing a `name` into a single field with options.
 * The group's `currentValue` is the value of the checked radio (if any).
 */
export function groupRadios(fields: FormField[]): FormField[] {
    const result: FormField[] = [];
    const groups = new Map<string, FormField>();

    for (const field of fields) {
        if (field.type !== 'radio' || !field.name) {
            result.push(field);
            continue;
        }
        const option = { value: field.defaultValue ?? field.label ?? '', label: field.label ?? '' };
        const existing = groups.get(field.name);
        if (existing) {
            existing.options!.push(option);
            existing.required ||= field.required;
            if (field.checked) existing.currentValue = option.value;
        } else {
            const group: FormField = {
                ...field,
                label: undefined,
                defaultValue: undefined,
                options: [option],
                currentValue: field.checked ? option.value : undefined,
                checked: undefined,
            };
            groups.set(field.name, group);
            result.push(group);
        }
    }
    return result;
}
