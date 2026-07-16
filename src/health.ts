export function healthPayload(env: Pick<Env, "CF_VERSION_METADATA" | "NETWORK">) {
  return {
    ok: true,
    version: env.CF_VERSION_METADATA?.id ?? "local",
    deployed_at: env.CF_VERSION_METADATA?.timestamp ?? null,
    network: env.NETWORK
  };
}
