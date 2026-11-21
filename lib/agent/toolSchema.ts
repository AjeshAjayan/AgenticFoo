import type { ToolSchema, WireTool } from './types';
import { BUILTIN_TOOL_NAMES } from './builtinTools';

/** Converts a developer's tool schema to the format the OpenAI package expects. Drops `execute`. */
export function toOpenAITool(schema: ToolSchema): WireTool {
    const { name, description, parameters, strict } = schema;
    return {
        type: 'function',
        function: {
            name,
            description,
            parameters,
            ...(strict !== undefined && { strict }),
        },
    };
}

export function toOpenAITools(schemas: ToolSchema[]): WireTool[] {
    return schemas.map(toOpenAITool);
}

/** Returns a human-readable problem with the developer's tools, or null when they are all valid. */
export function getToolsError(tools: ToolSchema[] | undefined): string | null {
    if (!tools) return null;
    const seen = new Set<string>();
    for (const [i, tool] of tools.entries()) {
        const label = tool?.name ? `Tool "${tool.name}"` : `Tool at index ${i}`;
        if (!tool || typeof tool.name !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(tool.name)) {
            return `${label} needs a \`name\` of 1-64 letters, digits, underscores or dashes.`;
        }
        if (BUILTIN_TOOL_NAMES.has(tool.name)) return `${label} clashes with a built-in AgentFoo tool name.`;
        if (seen.has(tool.name)) return `${label} is defined more than once.`;
        seen.add(tool.name);
        if (!tool.description) return `${label} needs a \`description\`.`;
        if (tool.parameters?.type !== 'object') return `${label} needs \`parameters\` to be a JSON Schema with type "object".`;
        if (typeof tool.execute !== 'function') return `${label} needs an \`execute\` function.`;
    }
    return null;
}
