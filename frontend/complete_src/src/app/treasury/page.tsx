"use client";
import SectorPageContent from "@/components/SectorPageContent";
import { SECTORS } from "@/lib/sectors";
export default function Page() {
  const sector = SECTORS.find(s => s.id === "treasury")!;
  return <SectorPageContent sector={sector} />;
}
