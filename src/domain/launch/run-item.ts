import type { ItemRunEvent } from "@/domain/launch/item-run";
import type { ProcessEvent, SystemAdapter } from "@/domain/launch/system-adapter";
import type { PresetItem } from "@/domain/preset/schema";
import { errorMessage } from "@/lib/errors";

/**
 * Exécute un item et décrit ce qui se passe sous forme d'événements.
 * Ne lève jamais d'exception : un échec devient un événement `failed`.
 */
export async function runItem(
  item: PresetItem,
  system: SystemAdapter,
  emit: (event: ItemRunEvent) => void,
): Promise<void> {
  emit({ type: "started" });
  try {
    switch (item.type) {
      case "url":
        await system.openUrl(item.config.url);
        emit({ type: "succeeded" });
        return;
      case "folder":
        await system.openFolder(item.config.path);
        emit({ type: "succeeded" });
        return;
      case "application":
        await system.launchApplication({
          path: item.config.path,
          args: item.config.args,
          workingDirectory: item.config.workingDirectory,
        });
        emit({ type: "succeeded" });
        return;
      case "command": {
        // On n'attend pas la fin : un serveur de dev tourne indéfiniment.
        // Le statut reste « running » jusqu'à l'événement `exited`.
        const processId = await system.executeCommand(
          { command: item.config.command, workingDirectory: item.config.workingDirectory },
          (event) => emit(toItemRunEvent(event)),
        );
        emit({ type: "process-started", processId });
        return;
      }
    }
  } catch (error) {
    emit({ type: "failed", error: errorMessage(error) });
  }
}

function toItemRunEvent(event: ProcessEvent): ItemRunEvent {
  return event.type === "exited"
    ? { type: "exited", code: event.code }
    : { type: "output", line: { stream: event.type, text: event.line } };
}
