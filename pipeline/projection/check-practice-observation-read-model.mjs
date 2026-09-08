import assert from "node:assert/strict";
import {
  PRACTICE_SELECTION_CONDITIONS,
  listPracticeObservations,
  shapePracticeObservation,
} from "../../functions/_lib/practice-observation-read-model.js";

const row = {
  projection_id: "main",
  evidence_id: "2026-04-22-spotify-honk-part-4",
  observation_id: "dependency-lineage-targeting",
  producer: "Spotify",
  source_title: "Honk Part 4",
  source_date: "2026-04-22",
  source_url: "https://example.com/honk",
  github_path: "evidence/2026-04-22-spotify-honk-part-4.yaml",
  use_case: "Identify repositories affected by a downstream dataset migration.",
  problem: "The migration system must know which repositories consume the changed dataset.",
  reported_practice: "Use dependency lineage to identify downstream consumers.",
  conditions_json: JSON.stringify(["context", "coordination"]),
};

const observation = shapePracticeObservation(row);
assert.deepEqual(observation, {
  id: "dependency-lineage-targeting",
  projection_id: "main",
  evidence_id: "2026-04-22-spotify-honk-part-4",
  company: "Spotify",
  use_case: row.use_case,
  problem: row.problem,
  reported_practice: row.reported_practice,
  selection_conditions: ["context", "coordination"],
  evidence: {
    title: "Honk Part 4",
    date: "2026-04-22",
    url: "https://example.com/honk",
    github_path: "evidence/2026-04-22-spotify-honk-part-4.yaml",
  },
});

assert.deepEqual(PRACTICE_SELECTION_CONDITIONS, [
  "context",
  "execution",
  "verification",
  "coordination",
  "observability",
  "economics",
  "learning",
]);

function fakeEnv(rows) {
  const calls = [];
  return {
    calls,
    EVIDENCE_DB: {
      prepare(query) {
        const call = { query, params: [] };
        calls.push(call);
        return {
          bind(...params) {
            call.params = params;
            return this;
          },
          async all() {
            return { results: rows };
          },
        };
      },
    },
  };
}

let env = fakeEnv([row]);
let observations = await listPracticeObservations(env, {}, 100, "main");
assert.equal(observations.length, 1);
assert.deepEqual(env.calls[0].params, ["main", 100]);
assert.match(env.calls[0].query, /p\.projection_id = \?/);
assert.match(env.calls[0].query, /ORDER BY e\.source_date DESC, p\.evidence_id ASC, p\.observation_id ASC/);

env = fakeEnv([row]);
observations = await listPracticeObservations(env, { condition: "context" }, 50, "deadbeefcafe");
assert.equal(observations.length, 1);
assert.deepEqual(env.calls[0].params, ["deadbeefcafe", "context", 50]);
assert.match(env.calls[0].query, /practice_observation_conditions/);
assert.match(env.calls[0].query, /c\.condition = \?/);

console.log("Practice observation D1 read model contract is stable");
