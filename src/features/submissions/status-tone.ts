import type { SubmissionStatus } from '@/lib/domain/enums';

/** Badge colour per submission status, shared by the queue and the review page. */
export const submissionTone: Record<
  SubmissionStatus,
  'brand' | 'warning' | 'success' | 'danger' | 'neutral'
> = {
  incomplete: 'neutral',
  pending: 'warning',
  approved: 'success',
  rejected: 'neutral',
  spam: 'danger',
};
