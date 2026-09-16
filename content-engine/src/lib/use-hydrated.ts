"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** 클라이언트 hydration 완료 여부. 폼에 data-hydrated 마커를 달아 E2E가 준비 상태를 기다릴 수 있게 한다. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export function hydratedAttr(hydrated: boolean) {
  return { "data-hydrated": hydrated ? "true" : "false" } as const;
}
