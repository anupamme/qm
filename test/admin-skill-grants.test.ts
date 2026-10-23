import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { adminRoutes } from "../src/api/routes/admin.ts";

test("the admin skill's route-to-grant table matches the routes' unattended grants", () => {
  const skill = readFileSync("skills-seed/admin/SKILL.md", "utf8");
  const section = skill.slice(skill.indexOf("## Scheduling admin-reading work"));
  const documented = [...section.matchAll(/^\| `(GET \S+)`\s*\| `(admin\.[a-z]+\.read)`\s*\|$/gm)].map(
    ([, route, grant]) => `${route} -> ${grant}`,
  );
  const declared = adminRoutes.flatMap((route) =>
    "path" in route && route.admin?.unattended
      ? [`${route.method} ${route.path} -> ${route.admin.unattended.grant}`]
      : [],
  );
  assert.ok(declared.length > 0);
  assert.deepEqual([...documented].sort(), [...declared].sort());
});
