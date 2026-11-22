import { createFileRoute } from "@tanstack/react-router";
import { Terms } from "@/components/legal/terms";

export const Route = createFileRoute("/terms")({ component: Terms });
