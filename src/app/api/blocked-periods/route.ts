import { withAuth } from "@/lib/auth/api";
import { handleCreateBlock } from "@/lib/calendar/handlers";

// Create a blocked period; overlapping sessions are cancelled without notifications (SPEC §3.5).
export const POST = withAuth((request) => handleCreateBlock(request));
