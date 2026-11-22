// User-facing attendance messages (AC-9.4: clear, non-technical).
export const AM = {
  statusInvalid: "Choose Present, Late or Absent.",
  remarksInvalid: "Remarks must be text.",
  remarksTooLong: "Remarks must have at most 500 characters.",
  studentInvalid: "This student isn't in this class. Please reload the page.",
  cancelled: "Attendance isn't taken for cancelled sessions.",
  future: "Attendance can only be marked on the day of the session or later.",
} as const;
