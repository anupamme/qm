import { test } from "node:test";
import assert from "node:assert/strict";
import { DELETE_RESERVED_ENV_KEYS_MIGRATION } from "../src/credentials/keychain.ts";

const URL = process.env.DATABASE_URL;
const skip = URL ? false : "set DATABASE_URL (a Postgres) to run the keychain reserved-env-key migration test";

test(
  "deleting reserved-key credentials removes every AGENT_* spelling and its grants, and is idempotent",
  { skip },
  async () => {
    const pg = (await import("pg")).default;
    const pool = new pg.Pool({ connectionString: URL });
    try {
      await pool.query("DROP TABLE IF EXISTS keychain_credentials, keychain_grants");
      for (const sql of DELETE_RESERVED_ENV_KEYS_MIGRATION.statements.slice(0, 2)) await pool.query(sql);
      const reserved = {
        envKey: { kind: "env", service: "x", envKey: "AGENT_API_URL" },
        fieldKey: { kind: "env", service: "db", fields: [{ envKey: "DB_USER" }, { envKey: "AGENT_API_TOKEN" }] },
        derivedKey: { kind: "env", service: "agent-foo" },
        derivedBareKey: { kind: "env", service: "agent" },
      };
      const kept = {
        derivedNoSeparator: { kind: "env", service: "agentx" },
        github: { kind: "env", service: "github", envKey: "GITHUB_TOKEN" },
        fields: { kind: "env", service: "db", fields: [{ envKey: "DB_USER" }, { envKey: "DB_PASS" }] },
        explicitKey: { kind: "env", service: "agent-x", envKey: "AGENTX_TOKEN" },
        longerPrefix: { kind: "env", service: "x", envKey: "AGENTIC_TOKEN" },
        file: { kind: "file", service: "agent-foo", targets: [".ssh/id"] },
        connector: { kind: "env", service: "agent-foo", managed: "connector", host: "agent-foo.test" },
      };
      for (const [id, json] of Object.entries({ ...reserved, ...kept }))
        await pool.query("INSERT INTO keychain_credentials (id, json) VALUES ($1, $2)", [
          id,
          JSON.stringify({ id, ownerId: "alice", ...json }),
        ]);
      for (const [id, credentialId] of [
        ["g-envKey", "envKey"],
        ["g-derivedKey", "derivedKey"],
        ["g-github", "github"],
      ])
        await pool.query("INSERT INTO keychain_grants (id, json) VALUES ($1, $2)", [
          id,
          JSON.stringify({ id, credentialId, ownerId: "alice" }),
        ]);

      for (const run of [1, 2]) {
        for (const sql of DELETE_RESERVED_ENV_KEYS_MIGRATION.statements) await pool.query(sql);
        const credentials = (await pool.query("SELECT id FROM keychain_credentials ORDER BY id")).rows.map((r) => r.id);
        assert.deepEqual(credentials, Object.keys(kept).toSorted(), `run ${run}`);
        const grants = (await pool.query("SELECT id FROM keychain_grants ORDER BY id")).rows.map((r) => r.id);
        assert.deepEqual(grants, ["g-github"], `run ${run}`);
      }
    } finally {
      await pool.end();
    }
  },
);
