// Streamable HTTP opens an SSE stream. Node's global fetch can deadlock a
// second same-origin request behind that stream, so use a dedicated dispatcher.
import { Agent, fetch as undiciFetch } from "undici";

const dispatcher = new Agent({ allowH2: false, connections: 128 });

export const mcpFetch = (url, init = {}) => undiciFetch(url, { ...init, dispatcher });
