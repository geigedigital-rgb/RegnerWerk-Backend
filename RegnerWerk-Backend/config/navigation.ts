import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Bot,
  Briefcase,
  ClipboardList,
  FolderKanban,
  GitBranch,
  Inbox,
  LayoutDashboard,
  ListTodo,
  MessageSquareText,
  Package,
  Phone,
  PhoneCall,
  Radio,
  ScrollText,
  ShieldAlert,
  Sparkles,
  TestTube2,
  Users,
  Wrench,
} from "lucide-react";

export type WorkspaceId = "produkte" | "projekte" | "crm" | "ai";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  tzRef?: string;
};

export type NavGroup = {
  id: string;
  label?: string;
  items: NavItem[];
};

export type WorkspaceConfig = {
  id: WorkspaceId;
  label: string;
  href: string;
  description: string;
  accent: "neutral" | "ai";
  groups: NavGroup[];
};

export const WORKSPACES: WorkspaceConfig[] = [
  {
    id: "produkte",
    label: "Produkte",
    href: "/produkte",
    description: "Katalog",
    accent: "neutral",
    groups: [
      {
        id: "main",
        items: [{ href: "/produkte", label: "Katalog", icon: Package }],
      },
    ],
  },
  {
    id: "projekte",
    label: "Projekte",
    href: "/projekte",
    description: "Sofort",
    accent: "neutral",
    groups: [
      {
        id: "main",
        items: [
          {
            href: "/projekte",
            label: "Sofort-Projekte",
            icon: FolderKanban,
          },
        ],
      },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    href: "/crm",
    description: "Kunden",
    accent: "neutral",
    groups: [
      {
        id: "alltag",
        label: "Alltag",
        items: [
          { href: "/crm", label: "Übersicht", icon: LayoutDashboard, tzRef: "§7.1" },
          { href: "/crm/inbox", label: "Inbox", icon: Inbox, tzRef: "§7.2" },
          { href: "/crm/leads", label: "Leads", icon: ClipboardList, tzRef: "§7.3" },
          { href: "/crm/kunden", label: "Kunden", icon: Users, tzRef: "§7.4" },
          { href: "/crm/aufgaben", label: "Aufgaben", icon: ListTodo, tzRef: "§7.8" },
        ],
      },
      {
        id: "verkauf",
        label: "Verkauf & Bau",
        items: [
          { href: "/crm/pipeline", label: "Pipeline", icon: GitBranch, tzRef: "§7.5" },
          {
            href: "/crm/montageprojekte",
            label: "Montage",
            icon: Briefcase,
            tzRef: "§7.6",
          },
          { href: "/crm/service", label: "Service", icon: Wrench, tzRef: "§7.7" },
        ],
      },
    ],
  },
  {
    id: "ai",
    label: "KI-Assistent",
    href: "/ai",
    description: "Empfang",
    accent: "ai",
    groups: [
      {
        id: "betrieb",
        label: "Betrieb",
        items: [
          { href: "/ai", label: "Übersicht", icon: Sparkles, tzRef: "§8.1" },
          { href: "/ai/live", label: "Live", icon: Radio, tzRef: "§8.1" },
          { href: "/ai/anrufe", label: "Anrufe", icon: PhoneCall, tzRef: "§8.1" },
          { href: "/ai/telefonie", label: "Verbindung", icon: Phone, tzRef: "§8.4" },
        ],
      },
      {
        id: "texte",
        label: "Texte",
        items: [
          {
            href: "/ai/prompts",
            label: "Prompts",
            icon: MessageSquareText,
            tzRef: "§13",
          },
          {
            href: "/ai/regeln",
            label: "Stop-Regeln",
            icon: ShieldAlert,
            tzRef: "§16",
          },
          { href: "/ai/wissen", label: "Wissen", icon: BookOpen, tzRef: "§14" },
          { href: "/ai/test-lab", label: "Test Lab", icon: TestTube2, tzRef: "§18" },
        ],
      },
      {
        id: "releases",
        label: "Releases",
        items: [
          { href: "/ai/assistenten", label: "Assistent", icon: Bot, tzRef: "§8.2" },
          {
            href: "/ai/szenarien",
            label: "Szenarien",
            icon: GitBranch,
            tzRef: "§15",
          },
          {
            href: "/ai/versionen",
            label: "Historie",
            icon: ScrollText,
            tzRef: "§8.4",
          },
        ],
      },
    ],
  },
];

export function resolveWorkspaceFromPath(pathname: string): WorkspaceId {
  if (pathname.startsWith("/produkte") || pathname.startsWith("/products")) {
    return "produkte";
  }
  if (pathname.startsWith("/projekte") || pathname.startsWith("/projects")) {
    return "projekte";
  }
  if (pathname.startsWith("/crm")) return "crm";
  if (pathname.startsWith("/ai")) return "ai";
  return "crm";
}

export function workspaceFromPath(pathname: string): WorkspaceId {
  return resolveWorkspaceFromPath(pathname);
}

export function getWorkspace(id: WorkspaceId): WorkspaceConfig {
  return WORKSPACES.find((w) => w.id === id) ?? WORKSPACES[2];
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/crm" || href === "/ai" || href === "/produkte" || href === "/projekte") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
