import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  evaluateFixture,
  parseFixtureFile,
  scoreEvaluation,
  type EvaluationCase,
  type EvaluationResult
} from "../scripts/eval";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const verdict = (value: EvaluationResult["verdict"]["verdict"], synthesis: string) => ({
  verdict: value,
  consensus_score: 0.8,
  agreements: [],
  contradictions: [],
  dissent: [],
  synthesis
});

describe("quality evaluation", () => {
  it("scores synthesis, naive majority, findings, degradation, and latency", () => {
    const cases: EvaluationCase[] = [
      {
        id: "supported-case",
        category: "factual_claim",
        content: "A synthetic claim.",
        expectedVerdict: "supported",
        requiredFindings: ["bounded evidence"]
      },
      {
        id: "refuted-case",
        category: "code_review",
        content: "A synthetic code review.",
        expectedVerdict: "refuted",
        requiredFindings: ["race condition"]
      }
    ];
    const results: EvaluationResult[] = [
      {
        caseId: "supported-case",
        verdict: verdict("supported", "Supported by bounded evidence."),
        panelOutputs: [
          "ASSESSMENT: SUPPORTED",
          "ASSESSMENT: SUPPORTED",
          "ASSESSMENT: INSUFFICIENT_INFO"
        ],
        degraded: false,
        latencyMs: 100
      },
      {
        caseId: "refuted-case",
        verdict: verdict("refuted", "A race condition makes the claim false."),
        panelOutputs: [
          "ASSESSMENT: SUPPORTED",
          "ASSESSMENT: SUPPORTED",
          "ASSESSMENT: REFUTED"
        ],
        degraded: true,
        latencyMs: 300
      }
    ];

    expect(scoreEvaluation(cases, results)).toEqual({
      total: 2,
      synthesisAccuracy: 1,
      naiveMajorityAccuracy: 0.5,
      requiredFindingRecall: 1,
      schemaFailures: 0,
      degraded: 1,
      averageLatencyMs: 200
    });
  });

  it("counts schema failures without treating malformed verdicts as correct", () => {
    const cases: EvaluationCase[] = [
      {
        id: "malformed",
        category: "ambiguous_evidence",
        content: "Synthetic evidence.",
        expectedVerdict: "insufficient",
        requiredFindings: []
      }
    ];
    const results = [
      {
        caseId: "malformed",
        verdict: { verdict: "insufficient", synthesis: "Missing required fields." },
        panelOutputs: ["ASSESSMENT: INSUFFICIENT_INFO"],
        degraded: false
      }
    ] as unknown as EvaluationResult[];

    expect(scoreEvaluation(cases, results)).toMatchObject({
      total: 1,
      synthesisAccuracy: 0,
      naiveMajorityAccuracy: 1,
      schemaFailures: 1
    });
  });

  it("rejects duplicate cases and incomplete result sets", () => {
    const sample: EvaluationCase = {
      id: "same",
      category: "migration_safety",
      content: "Synthetic plan.",
      expectedVerdict: "contested",
      requiredFindings: []
    };
    const result: EvaluationResult = {
      caseId: "same",
      verdict: verdict("contested", "Tradeoffs remain."),
      panelOutputs: ["ASSESSMENT: CONTESTED"],
      degraded: false
    };

    expect(() => scoreEvaluation([sample, sample], [result])).toThrow(/duplicate case id/i);
    expect(() => scoreEvaluation([sample], [])).toThrow(/missing result/i);
  });

  it("rejects malformed outer result fields", () => {
    const sample: EvaluationCase = {
      id: "malformed-result",
      category: "migration_safety",
      content: "Synthetic plan.",
      expectedVerdict: "supported",
      requiredFindings: []
    };
    const result = {
      caseId: sample.id,
      verdict: verdict("supported", "Safe."),
      panelOutputs: ["ASSESSMENT: SUPPORTED"],
      degraded: "yes"
    } as unknown as EvaluationResult;

    expect(() => scoreEvaluation([sample], [result])).toThrow(/malformed result/i);
  });

  it("rejects malformed case fields and fixture baselines at runtime", () => {
    const malformedCase = {
      id: "invalid-case",
      category: "not-a-category",
      content: 42,
      expectedVerdict: "supported",
      requiredFindings: []
    };
    const result: EvaluationResult = {
      caseId: "invalid-case",
      verdict: verdict("supported", "Safe."),
      panelOutputs: ["ASSESSMENT: SUPPORTED"],
      degraded: false
    };

    expect(() => scoreEvaluation([malformedCase], [result])).toThrow(/malformed evaluation case/i);
    expect(() => scoreEvaluation([{ ...malformedCase, category: "factual_claim", content: "Claim" }], [
      { ...result, unexpected: true }
    ])).toThrow(/malformed result/i);
    expect(() =>
      parseFixtureFile({
        baseline: {
          synthesisAccuracy: 1,
          naiveMajorityAccuracy: 0.5,
          requiredFindingRecall: 1,
          unexpected: true
        },
        results: [result]
      })
    ).toThrow(/malformed fixture file/i);
  });

  it("ships a public corpus covering every verdict and required category", async () => {
    const cases = JSON.parse(
      await readFile(`${ROOT}/eval/cases.json`, "utf8")
    ) as EvaluationCase[];

    expect(cases.length).toBeGreaterThanOrEqual(20);
    expect(new Set(cases.map((item) => item.expectedVerdict))).toEqual(
      new Set(["supported", "contested", "refuted", "insufficient"])
    );
    expect(new Set(cases.map((item) => item.category))).toEqual(
      new Set([
        "factual_claim",
        "code_review",
        "migration_safety",
        "ambiguous_evidence",
        "adversarial_claim"
      ])
    );
  });

  it("meets the committed fixture baseline", async () => {
    const report = await evaluateFixture();

    expect(report.summary.schemaFailures).toBe(0);
    expect(report.summary.synthesisAccuracy).toBeGreaterThanOrEqual(
      report.baseline.synthesisAccuracy
    );
    expect(report.summary.naiveMajorityAccuracy).toBeGreaterThanOrEqual(
      report.baseline.naiveMajorityAccuracy
    );
    expect(report.summary.requiredFindingRecall).toBeGreaterThanOrEqual(
      report.baseline.requiredFindingRecall
    );
  });

  it("keeps live mode opt-in and fails before network access without exported credentials", () => {
    const env = { ...process.env };
    for (const name of [
      "ANTHROPIC_API_KEY",
      "OPENAI_API_KEY",
      "GOOGLE_API_KEY",
      "PANEL_MODEL_ANTHROPIC",
      "PANEL_MODEL_OPENAI",
      "PANEL_MODEL_GOOGLE",
      "SYNTHESIS_MODEL"
    ]) {
      delete env[name];
    }

    const run = spawnSync(
      process.execPath,
      [resolve(ROOT, "node_modules/tsx/dist/cli.mjs"), resolve(ROOT, "scripts/eval.ts"), "live"],
      {
        cwd: ROOT,
        env,
        encoding: "utf8"
      }
    );

    expect(run.status).toBe(1);
    expect(run.stderr).toContain("Live evaluation requires exported environment variables");
    expect(run.stdout).not.toContain("fact-water-boiling-point:");
  });
});
