import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { adminRoutes } from "../src/api/routes/admin.ts";
import { adminOperations } from "../src/tools/admin.ts";

test("the admin skill's grant table matches the routes' unattended grants and the admin tool's actions", () => {
  const skill = readFileSync("skills-seed/admin/SKILL.md", "utf8");
  const section = skill.slice(skill.indexOf("## Scheduling admin-reading work"));
  const documented = [
    ...section.matchAll(/^\| (?:`([a-z_]+)`|—)\s*\| `(GET \S+)`\s*\| `(admin\.[a-z]+\.read)`\s*\|$/gm),
  ].map(([, action, route, grant]) => `${action ?? "—"} ${route} -> ${grant}`);
  const declared = adminRoutes.flatMap((route) => {
    if (!("path" in route) || !route.admin?.unattended) return [];
    const action = Object.entries(adminOperations).find(
      ([, op]) => op.method === route.method && `/v1/admin${op.path}` === route.path,
    )?.[0];
    return [`${action ?? "—"} ${route.method} ${route.path} -> ${route.admin.unattended.grant}`];
  });
  assert.ok(declared.length > 0);
  assert.deepEqual([...documented].sort(), [...declared].sort());
});
