export type ChatMessage = {
    role: 'user' | 'assistant';
    content: string;
};

/** A value the agent wants to put into a field. Use `boolean` for a lone checkbox, `string[]` for multi-selects / checkbox groups. */
export type FieldValue = string | string[] | boolean;

/** Field updates keyed by the field's `id` (or by `name` for a radio group). */
export type FormUpdates = Record<string, FieldValue>;

/**
 * Optional class names for each element AgenticFoo renders. AgenticFoo ships no styles of its own;
 * every element also carries a stable `data-agentic-foo="<slot>"` attribute you can target instead.
 */
export type AgenticFooClassNames = Partial<Record<
    | 'root'
    | 'toolbar'
    | 'toggle'
    | 'formContainer'
    | 'error'
    | 'chat'
    | 'log'
    | 'hint'
    /** Every chat bubble. `userMessage` / `agentMessage` are added on top. */
    | 'message'
    | 'userMessage'
    | 'agentMessage'
    | 'pending'
    | 'notice'
    | 'composer'
    | 'input'
    | 'send'
    /** Added (with `data-agent-updated`) to a form control for a moment after the agent changes it. */
    | 'updatedField',
    string
>>;
