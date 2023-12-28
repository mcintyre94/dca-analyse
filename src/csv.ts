import { BigFloat } from "https://deno.land/x/bigfloat@v3.0.2/mod.ts";
import type { DCAMapItem } from "./dca-fetch.ts";
import type { DCA } from "npm:@jup-ag/dca-sdk@2.3.8";
import { format as dateFormat } from "https://deno.land/std@0.210.0/datetime/format.ts";
import { Input } from "https://deno.land/x/cliffy@v1.0.0-rc.3/prompt/input.ts";
import { writeCSV } from "https://deno.land/x/csv@v0.9.2/writer.ts";

// Generate CSV data for a list of DCAs
async function* makeCsvData(
  trades: DCAMapItem[],
  dcaClient: DCA,
): AsyncGenerator<string[]> {
  const first = trades[0];
  const inSym = first.inTokenInfo.symbol;
  const outSym = first.outTokenInfo.symbol;

  // header row
  yield [
    `${inSym} out`,
    `${outSym} in`,
    `Rate (${outSym} per ${inSym})`,
    "DateTime",
    "Transaction",
  ];

  let sumIn = new BigFloat(0);
  let sumOut = new BigFloat(0);

  const allFills = (await Promise.all(
    trades.map((trade) => {
      if (trade.fills) {
        return Promise.resolve(trade.fills);
      } else {
        return dcaClient.getFillHistory(trade.dcaAddress);
      }
    }),
  )).flat();
  // Sort, earliest first
  allFills.sort((a, b) => a.confirmedAt.getTime() - b.confirmedAt.getTime());

  for (const fill of allFills) {
    const inAmount = new BigFloat(fill.inAmount).dividedBy(
      10 ** first.inTokenInfo.decimals,
    );
    sumIn = sumIn.add(inAmount);

    const outAmount = new BigFloat(fill.outAmount).dividedBy(
      10 ** first.outTokenInfo.decimals,
    );
    sumOut = sumOut.add(outAmount);

    // row per fill
    yield [
      inAmount.toString(),
      outAmount.toString(),
      outAmount.dividedBy(inAmount).toString(),
      dateFormat(fill.confirmedAt, "yyyy-MM-dd HH:mm"),
      fill.txId,
    ];
  }

  // empty row
  yield [];

  // sum of inputs
  yield [`Total (${inSym})`, sumIn.toString()];

  // sum of outputs
  yield [`Total (${outSym})`, sumOut.toString()];

  // average rate
  yield [
    `Average rate (${outSym} per ${inSym})`,
    sumOut.dividedBy(sumIn).toString(),
  ];
}

// Generate the default name for the CSV for a list of DCAs
function csvDefaultName(trades: DCAMapItem[]): string {
  const first = trades[0];
  if (trades.length > 1) {
    // just use symbols
    return `${first.inTokenInfo.symbol}-${first.outTokenInfo.symbol}`;
  } else {
    // use the full name for the trade
    return `${first.displayName}`;
  }
}

// Create and save the CSV for a list of DCAs
export async function makeCsv(
  trades: DCAMapItem[],
  dcaClient: DCA,
): Promise<void> {
  let csvFileName = await Input.prompt({
    message: "Filename to save to",
    default: csvDefaultName(trades),
    prefix: "📄 ",
  });

  if (!csvFileName.toLowerCase().endsWith(".csv")) {
    csvFileName += ".csv";
  }

  const f = await Deno.open(`./${csvFileName}`, {
    write: true,
    create: true,
    truncate: true,
  });

  await writeCSV(f, makeCsvData(trades, dcaClient));

  f.close();
}
