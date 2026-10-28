import type { Metadata } from "next";
import { PropertyWizard } from "@/components/app/property-wizard";

export const metadata: Metadata = { title: "Novo imóvel" };

export default function NewPropertyPage() {
  return <PropertyWizard />;
}
