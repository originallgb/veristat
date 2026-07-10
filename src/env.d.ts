interface Env {
  VeristatMCP: DurableObjectNamespace;
  DB: D1Database;

  NETWORK: string;
  FACILITATOR_URL: string;
  PAY_TO_ADDRESS: string;
  PANEL_MODEL_ANTHROPIC: string;
  PANEL_MODEL_OPENAI: string;
  PANEL_MODEL_GOOGLE: string;
  SYNTHESIS_MODEL: string;

  // Secrets
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  GOOGLE_API_KEY: string;
  QUOTE_SIGNING_KEY: string;
}
