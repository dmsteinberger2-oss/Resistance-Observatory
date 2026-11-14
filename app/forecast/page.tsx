import "./forecast.css";
import { loadAlertFeed } from "@/lib/forecast/alerts.server";
import { ForecastApp } from "@/components/forecast/ForecastApp";

export const metadata = { title: "Forecast" };

export default function ForecastPage() {
  const feed = loadAlertFeed();
  return <ForecastApp alertFeed={feed} />;
}
