import * as React from 'react';
import { cx } from './utils/cx';
import type { AgentFooClassNames, ChatMessage } from './types';

type AgentChatProps = {
    messages: ChatMessage[];
    pending: boolean;
    disabledReason?: string;
    onSend: (text: string) => void;
    classNames?: AgentFooClassNames;
};

/** Unstyled chat UI. Style it through `classNames` or the `data-agent-foo` attributes. */
export function AgentChat({ messages, pending, disabledReason, onSend, classNames: c = {} }: AgentChatProps) {
    const [draft, setDraft] = React.useState('');
    const logRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const log = logRef.current;
        if (log) log.scrollTop = log.scrollHeight;
    }, [messages, pending]);

    const disabled = pending || Boolean(disabledReason);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const text = draft.trim();
        if (!text || disabled) return;
        setDraft('');
        onSend(text);
    };

    return <div className={c.chat} data-agent-foo="chat">
        <div className={c.log} data-agent-foo="log" ref={logRef} role="log" aria-live="polite">
            {messages.length === 0 && (
                <p className={c.hint} data-agent-foo="hint">
                    Tell the agent what to put in the form, e.g. “My name is Ada and my email is ada@example.com”.
                </p>
            )}
            {messages.map((m, i) => (
                <div
                    key={i}
                    className={cx(c.message, m.role === 'user' ? c.userMessage : c.agentMessage)}
                    data-agent-foo="message"
                    data-role={m.role}
                >
                    {m.content}
                </div>
            ))}
            {pending && (
                <div className={cx(c.message, c.agentMessage, c.pending)} data-agent-foo="pending" data-role="assistant">
                    Thinking…
                </div>
            )}
        </div>
        {disabledReason && <p className={c.notice} data-agent-foo="notice">{disabledReason}</p>}
        <form className={c.composer} data-agent-foo="composer" onSubmit={submit}>
            <input
                className={c.input}
                data-agent-foo="input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Message the agent…"
                aria-label="Message the agent"
                disabled={disabled}
            />
            <button className={c.send} data-agent-foo="send" type="submit" disabled={disabled || !draft.trim()}>Send</button>
        </form>
    </div>;
}
