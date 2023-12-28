import { Input } from "https://deno.land/x/cliffy@v1.0.0-rc.3/prompt/input.ts";
import { Connection, PublicKey } from "npm:@solana/web3.js@1.87.6";

// Get the RPC URL, either from an environment variable or a prompt
export async function getRpcUrl(): Promise<string> {
  let rpcUrl = Deno.env.get("SOLANA_RPC_URL");
  if (!rpcUrl) {
    rpcUrl = await Input.prompt({
      message: "Solana RPC URL",
      hint: "You can also use the `SOLANA_RPC_URL` environment variable",
      prefix: "ℹ ",
      validate: (url) => {
        try {
          new Connection(url);
          return true;
        } catch {
          return "Invalid RPC URL";
        }
      },
    });
  }
  return rpcUrl;
}

// Get the user address, either from args or a prompt
export async function getAddress(): Promise<PublicKey> {
  let address = Deno.args[0];
  if (!address) {
    address = await Input.prompt({
      message: "Solana address",
      hint:
        "You can also pass as the first argument, eg dca-analyse 7sh3me5291ifasiAMqCxSjnu7pF6PzJoMAGhBCPDxHp4",
      prefix: "◎ ",
      validate: (a) => {
        try {
          new PublicKey(a);
          return true;
        } catch {
          return "Invalid base58 address";
        }
      },
    });
  }
  return new PublicKey(address);
}
