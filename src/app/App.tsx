import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isDesktop } from "@/platform/runtime";

function App() {
  return (
    <main className="flex h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Workspace Presets</h1>
      <p className="text-sm text-muted-foreground">
        Runtime: {isDesktop() ? "desktop (Tauri)" : "browser"}
      </p>
      <Button disabled>
        <Plus data-icon="inline-start" />
        Create preset
      </Button>
    </main>
  );
}

export default App;
