import { withAuth } from "@/lib/auth/api";
import { handleSave } from "@/lib/students/handlers";

// Create a student (SPEC §3.9). Body: student fields + availability blocks.
export const POST = withAuth((request) => handleSave(request, null));
