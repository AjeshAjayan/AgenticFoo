import * as React from 'react';
import { getFormError } from './utils/getFormError';
import { buildSystemPrompt } from './utils/buildSystemPrompt';
import { buildFormStateMessage, getFormSummary } from './utils/buildFormStateMessage';
import { applyFormUpdates } from './utils/applyFormUpdates';
import { markUpdated } from './utils/markUpdated';
import { AgentChat } from './AgentChat';
import { runAgent } from './agent/runAgent';
import { createOpenAIClient } from './agent/openaiClient';
import { getToolsError } from './agent/toolSchema';
import type { AgentEvent, ToolSchema } from './agent/types';
import type { AgenticFooClassNames, ChatMessage } from './types';

export type { AgenticFooClassNames };

type AgenticFooProps = {
    children?: React.ReactNode;
    /** OpenAI API key. Exposed to the browser for now; will move to a backend. */
    apiKey?: string;
    /** OpenAI model id, e.g. "gpt-4o". */
    model?: string;
    /** Tools the agent can call, e.g. to fetch user details. Each includes the function to run. */
    tools?: ToolSchema[];
    /**
     * Class names for the elements AgenticFoo renders. AgenticFoo ships no styles: use this, or target
     * the `data-agentic-foo="<slot>"` attributes, to apply your app's design.
     */
    classNames?: AgenticFooClassNames;
    /** How long (ms) a field keeps `data-agent-updated` after the agent changes it. Default 1600. */
    highlightDuration?: number;
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

export function AgenticFoo({ children, apiKey, model, tools, classNames: c = {}, highlightDuration = 1600 }: AgenticFooProps) {
    const [isAgentMode, setIsAgentMode] = React.useState(false);
    const [messages, setMessages] = React.useState<ChatMessage[]>([]);
    const [pending, setPending] = React.useState(false);
    const formContainerRef = React.useRef<HTMLDivElement>(null);
    // Clears field highlights that are still showing when AgenticFoo unmounts.
    const clearHighlights = React.useRef(new Set<() => void>());
    React.useEffect(() => () => {
        for (const clear of clearHighlights.current) clear();
    }, []);
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

    console.log('[AgenticFoo] system prompt:', systemPrompt);
    console.log('[AgenticFoo] form state message:', formStateMessage);

    React.useEffect(() => {
        if (error) {
            console.error(`[AgenticFoo] ${error}`);
        }
    }, [error]);

    if (error) {
        return <section className={c.root} data-agentic-foo="root">
            <p className={c.error} data-agentic-foo="error" role="alert">
                <strong>AgenticFoo error:</strong> {error}
            </p>
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
                    const clear = markUpdated(result.elements, { className: c.updatedField, duration: highlightDuration });
                    clearHighlights.current.add(clear);
                    setTimeout(() => clearHighlights.current.delete(clear), highlightDuration);
                    if (result.unknown.length) {
                        console.warn(`[AgenticFoo] agent referenced unknown or disabled fields: ${result.unknown.join(', ')}`);
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
            console.error('[AgenticFoo] agent request failed', err);
            show('Sorry, something went wrong. Please try again.');
        } finally {
            setPending(false);
        }
    };

    return <section
        className={c.root}
        data-agentic-foo="root"
        data-mode={isAgentMode ? 'agent' : 'form'}
        data-pending={pending || undefined}
    >
        <div className={c.toolbar} data-agentic-foo="toolbar">
            <button
                type="button"
                className={c.toggle}
                data-agentic-foo="toggle"
                aria-pressed={isAgentMode}
                onClick={() => setIsAgentMode(!isAgentMode)}
            >
                {isAgentMode ? 'Exit Agent Mode' : 'Enter Agent Mode'}
            </button>
        </div>
        <div className={c.formContainer} data-agentic-foo="form-container" ref={formContainerRef}>
            {children}
        </div>
        {isAgentMode && <AgentChat
            messages={messages}
            pending={pending}
            disabledReason={client ? undefined : 'No agent is connected. Pass `apiKey` and `model` to <AgenticFoo>.'}
            onSend={handleSend}
            classNames={c}
        />}
    </section>;
}
