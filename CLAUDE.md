# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@ajeshajayan/agentic-foo-react`: a React component (`<AgenticFoo>`) that wraps a single `<form>` and adds an "agent mode" where users fill the form by chatting with an LLM. Early development; see README.md for usage and props.

## Commands

- `pnpm install`
- `pnpm dev`: runs the Vite playground (`vite playground`). Needs `.env.local` with `VITE_OPENAI_API_KEY` and `VITE_OPENAI_MODEL` (e.g. `openai/gpt-4o`).
- There is no test, lint, or build script configured. Type-check with `npx tsc --noEmit -p tsconfig.json` if needed.

## Architecture

- `lib/AgenticFoo.tsx` wires everything: it validates `children` (`utils/getFormError.ts`), extracts fields from the **React element tree** (`utils/formFields.ts`, not the DOM, so only host `input`/`textarea`/`select` elements are discoverable, and every field requires an `id`), builds the system prompt (`utils/buildSystemPrompt.ts`), and renders `AgentChat`.
- `lib/agent/runAgent.ts` is the provider-independent agent loop. It depends only on the `LLMClient` interface (`createCompletion({ messages, tools, signal })`). The model must answer with a tool call every turn. The loop ends on `ask_user`, `finish`, a complete form (required fields filled, none invalid), or `maxSteps` (default 10).
- `lib/agent/builtinTools.ts` defines the built-ins `update_form`, `ask_user`, and `finish`. `update_form` writes values straight into the DOM inputs via `utils/applyFormUpdates.ts`, and the agent then receives fresh state from `utils/buildFormStateMessage.ts`.
- `lib/agent/toolSchema.ts` validates developer tools (created with `defineTool`) and converts them to the wire format. Tool names must not clash with the built-ins.
- `lib/agent/openaiClient.ts` is the **only** file that imports `openai`. It calls OpenRouter from the browser with `dangerouslyAllowBrowser: true`, which exposes the API key, so it is for local development only. Production is meant to swap in an `LLMClient` that POSTs to a backend.
- `lib/` ships **no CSS or inline styles**; it must stay style-agnostic. Every rendered element takes a class from the `classNames` prop (`AgenticFooClassNames` in `lib/types.ts`) and carries a `data-agentic-foo="<slot>"` attribute. Fields the agent just changed get `data-agent-updated` for `highlightDuration` ms (`utils/markUpdated.ts`). Visual design belongs in the host app.
- `playground/` is the Vite demo app and is not part of the library; its design lives in `playground/styles.css`.
