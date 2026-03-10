import SectorPageContent from "@/components/SectorPageContent";
import { SECTORS } from "@/lib/sectors";
export const revalidate = 300;
export default function Page() {
  const sector = SECTORS.find(s => s.id === "ecommerce")!;
  return <SectorPageContent sector={sector} />;
}
