import * as React from 'react';
import { extractFields, getForm, getFormName, getMissingIdError, groupRadios, type FormField } from './formFields';

const NUMERIC_TYPES = new Set(['number', 'range']);
const ORDERED_STRING_TYPES = new Set(['date', 'month', 'week', 'time', 'datetime-local']);

type FieldStatus = { problems: string[]; missing: boolean };

const quote = (value: string) => `"${value}"`;

/** Normalises the current value to a list of non-empty strings. */
function getValues(field: FormField): string[] {
    const { currentValue } = field;
    if (currentValue === undefined) return [];
    return (Array.isArray(currentValue) ? currentValue : [currentValue]).filter((v) => v !== '');
}

function isEmpty(field: FormField): boolean {
    return field.type === 'checkbox' ? !field.checked : getValues(field).length === 0;
}

/** Cheap, deterministic checks of the current value against the field's own constraints. */
function validate(field: FormField): FieldStatus {
    const status: FieldStatus = { problems: [], missing: false };
    if (field.disabled) return status;

    if (isEmpty(field)) {
        status.missing = field.required;
        return status;
    }
    if (field.type === 'checkbox') return status;

    const values = getValues(field);
    const { rules } = field;

    if (field.options?.length) {
        const allowed = new Set(field.options.map((o) => o.value));
        for (const v of values) if (!allowed.has(v)) status.problems.push(`${quote(v)} is not an allowed value`);
    }

    // Text-like constraints only apply to single-valued controls.
    const [value] = values;
    if (values.length !== 1 || field.options) return status;

    if (rules.minLength !== undefined && value.length < rules.minLength) {
        status.problems.push(`shorter than min length ${rules.minLength}`);
    }
    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        status.problems.push(`longer than max length ${rules.maxLength}`);
    }
    if (rules.pattern !== undefined) {
        try {
            if (!new RegExp(`^(?:${rules.pattern})$`).test(value)) {
                status.problems.push(`does not match pattern /${rules.pattern}/`);
            }
        } catch {
            // Invalid pattern in the source form: nothing meaningful to check.
        }
    }

    if (NUMERIC_TYPES.has(field.type)) {
        const n = Number(value);
        if (Number.isNaN(n)) {
            status.problems.push('not a number');
        } else {
            if (rules.min !== undefined && n < Number(rules.min)) status.problems.push(`below min ${rules.min}`);
            if (rules.max !== undefined && n > Number(rules.max)) status.problems.push(`above max ${rules.max}`);
        }
    } else if (ORDERED_STRING_TYPES.has(field.type)) {
        // ISO-like formats sort lexicographically.
        if (rules.min !== undefined && value < rules.min) status.problems.push(`before min ${rules.min}`);
        if (rules.max !== undefined && value > rules.max) status.problems.push(`after max ${rules.max}`);
    }
    return status;
}

function describeValue(field: FormField): string {
    if (field.disabled) return '(disabled, untouched)';
    if (field.type === 'checkbox') return field.checked ? 'checked' : 'unchecked';

    const values = getValues(field);
    if (values.length === 0) return '(empty)';

    const labelOf = (v: string) => {
        const label = field.options?.find((o) => o.value === v)?.label;
        return label && label !== v ? `${quote(v)} (${label})` : quote(v);
    };
    return values.map(labelOf).join(', ');
}

function describeField(field: FormField, index: number): { line: string; status: FieldStatus } {
    const title = field.label ?? field.name ?? field.id ?? `Field ${index + 1}`;
    // Radio groups are addressed by their shared name; everything else by id.
    const ident = field.type === 'radio' ? (field.name ?? field.id) : field.id;
    const status = validate(field);

    const flags: string[] = [];
    if (status.missing) flags.push('required, missing');
    for (const problem of status.problems) flags.push(`invalid: ${problem}`);

    const line =
        `${index + 1}. ${title}` +
        (ident ? ` (${field.type === 'radio' ? 'name' : 'id'}: ${ident})` : '') +
        ` = ${describeValue(field)}` +
        (flags.length ? `  [${flags.join('; ')}]` : '');
    return { line, status };
}

/**
 * Keys the agent can update (field ids, radio groups by name) and how many required
 * fields are still missing / invalid. Used to constrain tool arguments and to detect completion.
 */
export function getFormSummary(children: React.ReactNode): { fieldKeys: string[]; missing: number; invalid: number } {
    const form = getForm(children);
    if (!form) return { fieldKeys: [], missing: 0, invalid: 0 };
    const fields = groupRadios(extractFields(form));
    const statuses = fields.map((f) => validate(f));
    return {
        fieldKeys: fields
            .filter((f) => !f.disabled)
            .map((f) => (f.type === 'radio' ? (f.name ?? f.id) : f.id))
            .filter((k): k is string => !!k),
        missing: statuses.filter((s) => s.missing).length,
        invalid: statuses.filter((s) => s.problems.length > 0).length,
    };
}

/**
 * Builds a message describing the *current* state of the form passed as `children`,
 * meant to be sent back to the agent after its values were applied so it can verify
 * them or make corrections. Pairs with `buildSystemPrompt`, which describes the form itself.
 *
 * Expects `children` to be a single <form> element (validate with `getFormError` first).
 *
 * Values are read from React props (`value`, `checked`, `defaultValue`, `defaultChecked`,
 * `<option selected>`), so the form must be controlled: values the agent set must be
 * rendered back as props. Uncontrolled inputs whose value only lives in the DOM, and inputs
 * hidden inside custom components, cannot be seen from the element tree.
 */
export function buildFormStateMessage(children: React.ReactNode): string {
    const form = getForm(children);
    if (!form) return '';

    const rawFields = extractFields(form);
    const idError = getMissingIdError(rawFields);
    if (idError) {
        console.error(`[AgenticFoo] ${idError}`);
        throw new Error(idError);
    }
    const fields = groupRadios(rawFields);
    const formName = getFormName(form);

    const sections = [formName ? `# Current state of form: ${formName}` : '# Current state of form'];

    if (fields.length === 0) {
        sections.push('This form has no fillable fields.');
        return sections.join('\n\n');
    }

    const described = fields.map(describeField);
    sections.push(described.map((d) => d.line).join('\n'));

    const missing = described.filter((d) => d.status.missing).length;
    const invalid = described.filter((d) => d.status.problems.length > 0).length;
    sections.push(
        `Summary: ${fields.length} field${fields.length === 1 ? '' : 's'}, ` +
            `${missing} required field${missing === 1 ? '' : 's'} missing, ` +
            `${invalid} invalid.`,
    );

    sections.push(
        'Compare these values with the form definition and what the user told you. ' +
            'Reply with corrections for any wrong, missing or invalid fields, ' +
            'or confirm that the form is complete and correct.',
    );

    return sections.join('\n\n');
}
