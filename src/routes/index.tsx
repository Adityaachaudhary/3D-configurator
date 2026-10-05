import { createFileRoute } from "@tanstack/react-router";
import { SofaConfigurator } from "@/components/SofaConfigurator";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Panache Sofa Configurator" },
      { name: "description", content: "Configure one-, two-, and three-seater Panache OPAA sofas in 3D with smooth seating transitions, fabrics, finishes, and measurements." },
      { property: "og:title", content: "Panache Sofa Configurator" },
      { property: "og:description", content: "Explore one-, two-, and three-seater Panache OPAA configurations with smooth transitions and custom materials." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <SofaConfigurator />;
}
