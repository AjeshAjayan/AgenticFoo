import { useState } from "react";
import { AgenticFoo, type AgenticFooClassNames } from "../lib/AgenticFoo";
import { defineTool } from "../lib/agent";
import { ThemeSwitch } from "./ThemeSwitch";

// Example developer tool: the model can call this to look up the signed-in user.
const getUserDetails = defineTool({
  name: "get_user_details",
  description: "Fetch the signed-in user's profile (name and email). Use it when the user asks to fill the form with their details.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
  execute: async () => ({ name: "Ajesh Ajayan", email: "ajesh@example.com" }),
});

const tools = [getUserDetails];

// AgenticFoo ships no styles. The playground passes a few class names to show the prop;
// everything else is styled through the `data-agentic-foo` attributes in styles.css.
const classNames: AgenticFooClassNames = {
  root: "workspace",
  formContainer: "sheet",
  chat: "notes",
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
    <main className="page">
      <div className="topbar">
        <ThemeSwitch />
      </div>
      <header className="intro">
        <h1>Fill this form by telling it what to write.</h1>
        <p>
          Turn on agent mode and describe what you want. Each field the agent fills is
          marked as it lands, so you can check its work.
        </p>
      </header>

      <AgenticFoo
        apiKey={import.meta.env.VITE_OPENAI_API_KEY}
        model={import.meta.env.VITE_OPENAI_MODEL}
        tools={tools}
        classNames={classNames}
      >
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" name="name" type="text" autoComplete="name" required {...bind("name")} />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required {...bind("email")} />
          </div>
          <div className="field">
            <label htmlFor="message">Message <span className="optional">optional</span></label>
            <textarea id="message" name="message" rows={4} {...bind("message")} />
          </div>
          <button type="submit" className="submit">Send request</button>
        </form>
      </AgenticFoo>

      {submitted && (
        <section className="receipt" aria-live="polite">
          <h2>Request sent</h2>
          <dl>
            {Object.entries(submitted).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </main>
  );
}
