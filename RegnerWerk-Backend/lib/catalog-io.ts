/** Server-only: load taxonomy & group schemas from disk. */
import fs from "node:fs/promises";
import path from "node:path";
import { DATA_ROOT } from "./paths";
import type { GroupSchema, Taxonomy } from "./types";

const NORMALIZED = path.join(DATA_ROOT, "catalog", "normalized");

export async function loadTaxonomy(): Promise<Taxonomy> {
  return JSON.parse(
    await fs.readFile(path.join(NORMALIZED, "catalog_taxonomy.json"), "utf8"),
  ) as Taxonomy;
}

export async function loadGroupSchemas(): Promise<Map<string, GroupSchema>> {
  const raw = JSON.parse(
    await fs.readFile(path.join(NORMALIZED, "group_schemas.json"), "utf8"),
  ) as { groups: GroupSchema[] };
  return new Map(raw.groups.map((g) => [g.group_id, g]));
}
