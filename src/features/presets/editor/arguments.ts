/**
 * Conversion entre le champ texte « Arguments » du formulaire et le tableau
 * `args` du modèle.
 *
 * Règles volontairement simples, proches d'un terminal :
 * - les espaces séparent les arguments ;
 * - des guillemets doubles regroupent un argument qui contient des espaces ;
 * - l'antislash n'a AUCUN sens spécial, pour que `C:\Users\me` reste intact.
 *
 * Limite assumée : un argument contenant lui-même un guillemet double ne peut pas être saisi.
 */

export function parseArguments(text: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuotes = false;
  let inArgument = false;

  for (const char of text) {
    if (char === '"') {
      inQuotes = !inQuotes;
      inArgument = true; // "" produit un argument vide
    } else if (!inQuotes && /\s/.test(char)) {
      if (inArgument) args.push(current);
      current = "";
      inArgument = false;
    } else {
      current += char;
      inArgument = true;
    }
  }
  if (inArgument) args.push(current);
  return args;
}

export function formatArguments(args: readonly string[]): string {
  return args.map((arg) => (arg === "" || /\s/.test(arg) ? `"${arg}"` : arg)).join(" ");
}
