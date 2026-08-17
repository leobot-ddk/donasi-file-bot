// ======================================================
// BOT ROUTER
// DONASI FILE BOT
// ======================================================

import {
  isAdmin
} from "../config.js";

import {
  sendMessage
} from "../services/telegram.js";

import {
  selectOne
} from "../database/supabase.js";

import {
  handleStart,
  handleMedia,
  handleText,
  getUserState
} from "./user.js";

import {
  handleCallback
} from "./callbacks.js";

import {
  handleAdminCommand,
  handleAdminText,
  hasAdminSession
} from "./admin.js";


// ======================================================
// CHECK BLOCKED USER
// ======================================================

async function isBlocked(
  env,
  userId
) {

  if (!userId) {
    return false;
  }

  try {

    const user =
      await selectOne(
        env,
        "blocked_users",

        `select=id&telegram_user_id=eq.${encodeURIComponent(
          userId
        )}&limit=1`
      );

    return Boolean(
      user
    );

  } catch (error) {

    console.error(
      "CHECK BLOCKED USER ERROR:",
      error
    );

    return false;

  }

}


// ======================================================
// HANDLE UPDATE
// ======================================================

export async function handleUpdate(
  update,
  env
) {

  try {

    // ==================================================
    // CALLBACK QUERY
    // ==================================================

    if (
      update?.callback_query
    ) {

      await handleCallback(
        update.callback_query,
        env
      );

      return;

    }


    // ==================================================
    // MESSAGE
    // ==================================================

    const message =
      update?.message;

    if (!message) {
      return;
    }


    const user =
      message.from;

    const userId =
      user?.id;

    const chatId =
      message.chat?.id;


    if (
      !userId ||
      !chatId
    ) {

      return;

    }


    // ==================================================
    // ADMIN CHECK
    // ==================================================

    const admin =
      isAdmin(
        userId,
        env
      );


    // ==================================================
    // BLOCKED USER
    // ==================================================

    if (!admin) {

      const blocked =
        await isBlocked(
          env,
          userId
        );


      if (blocked) {

        await sendMessage(
          env,
          chatId,

          "🚫 Kamu telah diblokir dari menggunakan bot."
        );

        return;

      }

    }


    // ==================================================
    // /START
    // ==================================================

    if (
      typeof message.text === "string" &&
      message.text
        .trim()
        .toLowerCase()
        .startsWith(
          "/start"
        )
    ) {

      await handleStart(
        message,
        env
      );

      return;

    }


    // ==================================================
    // ADMIN COMMAND
    // ==================================================

    if (
      typeof message.text === "string" &&
      message.text
        .trim()
        .startsWith("/")
    ) {

      if (admin) {

        await handleAdminCommand(
          message,
          env
        );

        return;

      }

    }


    // ==================================================
    // MEDIA
    // ==================================================

    const hasMedia =

      Boolean(
        message.document
      ) ||

      Boolean(
        message.photo
      ) ||

      Boolean(
        message.video
      ) ||

      Boolean(
        message.audio
      ) ||

      Boolean(
        message.voice
      ) ||

      Boolean(
        message.animation
      ) ||

      Boolean(
        message.video_note
      ) ||

      Boolean(
        message.sticker
      );


    if (hasMedia) {

      await handleMedia(
        message,
        env
      );

      return;

    }


    // ==================================================
    // TEXT
    // ==================================================

    if (
      typeof message.text === "string"
    ) {

      // =================================================
      // ADMIN SESSION
      // =================================================
      //
      // HARUS dicek sebelum upload session user.
      //
      // Ini menangani:
      // - Tambah caption admin
      //
      // sehingga pesan caption tidak masuk ke
      // handleText() milik user.
      //
      // =================================================

      if (
        admin &&
        hasAdminSession(
          userId
        )
      ) {

        await handleAdminText(
          message,
          env
        );

        return;

      }


      // =================================================
      // USER UPLOAD SESSION
      // =================================================

      const session =
        await getUserState(
          env,
          userId
        );


      if (session) {

        await handleText(
          message,
          env
        );

        return;

      }


      // =================================================
      // ADMIN TEXT
      // =================================================

      if (admin) {

        await handleAdminText(
          message,
          env
        );

        return;

      }


      // =================================================
      // USER TEXT
      // =================================================

      await handleText(
        message,
        env
      );

      return;

    }

  } catch (error) {

    console.error(
      "HANDLE UPDATE ERROR:",
      error
    );


    try {

      const chatId =
        update?.message?.chat?.id;


      if (chatId) {

        await sendMessage(
          env,
          chatId,

          "❌ Terjadi kesalahan saat memproses permintaan."
        );

      }

    } catch (sendError) {

      console.error(
        "ERROR SEND ERROR MESSAGE:",
        sendError
      );

    }

  }

}
