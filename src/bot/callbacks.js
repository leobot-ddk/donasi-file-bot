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
  askDuration,
  setCaption,
  setDuration,
  finishFile,
  getSession
} from "./user.js";


// ======================================================
// CALLBACK HANDLER
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


  await answerCallbackQuery(
    env,
    queryId
  ).catch(() => {});


  // ====================================================
  // PROTECT / PUBLIC
  // ====================================================

  if (
    data.startsWith("protect:")
  ) {

    const parts =
      data.split(":");

    const mode =
      parts[1];

    const sessionId =
      parts.slice(2).join(":");


    if (
      !sessionId ||
      (
        mode !== "on" &&
        mode !== "off"
      )
    ) {

      await sendMessage(
        env,
        chatId,
        "❌ Data sesi tidak valid."
      );

      return;
    }


    const session =
      await getSession(
        env,
        sessionId
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


    if (
      Number(session.telegram_id) !==
      Number(userId)
    ) {

      await sendMessage(
        env,
        chatId,
        "❌ Sesi ini bukan milik Anda."
      );

      return;
    }


    await setProtect(
      env,
      sessionId,
      mode === "on"
    );


    await sendMessage(
      env,
      chatId,

      mode === "on"
        ? "🔒 Protect Content: ON"
        : "🌐 Public: ON"
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
    data.startsWith("caption:none:")
  ) {

    const sessionId =
      data.substring(
        "caption:none:".length
      );


    if (!sessionId) {

      await sendMessage(
        env,
        chatId,
        "❌ Data sesi tidak valid."
      );

      return;
    }


    const session =
      await getSession(
        env,
        sessionId
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


    if (
      Number(session.telegram_id) !==
      Number(userId)
    ) {

      await sendMessage(
        env,
        chatId,
        "❌ Sesi ini bukan milik Anda."
      );

      return;
    }


    await setCaption(
      env,
      sessionId,
      null
    );


    await askDuration(
      env,
      chatId,
      sessionId
    );


    return;
  }


  // ====================================================
  // DURASI
  // ====================================================

  if (
    data.startsWith("duration:")
  ) {

    const parts =
      data.split(":");

    const type =
      parts[1];

    const sessionId =
      parts.slice(2).join(":");


    if (!sessionId) {

      await sendMessage(
        env,
        chatId,
        "❌ Data sesi tidak valid."
      );

      return;
    }


    const session =
      await getSession(
        env,
        sessionId
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


    if (
      Number(session.telegram_id) !==
      Number(userId)
    ) {

      await sendMessage(
        env,
        chatId,
        "❌ Sesi ini bukan milik Anda."
      );

      return;
    }


    // ================================================
    // CUSTOM
    // ================================================

    if (
      type === "custom"
    ) {

      await sendMessage(
        env,
        chatId,

        "✏️ Kirim durasi custom.\n\n" +

        "Contoh:\n" +
        "30min = 30 menit\n" +
        "2h = 2 jam\n" +
        "3d = 3 hari\n" +
        "2w = 2 minggu\n" +
        "1m = 1 bulan\n" +
        "forever = selamanya"
      );


      // Custom akan diproses oleh router
      // menggunakan sessionId dari sesi terbaru user.

      return;
    }


    // ================================================
    // SELAMANYA
    // ================================================

    if (
      type === "forever"
    ) {

      await setDuration(
        env,
        sessionId,
        null
      );


      await finishFile(
        env,
        sessionId
      );


      return;
    }


    // ================================================
    // PRESET
    // ================================================

    let seconds =
      null;


    if (
      type === "1d"
    ) {

      seconds =
        1 *
        24 *
        60 *
        60;

    }


    else if (
      type === "7d"
    ) {

      seconds =
        7 *
        24 *
        60 *
        60;

    }


    else if (
      type === "30d"
    ) {

      seconds =
        30 *
        24 *
        60 *
        60;

    }


    else {

      await sendMessage(
        env,
        chatId,
        "❌ Durasi tidak dikenali."
      );

      return;
    }


    await setDuration(
      env,
      sessionId,
      seconds
    );


    await finishFile(
      env,
      sessionId
    );


    return;
  }

}
