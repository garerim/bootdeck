/**
 * Suit le thème clair/sombre du système : ajoute ou retire la classe `dark`
 * sur `<html>`, maintenant et à chaque changement de réglage de l'OS.
 */
export function followSystemTheme(): void {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => document.documentElement.classList.toggle("dark", query.matches);
  apply();
  query.addEventListener("change", apply);
}
