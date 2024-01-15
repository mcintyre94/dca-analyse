import { DCAMapItem } from "./dca-fetch.ts";
import { ExitCodes } from "./exit-codes.ts";

type MissingSignaturesResponse = 
    | { ok: true, missingSignatures: string[] }
    | { ok: false }

export async function findDcasWithMissingSignatures(
    dcas: DCAMapItem[]
  ): Promise<DCAMapItem[]> {
    const responses = await Promise.allSettled(dcas.map(async dca => {
        // const response = await fetch(`https://dca-api.jup.ag/missing-signatures/${dca.dcaAddress}`);
        const response = await fetch('https://httpbin.org/status/400');
        if(response.status !== 200) {
            throw new Error(`HTTP error requesting missing signatures from Jupiter for DCA ${dca.dcaAddress}`);
        }
    }))

    const errors = responses.filter(r => r.status === 'rejected').map(r => (r as PromiseRejectedResult).reason);
    console.error(`Errors fetching missing transaction signatures from Jupiter: \n${errors.join('\n')}`);
    Deno.exit(ExitCodes.FailedToFetchMissingSignatures);
    
    return [];
  }
  