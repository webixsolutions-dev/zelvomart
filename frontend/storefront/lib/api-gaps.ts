/**
 * Features the design shows but the backend has no endpoint for yet (decided 21 Oct: keep them
 * static for now). Each keeps the design's current behaviour; the backend work is a separate task.
 */
import { saveSubscriber as saveSubscriberOnDevice } from "./reviews";


/** TODO(api): "Get email updates" subscribe — no subscribe endpoint yet; kept on this device. */
export function subscribeToUpdates(email: string) {
  saveSubscriberOnDevice(email);
}

/**
 * TODO(api): the full My Account dashboard (order list, claiming a past order, saved address,
 * forgotten password). Login and register already use /api/account; the rest shows as designed.
 */
export const accountDashboardAvailable = false;
