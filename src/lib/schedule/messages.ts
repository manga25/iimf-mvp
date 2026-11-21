// User-facing schedule messages (AC-9.4: clear, non-technical).
export const SM = {
  missingAvailability: "Some students have no availability yet. Add their availability before generating the schedule.",
  noDraft: "There is no draft schedule yet. Generate one first.",
  emptyDraft: "The draft has no classes to approve. Regenerate it or assign students first.",
  hardViolations: "The schedule can't be approved until every error is fixed.",
  invalidEdit: "This change isn't valid. Please reload the page and try again.",
  groupNotFound: "This class no longer exists. Please reload the page.",
  studentNotFound: "This student doesn't exist or was removed.",
  studentInactive: "This student has been deactivated and can't be assigned.",
  alreadyInGroup: "The student is already in this class.",
  notInGroup: "The student isn't in any class.",
  blocked: (reason: string) => `This change can't be saved: ${reason}`,
  locked: "The schedule has been approved and can no longer be changed.",
  unreadable: "We couldn't read the request. Please reload the page and try again.",
  serverError: "Something went wrong while saving the schedule. Please try again in a moment.",
  network: "We couldn't reach the server. Check your connection and try again.",
} as const;
