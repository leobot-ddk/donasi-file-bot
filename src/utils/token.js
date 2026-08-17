// ======================================================
// SHORT FILE TOKEN
// ======================================================

export function createFileToken() {

  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
    "abcdefghijklmnopqrstuvwxyz" +
    "0123456789";

  const bytes =
    crypto.getRandomValues(
      new Uint8Array(8)
    );

  let token = "";

  for (const byte of bytes) {

    token +=
      chars[
        byte % chars.length
      ];

  }

  return token;

}
