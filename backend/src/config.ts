export type AssayRuntime = "development" | "test" | "production";

export interface BackendConfig {
  runtime: AssayRuntime;
  host: string;
  port: number;
  corsOrigins: string[];
  arcMainnet: {
    chainId: 5042;
    rpcUrl: string;
    explorerUrl: string;
  } | null;
}

const enabled = (value: string | undefined) => value === "1";

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`[config] ${key} is required in production`);
  return value;
}

function httpUrl(value: string, key: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`[config] ${key} must be an absolute HTTP(S) URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`[config] ${key} must be an absolute HTTP(S) URL`);
  }
  return value.replace(/\/$/, "");
}

export function loadBackendConfig(env: NodeJS.ProcessEnv = process.env): BackendConfig {
  const runtime = (env.ASSAY_RUNTIME ??
    (env.NODE_ENV === "production" ? "production" : "development")) as AssayRuntime;
  if (!(["development", "test", "production"] as string[]).includes(runtime)) {
    throw new Error(`[config] unsupported ASSAY_RUNTIME: ${runtime}`);
  }

  const port = Number(env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("[config] PORT must be an integer between 1 and 65535");
  }

  const corsOrigins = (env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

  if (runtime !== "production") {
    return { runtime, host: "0.0.0.0", port, corsOrigins, arcMainnet: null };
  }

  if (enabled(env.ASSAY_TEST_SETTLE)) {
    throw new Error("[config] ASSAY_TEST_SETTLE=1 is forbidden in production");
  }
  if (enabled(env.ASSAY_MOCK_PAY)) {
    throw new Error("[config] ASSAY_MOCK_PAY=1 is forbidden in production");
  }
  if (corsOrigins.length === 0 || corsOrigins.includes("*")) {
    throw new Error("[config] production CORS_ORIGIN must contain explicit origins");
  }
  corsOrigins.forEach((origin) => httpUrl(origin, "CORS_ORIGIN"));

  const chainId = Number(required(env, "ARC_MAINNET_CHAIN_ID"));
  if (chainId !== 5042) {
    throw new Error("[config] ARC_MAINNET_CHAIN_ID must be 5042");
  }

  return {
    runtime,
    host: "0.0.0.0",
    port,
    corsOrigins,
    arcMainnet: {
      chainId: 5042,
      rpcUrl: httpUrl(required(env, "ARC_MAINNET_RPC_URL"), "ARC_MAINNET_RPC_URL"),
      explorerUrl: httpUrl(
        required(env, "ARC_MAINNET_EXPLORER_URL"),
        "ARC_MAINNET_EXPLORER_URL",
      ),
    },
  };
}
