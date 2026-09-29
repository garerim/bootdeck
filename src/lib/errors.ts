/** Message lisible pour une erreur de type inconnu (`catch (error)` reçoit `unknown`). */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
