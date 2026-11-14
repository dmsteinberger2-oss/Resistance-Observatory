"use client";

// Placeholder — Benjamin owns this route and replaces this file wholesale.
import { useSelection } from "@/lib/selection";

export default function ForecastPage() {
  const { markerId } = useSelection();
  return <h1>Forecast{markerId ? ` — ${markerId}` : ""}</h1>;
}
