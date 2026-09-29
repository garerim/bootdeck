import { useState } from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { canPickPaths, pickFolder, pickProgram } from "@/platform/dialogs";

interface BrowseButtonProps {
  kind: "folder" | "program";
  /** Valeur actuelle du champ : la boîte de dialogue s'ouvre à cet endroit s'il existe. */
  value: string;
  onPicked: (path: string) => void;
  onError: (message: string) => void;
}

/** Bouton « Parcourir… » : ouvre le sélecteur natif. Absent dans un navigateur. */
export function BrowseButton({ kind, value, onPicked, onError }: BrowseButtonProps) {
  const [open, setOpen] = useState(false);
  if (!canPickPaths()) return null;

  const label = kind === "folder" ? "Browse for a folder" : "Browse for a program";

  async function browse() {
    setOpen(true);
    try {
      const path = kind === "folder" ? await pickFolder(value) : await pickProgram(value);
      if (path) onPicked(path); // null : l'utilisateur a annulé, on ne change rien
    } catch (error) {
      onError(`The file dialog couldn’t be opened: ${errorMessage(error)}`);
    } finally {
      setOpen(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      title={label}
      disabled={open}
      onClick={() => void browse()}
    >
      <FolderOpen />
    </Button>
  );
}
