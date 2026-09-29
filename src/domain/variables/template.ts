/**
 * Modèles de texte avec variables : `~/Projects/{project}`.
 *
 * Règles :
 * - `{nom}` est une variable si `nom` s'écrit en minuscules, chiffres et `_` ;
 * - `{{` et `}}` produisent des accolades littérales (échappement) ;
 * - toute autre accolade reste telle quelle : `{"a": 1}` ou `${HOME}` (majuscules)
 *   ne sont pas des variables, pour ne pas gêner JSON et les shells.
 */

export const VARIABLE_NAME_PATTERN = /^[a-z_][a-z0-9_]*$/;

// Ordre important : les échappements sont reconnus avant les variables.
const TOKEN = /\{\{|\}\}|\{([a-z_][a-z0-9_]*)\}/g;

export type TemplatePart = { type: "text"; value: string } | { type: "variable"; name: string };

export function parseTemplate(template: string): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let text = "";
  let cursor = 0;
  for (const match of template.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    text += template.slice(cursor, index);
    cursor = index + match[0].length;
    if (match[0] === "{{") text += "{";
    else if (match[0] === "}}") text += "}";
    else {
      if (text) parts.push({ type: "text", value: text });
      text = "";
      parts.push({ type: "variable", name: match[1] ?? "" });
    }
  }
  text += template.slice(cursor);
  if (text) parts.push({ type: "text", value: text });
  return parts;
}

/** Variables utilisées, sans doublon, dans l'ordre d'apparition. */
export function templateVariables(template: string): string[] {
  const names = parseTemplate(template).flatMap((part) => (part.type === "variable" ? [part.name] : []));
  return [...new Set(names)];
}

export function hasVariables(template: string): boolean {
  return templateVariables(template).length > 0;
}

export type RenderResult = { ok: true; value: string } | { ok: false; missing: string[] };

/** Remplace les variables par leur valeur. Une variable sans valeur n'est JAMAIS laissée telle quelle. */
export function renderTemplate(template: string, values: Readonly<Record<string, string>>): RenderResult {
  const missing = new Set<string>();
  let value = "";
  for (const part of parseTemplate(template)) {
    if (part.type === "text") {
      value += part.value;
    } else if (Object.prototype.hasOwnProperty.call(values, part.name)) {
      // Et non `part.name in values` : « constructor » serait trouvé sur tout objet JavaScript.
      value += values[part.name];
    } else {
      missing.add(part.name);
    }
  }
  return missing.size > 0 ? { ok: false, missing: [...missing] } : { ok: true, value };
}

/** `{project}, {port}` */
export function formatVariableList(names: readonly string[]): string {
  return names.map((name) => `{${name}}`).join(", ");
}
