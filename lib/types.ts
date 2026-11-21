export type ChatMessage = {
    role: 'user' | 'assistant';
    content: string;
};

/** A value the agent wants to put into a field. Use `boolean` for a lone checkbox, `string[]` for multi-selects / checkbox groups. */
export type FieldValue = string | string[] | boolean;

/** Field updates keyed by the field's `id` (or by `name` for a radio group). */
export type FormUpdates = Record<string, FieldValue>;
