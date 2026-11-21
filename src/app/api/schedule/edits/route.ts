import { withAuth } from "@/lib/auth/api";
import { handleEdit } from "@/lib/schedule/handlers";

// Apply one manual edit to the draft. Body: { type: "assign" | "remove" | "reschedule", ... }.
export const POST = withAuth((request) => handleEdit(request));
