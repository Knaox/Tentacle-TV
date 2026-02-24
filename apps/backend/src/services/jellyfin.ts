const JELLYFIN_URL = process.env.JELLYFIN_URL || "http://localhost:8096";
const JELLYFIN_ADMIN_API_KEY = process.env.JELLYFIN_ADMIN_API_KEY;

interface JellyfinUserResponse {
  Id: string;
  Name: string;
}

export async function createJellyfinUser(
  username: string,
  password: string
): Promise<JellyfinUserResponse> {
  if (!JELLYFIN_ADMIN_API_KEY) {
    throw new Error("JELLYFIN_ADMIN_API_KEY is not configured");
  }

  // Create the user
  const createRes = await fetch(`${JELLYFIN_URL}/Users/New`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Emby-Token": JELLYFIN_ADMIN_API_KEY,
    },
    body: JSON.stringify({ Name: username }),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Failed to create Jellyfin user: ${errorText}`);
  }

  const user: JellyfinUserResponse = await createRes.json();

  // Set the user's password
  const passwordRes = await fetch(
    `${JELLYFIN_URL}/Users/${user.Id}/Password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Emby-Token": JELLYFIN_ADMIN_API_KEY,
      },
      body: JSON.stringify({
        NewPw: password,
        ResetPassword: false,
      }),
    }
  );

  if (!passwordRes.ok) {
    throw new Error("User created but failed to set password");
  }

  return user;
}
