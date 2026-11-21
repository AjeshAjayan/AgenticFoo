import * as React from 'react';
import { extractFields, getForm, getFormName, groupRadios, type FormField } from './formFields';

function describeField(field: FormField, index: number): string {
    const title = field.label ?? field.name ?? field.id ?? `Field ${index + 1}`;
    const lines = [`${index + 1}. ${title}`];

    if (field.name) lines.push(`   - name: ${field.name}`);
    if (field.id && field.id !== field.name) lines.push(`   - id: ${field.id}`);

    const typeLabel = field.kind === 'input' ? `${field.type} input` : field.kind;
    lines.push(`   - type: ${typeLabel}`);
    lines.push(`   - required: ${field.required ? 'yes' : 'no'}`);

    if (field.disabled) lines.push('   - disabled: yes (do not fill)');
    if (field.placeholder) lines.push(`   - placeholder: "${field.placeholder}"`);
    if (field.defaultValue) lines.push(`   - default value: "${field.defaultValue}"`);
    if (field.constraints.length) lines.push(`   - constraints: ${field.constraints.join(', ')}`);

    if (field.options?.length) {
        const opts = field.options
            .map((o) => (o.label && o.label !== o.value ? `"${o.value}" (${o.label})` : `"${o.value}"`))
            .join(', ');
        lines.push(`   - allowed values: ${opts}`);
    }
    return lines.join('\n');
}

/**
 * Builds a system prompt describing the form passed as `children`,
 * by extracting its inputs, textareas and selects.
 *
 * Expects `children` to be a single <form> element (validate with `getFormError` first).
 * Only host elements are inspected: inputs hidden inside custom components
 * (function/class components) cannot be seen from the element tree.
 */
export function buildSystemPrompt(children: React.ReactNode): string {
    const form = getForm(children);
    if (!form) return '';

    const fields = groupRadios(extractFields(form));
    const formName = getFormName(form);

    const sections = [
        'You are an assistant that helps the user fill out a web form. ' +
            'Use the form definition below to understand what information is needed, ' +
            'ask the user for any missing details, and supply values that respect each field\'s type, ' +
            'constraints and allowed values.',
        formName ? `# Form: ${formName}` : '# Form',
    ];

    if (fields.length === 0) {
        sections.push('This form has no fillable fields.');
    } else {
        sections.push(`The form has ${fields.length} field${fields.length === 1 ? '' : 's'}:`);
        sections.push(fields.map(describeField).join('\n\n'));
    }

    sections.push(
        '# Rules\n' +
            '- Always provide a value for required fields.\n' +
            '- Never invent values for fields the user has not given you; ask instead.\n' +
            '- For fields with allowed values, use exactly one of those values.\n' +
            '- Leave disabled fields untouched.',
    );

    return sections.join('\n\n');
}
