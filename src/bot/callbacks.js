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
  finishFile
} from "./user.js";


// ======================================================
// STATE CALLBACK
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
  // PROTECT
  // ====================================================

  if (
    data === "protect:on"
  ) {

    const ok =
      setProtect(
        userId,
        true
      );


    if (!ok) {

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
      chatId
    );


    return;

  }


  // ====================================================
  // PUBLIC
  // ====================================================

  if (
    data === "protect:off"
  ) {

    const ok =
      setProtect(
        userId,
        false
      );


    if (!ok) {

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
      chatId
    );


    return;

  }


  // ====================================================
  // CAPTION NONE
  // ====================================================

  if (
    data === "caption:none"
  ) {

    const ok =
      setCaption(
        userId,
        null
      );


    if (!ok) {

      await sendMessage(
        env,
        chatId,
        "❌ Sesi file tidak ditemukan.\n\nKirim file kembali."
      );

      return;

    }


    await askDuration(
      env,
      chatId
    );


    return;

  }


  // ====================================================
  // DURASI SELAMANYA
  // ====================================================

  if (
    data === "duration:forever"
  ) {

    await finishWithDuration(
      env,
      userId,
      chatId,
      null
    );

    return;

  }


  // ====================================================
  // DURASI PRESET
  // ====================================================

  if (
    data === "duration:1d"
  ) {

    await finishWithDuration(
      env,
      userId,
      chatId,
      1 * 24 * 60 * 60
    );

    return;

  }


  if (
    data === "duration:7d"
  ) {

    await finishWithDuration(
      env,
      userId,
      chatId,
      7 * 24 * 60 * 60
    );

    return;

  }


  if (
    data === "duration:30d"
  ) {

    await finishWithDuration(
      env,
      userId,
      chatId,
      30 * 24 * 60 * 60
    );

    return;

  }


  // ====================================================
  // CUSTOM
  // ====================================================

  if (
    data === "duration:custom"
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

}


// ======================================================
// FINISH DENGAN DURASI
// ======================================================

async function finishWithDuration(
  env,
  userId,
  chatId,
  seconds
) {

  try {

    const ok =
      setDuration(
        userId,
        seconds
      );


    if (!ok) {

      await sendMessage(
        env,
        chatId,

        "❌ Sesi file tidak ditemukan.\n\n" +
        "Kirim file kembali."
      );

      return;

    }


    // Ambil state internal dari user.js
    //
    // finishFile membutuhkan state.
    // Fungsi berikut mengambil state tersebut.

    const state =
      await getUserState(
        userId
      );


    if (!state) {

      await sendMessage(
        env,
        chatId,

        "❌ Sesi file tidak ditemukan.\n\n" +
        "Kirim file kembali."
      );

      return;

    }


    await finishFile(
      env,
      userId,
      chatId,
      state
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


// ======================================================
// AMBIL STATE USER
// ======================================================
//
// user.js menyediakan fungsi ini.
// ======================================================

async function getUserState(
  userId
) {

  const module =
    await import("./user.js");

  if (
    typeof module.getUserState !==
    "function"
  ) {

    throw new Error(
      "getUserState belum tersedia di user.js"
    );

  }

  return module.getUserState(
    userId
  );

}
