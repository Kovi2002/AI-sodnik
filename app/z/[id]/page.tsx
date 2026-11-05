import type { Metadata } from "next";
import { CaseScreen } from "@/components/CaseScreen";

export const metadata: Metadata = {
  title: "Zadeva · Kdo je kriv?",
};

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CaseScreen id={id} />;
}
