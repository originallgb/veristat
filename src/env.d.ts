interface Env {
  VeristatMCP: DurableObjectNamespace;
  DB: D1Database;
  /** Cloudflare deployment identity; absent only in narrow unit-test mocks. */
  CF_VERSION_METADATA?: WorkerVersionMetadata;

  NETWORK: string;
  FACILITATOR_URL: string;
  PAY_TO_ADDRESS: string;
  /** Public /mcp URL — catalogued by the Bazaar; empty disables discovery. */
  PUBLIC_URL: string;
  PANEL_MODEL_ANTHROPIC: string;
  PANEL_MODEL_OPENAI: string;
  PANEL_MODEL_GOOGLE: string;
  SYNTHESIS_MODEL: string;

  // Secrets
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  GOOGLE_API_KEY: string;
  QUOTE_SIGNING_KEY: string;
  /** Required only when FACILITATOR_URL is the CDP facilitator. */
  CDP_API_KEY_ID?: string;
  CDP_API_KEY_SECRET?: string;
}
