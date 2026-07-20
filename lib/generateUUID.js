// crypto.randomUUID() isn't available in all Safari/iPad WebKit versions.
// This doesn't need to be cryptographically secure, just unique enough to
// group messages into a conversation for analytics.
export function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
