// ======================================================
// CALLBACK HANDLER
// ======================================================

import {
  telegram
} from "../services/telegram.js";

import {
  getSession,
  setProtect,
  askCaption,
  setCaption,
  askDuration,
  setDuration,
  finishFile
} from "./user.js";

import {
  update
} from "../database/supabase.js";


// ======================================================
// ANSWER CALLBACK
// ======================================================

async function answerCallback(
  env,
  callbackId,
  text = ""
) {

  if (!callbackId) {
    return;
  }

  try {

    await telegram(
      env,
      "answerCallbackQuery",
      {
        callback_query_id:
          callbackId,

        text,

        show_alert:
          false
      }
    );

  } catch (error) {

    console.error(
      "ANSWER CALLBACK ERROR:",
      error
    );

  }

}


// ======================================================
// SET STEP
// ======================================================

async function setStep(
  env,
  sessionId,
  step
) {

  return update(
    env,
    "upload_sessions",
    `session_id=eq.${encodeURIComponent(
      sessionId
    )}`,
    {
      step
    }
  );

}


// ======================================================
// HANDLE CALLBACK
// ======================================================

export async function handleCallback(
  callback,
  env
) {

  try {

    const data =
      callback?.data;

    const callbackId =
      callback?.id;

    const message =
      callback?.message;

    const chatId =
      message?.chat?.id;


    if (!data || !callbackId) {
      return;
    }


    // ==================================================
    // PROTECT / PUBLIC
    // ==================================================

    if (
      data.startsWith("protect:")
    ) {

      const parts =
        data.split(":");

      const value =
        parts[1];

      const sessionId =
        parts.slice(2).join(":");

      const protect =
        value === "on";


      const session =
        await setProtect(
          env,
          sessionId,
          protect
        );


      if (!session) {

        await answerCallback(
          env,
          callbackId,
          "Sesi tidak ditemukan."
        );

        return;

      }


      await setStep(
        env,
        sessionId,
        "caption"
      );


      await answerCallback(
        env,
        callbackId,
        protect
          ? "Protect Content dipilih."
          : "Public dipilih."
      );


      await askCaption(
        env,
        chatId,
        sessionId
      );


      return;

    }


    // ==================================================
    // TANPA CAPTION
    // ==================================================

    if (
      data.startsWith(
        "caption:none:"
      )
    ) {

      const sessionId =
        data.substring(
          "caption:none:".length
        );


      const session =
        await setCaption(
          env,
          sessionId,
          null
        );


      if (!session) {

        await answerCallback(
          env,
          callbackId,
          "Sesi tidak ditemukan."
        );

        return;

      }


      await setStep(
        env,
        sessionId,
        "duration"
      );


      await answerCallback(
        env,
        callbackId,
        "Tanpa caption."
      );


      await askDuration(
        env,
        chatId,
        sessionId
      );


      return;

    }


    // ==================================================
    // CAPTION BUTTON
    // ==================================================

    if (
      data.startsWith("caption:")
    ) {

      const parts =
        data.split(":");

      const sessionId =
        parts.slice(2).join(":");


      const session =
        await getSession(
          env,
          sessionId
        );


      if (!session) {

        await answerCallback(
          env,
          callbackId,
          "Sesi tidak ditemukan."
        );

        return;

      }


      await setStep(
        env,
        sessionId,
        "caption"
      );


      await answerCallback(
        env,
        callbackId,
        "Silakan kirim caption."
      );


      await telegram(
        env,
        "sendMessage",
        {

          chat_id:
            chatId,

          text:
            "📝 Silakan kirim caption sekarang."

        }
      );


      return;

    }


    // ==================================================
    // DURATION
    // ==================================================

    if (
      data.startsWith("duration:")
    ) {

      const parts =
        data.split(":");

      const durationType =
        parts[1];

      const sessionId =
        parts.slice(2).join(":");


      const session =
        await getSession(
          env,
          sessionId
        );


      if (!session) {

        await answerCallback(
          env,
          callbackId,
          "Sesi tidak ditemukan."
        );

        return;

      }


      // ================================================
      // CUSTOM
      // ================================================

      if (
        durationType === "custom"
      ) {

        await setStep(
          env,
          sessionId,
          "custom_duration"
        );


        await answerCallback(
          env,
          callbackId
        );


        await telegram(
          env,
          "sendMessage",
          {

            chat_id:
              chatId,

            text:
              "✏️ Masukkan durasi custom.\n\n" +
              "Contoh:\n" +
              "30min\n" +
              "2h\n" +
              "1d\n" +
              "7d\n" +
              "2w\n" +
              "1m\n" +
              "forever"

          }
        );


        return;

      }


      // ================================================
      // FOREVER
      // ================================================

      if (
        durationType === "forever"
      ) {

        await setDuration(
          env,
          sessionId,
          0
        );


        await setStep(
          env,
          sessionId,
          "finished"
        );


        await answerCallback(
          env,
          callbackId,
          "Selamanya dipilih."
        );


        await finishFile(
          env,
          sessionId
        );


        return;

      }


      // ================================================
      // DURASI STANDAR
      // ================================================

      const durationMap = {

        "1d":
          86400,

        "7d":
          604800,

        "30d":
          2592000

      };


      const seconds =
        durationMap[
          durationType
        ];


      if (!seconds) {

        await answerCallback(
          env,
          callbackId,
          "Durasi tidak valid."
        );

        return;

      }


      await setDuration(
        env,
        sessionId,
        seconds
      );


      await setStep(
        env,
        sessionId,
        "finished"
      );


      await answerCallback(
        env,
        callbackId,
        "Durasi dipilih."
      );


      await finishFile(
        env,
        sessionId
      );


      return;

    }


    // ==================================================
    // CALLBACK TIDAK DIKENAL
    // ==================================================

    await answerCallback(
      env,
      callbackId,
      "Pilihan tidak dikenali."
    );

  } catch (error) {

    console.error(
      "CALLBACK ERROR:",
      error
    );


    try {

      await answerCallback(
        env,
        callback?.id,
        "❌ Terjadi kesalahan."
      );

    } catch {}

  }

}
