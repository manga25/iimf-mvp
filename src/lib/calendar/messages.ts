// User-facing calendar messages (AC-9.4: clear, non-technical).
export const CM = {
  startInvalid: "Enter a valid start date and time.",
  endInvalid: "Enter a valid end date and time.",
  endBeforeStart: "The end must be after the start.",
  reasonRequired: "Enter a reason (for example, “Christmas holidays”).",
  reasonTooLong: "The reason must have at most 200 characters.",
  modalityInvalid: "Choose In-Person or Online.",
  blockNotFound: "This blocked period no longer exists. Please reload the page.",
  sessionNotFound: "This session doesn't exist. Please reload the page.",
  alreadyCancelled: "This session is already cancelled.",
  finished: "This session has already finished and can no longer be changed.",
  sameModality: "The session already has this modality.",
  invalidInput: "Please check the highlighted fields.",
  unreadable: "We couldn't read the request. Please reload the page and try again.",
  serverError: "Something went wrong while saving. Please try again in a moment.",
  network: "We couldn't reach the server. Check your connection and try again.",
} as const;
