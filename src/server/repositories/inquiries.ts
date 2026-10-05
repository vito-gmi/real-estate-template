import 'server-only';

import { and, count, desc, eq, inArray } from 'drizzle-orm';
import type { InquiryStatus } from '@/lib/domain/enums';
import { db } from '@/server/db/client';
import { inquiries, listingTranslations, listings } from '@/server/db/schema';

export type NewInquiry = typeof inquiries.$inferInsert;

export async function createInquiry(input: NewInquiry): Promise<{ id: string }> {
  const [row] = await db.insert(inquiries).values(input).returning({ id: inquiries.id });
  return row!;
}

export type InquiryListItem = {
  id: string;
  kind: (typeof inquiries.$inferSelect)['kind'];
  status: InquiryStatus;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  createdAt: Date;
  listingId: string | null;
  listingReference: number | null;
  listingTitle: string | null;
};

export async function listInquiries(options: {
  statuses?: readonly InquiryStatus[];
  limit?: number;
  offset?: number;
}): Promise<readonly InquiryListItem[]> {
  const conditions = options.statuses?.length
    ? [inArray(inquiries.status, [...options.statuses])]
    : [];

  return db
    .select({
      id: inquiries.id,
      kind: inquiries.kind,
      status: inquiries.status,
      name: inquiries.name,
      email: inquiries.email,
      phone: inquiries.phone,
      message: inquiries.message,
      createdAt: inquiries.createdAt,
      listingId: inquiries.listingId,
      listingReference: listings.reference,
      listingTitle: listingTranslations.title,
    })
    .from(inquiries)
    .leftJoin(listings, eq(listings.id, inquiries.listingId))
    .leftJoin(
      listingTranslations,
      and(eq(listingTranslations.listingId, listings.id), eq(listingTranslations.locale, 'bg')),
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(inquiries.createdAt))
    .limit(options.limit ?? 50)
    .offset(options.offset ?? 0);
}

export async function updateInquiryStatus(
  id: string,
  status: InquiryStatus,
  handledBy: string,
): Promise<void> {
  await db
    .update(inquiries)
    .set({ status, handledBy, handledAt: new Date() })
    .where(eq(inquiries.id, id));
}

export async function countInquiriesByStatus(status: InquiryStatus): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(inquiries)
    .where(eq(inquiries.status, status));
  return Number(row?.total ?? 0);
}
