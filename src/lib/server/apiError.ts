import { getTranslations } from "next-intl/server";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@/lib/domain/auth";
import type { BookingRuleErrorCode } from "@/lib/domain/bookingRules";
import { MAX_OCCURRENCES, MIN_OCCURRENCES } from "@/lib/domain/recurrence";

const SCHEMA_LIMITS = {
  maxName: MAX_NAME_LENGTH,
  minPassword: MIN_PASSWORD_LENGTH,
  maxPassword: MAX_PASSWORD_LENGTH,
  minRepeat: MIN_OCCURRENCES,
  maxRepeat: MAX_OCCURRENCES,
};

// Every endpoint answers failures with the same shape:
// { "error": { "code": string, "message": string, "field"?: string } }
//
// The code is decided by the domain, the wording by the dictionary of the
// language this request came in. Nothing here spells a sentence out: adding a
// language must not mean hunting for strings across the routes.

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
  | "NOT_FOUND"
  // Beyond the codes in the specification, which asks not to invent new ones
  // without need. The need here is that a refusal to book because the address
  // is unconfirmed has to be told apart from an ordinary FORBIDDEN, since the
  // user can fix only one of the two.
  | "EMAIL_NOT_VERIFIED"
  // Likewise: throttling after repeated failures is neither a wrong password
  // nor a validation problem, and the user is told to wait rather than to fix
  // the request.
  | "TOO_MANY_ATTEMPTS";

/** Keys in the api section of the dictionaries; several map onto one HTTP code. */
type MessageKey = string;

/**
 * The API code for a broken domain rule. The domain names rules more precisely
 * than the specification names error codes, so several of its names collapse
 * into one code the clients already know.
 */
export function apiCodeFor(rule: BookingRuleErrorCode): ApiErrorCode {
  switch (rule) {
    case "TIME_NOT_ALIGNED":
    case "DURATION_INVALID":
    case "OUTSIDE_WORKING_HOURS":
    case "TIME_IN_PAST":
      return rule;
    case "TITLE_REQUIRED":
    case "TITLE_TOO_LONG":
      return "TITLE_INVALID";
    default:
      return "VALIDATION_ERROR";
  }
}

type ErrorValues = Record<string, string | number>;

async function message(key: MessageKey, values?: ErrorValues) {
  const t = await getTranslations("api");

  return t(key, values);
}

/**
 * Builds the response. The HTTP code and the error code come from the caller,
 * the sentence from the dictionary, so a translator never has to read a route.
 */
export async function apiError(
  status: number,
  code: ApiErrorCode,
  messageKey: MessageKey,
  options: { field?: string; values?: ErrorValues } = {},
) {
  return NextResponse.json(
    {
      error: {
        code,
        message: await message(messageKey, options.values),
        field: options.field,
      },
    },
    { status },
  );
}

/**
 * Turns a Zod failure into a 400 pointing at the first offending field, so the
 * form can show the message right next to the input.
 *
 * The schemas carry dictionary keys rather than sentences, which is what lets
 * the same schema serve both languages.
 */
export async function validationError(error: ZodError) {
  const issue = error.issues[0];
  const field = issue.path.length > 0 ? String(issue.path[0]) : undefined;

  return apiError(400, "VALIDATION_ERROR", issue.message, {
    field,
    // A schema cannot carry values with its key, so every limit a schema
    // message might mention is offered here. The names differ per rule, so a
    // sentence picks the one it needs and ignores the rest, and the numbers
    // still live only in the domain.
    values: SCHEMA_LIMITS,
  });
}

export async function unauthorizedError() {
  return apiError(401, "UNAUTHORIZED", "UNAUTHORIZED");
}

export async function tooManyAttemptsError() {
  return apiError(429, "TOO_MANY_ATTEMPTS", "TOO_MANY_ATTEMPTS");
}

export async function emailNotVerifiedError() {
  return apiError(403, "EMAIL_NOT_VERIFIED", "EMAIL_NOT_VERIFIED");
}
