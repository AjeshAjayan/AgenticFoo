import type { FormUpdates } from '../types';

/** JSON Schema describing a tool's arguments. OpenAI requires the root to be an object. */
export type ToolParameters = {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
    [key: string]: unknown;
};

/**
 * A tool the developer makes available to the agent (e.g. "fetch the user's details").
 * Everything except `execute` is sent to the model; `execute` runs in the app when the
 * model calls the tool, and its return value (JSON-serialisable) is given back to the model.
 */
export type ToolSchema<TArgs = any> = {
    /** Unique, snake_case-friendly name the model calls the tool by. */
    name: string;
    /** Tells the model what the tool does and when to use it. */
    description: string;
    /** JSON Schema of the arguments object. Use `{ type: 'object', properties: {} }` for none. */
    parameters: ToolParameters;
    /** Enable OpenAI strict schema adherence (requires `additionalProperties: false` and all properties `required`). */
    strict?: boolean;
    /** The function to run when the model calls this tool. */
    execute: (args: TArgs) => unknown | Promise<unknown>;
};

/** Identity helper that gives `execute` typed arguments. */
export function defineTool<TArgs = any>(tool: ToolSchema<TArgs>): ToolSchema<TArgs> {
    return tool;
}

// ---- Wire format (OpenAI chat-completions shape, kept free of any SDK import so it can move to a backend) ----

export type WireToolCall = {
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
};

export type WireMessage =
    | { role: 'system' | 'user'; content: string }
    | { role: 'assistant'; content: string | null; tool_calls?: WireToolCall[] }
    | { role: 'tool'; tool_call_id: string; content: string };

/** A tool in the format OpenAI expects. Produced by `toOpenAITool`. */
export type WireTool = {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: ToolParameters;
        strict?: boolean;
    };
};

export type CompletionRequest = {
    messages: WireMessage[];
    tools: WireTool[];
    signal?: AbortSignal;
};

/** The only thing `runAgent` needs from a model provider. Swap the implementation to move to a backend. */
export type LLMClient = {
    createCompletion(request: CompletionRequest): Promise<Extract<WireMessage, { role: 'assistant' }>>;
};

export type AgentConfig = {
    apiKey: string;
    model: string;
};

/** What the agent loop reports back to the UI. */
export type AgentEvent =
    | { type: 'question'; question: string; fieldId?: string }
    | { type: 'form_update'; updates: FormUpdates; applied: string[]; unknown: string[] }
    | { type: 'tool_call'; name: string; args: unknown; result?: unknown; error?: string }
    | { type: 'done'; summary?: string }
    | { type: 'error'; message: string };
