import { NextResponse } from "next/server";
import { ZodError } from "zod";

// Every endpoint answers failures with the same shape:
// { "error": { "code": string, "message": string, "field"?: string } }
// message is Ukrainian and is shown to the user as is.

export type ApiErrorCode =
  | "EMAIL_TAKEN"
  | "INVALID_CREDENTIALS"
  | "VALIDATION_ERROR"
  | "TITLE_INVALID"
  | "TIME_NOT_ALIGNED"
  | "DURATION_INVALID"
  | "OUTSIDE_WORKING_HOURS"
  | "TIME_IN_PAST"
  | "SLOT_TAKEN"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "NOT_FOUND";

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  field?: string,
) {
  return NextResponse.json({ error: { code, message, field } }, { status });
}

/**
 * Turns a Zod failure into a 400 pointing at the first offending field, so the
 * form can show the message right next to the input.
 */
export function validationError(error: ZodError) {
  const issue = error.issues[0];
  const field = issue.path.length > 0 ? String(issue.path[0]) : undefined;

  return apiError(400, "VALIDATION_ERROR", issue.message, field);
}

export function unauthorizedError() {
  return apiError(401, "UNAUTHORIZED", "Потрібно увійти в систему");
}
