import * as React from 'react';
import styles from './AgentFoo.module.css';
import { getFormError } from './utils/getFormError';
import { buildSystemPrompt } from './utils/buildSystemPrompt';
import { buildFormStateMessage } from './utils/buildFormStateMessage';
import { applyFormUpdates } from './utils/applyFormUpdates';
import { AgentChat } from './AgentChat';
import type { AgentHandler, ChatMessage } from './types';

type AgentFooProps = {
    children?: React.ReactNode;
    /**
     * Called for every user message in agent mode. Send the request to your model and
     * resolve with the reply (ask a question back via `message`) and any form `updates`.
     */
    onAgentTurn?: AgentHandler;
}

export function AgentFoo({ children, onAgentTurn }: AgentFooProps) {
    const [isAgentMode, setIsAgentMode] = React.useState(false);
    const [messages, setMessages] = React.useState<ChatMessage[]>([]);
    const [pending, setPending] = React.useState(false);
    const formContainerRef = React.useRef<HTMLDivElement>(null);
    const error = getFormError(children);
    // Empty string when `children` is not a valid form (see `error` above).
    const systemPrompt = React.useMemo(() => buildSystemPrompt(children), [children]);

    // Current form state, rebuilt whenever the form re-renders with new values.
    const formStateMessage = buildFormStateMessage(children);

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

    // Always read the latest values when a message is sent, not those from when the handler was created.
    const latest = React.useRef({ systemPrompt, formStateMessage });
    latest.current = { systemPrompt, formStateMessage };

    const handleSend = async (text: string) => {
        if (!onAgentTurn) return;

        const history: ChatMessage[] = [...messages, { role: 'user', content: text }];
        setMessages(history);
        setPending(true);

        try {
            // Only the newest user message carries the form state; older ones stay as typed.
            const request = history.map((m, i) =>
                i === history.length - 1
                    ? { ...m, content: `${m.content}\n\n${latest.current.formStateMessage}` }
                    : m,
            );
            const response = await onAgentTurn({ systemPrompt: latest.current.systemPrompt, messages: request });

            let note = '';
            const form = formContainerRef.current?.querySelector('form');
            if (response.updates && form) {
                const { unknown } = applyFormUpdates(form, response.updates);
                if (unknown.length) {
                    console.warn(`[AgentFoo] agent referenced unknown or disabled fields: ${unknown.join(', ')}`);
                    note = `\n\n(Could not set: ${unknown.join(', ')})`;
                }
            }
            setMessages([...history, { role: 'assistant', content: response.message + note }]);
        } catch (err) {
            console.error('[AgentFoo] agent request failed', err);
            setMessages([...history, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
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
            disabledReason={onAgentTurn ? undefined : 'No agent is connected. Pass an `onAgentTurn` handler to <AgentFoo>.'}
            onSend={handleSend}
        />}
    </section>;
}
