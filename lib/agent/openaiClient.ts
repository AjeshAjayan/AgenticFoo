import OpenAI from 'openai';
import type { AgentConfig, LLMClient } from './types';

/**
 * Talks to OpenAI straight from the browser. This is the ONLY file that imports `openai`.
 *
 * WARNING: `dangerouslyAllowBrowser` ships the API key to every visitor. Fine for local
 * development; before production replace this with a client that POSTs the same
 * `{ messages, tools }` to your backend, which calls OpenAI and returns the assistant message.
 */
export function createOpenAIClient({ apiKey, model }: AgentConfig): LLMClient {
    // OpenRouter exposes an OpenAI-compatible API and sends CORS headers, so it works from the browser.
    const openai = new OpenAI({
        apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        dangerouslyAllowBrowser: true,
        defaultHeaders: {
            'HTTP-Referer': typeof location !== 'undefined' ? location.origin : '',
            'X-Title': 'AgenticFoo',
        },
    });

    return {
        async createCompletion({ messages, tools, signal }) {
            const res = await openai.chat.completions.create(
                {
                    model,
                    messages: messages as any,
                    tools: tools as any,
                    tool_choice: 'required',
                    parallel_tool_calls: false,
                },
                { signal },
            );
            const message = res.choices[0].message;
            return {
                role: 'assistant',
                content: message.content,
                tool_calls: message.tool_calls
                    ?.filter((c) => c.type === 'function')
                    .map((c) => ({ id: c.id, type: 'function' as const, function: c.function })),
            };
        },
    };
}
