import { createFileRoute } from "@tanstack/react-router";
import { Goldthorn } from "@/components/goldthorn";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <Goldthorn />;
}
