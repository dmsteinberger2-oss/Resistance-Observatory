"use client";

// Placeholder — David owns this route and replaces this file wholesale.
import { useSelection } from "@/lib/selection";

export default function AlertPage() {
  const { markerId } = useSelection();
  return <h1>Alert{markerId ? ` — ${markerId}` : ""}</h1>;
}
