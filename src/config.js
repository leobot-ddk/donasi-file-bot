// ======================================================
// CONFIG
// ======================================================

export const BOT_USERNAME = (env) => {
  return String(
    env.TELEGRAM_BOT_USERNAME || ""
  ).replace(/^@/, "");
};


// ======================================================
// ADMIN IDS
// ======================================================

export function isAdmin(userId, env) {

  if (!userId) {
    return false;
  }

  const raw =
    String(
      env.ADMIN_IDS || ""
    ).trim();

  if (!raw) {
    return false;
  }

  const adminIds =
    raw
      .split(",")
      .map(id => id.trim())
      .filter(Boolean);

  return adminIds.includes(
    String(userId)
  );
}


// ======================================================
// ADMIN GROUP
// ======================================================

export function getAdminGroupId(env) {

  return String(
    env.ADMIN_GROUP_ID || ""
  ).trim();

}


// ======================================================
// ADMIN CHANNEL
// ======================================================

export function getAdminChannelId(env) {

  return String(
    env.ADMIN_CHANNEL_ID || ""
  ).trim();

}
