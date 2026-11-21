import * as React from 'react';

export function getFormError(children: React.ReactNode): string | null {
    const nodes = React.Children.toArray(children);

    if (nodes.length === 0) {
        return 'AgentFoo expects a <form> as its child, but received nothing.';
    }
    if (nodes.length > 1) {
        return `AgentFoo expects exactly one <form> child, but received ${nodes.length} children.`;
    }

    const [child] = nodes;
    if (!React.isValidElement(child) || child.type !== 'form') {
        return 'AgentFoo expects its child to be a <form> element.';
    }
    return null;
}
