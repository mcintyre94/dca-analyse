import { PublicKey } from "npm:@solana/web3.js@1.87.6";
import { Checkbox } from "https://deno.land/x/cliffy@v1.0.0-rc.3/prompt/checkbox.ts";
import { Confirm } from "https://deno.land/x/cliffy@v1.0.0-rc.3/prompt/confirm.ts";
import { getAddress, getRpcUrl } from "./inputs.ts";
import { DCAMapItem, makeDcaClient, makeDcaMap } from "./dca-fetch.ts";
import { getDCAListOptions } from "./dca-list.ts";
import { makeCsv } from "./csv.ts";

async function main() {
  const rpcUrl = await getRpcUrl();
  const address: PublicKey = await getAddress();
  const dcaClient = makeDcaClient(rpcUrl);

  const dcaMap = await makeDcaMap(dcaClient, address);

  // Exit if no DCAs for user
  if (dcaMap.size === 0) {
    console.log(`No DCAs found for address ${address.toBase58()}`);
    Deno.exit(0);
  }

  const options = getDCAListOptions(dcaMap);

  const selectedDcaAddresses: string[] = await Checkbox.prompt({
    message: "Choose DCAs to include",
    options,
    prefix: "🪐 ",
    search: true,
    minOptions: 1,
  }) as unknown as string[];

  const selectedDcaItems: DCAMapItem[] = selectedDcaAddresses
    .map((address) => dcaMap.get(address))
    .filter((value) => value !== undefined) as unknown as DCAMapItem[];

  // Group by input + output token
  const groupByTokens = Object.groupBy(
    selectedDcaItems,
    (item) => `${item!.inTokenAddress}-${item!.outTokenAddress}`,
  );

  for (const tokenAddresses in groupByTokens) {
    const trades =
      groupByTokens[tokenAddresses as keyof (typeof groupByTokens)];

    if (trades.length > 1) {
      const first = trades[0];
      // Ask whether to group the trades in the group
      const useGroupedCsv = await Confirm.prompt({
        message:
          `Group ${trades.length} ${first.inTokenInfo.symbol} → ${first.outTokenInfo.symbol} trades into a single CSV?`,
        default: true,
        prefix: "✓ ",
      });

      if (useGroupedCsv) {
        await makeCsv(trades, dcaClient);
      } else {
        for (const trade of trades) {
          await makeCsv([trade], dcaClient);
        }
      }
    } else {
      await makeCsv(trades, dcaClient);
    }
  }
}

if (import.meta.main) {
  await main();
}
