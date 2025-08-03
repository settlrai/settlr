import { BASE_URL } from "@/constants/api";

export async function triggerRegionFetch(
  conversationId: string,
  regionId: number
): Promise<void> {
  const response = await fetch(
    `${BASE_URL}/conversations/${conversationId}/regions/${regionId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch region details: ${response.statusText}`);
  }
}
export async function triggerGlobalFetch(conversationId: string) {
  const response = await fetch(`${BASE_URL}/conversations/${conversationId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch global region details: ${response.statusText}`
    );
  }
}
