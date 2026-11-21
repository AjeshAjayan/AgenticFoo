import * as React from 'react';
import styles from './AgentFoo.module.css';
import type { ChatMessage } from './types';

type AgentChatProps = {
    messages: ChatMessage[];
    pending: boolean;
    disabledReason?: string;
    onSend: (text: string) => void;
};

export function AgentChat({ messages, pending, disabledReason, onSend }: AgentChatProps) {
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

    return <div className={styles.chat}>
        <div className={styles.chatLog} ref={logRef} role="log" aria-live="polite">
            {messages.length === 0 && (
                <p className={styles.chatHint}>
                    Tell the agent what to put in the form, e.g. “My name is Ada and my email is ada@example.com”.
                </p>
            )}
            {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? styles.userMessage : styles.agentMessage}>
                    {m.content}
                </div>
            ))}
            {pending && <div className={styles.agentMessage}>Thinking…</div>}
        </div>
        {disabledReason && <p className={styles.chatNotice}>{disabledReason}</p>}
        <form className={styles.chatInput} onSubmit={submit}>
            <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Message the agent…"
                aria-label="Message the agent"
                disabled={disabled}
            />
            <button type="submit" disabled={disabled || !draft.trim()}>Send</button>
        </form>
    </div>;
}
