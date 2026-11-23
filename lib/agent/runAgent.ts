import type { FormUpdates } from '../types';
import { ASK_USER, FINISH, UPDATE_FORM, getBuiltinTools } from './builtinTools';
import { toOpenAITools } from './toolSchema';
import type { AgentEvent, LLMClient, ToolSchema, WireMessage } from './types';

export type RunAgentOptions = {
    client: LLMClient;
    systemPrompt: string;
    /** Conversation so far; the latest user message should already carry the form state. */
    messages: WireMessage[];
    /** Developer-defined tools. */
    tools?: ToolSchema[];
    /** Ids the model may update (used to constrain `update_form`). */
    fieldIds: string[];
    /** Writes values into the form. */
    applyUpdates: (updates: FormUpdates) => { applied: string[]; unknown: string[] };
    /** Current form state text, read fresh after every update. */
    getFormState: () => string;
    /** True when every required field is filled and nothing is invalid. */
    isFormComplete: () => boolean;
    onEvent: (event: AgentEvent) => void;
    signal?: AbortSignal;
    /** Safety cap on model round-trips per user message. */
    maxSteps?: number;
};

/** Lets React re-render after the form was changed, so `getFormState` sees the new values. */
const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const toolResult = (tool_call_id: string, payload: unknown): WireMessage => ({
    role: 'tool',
    tool_call_id,
    content: typeof payload === 'string' ? payload : JSON.stringify(payload ?? null),
});

/**
 * Runs the agent until it asks the user something, finishes, fills the form, or hits `maxSteps`.
 * Independent of any SDK: it only talks to the `LLMClient`.
 */
export async function runAgent(options: RunAgentOptions): Promise<void> {
    const { client, systemPrompt, tools = [], onEvent, signal, maxSteps = 10 } = options;
    const wireTools = [...getBuiltinTools(options.fieldIds), ...toOpenAITools(tools)];
    const executors = new Map(tools.map((t) => [t.name, t]));
    const messages: WireMessage[] = [{ role: 'system', content: systemPrompt }, ...options.messages];

    for (let step = 0; step < maxSteps; step++) {
        if (signal?.aborted) return;

        const reply = await client.createCompletion({ messages, tools: wireTools, signal });
        messages.push(reply);

        const call = reply.tool_calls?.[0];
        if (!call) {
            // tool_choice is "required", so this should not happen; treat any text as a question.
            onEvent({ type: 'question', question: reply.content ?? 'Could you tell me more?' });
            return;
        }

        let args: any;
        try {
            args = JSON.parse(call.function.arguments || '{}');
        } catch {
            messages.push(toolResult(call.id, { error: 'Arguments were not valid JSON. Try again.' }));
            continue;
        }

        const { name } = call.function;

        if (name === ASK_USER) {
            onEvent({ type: 'question', question: args.question, fieldId: args.field_id ?? undefined });
            return;
        }

        if (name === FINISH) {
            onEvent({ type: 'done', summary: args.summary });
            return;
        }

        if (name === UPDATE_FORM) {
            const updates: FormUpdates = {};
            for (const { id, value } of args.updates ?? []) updates[id] = value;
            const { applied, unknown } = options.applyUpdates(updates);
            onEvent({ type: 'form_update', updates, applied, unknown });
            await nextTick();
            messages.push(toolResult(call.id, { applied, unknown, formState: options.getFormState() }));
            if (options.isFormComplete()) {
                onEvent({ type: 'done' });
                return;
            }
            continue;
        }

        const tool = executors.get(name);
        if (!tool) {
            messages.push(toolResult(call.id, { error: `Unknown tool "${name}".` }));
            continue;
        }
        try {
            const result = await tool.execute(args);
            onEvent({ type: 'tool_call', name, args, result });
            messages.push(toolResult(call.id, result));
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            console.error(`[AgenticFoo] tool "${name}" failed`, err);
            onEvent({ type: 'tool_call', name, args, error });
            messages.push(toolResult(call.id, { error }));
        }
    }

    onEvent({ type: 'error', message: `The agent did not finish within ${maxSteps} steps.` });
}
