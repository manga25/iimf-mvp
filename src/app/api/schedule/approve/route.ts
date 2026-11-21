import { withAuth } from "@/lib/auth/api";
import { handleApprove } from "@/lib/schedule/handlers";

// Approve the draft and create the term's sessions (irreversible, SPEC §3.4).
export const POST = withAuth(() => handleApprove());
