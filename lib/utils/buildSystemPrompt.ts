import * as React from 'react';
import { extractFields, getForm, getFormName, getMissingIdError, groupRadios, type FormField } from './formFields';

function describeField(field: FormField, index: number): string {
    const title = field.label ?? field.name ?? field.id ?? `Field ${index + 1}`;
    const lines = [`${index + 1}. ${title}`];

    // Radio groups share a name and have one id per radio (listed in the allowed values).
    const isRadioGroup = field.type === 'radio';
    if (!isRadioGroup && field.id) lines.push(`   - id: ${field.id} (use this as the key when setting the value)`);
    if (field.name) lines.push(`   - name: ${field.name}${isRadioGroup ? ' (use this as the key when setting the value)' : ''}`);

    const typeLabel = field.kind === 'input' ? `${field.type} input` : field.kind;
    lines.push(`   - type: ${typeLabel}`);
    lines.push(`   - required: ${field.required ? 'yes' : 'no'}`);

    if (field.disabled) lines.push('   - disabled: yes (do not fill)');
    if (field.placeholder) lines.push(`   - placeholder: "${field.placeholder}"`);
    if (field.defaultValue) lines.push(`   - default value: "${field.defaultValue}"`);
    if (field.constraints.length) lines.push(`   - constraints: ${field.constraints.join(', ')}`);

    if (field.options?.length) {
        const opts = field.options
            .map((o) => {
                const text = o.label && o.label !== o.value ? `"${o.value}" (${o.label})` : `"${o.value}"`;
                return isRadioGroup && o.id ? `${text} [id: ${o.id}]` : text;
            })
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
 * Throws (after logging to the console) when any field lacks an `id`.
 * Only host elements are inspected: inputs hidden inside custom components
 * (function/class components) cannot be seen from the element tree.
 */
export function buildSystemPrompt(children: React.ReactNode, tools: { name: string; description: string }[] = []): string {
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

    sections.push(
        '# How to respond\n' +
            'Every reply must be a tool call, never plain text:\n' +
            '- `update_form` to fill in values you know.\n' +
            '- `ask_user` when required information is missing or unclear.\n' +
            '- `finish` when the form is complete or there is nothing more you can do.\n' +
            'After `update_form` you receive the new form state; continue until the form is complete.',
    );

    if (tools.length) {
        sections.push(
            '# Other tools\n' +
                'You may also call these to look up information before filling the form:\n' +
                tools.map((t) => `- \`${t.name}\`: ${t.description}`).join('\n'),
        );
    }

    return sections.join('\n\n');
}
