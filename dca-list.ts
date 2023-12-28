import { Checkbox } from "https://deno.land/x/cliffy@v1.0.0-rc.3/prompt/checkbox.ts";
import { type DCAMapItem } from "./dca-fetch.ts";

type ListOption = {
  name: string;
  value: string;
};

function toListOption(item: DCAMapItem): ListOption {
  return {
    name: item.displayName,
    value: item.dcaAddress,
  };
}

// Get the list options for the DCAs
export function getDCAListOptions(
  dcaMap: Map<string, DCAMapItem>,
) {
  // Separate closed from open DCAs for selection
  const [closedDCAs, openDCAs] = [...dcaMap].reduce(
    (acc: [DCAMapItem[], DCAMapItem[]], keyValuePair: [string, DCAMapItem]) => {
      const [closedSoFar, openSoFar] = acc;
      const item = keyValuePair[1];
      if (item.isOpen) {
        return [closedSoFar, [...openSoFar, item]];
      } else {
        return [[...closedSoFar, item], openSoFar];
      }
    },
    [[], []],
  );

  // Sort each category, newest first
  closedDCAs.sort((a, b) =>
    Number(b.createdAtTimestamp - a.createdAtTimestamp)
  );
  openDCAs.sort((a, b) => Number(b.createdAtTimestamp - a.createdAtTimestamp));

  const closedDCAOptions = closedDCAs.map(toListOption);
  const openDCAOptions = openDCAs.map(toListOption);

  return openDCAOptions.length > 0
    ? [
      ...closedDCAOptions,
      Checkbox.separator("Open (incomplete)"),
      ...openDCAOptions,
    ]
    : closedDCAOptions;
}
