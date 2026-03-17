"use client";
import { useState, useEffect } from "react";

/** Returns false on the server and during the first client render, true after hydration. */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
