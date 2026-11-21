import * as React from 'react';
import styles from './AgentFoo.module.css';
import { getFormError } from './utils/getFormError';
import { buildSystemPrompt } from './utils/buildSystemPrompt';
import { buildFormStateMessage, getFormSummary } from './utils/buildFormStateMessage';
import { applyFormUpdates } from './utils/applyFormUpdates';
import { AgentChat } from './AgentChat';
import { runAgent } from './agent/runAgent';
import { createOpenAIClient } from './agent/openaiClient';
import { getToolsError } from './agent/toolSchema';
import type { AgentEvent, ToolSchema } from './agent/types';
import type { ChatMessage } from './types';

type AgentFooProps = {
    children?: React.ReactNode;
    /** OpenAI API key. Exposed to the browser for now; will move to a backend. */
    apiKey?: string;
    /** OpenAI model id, e.g. "gpt-4o". */
    model?: string;
    /** Tools the agent can call, e.g. to fetch user details. Each includes the function to run. */
    tools?: ToolSchema[];
}

/** Turns an agent event into a chat line, or null when it should not be shown. */
function describeEvent(event: AgentEvent): string | null {
    switch (event.type) {
        case 'question': return event.question;
        case 'done': return event.summary ?? 'The form is complete.';
        case 'error': return event.message;
        case 'tool_call': return event.error ? `(Tool ${event.name} failed: ${event.error})` : `(Used tool: ${event.name})`;
        case 'form_update': {
            const parts = [event.applied.length ? `Filled: ${event.applied.join(', ')}` : '', event.unknown.length ? `Could not set: ${event.unknown.join(', ')}` : ''];
            return `(${parts.filter(Boolean).join('. ')})`;
        }
    }
}

export function AgentFoo({ children, apiKey, model, tools }: AgentFooProps) {
    const [isAgentMode, setIsAgentMode] = React.useState(false);
    const [messages, setMessages] = React.useState<ChatMessage[]>([]);
    const [pending, setPending] = React.useState(false);
    const formContainerRef = React.useRef<HTMLDivElement>(null);
    const error = getFormError(children) ?? getToolsError(tools);
    // Empty string when `children` is not a valid form (see `error` above).
    const systemPrompt = React.useMemo(() => (error ? '' : buildSystemPrompt(children)), [children, error]);

    // Current form state, rebuilt whenever the form re-renders with new values.
    const formStateMessage = error ? '' : buildFormStateMessage(children);

    // Always read the latest values when a message is sent, not those from when the handler was created.
    const summary = error ? { fieldKeys: [], missing: 0, invalid: 0 } : getFormSummary(children);
    const latest = React.useRef({ systemPrompt, formStateMessage, summary });
    latest.current = { systemPrompt, formStateMessage, summary };

    const client = React.useMemo(
        () => (apiKey && model ? createOpenAIClient({ apiKey, model }) : null),
        [apiKey, model],
    );

    console.log('[AgentFoo] system prompt:', systemPrompt);
    console.log('[AgentFoo] form state message:', formStateMessage);

    React.useEffect(() => {
        if (error) {
            console.error(`[AgentFoo] ${error}`);
        }
    }, [error]);

    if (error) {
        return <section className={styles.wrapper} role="alert">
            <strong>AgentFoo error:</strong> {error}
        </section>;
    }

    const handleSend = async (text: string) => {
        const form = formContainerRef.current?.querySelector('form');
        if (!client || !form) return;

        const history: ChatMessage[] = [...messages, { role: 'user', content: text }];
        let shown = history;
        const show = (content: string) => {
            shown = [...shown, { role: 'assistant', content }];
            setMessages(shown);
        };
        setMessages(history);
        setPending(true);

        try {
            // Only the newest user message carries the form state; older ones stay as typed.
            const request = history.map((m, i) =>
                i === history.length - 1
                    ? { ...m, content: `${m.content}\n\n${latest.current.formStateMessage}` }
                    : m,
            );
            await runAgent({
                client,
                systemPrompt: latest.current.systemPrompt,
                messages: request,
                tools,
                fieldIds: latest.current.summary.fieldKeys,
                applyUpdates: (updates) => {
                    const result = applyFormUpdates(form, updates);
                    if (result.unknown.length) {
                        console.warn(`[AgentFoo] agent referenced unknown or disabled fields: ${result.unknown.join(', ')}`);
                    }
                    return result;
                },
                getFormState: () => latest.current.formStateMessage,
                isFormComplete: () => latest.current.summary.missing === 0 && latest.current.summary.invalid === 0,
                onEvent: (event) => {
                    const line = describeEvent(event);
                    if (line) show(line);
                },
            });
        } catch (err) {
            console.error('[AgentFoo] agent request failed', err);
            show('Sorry, something went wrong. Please try again.');
        } finally {
            setPending(false);
        }
    };

    return <section className={styles.wrapper}>
        <div className={styles.agentControlWrapper}>
            <button onClick={() => setIsAgentMode(!isAgentMode)}>
                {isAgentMode ? 'Exit Agent Mode' : 'Enter Agent Mode'}
            </button>
        </div>
        <div ref={formContainerRef}>
            {children}
        </div>
        {isAgentMode && <AgentChat
            messages={messages}
            pending={pending}
            disabledReason={client ? undefined : 'No agent is connected. Pass `apiKey` and `model` to <AgentFoo>.'}
            onSend={handleSend}
        />}
    </section>;
}
