/** Joins class names, skipping empty values. Returns undefined when there are none, so no empty `class` attribute is rendered. */
export function cx(...names: (string | false | null | undefined)[]): string | undefined {
    const joined = names.filter(Boolean).join(' ');
    return joined || undefined;
}
