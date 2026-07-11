// Node's built-in fetch (undici global dispatcher) stalls a second request
// to the same origin while an SSE stream is open — which deadlocks MCP
// streamable HTTP after the standalone GET stream connects. A dedicated
// dispatcher avoids it. (Observed on Node 26; harmless elsewhere.)
import { Agent } from "undici";

const dispatcher = new Agent({ allowH2: false, connections: 128 });

export const mcpFetch = (url, init = {}) => fetch(url, { ...init, dispatcher });
