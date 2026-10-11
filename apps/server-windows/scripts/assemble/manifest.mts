/**
 * `AppxManifest.xml` à partir du modèle `msix/Package.appxmanifest`.
 *
 * L'identité est un PARAMÈTRE : celle du développement par défaut (un essai en
 * VM se signe avec un certificat au même `Publisher`), celle que le Partner
 * Center aura réservée pour le Store, passée par le workflow (fil E).
 */

export interface PackageIdentity {
  /** `Identity/@Name`, réservé par le Partner Center pour le Store. */
  name: string;
  /** `Identity/@Publisher` : le sujet exact du certificat qui signe. */
  publisher: string;
  publisherDisplayName: string;
}

/** Pour un essai local ou en VM ; jamais soumis au Store. */
export const DEV_IDENTITY: PackageIdentity = {
  name: "TentacleServer.Dev",
  publisher: "CN=Tentacle Server Dev",
  publisherDisplayName: "Tentacle TV (dev)",
};

/** X.Y.Z.0 : le Store exige un 4e champ à 0. */
export function checkPackageVersion(version: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (match === null) throw new Error(`version « ${version} » : attendu X.Y.Z.0`);
  if (match.slice(1).some((part) => Number(part) > 65535)) throw new Error(`version « ${version} » : champ > 65535`);
  if (match[4] !== "0") throw new Error(`version « ${version} » : le 4e champ doit valoir 0 (Store)`);
  return version;
}

export function checkIdentity(identity: PackageIdentity): PackageIdentity {
  if (!/^[-.A-Za-z0-9]{3,50}$/.test(identity.name)) throw new Error(`nom de paquet invalide : ${identity.name}`);
  if (!/^CN=/.test(identity.publisher)) throw new Error(`éditeur invalide (CN=… attendu) : ${identity.publisher}`);
  if (identity.publisherDisplayName.trim() === "") throw new Error("nom d'éditeur affiché vide");
  return identity;
}

function xmlEscape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function renderManifest(template: string, identity: PackageIdentity, version: string): string {
  const values: Record<string, string> = {
    IDENTITY_NAME: checkIdentity(identity).name,
    PUBLISHER: identity.publisher,
    PUBLISHER_DISPLAY_NAME: identity.publisherDisplayName,
    VERSION: checkPackageVersion(version),
  };
  const rendered = template.replace(/\{\{(\w+)\}\}/g, (token, key: string) => {
    const value = values[key];
    if (value === undefined) throw new Error(`jeton inconnu dans le manifeste : ${token}`);
    return xmlEscape(value);
  });
  return rendered;
}
