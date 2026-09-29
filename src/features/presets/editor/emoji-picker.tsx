import { useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Sélection courte et curatée : garantit un emoji valide sans bibliothèque d'emojis. */
const EMOJIS = [
  "🧑‍💻", "💻", "🚀", "🛠️", "🔍", "🎨",
  "📝", "📚", "🧪", "🐛", "📦", "🗂️",
  "⚡", "🔥", "🌐", "📊", "🧠", "🎯",
  "☕", "🎧", "📅", "✉️", "🔒", "🧩",
];

interface EmojiPickerProps {
  id?: string;
  value: string;
  onChange: (emoji: string) => void;
}

export function EmojiPicker({ id, value, onChange }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  function select(emoji: string) {
    onChange(emoji);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" className="size-8 p-0 text-lg" aria-label="Choose icon">
          {value || <Smile className="text-muted-foreground" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-6 gap-1" role="listbox" aria-label="Icons">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="option"
              aria-selected={emoji === value}
              onClick={() => select(emoji)}
              className={cn(
                "grid size-9 place-items-center rounded-md text-lg outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                emoji === value && "bg-accent ring-1 ring-ring",
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
        {value && (
          <Button type="button" variant="ghost" size="sm" className="mt-1 w-full" onClick={() => select("")}>
            Remove icon
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
