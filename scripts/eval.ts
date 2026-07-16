import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verdictSchema, type Verdict } from "../src/mcp/schemas";
import { buildPanel } from "../src/panel/providers";
import { runPanel } from "../src/panel/orchestrator";
import { synthesize } from "../src/panel/synthesis";
import { buildPanelPrompt } from "../src/prompts/panel_v1";

export type VerdictLabel = Verdict["verdict"];

export interface EvaluationCase {
  id: string;
  category:
    | "factual_claim"
    | "code_review"
    | "migration_safety"
    | "ambiguous_evidence"
    | "adversarial_claim";
  content: string;
  context?: string;
  question?: string;
  expectedVerdict: VerdictLabel;
  requiredFindings: string[];
}

export interface EvaluationResult {
  caseId: string;
  verdict: Verdict;
  panelOutputs: string[];
  degraded: boolean;
  latencyMs?: number;
}

export interface EvaluationSummary {
  total: number;
  synthesisAccuracy: number;
  naiveMajorityAccuracy: number;
  requiredFindingRecall: number;
  schemaFailures: number;
  degraded: number;
  averageLatencyMs?: number;
}

export interface EvaluationBaseline {
  synthesisAccuracy: number;
  naiveMajorityAccuracy: number;
  requiredFindingRecall: number;
}

interface FixtureFile {
  baseline: EvaluationBaseline;
  results: EvaluationResult[];
}

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CASES_PATH = resolve(SCRIPT_DIR, "../eval/cases.json");
const FIXTURE_RESULTS_PATH = resolve(SCRIPT_DIR, "../eval/fixture-results.json");

function assertUniqueIds(items: { id: string }[], label: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (!item.id || seen.has(item.id)) {
      throw new Error(`Duplicate ${label} id: ${item.id || "<empty>"}`);
    }
    seen.add(item.id);
  }
}

function naiveMajority(panelOutputs: string[]): VerdictLabel {
  const labels = panelOutputs.map((output) => {
    const match = output.match(
      /ASSESSMENT:\s*(SUPPORTED|CONTESTED|REFUTED|INSUFFICIENT(?:_INFO)?)/i
    );
    if (!match) throw new Error("Malformed result: panel output lacks ASSESSMENT label");
    const label = match[1].toLowerCase();
    return label.startsWith("insufficient") ? "insufficient" : (label as VerdictLabel);
  });
  if (labels.length === 0) throw new Error("Malformed result: panel output list is empty");

  const counts = new Map<VerdictLabel, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ordered.length > 1 && ordered[0][1] === ordered[1][1]) return "contested";
  return ordered[0][0];
}

function searchableVerdict(verdict: Verdict): string {
  return [
    verdict.synthesis,
    ...verdict.agreements.map((item) => item.point),
    ...verdict.contradictions.flatMap((item) => [
      item.point,
      ...item.positions.flatMap((position) => [position.stance, position.reasoning])
    ]),
    ...verdict.dissent.map((item) => item.position)
  ]
    .join(" ")
    .toLocaleLowerCase();
}

export function scoreEvaluation(
  cases: EvaluationCase[],
  results: EvaluationResult[]
): EvaluationSummary {
  for (const result of results) {
    if (
      typeof result?.caseId !== "string" ||
      result.caseId.length === 0 ||
      !Array.isArray(result.panelOutputs) ||
      result.panelOutputs.length === 0 ||
      result.panelOutputs.some((output) => typeof output !== "string") ||
      typeof result.degraded !== "boolean" ||
      (result.latencyMs !== undefined && typeof result.latencyMs !== "number")
    ) {
      throw new Error("Malformed result: invalid caseId, panelOutputs, degraded, or latencyMs");
    }
  }
  assertUniqueIds(cases, "case");
  assertUniqueIds(
    results.map((result) => ({ id: result.caseId })),
    "result case"
  );

  const caseIds = new Set(cases.map((item) => item.id));
  const byCase = new Map(results.map((result) => [result.caseId, result]));
  for (const item of cases) {
    if (!byCase.has(item.id)) throw new Error(`Missing result for case: ${item.id}`);
  }
  for (const result of results) {
    if (!caseIds.has(result.caseId)) throw new Error(`Result has unknown case id: ${result.caseId}`);
  }

  let synthesisCorrect = 0;
  let majorityCorrect = 0;
  let findingsFound = 0;
  let findingsTotal = 0;
  let schemaFailures = 0;
  let degraded = 0;
  const latencies: number[] = [];

  for (const item of cases) {
    const result = byCase.get(item.id)!;
    const parsed = verdictSchema.safeParse(result.verdict);
    if (!parsed.success) {
      schemaFailures += 1;
    } else {
      if (parsed.data.verdict === item.expectedVerdict) synthesisCorrect += 1;
      const searchable = searchableVerdict(parsed.data);
      for (const finding of item.requiredFindings) {
        if (searchable.includes(finding.toLocaleLowerCase())) findingsFound += 1;
      }
    }
    findingsTotal += item.requiredFindings.length;
    if (naiveMajority(result.panelOutputs) === item.expectedVerdict) majorityCorrect += 1;
    if (result.degraded) degraded += 1;
    if (result.latencyMs !== undefined) {
      if (!Number.isFinite(result.latencyMs) || result.latencyMs < 0) {
        throw new Error(`Malformed result latency for case: ${item.id}`);
      }
      latencies.push(result.latencyMs);
    }
  }

  const total = cases.length;
  if (total === 0) throw new Error("Evaluation corpus is empty");
  const summary: EvaluationSummary = {
    total,
    synthesisAccuracy: synthesisCorrect / total,
    naiveMajorityAccuracy: majorityCorrect / total,
    requiredFindingRecall: findingsTotal === 0 ? 1 : findingsFound / findingsTotal,
    schemaFailures,
    degraded
  };
  if (latencies.length > 0) {
    summary.averageLatencyMs = latencies.reduce((sum, value) => sum + value, 0) / latencies.length;
  }
  return summary;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function evaluateFixture(): Promise<{
  summary: EvaluationSummary;
  baseline: EvaluationBaseline;
}> {
  const cases = await readJson<EvaluationCase[]>(CASES_PATH);
  const fixture = await readJson<FixtureFile>(FIXTURE_RESULTS_PATH);
  if (!fixture.baseline || !Array.isArray(fixture.results)) {
    throw new Error("Malformed fixture file");
  }
  return { summary: scoreEvaluation(cases, fixture.results), baseline: fixture.baseline };
}

function assertFixtureBaseline(
  summary: EvaluationSummary,
  baseline: EvaluationBaseline
): void {
  if (summary.schemaFailures > 0) {
    throw new Error(`Fixture contains ${summary.schemaFailures} schema failure(s)`);
  }
  for (const metric of [
    "synthesisAccuracy",
    "naiveMajorityAccuracy",
    "requiredFindingRecall"
  ] as const) {
    if (summary[metric] < baseline[metric]) {
      throw new Error(
        `${metric} regressed: ${summary[metric]} is below baseline ${baseline[metric]}`
      );
    }
  }
}

function requiredEnvironment(): Env {
  const names = [
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "GOOGLE_API_KEY",
    "PANEL_MODEL_ANTHROPIC",
    "PANEL_MODEL_OPENAI",
    "PANEL_MODEL_GOOGLE",
    "SYNTHESIS_MODEL"
  ] as const;
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Live evaluation requires exported environment variables: ${missing.join(", ")}`);
  }
  return Object.fromEntries(names.map((name) => [name, process.env[name]])) as unknown as Env;
}

async function runLive(): Promise<EvaluationSummary> {
  const env = requiredEnvironment();
  const cases = await readJson<EvaluationCase[]>(CASES_PATH);
  const results: EvaluationResult[] = [];

  for (const item of cases) {
    const started = Date.now();
    const prompt = buildPanelPrompt({
      content: item.content,
      context: item.context,
      question: item.question,
      mode: item.category === "adversarial_claim" ? "adversarial" : "verify"
    });
    const outcome = await runPanel(buildPanel(env), prompt);
    const verdict = await synthesize(env, {
      content: item.content,
      question: item.question,
      panel: outcome.succeeded
    });
    const result: EvaluationResult = {
      caseId: item.id,
      verdict,
      panelOutputs: outcome.succeeded.map((panelist) => panelist.output),
      degraded: outcome.degraded,
      latencyMs: Date.now() - started
    };
    results.push(result);
    process.stdout.write(
      `${item.id}: ${verdict.verdict} (${result.latencyMs}ms${outcome.degraded ? ", degraded" : ""})\n`
    );
  }
  return scoreEvaluation(cases, results);
}

function scrubSecrets(message: string): string {
  let scrubbed = message;
  for (const name of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY"]) {
    const secret = process.env[name];
    if (secret) scrubbed = scrubbed.replaceAll(secret, "[REDACTED]");
  }
  return scrubbed;
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? "fixture";
  if (mode === "fixture") {
    const report = await evaluateFixture();
    assertFixtureBaseline(report.summary, report.baseline);
    process.stdout.write(`${JSON.stringify(report.summary, null, 2)}\n`);
    return;
  }
  if (mode === "live") {
    process.stdout.write(`${JSON.stringify(await runLive(), null, 2)}\n`);
    return;
  }
  throw new Error(`Unknown evaluation mode: ${mode}`);
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entrypoint) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown evaluation failure";
    process.stderr.write(`Evaluation failed: ${scrubSecrets(message)}\n`);
    process.exitCode = 1;
  });
}
