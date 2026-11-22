import { MESSAGE_MAX } from "./types";

// User-facing notification messages (AC-9.4: clear, non-technical).
export const NM = {
  actionInvalid: "Choose an action: save, send or dismiss.",
  messageEmpty: "The message can't be empty.",
  messageTooLong: `The message must be at most ${MESSAGE_MAX} characters.`,
  notFound: "This notification doesn't exist. Please reload the page.",
  notPending: "This notification was already sent or dismissed. Please reload the page.",
  invalidInput: "Please check the message.",
  unreadable: "We couldn't read the request. Please reload the page and try again.",
  serverError: "Something went wrong while saving. Please try again in a moment.",
  copyFailed: "Your browser blocked copying. Select the message and copy it by hand.",
} as const;
