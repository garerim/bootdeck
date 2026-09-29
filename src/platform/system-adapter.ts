import type { SystemAdapter } from "@/domain/launch/system-adapter";
import { createMockSystemAdapter } from "@/platform/mock/mock-system-adapter";
import { isDesktop } from "@/platform/runtime";
import { tauriSystemAdapter } from "@/platform/tauri/tauri-system-adapter";

/** Le vrai système dans l'app desktop, une simulation dans un navigateur. */
export function createSystemAdapter(): SystemAdapter {
  return isDesktop() ? tauriSystemAdapter : createMockSystemAdapter();
}
