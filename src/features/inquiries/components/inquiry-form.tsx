"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Send } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Locale } from "@/i18n/routing";
import { inquiryKinds } from "@/lib/domain/enums";
import { submitInquiry } from "../actions";
import { inquirySchema, type InquiryInput } from "../schema";

const KIND_LABELS: Record<(typeof inquiryKinds)[number], string> = {
  message: "kindMessage",
  callback: "kindCallback",
  viewing: "kindViewing",
};

export function InquiryForm({
  listingId,
  defaultKind = "message",
  compact = false,
}: {
  listingId?: string;
  defaultKind?: (typeof inquiryKinds)[number];
  compact?: boolean;
}) {
  const t = useTranslations("inquiry");
  const tErrors = useTranslations("errors");
  const locale = useLocale() as Locale;
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<InquiryInput>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      listingId,
      kind: defaultKind,
      name: "",
      email: "",
      phone: "",
      message: "",
      locale,
      website: "",
    },
  });

  const { execute, isPending } = useAction(submitInquiry, {
    onSuccess: ({ data }) => {
      if (data?.ok) {
        setSent(true);
        setServerError(null);
        form.reset();
      } else if (data) {
        setServerError(data.error.messageKey);
      }
    },
    onError: () => setServerError("errors.unexpected"),
  });

  if (sent) {
    return (
      <div className="rounded-card border border-success/40 bg-success-soft p-6 text-center">
        <CheckCircle2
          className="mx-auto size-8 text-success"
          aria-hidden="true"
        />
        <h3 className="mt-3 font-semibold text-ink">{t("successTitle")}</h3>
        <p className="mt-1 text-sm text-ink-muted">{t("successText")}</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => setSent(false)}
        >
          {t("sendAnother")}
        </Button>
      </div>
    );
  }

  const errors = form.formState.errors;
  const translateError = (key?: string) => {
    if (!key) return undefined;
    // Schema messages are translation keys; anything else is a Zod default.
    return key.startsWith("inquiry.") || key.startsWith("errors.")
      ? key.startsWith("errors.")
        ? tErrors(key.slice(7))
        : t(key.slice(8))
      : key;
  };

  return (
    <form
      onSubmit={form.handleSubmit((values) => execute(values))}
      className="space-y-4"
      noValidate
      aria-label={t("title")}
    >
      {!compact ? (
        <div>
          <h3 className="text-base font-semibold text-ink">{t("title")}</h3>
          <p className="mt-1 text-sm text-ink-muted">{t("subtitle")}</p>
        </div>
      ) : null}

      {/* Honeypot: hidden from people, irresistible to naive bots. */}
      <div
        aria-hidden="true"
        className="absolute left-[-9999px] top-auto size-px overflow-hidden"
      >
        <label htmlFor="website">Website</label>
        <input
          id="website"
          tabIndex={-1}
          autoComplete="off"
          {...form.register("website")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="inquiry-kind">{t("kind")}</Label>
        <Select
          value={form.watch("kind")}
          onValueChange={(value) =>
            form.setValue("kind", value as (typeof inquiryKinds)[number], {
              shouldDirty: true,
            })
          }
        >
          <SelectTrigger id="inquiry-kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {inquiryKinds.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {t(KIND_LABELS[kind])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("name")}
          htmlFor="inquiry-name"
          required
          error={translateError(errors.name?.message)}
        >
          <Input
            id="inquiry-name"
            autoComplete="name"
            placeholder={t("namePlaceholder")}
            aria-invalid={Boolean(errors.name)}
            {...form.register("name")}
          />
        </Field>

        <Field
          label={t("phone")}
          htmlFor="inquiry-phone"
          error={translateError(errors.phone?.message)}
        >
          <Input
            id="inquiry-phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            aria-invalid={Boolean(errors.phone)}
            {...form.register("phone")}
          />
        </Field>
      </div>

      <Field
        label={t("email")}
        htmlFor="inquiry-email"
        required
        error={translateError(errors.email?.message)}
      >
        <Input
          id="inquiry-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={Boolean(errors.email)}
          {...form.register("email")}
        />
      </Field>

      <Field label={t("message")} htmlFor="inquiry-message">
        <Textarea
          id="inquiry-message"
          rows={compact ? 4 : 5}
          placeholder={t("messagePlaceholder")}
          {...form.register("message")}
        />
      </Field>

      <div className="flex items-start gap-2.5">
        <Checkbox
          id="inquiry-consent"
          checked={form.watch("consent") === true}
          onCheckedChange={(checked) =>
            form.setValue(
              "consent",
              checked === true ? true : (undefined as never),
              {
                shouldValidate: form.formState.isSubmitted,
              },
            )
          }
          aria-invalid={Boolean(errors.consent)}
        />
        <Label
          htmlFor="inquiry-consent"
          className="text-xs font-normal leading-relaxed text-ink-muted"
        >
          {t("consent")}
        </Label>
      </div>
      {errors.consent ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {t("consentRequired")}
        </p>
      ) : null}

      {serverError ? (
        <p
          role="alert"
          className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {tErrors(serverError.replace(/^errors\./, ""))}
        </p>
      ) : null}

      <Button type="submit" full disabled={isPending}>
        <Send />
        {isPending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
