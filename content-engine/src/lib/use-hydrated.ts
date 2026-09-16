"use client";

import { useEffect, useState } from "react";

/** 클라이언트 hydration 완료 여부. 폼에 data-hydrated 마커를 달아 E2E가 준비 상태를 기다릴 수 있게 한다. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

export function hydratedAttr(hydrated: boolean) {
  return { "data-hydrated": hydrated ? "true" : "false" } as const;
}
