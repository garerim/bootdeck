import type { Preset } from "@/domain/preset/schema";

/**
 * Presets de démonstration : données de l'UI statique (Phase 2) et des tests.
 * Les ids sont fixes pour que les tests soient déterministes.
 */

const PROJECT = "~/Projects/my-saas";

export const demoPresets: Preset[] = [
  {
    id: "9e739fc5-bca2-4b41-9b84-db7669da4c1d",
    name: "Dev SaaS",
    description: "Next.js + Supabase",
    icon: "🧑‍💻",
    variables: [],
    items: [
      {
        id: "76146a7a-7ae5-409c-825a-016404840bdb",
        type: "application",
        name: "VS Code",
        enabled: true,
        config: { path: "code", args: ["."], workingDirectory: PROJECT },
      },
      {
        id: "c4cdade5-799d-4c81-a963-281df4d63832",
        type: "application",
        name: "Terminal",
        enabled: true,
        config: { path: "wt", args: ["-d", "."], workingDirectory: PROJECT },
      },
      {
        id: "768378b8-dd29-456c-a678-16dae8fdc44c",
        type: "command",
        name: "Dev server",
        enabled: true,
        config: { command: "npm run dev", workingDirectory: PROJECT },
      },
      {
        id: "f0110ac9-eb57-480e-bb10-5597d485e6b4",
        type: "url",
        name: "localhost",
        enabled: true,
        config: { url: "http://localhost:3000" },
      },
      {
        id: "189e7ce8-2154-4d67-af14-a5920dae8bd4",
        type: "url",
        name: "Supabase",
        enabled: true,
        config: { url: "https://supabase.com/dashboard" },
      },
      {
        id: "254dc603-369f-42f2-88d6-a46e1f68a8a7",
        type: "url",
        name: "Vercel",
        enabled: true,
        config: { url: "https://vercel.com/dashboard" },
      },
      {
        id: "24640f48-0c29-48de-8c0c-fd2f2d943ea6",
        type: "url",
        name: "shadcn/ui",
        enabled: true,
        config: { url: "https://ui.shadcn.com" },
      },
    ],
    createdAt: "2026-09-20T09:15:00.000Z",
    updatedAt: "2026-09-27T17:42:00.000Z",
  },
  {
    id: "4bf56dcf-9d54-4851-ae08-633861ecf3b9",
    name: "Code Review",
    description: "Pull requests and branches",
    icon: "🔍",
    variables: [],
    items: [
      {
        id: "96815e8f-7f19-48e3-8f0e-3ce269e8601b",
        type: "command",
        name: "Fetch branches",
        enabled: true,
        config: { command: "git fetch --all --prune", workingDirectory: PROJECT },
      },
      {
        id: "785cfb61-c2ed-4163-83d9-efa000c0e0c3",
        type: "application",
        name: "VS Code",
        enabled: true,
        config: { path: "code", args: ["."], workingDirectory: PROJECT },
      },
      {
        id: "f02ae6a7-530f-4414-ba3b-9ae5c5b22c28",
        type: "url",
        name: "Review requests",
        enabled: true,
        config: { url: "https://github.com/pulls/review-requested" },
      },
    ],
    createdAt: "2026-09-22T08:00:00.000Z",
    updatedAt: "2026-09-22T08:00:00.000Z",
  },
  {
    id: "e9f5af43-745c-4dc0-9e0b-988ac953d804",
    name: "Design Handoff",
    icon: "🎨",
    variables: [],
    items: [
      {
        id: "c4e7db73-b4e5-425a-b62c-e77a751e3302",
        type: "url",
        name: "Figma",
        enabled: true,
        config: { url: "https://www.figma.com" },
      },
      {
        id: "2a4cbaf4-656f-45e8-b452-a1a1833695a9",
        type: "folder",
        name: "Assets",
        enabled: true,
        config: { path: "D:\\Design\\assets" },
      },
      {
        id: "98f170bc-baf3-447a-b5f6-803127fc2e8a",
        type: "url",
        name: "Storybook",
        enabled: false,
        config: { url: "http://localhost:6006" },
      },
    ],
    createdAt: "2026-09-25T14:30:00.000Z",
    updatedAt: "2026-09-26T10:05:00.000Z",
  },
  {
    id: "8cca43f7-81fe-4382-912c-9daadb45479e",
    name: "Next.js project",
    description: "Any project in ~/Projects, on any port",
    icon: "🚀",
    // Un seul preset pour tous les projets : les valeurs sont demandées au lancement.
    variables: [
      { key: "project", label: "Project", kind: "text", defaultValue: "my-saas" },
      { key: "project_path", label: "Project folder", kind: "path", defaultValue: "~/Projects/{project}" },
      { key: "port", kind: "port", defaultValue: "3000" },
    ],
    items: [
      {
        id: "d1247283-1c33-49a9-91c8-51b3409dfe73",
        type: "application",
        name: "VS Code",
        enabled: true,
        config: { path: "code", args: ["."], workingDirectory: "{project_path}" },
      },
      {
        id: "5ead34d7-fb67-4efd-8138-b9351d63f5f4",
        type: "command",
        name: "Dev server",
        enabled: true,
        config: { command: "npm run dev -- --port {port}", workingDirectory: "{project_path}" },
      },
      {
        id: "d7d473be-6c5d-4c14-98b9-605f9deb6415",
        type: "url",
        name: "App",
        enabled: true,
        config: { url: "http://localhost:{port}" },
      },
    ],
    createdAt: "2026-09-28T18:00:00.000Z",
    updatedAt: "2026-09-28T18:00:00.000Z",
  },
];
