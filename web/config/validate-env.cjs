const BLOCKED_PRODUCTION_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function validatePublicServiceUrl(name, value) {
  if (!value) throw new Error(`[config] ${name} is required for a production build`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`[config] ${name} must be an absolute HTTP(S) URL`);
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`[config] ${name} must be an absolute HTTP(S) URL`);
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_PRODUCTION_HOSTS.has(host) || host.endsWith(".trycloudflare.com")) {
    throw new Error(`[config] ${name} must use a persistent production origin`);
  }
  return value.replace(/\/$/, "");
}

function validateProductionEnv(env = process.env) {
  return {
    backendUrl: validatePublicServiceUrl(
      "NEXT_PUBLIC_BACKEND_URL",
      env.NEXT_PUBLIC_BACKEND_URL,
    ),
    agentUrl: validatePublicServiceUrl("NEXT_PUBLIC_AGENT_URL", env.NEXT_PUBLIC_AGENT_URL),
  };
}

module.exports = { validateProductionEnv, validatePublicServiceUrl };
