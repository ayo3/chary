export const dynamic = "force-dynamic";
import SectorPageContent from "@/components/SectorPageContent";
import { SECTORS } from "@/lib/sectors";
export const revalidate = 300;
export default function Page() {
  const sector = SECTORS.find(s => s.id === "banks")!;
  return <SectorPageContent sector={sector} />;
}
