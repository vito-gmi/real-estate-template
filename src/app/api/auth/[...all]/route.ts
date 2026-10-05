import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth/config";

/** better-auth's own endpoints: session, sign-out, two-factor enrolment. */
export const { GET, POST } = toNextJsHandler(auth.handler);
