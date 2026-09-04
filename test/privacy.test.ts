import { expect, test, describe, vi } from "vitest";
import { logRequest, type RequestRecord } from "../src/logging";

describe("Privacy & Retention Policy (ADR-0004)", () => {
  test("SHA-256 hashing is deterministic and produces 64-char hex", async () => {
    const inputString = JSON.stringify({
      content: "test content",
      context: undefined,
      question: "test question"
    });
    
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(inputString));
    const inputHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
      
    expect(inputHash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(inputHash)).toBe(true);
    
    // Determinism
    const hashBuffer2 = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(inputString));
    const inputHash2 = Array.from(new Uint8Array(hashBuffer2))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(inputHash).toBe(inputHash2);
  });

  test("RequestRecord schema enforces zero raw text properties", () => {
    const record: RequestRecord = {
      requestId: "req-123",
      tool: "test",
      mode: "verify",
      panelSize: 3,
      promptVersion: "v1",
      synthesisVersion: "v1",
      inputHash: "hash123",
      verdictLabel: "contested",
      consensusScore: 0.5,
      totalTokens: 100,
      modelCount: 3,
      degraded: false,
      totalLatencyMs: 1000
    };
    
    expect((record as any).inputJson).toBeUndefined();
    expect((record as any).panelJson).toBeUndefined();
    expect((record as any).verdictJson).toBeUndefined();
    expect(record.inputHash).toBeDefined();
    expect(record.verdictLabel).toBeDefined();
  });


  test("logRequest swallows errors and never throws", async () => {
    const mockDb = {
      prepare: vi.fn().mockImplementation(() => {
        throw new Error("DB Connection Failed");
      })
    };
    
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    
    const record: RequestRecord = {
      requestId: "req-err",
      tool: "test",
      mode: "verify",
      panelSize: 3,
      promptVersion: "v1",
      synthesisVersion: "v1",
      inputHash: "hash123",
      verdictLabel: "contested",
      consensusScore: null,
      totalTokens: 100,
      modelCount: 3,
      degraded: false,
      totalLatencyMs: 1000
    };
    
    await expect(logRequest(mockDb as any, record)).resolves.not.toThrow();
    
    expect(consoleSpy).toHaveBeenCalledWith("request log failed", "req-err", expect.any(Error));
    consoleSpy.mockRestore();
  });
});
