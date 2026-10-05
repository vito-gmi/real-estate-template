export type MailMessage = {
  readonly to: string | readonly string[];
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
  readonly replyTo?: string;
};

/**
 * Outbound email behind one interface, so the choice of provider is a
 * configuration detail. The console driver keeps development free of API keys.
 */
export interface MailAdapter {
  readonly name: string;
  send(message: MailMessage): Promise<void>;
}
