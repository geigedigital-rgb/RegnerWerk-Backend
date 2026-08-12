import type { Metadata } from "next";
import { ProjectsList } from "@/components/ProjectsList";

export const metadata: Metadata = {
  title: "Sofort-Projekte",
};

export default function ProjectsPage() {
  return <ProjectsList />;
}
