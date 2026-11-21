import { useState } from "react";
import { AgentFoo } from "../lib/AgentFoo";
import { defineTool } from "../lib/agent";

// Example developer tool: the model can call this to look up the signed-in user.
const getUserDetails = defineTool({
  name: "get_user_details",
  description: "Fetch the signed-in user's profile (name and email). Use it when the user asks to fill the form with their details.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  execute: async () => ({ name: "Ajesh Ajayan", email: "ajesh@example.com" }),
});

const tools = [getUserDetails];

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
    <AgentFoo
      apiKey={import.meta.env.VITE_OPENAI_API_KEY}
      model={import.meta.env.VITE_OPENAI_MODEL}
      tools={tools}
    >
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
