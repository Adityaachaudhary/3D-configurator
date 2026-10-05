import { createFileRoute } from "@tanstack/react-router";
import { SofaConfigurator } from "@/components/SofaConfigurator";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Panache Sofa Configurator" },
      { name: "description", content: "Configure the Panache OPAA sofa in 3D with fabric, finish, scale, and precision viewing controls." },
      { property: "og:title", content: "Panache Sofa Configurator" },
      { property: "og:description", content: "Explore and configure the Panache OPAA sofa in an interactive 3D studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <SofaConfigurator />;
}
