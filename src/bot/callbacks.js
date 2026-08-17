// ======================================================
// CALLBACK HANDLER
// ======================================================

import {
  answerCallbackQuery,
  sendMessage
} from "../services/telegram.js";

import {
  setProtect,
  askCaption,
  setCaption,
  askDuration,
  setDuration,
  finishFile
} from "./user.js";


// ======================================================
// HANDLE CALLBACK
// ======================================================

export async function handleCallback(
  query,
  env
) {

  if (!query) {
    return;
  }


  const queryId =
    query.id;

  const userId =
    query.from?.id;

  const chatId =
    query.message?.chat?.id;

  const data =
    String(
      query.data || ""
    );


  if (!userId || !chatId) {

    await answerCallbackQuery(
      env,
      queryId,
      "❌ Data pengguna tidak ditemukan."
    ).catch(() => {});

    return;
  }


  // Tutup loading tombol
  await answerCallbackQuery(
    env,
    queryId
  ).catch(() => {});


  // ====================================================
  // PARSE CALLBACK DATA
  // ====================================================
  //
  // Format:
  //
  // protect:on:SESSION_ID
  // protect:off:SESSION_ID
  // caption:none:SESSION_ID
  // duration:forever:SESSION_ID
  // duration:1d:SESSION_ID
  // duration:7d:SESSION_ID
  // duration:30d:SESSION_ID
  // duration:custom:SESSION_ID
  //
  // ====================================================

  const parts =
    data.split(":");

  const action =
    parts[0] || "";

  const value =
    parts[1] || "";

  const sessionId =
    parts.slice(2).join(":");


  if (!sessionId) {

    await sendMessage(
      env,
      chatId,
      "❌ Sesi file tidak ditemukan.\n\nKirim file kembali."
    );

    return;
  }


  // ====================================================
  // PROTECT ON
  // ====================================================

  if (
    action === "protect" &&
    value === "on"
  ) {

    const session =
      await setProtect(
        env,
        sessionId,
        true
      );


    if (!session) {

      await sendMessage(
        env,
        chatId,
        "❌ Sesi file tidak ditemukan.\n\nKirim file kembali."
      );

      return;
    }


    await sendMessage(
      env,
      chatId,
      "🔒 Protect Content: ON"
    );


    await askCaption(
      env,
      chatId,
      sessionId
    );


    return;
  }


  // ====================================================
  // PROTECT OFF
  // ====================================================

  if (
    action === "protect" &&
    value === "off"
  ) {

    const session =
      await setProtect(
        env,
        sessionId,
        false
      );


    if (!session) {

      await sendMessage(
        env,
        chatId,
        "❌ Sesi file tidak ditemukan.\n\nKirim file kembali."
      );

      return;
    }


    await sendMessage(
      env,
      chatId,
      "🌐 Public: ON"
    );


    await askCaption(
      env,
      chatId,
      sessionId
    );


    return;
  }


  // ====================================================
  // CAPTION NONE
  // ====================================================

  if (
    action === "caption" &&
    value === "none"
  ) {

    const session =
      await setCaption(
        env,
        sessionId,
        null
      );


    if (!session) {

      await sendMessage(
        env,
        chatId,
        "❌ Sesi file tidak ditemukan.\n\nKirim file kembali."
      );

      return;
    }


    await askDuration(
      env,
      chatId,
      sessionId
    );


    return;
  }


  // ====================================================
  // DURATION FOREVER
  // ====================================================

  if (
    action === "duration" &&
    value === "forever"
  ) {

    await finishWithDuration(
      env,
      chatId,
      sessionId,
      null
    );

    return;
  }


  // ====================================================
  // DURATION 1 DAY
  // ====================================================

  if (
    action === "duration" &&
    value === "1d"
  ) {

    await finishWithDuration(
      env,
      chatId,
      sessionId,
      1 * 24 * 60 * 60
    );

    return;
  }


  // ====================================================
  // DURATION 7 DAYS
  // ====================================================

  if (
    action === "duration" &&
    value === "7d"
  ) {

    await finishWithDuration(
      env,
      chatId,
      sessionId,
      7 * 24 * 60 * 60
    );

    return;
  }


  // ====================================================
  // DURATION 30 DAYS
  // ====================================================

  if (
    action === "duration" &&
    value === "30d"
  ) {

    await finishWithDuration(
      env,
      chatId,
      sessionId,
      30 * 24 * 60 * 60
    );

    return;
  }


  // ====================================================
  // CUSTOM
  // ====================================================

  if (
    action === "duration" &&
    value === "custom"
  ) {

    await sendMessage(
      env,
      chatId,

      "✏️ Kirim durasi custom.\n\n" +

      "Contoh:\n" +
      "• 30min = 30 menit\n" +
      "• 2h = 2 jam\n" +
      "• 3d = 3 hari\n" +
      "• 2w = 2 minggu\n" +
      "• 1m = 1 bulan\n" +
      "• forever = selamanya"
    );


    return;
  }


  // ====================================================
  // CALLBACK TIDAK DIKENAL
  // ====================================================

  await sendMessage(
    env,
    chatId,
    "❌ Pilihan tidak dikenali."
  );

}


// ======================================================
// FINISH DENGAN DURASI
// ======================================================

async function finishWithDuration(
  env,
  chatId,
  sessionId,
  seconds
) {

  try {

    // ================================================
    // SIMPAN DURASI
    // ================================================

    const session =
      await setDuration(
        env,
        sessionId,
        seconds
      );


    if (!session) {

      await sendMessage(
        env,
        chatId,

        "❌ Sesi file tidak ditemukan.\n\n" +
        "Kirim file kembali."
      );

      return;
    }


    // ================================================
    // BUAT LINK
    // ================================================

    await finishFile(
      env,
      sessionId
    );


  } catch (error) {

    console.error(
      "FINISH CALLBACK ERROR:",
      error
    );


    await sendMessage(
      env,
      chatId,

      "❌ Gagal membuat link.\n\n" +
      "Silakan coba lagi."
    );

  }

}
