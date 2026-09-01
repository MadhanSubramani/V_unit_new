"use client";

import { useEffect, useState } from "react";
import { FreightForward } from "@/types/freightForward";
import { Cfs } from "@/types/cfs";
import { Sez } from "@/types/sez";
import { getCfsList } from "@/lib/cfs/cfs";
import { getSezList } from "@/lib/sez/sez";
import { resolveImportLocationCode } from "@/lib/import/location";
import { ImportTableCell } from "@/components/import/ImportJobTableCells";

export function ImportLocationCell({
  item,
  width = 120,
}: {
  item: FreightForward;
  width?: number;
}) {
  const [cfsList, setCfsList] = useState<Cfs[]>([]);
  const [sezList, setSezList] = useState<Sez[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([getCfsList(), getSezList()])
      .then(([cfs, sez]) => {
        if (active) {
          setCfsList(cfs);
          setSezList(sez);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <ImportTableCell
      value={resolveImportLocationCode(item, cfsList, sezList)}
      width={width}
    />
  );
}
