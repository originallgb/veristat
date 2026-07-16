import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Nested Git worktrees are runtime state, not part of this checkout's
    // suite. Restrict discovery to the tracked root test directory.
    include: ["test/**/*.test.ts"]
  }
});
