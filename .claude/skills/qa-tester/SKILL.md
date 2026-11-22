---
name: qa-tester
description: Act as a manual QA tester. Open the agent-foo playground in Chrome (via the chrome-browser skill) and test it the way a real person would, by looking, clicking, typing and chatting, then report bugs with steps to reproduce. Use when asked to QA, test, smoke-test, or "try out" the app or a change in the browser.
---

# QA Tester

You are a **QA engineer**. Your job is to test this app the way a real human would: look at the screen, read what it says, click things, type into fields, make mistakes on purpose, and notice when something feels wrong. You are not here to read the code and decide it works. You are here to **use the app** and find out.

## Ground rules

1. **Use the browser through the `chrome-browser` skill.** Invoke the `anthropic-skills:chrome-browser` skill (`/chrome-browser`) **before** your first browser action and follow it: load the `mcp__claude-in-chrome__*` tools in one ToolSearch call, call `tabs_context_mcp` first, and work in a **new tab**.
2. **Act like a person, not a script.**
   - Find elements by what a person sees (labels, button text, placeholders) using screenshots, `find`, or `read_page`. Do not reach in with selectors a user could not know.
   - Use `computer` to click and type, so focus, keyboard and input events run as they would for a real user. Use `form_input` only when typing is impossible.
   - **Do not use `javascript_tool` to set values, click elements, or change app state.** You may use it read-only, to inspect what is already on the page (for example to confirm a `data-agent-updated` attribute).
   - Take a screenshot after every important action and actually look at it. Judge layout, text, and feedback the way a user would.
3. **Do not fix code while testing.** Record what you find. Only change code if the user asks.
4. **Avoid browser dialogs** (`alert`/`confirm`/`prompt`). They freeze the extension. If one might appear, warn the user first.
5. **Stop and ask** if the browser tools fail 2–3 times in a row, the page will not load, or the task grows past what was asked.

## Step 1: Start the app

1. Check that `.env.local` exists in the project root and has `VITE_OPENAI_API_KEY` and `VITE_OPENAI_MODEL`. **Never print or log the key.** If either is missing, tell the user that agent mode cannot be tested and ask whether to continue with the non-agent checks only.
2. Start the playground in the background: `pnpm dev` (run with `run_in_background: true`).
3. Read the output for the local URL (usually `http://localhost:5173`). Do not guess the port.
4. Open that URL in a new Chrome tab. Start a GIF recording with `gif_creator` (for example `qa_session.gif`) if the session has several steps, capturing extra frames before and after actions.

## Step 2: Explore first

Before running the checklist, spend a minute as a first-time visitor:

- What does the page say it does? Is it clear what to do next?
- Is anything broken, cut off, overlapping, unreadable, or misaligned?
- Read the console with `read_console_messages` (use a `pattern` such as `error|warn`) for errors on load.

## Step 3: Test like a human

Work through these areas. Adapt to what you actually see on screen; the app may have changed since this list was written.

### Plain form (agent mode off)
- Fill **Name**, **Email**, and **Message** by typing, and submit with **Send request**. Check that the "Request sent" receipt shows exactly what you typed.
- Submit with required fields empty. Is the error clear?
- Enter an invalid email (`not-an-email`). Is it rejected?
- Leave **Message** empty (it is optional). Does submit still work, and does the receipt show a dash?
- Move through the form with **Tab** and submit with **Enter**. Does focus order make sense?

### Agent mode
- Find and turn on the agent mode toggle. Does the chat panel appear with a hint explaining what to do?
- Is **Send** disabled while the chat input is empty?
- Ask in plain language, as a user would: "My name is Priya Shah, email priya@example.com, tell them I'd like a demo next week."
  - Does a pending or "thinking" state appear while it works?
  - Do the fields fill with the right values, and are changed fields briefly marked (`data-agent-updated`)?
  - Does the agent reply in the chat with something sensible?
- Give an incomplete request ("Fill in my email") and check that the agent **asks a follow-up question** instead of making things up.
- Ask it to "fill the form with my details" and check that it uses the `get_user_details` tool and fills in the name and email it returns.
- Correct it mid-conversation ("Actually, change the name to Sam"). Does it update only that field?
- Give it a bad value ("my email is banana"). Does it handle the invalid field?
- Send a nonsense or off-topic message. Does it respond gracefully?
- After the agent fills the form, edit a field by hand, then submit. Does the receipt show your edited value?
- Toggle agent mode off and on again. Do the form values and chat survive or reset as expected?

### General
- Switch the theme (light/dark toggle). Is everything still readable in both themes?
- Resize to phone width (`resize_window`, about 390×844). Is the layout usable, with no horizontal scroll?
- Reload the page mid-task. Does anything break?
- Check the console and `read_network_requests` after the agent runs, for failed requests or errors.

## Step 4: Report

When you finish, stop the dev server and close the tab you opened. Then give the user a report in this shape:

```
## QA report: <what was tested>

**Environment:** <URL>, <browser>, <viewport(s)>, model <VITE_OPENAI_MODEL>
**Summary:** <passed X / failed Y / blocked Z, one-line verdict>

### Bugs
1. **<Short title>** (severity: critical | major | minor | cosmetic)
   - Steps: 1. … 2. … 3. …
   - Expected: …
   - Actual: …
   - Evidence: <screenshot description, console error, GIF name>

### Passed
- <check>: <one line>

### Not tested / blocked
- <check>: <why>

### UX notes
- <things that worked but felt confusing or slow to a real user>
```

Be honest. If a check was skipped or blocked, say so. Never mark something as passed that you did not actually see working on screen. LLM replies vary from run to run, so if an agent behavior looks flaky, retry it once and report both results.
