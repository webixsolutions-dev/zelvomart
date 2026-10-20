/**
 * Features the design shows but the backend has no endpoint for yet (decided 21 Oct: keep them
 * static for now). Each keeps the design's current behaviour; the backend work is a separate task.
 */
import { savePendingReview as saveReviewOnDevice, saveSubscriber as saveSubscriberOnDevice, type PendingReview } from "./reviews";

/**
 * TODO(api): open review submission with photos and videos. POST /api/reviews still asks for a
 * delivered order number and phone, and has no media upload; until it accepts any customer the
 * review is kept on this device as pending, as in the design.
 */
export function submitReview(review: PendingReview) {
  saveReviewOnDevice(review);
}

/** TODO(api): "Get email updates" subscribe — no subscribe endpoint yet; kept on this device. */
export function subscribeToUpdates(email: string) {
  saveSubscriberOnDevice(email);
}

/**
 * TODO(api): the full My Account dashboard (order list, claiming a past order, saved address,
 * forgotten password). Login and register already use /api/account; the rest shows as designed.
 */
export const accountDashboardAvailable = false;
