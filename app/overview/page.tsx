import { OverviewView } from "@/components/home/OverviewView";
// Read-only: the Alert tab's literature pack. Only two counts are taken from
// it here, on the server, so the pack is not shipped to the browser.
import literature from "@/k540e-data-pack/k540e-literature.json";

export const metadata = { title: "Overview" };

/** Overview. The body is a client component (it reads the shared selection). */
export default function OverviewPage() {
  const papers = (literature as { papers: { in_graph?: boolean }[] }).papers;
  return (
    <OverviewView
      papers={{
        read: papers.filter((p) => p.in_graph).length,
        total: papers.length,
      }}
    />
  );
}
