// Node's built-in fetch (undici global dispatcher) stalls a second request
// to the same origin while an SSE stream is open — which deadlocks MCP
// streamable HTTP after the standalone GET stream connects. A dedicated
// dispatcher avoids it. (Observed on Node 26; harmless elsewhere.)
//
// Use undici's own fetch, not globalThis.fetch: the built-in fetch rejects
// dispatchers from a different undici build (UND_ERR_INVALID_ARG
// "invalid onRequestStart method"), so mixing them breaks on any Node whose
// bundled undici doesn't match the npm one.
import { Agent, fetch as undiciFetch } from "undici";

const dispatcher = new Agent({ allowH2: false, connections: 128 });

export const mcpFetch = (url, init = {}) => undiciFetch(url, { ...init, dispatcher });
