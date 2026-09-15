import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { URL } from "node:url";
import path from "node:path";
import webpush from "web-push";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Uses existing local CLI sessions. Never prints or persists private key material.
const project = "controle-validades-alissonjs01";
const siteId = "800030c2-21af-4f17-8d40-1e9f59cf2f00";
const firebase = JSON.parse(
  await readFile(".cli-config/configstore/firebase-tools.json", "utf8")
);
const netlify = JSON.parse(
  await readFile(
    path.join(process.env.APPDATA, "netlify/Config/config.json"),
    "utf8"
  )
);
const user = netlify.users[netlify.userId];
const netlifyToken =
  typeof user.auth === "string" ? user.auth : user.auth.token;
async function api(url, token, method = "GET", data) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    ...(data ? { body: JSON.stringify(data) } : {})
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `API ${method} ${new URL(url).hostname} returned ${response.status}: ${error.message ?? "request rejected"}`
    );
  }
  return response.status === 204 ? null : response.json();
}
const google = (url, method, data) =>
  api(url, firebase.tokens.access_token, method, data);
const net = (url, method, data) =>
  api(`https://api.netlify.com/api/v1${url}`, netlifyToken, method, data);
const site = await net(`/sites/${siteId}`);
const envUrl = `/accounts/${site.account_id}/env?site_id=${siteId}`;
const env = await net(envUrl);
// Lambda disables require(esm), which Firebase Admin's current JWKS dependency needs.
const nodeOptions = env.find((item) => item.key === "NODE_OPTIONS");
if (!nodeOptions) {
  await net(envUrl, "POST", [{ key: "NODE_OPTIONS", values: [{ context: "production", value: "--experimental-require-module" }] }]);
} else if (!nodeOptions.values.some((entry) => entry.context === "production" && entry.value.includes("--experimental-require-module"))) {
  throw new Error("Existing NODE_OPTIONS needs require-module enabled; preserve other options.");
}
if (process.argv.includes("--verify")) {
  const item = env.find((item) => item.key === "FIREBASE_ADMIN_CREDENTIALS");
  const value = item?.values.find(
    (entry) => entry.context === "production"
  )?.value;
  if (!value)
    throw new Error("Server credentials unavailable for verification.");
  const app = initializeApp({ credential: cert(JSON.parse(value)) });
  const db = getFirestore(app);
  const lots = await db.collection("inventory/shared/lots").limit(1).get();
  const devices = await db
    .collection("pushDevices")
    .where("enabled", "==", true)
    .get();
  process.stdout.write(
    `Server Firestore access OK; stock available: ${!lots.empty}; active push devices: ${devices.size}\n`
  );
  await db.terminate();
  process.exit(0);
}
const names = [
  "FIREBASE_ADMIN_CREDENTIALS",
  "WEB_PUSH_PUBLIC_KEY",
  "WEB_PUSH_PRIVATE_KEY"
];
if (names.every((name) => env.some((item) => item.key === name))) {
  process.stdout.write(
    "Push environment already configured. No keys rotated.\n"
  );
  process.exit(0);
}
if (names.some((name) => env.some((item) => item.key === name)))
  throw new Error(
    "Partial push configuration exists; inspect before rotating keys."
  );
const accountId = "validda-push";
const email = `${accountId}@${project}.iam.gserviceaccount.com`;
const accountsUrl = `https://iam.googleapis.com/v1/projects/${project}/serviceAccounts`;
const accounts = await google(accountsUrl);
if (!accounts.accounts?.some((account) => account.email === email))
  await google(accountsUrl, "POST", {
    accountId,
    serviceAccount: { displayName: "ValiddA scheduled push" }
  });
const resource = `https://cloudresourcemanager.googleapis.com/v1/projects/${project}`;
const policy = await google(`${resource}:getIamPolicy`, "POST", {});
policy.bindings ??= [];
const role = "roles/datastore.user";
let binding = policy.bindings.find(
  (item) => item.role === role && !item.condition
);
if (!binding) {
  binding = { role, members: [] };
  policy.bindings.push(binding);
}
if (!binding.members.includes(`serviceAccount:${email}`)) {
  binding.members.push(`serviceAccount:${email}`);
  await google(`${resource}:setIamPolicy`, "POST", { policy });
}
const key = await google(`${accountsUrl}/${email}/keys`, "POST", {
  privateKeyType: "TYPE_GOOGLE_CREDENTIALS_FILE"
});
try {
  const credentials = Buffer.from(key.privateKeyData, "base64").toString(
    "utf8"
  );
  const vapid = webpush.generateVAPIDKeys();
  const values = [credentials, vapid.publicKey, vapid.privateKey];
  await net(
    envUrl,
    "POST",
    names.map((name, i) => ({
      key: name,
      values: [{ context: "production", value: values[i] }]
    }))
  );
  process.stdout.write(
    "Push credentials configured in Netlify production; no secrets printed.\n"
  );
} catch (error) {
  await google(`https://iam.googleapis.com/v1/${key.name}`, "DELETE");
  throw error;
}
