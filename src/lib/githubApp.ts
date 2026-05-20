import * as crypto from "crypto";

const GITHUB_APP_ID = process.env.GITHUB_APP_ID || "";
const GITHUB_APP_PRIVATE_KEY = (
  process.env.GITHUB_APP_PRIVATE_KEY || ""
).replace(/\\n/g, "\n");

function generateJWT(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iat: now - 60, exp: now + 600, iss: GITHUB_APP_ID }),
  ).toString("base64url");

  const signature = crypto
    .createSign("RSA-SHA256")
    .update(`${header}.${payload}`)
    .sign(GITHUB_APP_PRIVATE_KEY, "base64url");

  return `${header}.${payload}.${signature}`;
}

export async function getInstallationId(
  accessToken: string,
): Promise<number | null> {
  const res = await fetch("https://api.github.com/user/installations", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as any;
  const appId = parseInt(GITHUB_APP_ID);
  const appSlug = process.env.GITHUB_APP_SLUG || "endgit-local-dev";

  const installation = data.installations?.find(
    (inst: any) =>
      inst.app_id === appId ||
      inst.app_slug === appSlug ||
      (inst.app_slug && inst.app_slug.includes("endgit")),
  );

  return installation?.id || null;
}

export async function getInstallationToken(
  installationId: number,
): Promise<string | null> {
  const jwt = generateJWT();

  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github.v3+json",
      },
    },
  );

  if (!res.ok) return null;

  const data = (await res.json()) as any;
  return data.token || null;
}

export async function commitFileToRepo(
  installationToken: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
): Promise<boolean> {
  const encoded = Buffer.from(content).toString("base64");

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${installationToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        content: encoded,
        branch,
      }),
    },
  );

  return res.ok;
}
