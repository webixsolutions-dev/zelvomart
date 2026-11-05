/**
 * iPhone / iPad, including iPadOS 13+ which reports itself as a Mac ("Macintosh") but has a touch screen.
 * Used for the "press and hold the QR → Save to Photos" hint on the payment page.
 */
export function isIosDevice(userAgent: string, maxTouchPoints = 0) {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

/** Phones and tablets (where a banking app can open a saved QR); everything else is treated as a desktop. */
export function isMobileDevice(userAgent: string, maxTouchPoints = 0) {
  return isIosDevice(userAgent, maxTouchPoints) || /Android|Mobile/i.test(userAgent);
}
