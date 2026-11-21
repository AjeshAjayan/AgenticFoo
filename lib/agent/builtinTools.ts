import type { WireTool } from './types';

export const ASK_USER = 'ask_user';
export const UPDATE_FORM = 'update_form';
export const FINISH = 'finish';

export const BUILTIN_TOOL_NAMES = new Set([ASK_USER, UPDATE_FORM, FINISH]);

/**
 * Tools every agent has. They are how the model answers: each turn must call one of these
 * (or a developer tool), so the response is always structured.
 */
export function getBuiltinTools(fieldIds: string[]): WireTool[] {
    return [
        {
            type: 'function',
            function: {
                name: UPDATE_FORM,
                description: 'Set values on form fields. Only use values the user provided or that a tool returned.',
                parameters: {
                    type: 'object',
                    properties: {
                        updates: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: {
                                        type: 'string',
                                        description: 'Field id (or radio group name).',
                                        ...(fieldIds.length && { enum: fieldIds }),
                                    },
                                    value: {
                                        anyOf: [{ type: 'string' }, { type: 'boolean' }, { type: 'array', items: { type: 'string' } }],
                                        description: 'String for text/select/radio, boolean for a lone checkbox, string[] for multi-selects.',
                                    },
                                },
                                required: ['id', 'value'],
                                additionalProperties: false,
                            },
                        },
                    },
                    required: ['updates'],
                    additionalProperties: false,
                },
            },
        },
        {
            type: 'function',
            function: {
                name: ASK_USER,
                description: 'Ask the user for information that is missing or unclear. The conversation pauses until they reply.',
                parameters: {
                    type: 'object',
                    properties: {
                        question: { type: 'string' },
                        field_id: { type: ['string', 'null'], description: 'The field the question is about, if any.' },
                    },
                    required: ['question', 'field_id'],
                    additionalProperties: false,
                },
            },
        },
        {
            type: 'function',
            function: {
                name: FINISH,
                description: 'Call when there is nothing more to do. Summarise what was done.',
                parameters: {
                    type: 'object',
                    properties: { summary: { type: 'string' } },
                    required: ['summary'],
                    additionalProperties: false,
                },
            },
        },
    ];
}
