// User-facing payment messages (AC-9.4: clear, non-technical).
export const PM = {
  statusInvalid: "Choose Paid or Unpaid.",
  paidAtInvalid: "Enter a valid payment date.",
  paidAtFuture: "The payment date can't be in the future.",
  notFound: "This payment doesn't exist. Please reload the page.",
  sameStatus: "This payment already has this status. Please reload the page.",
  invalidInput: "Please check the highlighted fields.",
  unreadable: "We couldn't read the request. Please reload the page and try again.",
  serverError: "Something went wrong while saving. Please try again in a moment.",
} as const;
