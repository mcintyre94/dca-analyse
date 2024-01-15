import { Connection, PublicKey } from "npm:@solana/web3.js@1.87.6";
import { DCA, FillHistory } from "npm:@jup-ag/dca-sdk@2.3.8";
import { BN } from "npm:@coral-xyz/anchor@0.28.0";
import { BigFloat } from "https://deno.land/x/bigfloat@v3.0.2/mod.ts";
import { format as dateFormat } from "https://deno.land/std@0.210.0/datetime/format.ts";
import { ExitCodes } from "./exit-codes.ts";

type TokenInfo = {
  symbol: string;
  decimals: number;
};

export type DCAMapItem = {
  dcaAddress: string;
  inTokenAddress: string;
  inTokenInfo: TokenInfo;
  outTokenAddress: string;
  outTokenInfo: TokenInfo;
  displayName: string;
  isOpen: boolean;
  createdAtTimestamp: bigint;
  fills?: FillHistory[];
};

type FetchedDCA = {
  publicKey: PublicKey;
  account: {
    inputMint: PublicKey;
    inDeposited: typeof BN;
    outputMint: PublicKey;
    createdAt: typeof BN;
  };
  fills?: FillHistory[];
};

// Get the token info we need for a mint
async function getTokenInfo(mintPublicKey: PublicKey): Promise<TokenInfo> {
  const mintString = mintPublicKey.toBase58();
  const res = await fetch(
    `https://token-list-api.solana.cloud/v1/search?query=${mintString}&chainId=101&start=0&limit=1`,
  );
  if (res.status !== 200) {
    console.error(`Couldn't fetch token info for ${mintString} (status ${res.status})`);
    // TODO: might want better error handling here
    Deno.exit(ExitCodes.FailedToFetchTokenInfo);
  }
  const { content }: { content: TokenInfo[] } = await res.json();

  if (content.length === 0) {
    console.error(`Couldn't fetch token info for ${mintString} (no content)`);
    // TODO: might want better error handling here
    Deno.exit(ExitCodes.FailedToFetchTokenInfo);
  }

  return {
    symbol: content[0].symbol,
    decimals: content[0].decimals,
  };
}

export function makeDcaClient(rpcUrl: string): DCA {
  const connection = new Connection(rpcUrl, "confirmed");
  return new DCA(connection, "mainnet-beta");
}

async function makeDcaMapItem(
  order: FetchedDCA,
  isOpen: boolean,
): Promise<DCAMapItem> {
  const inTokenPublicKey = order.account.inputMint;
  const inTokenInfo = await getTokenInfo(inTokenPublicKey);
  const inFriendlyAmount = new BigFloat(order.account.inDeposited.toString())
    .dividedBy(10 ** inTokenInfo.decimals).toString();

  const outTokenPublicKey = order.account.outputMint;
  const outTokenInfo = await getTokenInfo(outTokenPublicKey);

  const date = new Date(order.account.createdAt * 1000);
  const friendlyDate = dateFormat(date, "yyyy-MM-dd HH:mm");

  const displayName =
    `${inFriendlyAmount} ${inTokenInfo.symbol} → ${outTokenInfo.symbol} - ${friendlyDate}`;

  return {
    dcaAddress: order.publicKey.toBase58(),
    inTokenAddress: inTokenPublicKey.toBase58(),
    inTokenInfo,
    outTokenAddress: outTokenPublicKey.toBase58(),
    outTokenInfo,
    displayName,
    fills: order.fills,
    isOpen,
    createdAtTimestamp: BigInt(order.account.createdAt.toString(10)),
  };
}

// Get all DCA info we need for all DCAs for the user
export async function makeDcaMap(
  dcaClient: DCA,
  address: PublicKey,
): Promise<Map<string, DCAMapItem>> {
  const dcaMap: Map<string, DCAMapItem> = new Map();

  // First, add the closed DCAs
  const closedOrders = await dcaClient.getClosedByUser(address);
  for (const order of closedOrders) {
    const mapItem = await makeDcaMapItem(order, false);
    dcaMap.set(order.publicKey.toBase58(), mapItem);
  }

  // Then, add the open DCAs
  const openOrders = await dcaClient.getCurrentByUser(address);
  for (const order of openOrders) {
    const mapItem = await makeDcaMapItem(order, true);
    dcaMap.set(order.publicKey.toBase58(), mapItem);
  }

  return dcaMap;
}
