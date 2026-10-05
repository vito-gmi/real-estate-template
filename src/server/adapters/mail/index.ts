import { Resend } from "resend";
import { serverEnv } from "@/env";
import type { MailAdapter, MailMessage } from "./types";

function createConsoleMailer(): MailAdapter {
  return {
    name: "console",
    async send(message) {
      console.info(
        [
          "— email —",
          `to: ${[message.to].flat().join(", ")}`,
          `subject: ${message.subject}`,
          message.text,
          "—",
        ].join("\n"),
      );
    },
  };
}

function createResendMailer(): MailAdapter {
  const apiKey = serverEnv.RESEND_API_KEY;
  if (!apiKey)
    throw new Error('RESEND_API_KEY is required when MAIL_DRIVER is "resend".');

  const client = new Resend(apiKey);

  return {
    name: "resend",
    async send(message: MailMessage) {
      const { error } = await client.emails.send({
        from: serverEnv.MAIL_FROM,
        to: [...[message.to].flat()],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      });

      if (error)
        throw new Error(`Resend rejected the message: ${error.message}`);
    },
  };
}

let instance: MailAdapter | undefined;

export function mailer(): MailAdapter {
  if (!instance) {
    instance =
      serverEnv.MAIL_DRIVER === "resend"
        ? createResendMailer()
        : createConsoleMailer();
  }
  return instance;
}

export type { MailAdapter, MailMessage } from "./types";
