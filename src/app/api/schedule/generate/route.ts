import { withAuth } from "@/lib/auth/api";
import { handleGenerate } from "@/lib/schedule/handlers";

// Generate (or regenerate) the draft schedule (SPEC §3.4).
export const POST = withAuth(() => handleGenerate());
