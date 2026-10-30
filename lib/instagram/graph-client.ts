// Thin wrapper over the Graph API endpoints Instagram Messaging uses -
// same Send API / user-profile shape Meta documents for Messenger, reused
// for Instagram professional accounts. Not confirmed against a real call
// from this account (needs her Meta app + page access token to exist
// first) - see README's Instagram section for setup and what to check if
// a call here ever fails.
const GRAPH_VERSION = "v21.0";

export async function sendInstagramMessage(recipientId: string, text: string, pageAccessToken: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("Instagram send failed", res.status, body);
      return { ok: false, error: `Instagram send failed (${res.status})` };
    }
    return { ok: true };
  } catch (err) {
    console.error("Instagram send threw", err);
    return { ok: false, error: err instanceof Error ? err.message : "Instagram send failed" };
  }
}

export async function fetchInstagramProfile(psid: string, pageAccessToken: string): Promise<{ username: string | null; name: string | null }> {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${psid}?fields=username,name&access_token=${encodeURIComponent(pageAccessToken)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { username: null, name: null };
    const body = (await res.json()) as { username?: string; name?: string };
    return { username: body.username ?? null, name: body.name ?? null };
  } catch (err) {
    console.error("Instagram profile fetch failed", err);
    return { username: null, name: null };
  }
}
