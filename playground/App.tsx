import { useState } from "react";
import { AgentFoo } from "../lib/AgentFoo";
import type { AgentHandler } from "../lib/types";

// Stand-in for a real model call: pulls an email out of the message and asks for whatever is still missing.
const mockAgent: AgentHandler = async ({ messages }) => {
  await new Promise((r) => setTimeout(r, 400));
  const text = messages.map((m) => m.content.split("\n\n#")[0]).join(" ");
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0];
  const name = text.match(/(?:my name is|i am|i'm)\s+([A-Z][a-z]+)/i)?.[1];
  const updates = { ...(name && { name }), ...(email && { email }) };
  if (!name) return { message: "What is your name?", updates };
  if (!email) return { message: `Thanks ${name}. What is your email address?`, updates };
  return { message: "I filled in your name and email. Anything you want to add as a message?", updates };
};

export default function App() {
  const [values, setValues] = useState({ name: "", email: "", message: "" });
  const bind = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value })),
  });
  const [submitted, setSubmitted] = useState<Record<string, string> | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setSubmitted(Object.fromEntries(data) as Record<string, string>);
  };

  return (
    <AgentFoo onAgentTurn={mockAgent}>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">Name</label>
          <input id="name" name="name" type="text" required {...bind("name")} />
        </div>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required {...bind("email")} />
        </div>
        <div>
          <label htmlFor="message">Message</label>
          <textarea id="message" name="message" rows={4} {...bind("message")} />
        </div>
        <button type="submit">Submit</button>
      </form>
      {submitted && <pre>{JSON.stringify(submitted, null, 2)}</pre>}
    </AgentFoo>
  );
}
