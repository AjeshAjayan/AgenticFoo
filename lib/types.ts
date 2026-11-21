export type ChatMessage = {
    role: 'user' | 'assistant';
    content: string;
};

/** A value the agent wants to put into a field. Use `boolean` for a lone checkbox, `string[]` for multi-selects / checkbox groups. */
export type FieldValue = string | string[] | boolean;

/** Field updates keyed by the field's `id` (or by `name` for a radio group). */
export type FormUpdates = Record<string, FieldValue>;

export type AgentRequest = {
    /** Describes the form and the rules the agent must follow (see `buildSystemPrompt`). */
    systemPrompt: string;
    /**
     * The conversation so far. The latest user message has the current form state
     * (see `buildFormStateMessage`) appended so the agent can see what is filled in.
     */
    messages: ChatMessage[];
};

export type AgentResponse = {
    /** Shown in the chat. Use it to ask the user a question when information is missing. */
    message: string;
    /** Values to write into the form. Omit when the agent only needs to ask a question. */
    updates?: FormUpdates;
};

/** Bridges AgentFoo to a model. Typically calls your backend, which calls the LLM. */
export type AgentHandler = (request: AgentRequest) => Promise<AgentResponse>;
