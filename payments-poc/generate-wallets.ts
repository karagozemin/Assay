/**
 * Generates the wallets needed for the Step 1 PoC and writes them to .env.local:
 *   - CREATOR: receives USDC (the seller / source owner).
 *   - BUYER:   the funder wallet the agent spends from.
 *
 * Fund the BUYER address with Arc-testnet USDC via https://faucet.circle.com/
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(".env.local");

const dim = (s: string) => `\x1b[2m${s}\x1b[22m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[39m`;
const green = (s: string) => `\x1b[32m${s}\x1b[39m`;
const underline = (s: string) => `\x1b[4m${s}\x1b[24m`;

function makeWallet(label: string) {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  console.log(`\n${bold(label)}`);
  console.log(`  ${dim("Address:")}     ${cyan(account.address)}`);
  console.log(`  ${dim("Private key:")} ${cyan(privateKey)}`);
  return { address: account.address, privateKey };
}

const creator = makeWallet("Creator (source owner — receives USDC)");
const buyer = makeWallet("Buyer (agent funder wallet — spends USDC)");

const values: Record<string, string> = {
  CREATOR_ADDRESS: creator.address,
  CREATOR_PRIVATE_KEY: creator.privateKey,
  BUYER_ADDRESS: buyer.address,
  BUYER_PRIVATE_KEY: buyer.privateKey,
};

function replaceOrAppend(content: string, key: string, line: string) {
  const regex = new RegExp(`^${key}=.*$`, "m");
  return regex.test(content)
    ? content.replace(regex, line)
    : content.trimEnd() + "\n" + line;
}

let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
for (const [key, value] of Object.entries(values)) {
  const line = `${key}=${value}`;
  content = content ? replaceOrAppend(content, key, line) : line;
}
fs.writeFileSync(envPath, content.trimEnd() + "\n");

console.log(`\n${green("Written to")} ${envPath}`);
console.log(`
${bold("Next steps:")}
  ${dim("1.")} Fund the BUYER wallet with Arc-testnet USDC:
     ${underline("https://faucet.circle.com/")}
     Address: ${cyan(buyer.address)}

  ${dim("2.")} Start the seller:  ${cyan("npm run seller")}
  ${dim("3.")} Pay for it:        ${cyan("npm run buy")}
`);
