import { getJellyfinUrl, getJellyfinApiKey } from "./configStore";

interface JellyfinUserResponse {
  Id: string;
  Name: string;
}

export async function createJellyfinUser(
  username: string,
  password: string
): Promise<JellyfinUserResponse> {
  const jellyfinUrl = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();

  if (!jellyfinUrl || !apiKey) {
    throw new Error("Jellyfin n'est pas configuré");
  }

  const createRes = await fetch(`${jellyfinUrl}/Users/New`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Emby-Token": apiKey,
    },
    body: JSON.stringify({ Name: username }),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Échec de création: ${errorText}`);
  }

  const user: JellyfinUserResponse = await createRes.json();

  const passwordRes = await fetch(
    `${jellyfinUrl}/Users/${user.Id}/Password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Emby-Token": apiKey,
      },
      body: JSON.stringify({ NewPw: password, ResetPassword: false }),
    }
  );

  if (!passwordRes.ok) {
    throw new Error("Utilisateur créé mais impossible de définir le mot de passe");
  }

  return user;
}
