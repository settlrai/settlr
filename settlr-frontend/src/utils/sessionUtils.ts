const SESSION_ID_KEY = "settlr_session_id";

export function generateSessionId(): string {
  return crypto.randomUUID();
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") {
    return generateSessionId();
  }
  return generateSessionId();

  // let sessionId = sessionStorage.getItem(SESSION_ID_KEY);

  // if (!sessionId) {
  //   sessionId = generateSessionId();
  //   sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  // }

  // return sessionId;
}

export function clearSessionId(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(SESSION_ID_KEY);
  }
}
