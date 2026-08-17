// ======================================================
// BOT ROUTER
// ======================================================

import { isAdmin } from "../config.js";

import {
  sendMessage
} from "../services/telegram.js";

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
  handleAdminText
} from "./admin.js";


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


    if (!userId || !chatId) {
      return;
    }


    // ==================================================
    // /START
    // ==================================================

    if (
      typeof message.text === "string" &&
      message.text
        .trim()
        .toLowerCase()
        .startsWith("/start")
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
        .startsWith("/") &&
      isAdmin(
        userId,
        env
      )
    ) {

      await handleAdminCommand(
        message,
        env
      );

      return;

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
      // CEK SESSION UPLOAD USER
      // =================================================
      //
      // Ini harus dicek SEBELUM ADMIN TEXT.
      //
      // Jika admin sedang upload file dan kemudian
      // mengetik caption, caption harus masuk ke
      // handleText(), bukan handleAdminText().
      //
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

      if (
        isAdmin(
          userId,
          env
        )
      ) {

        await handleAdminText(
          message,
          env
        );

        return;

      }


      // =================================================
      // TEXT USER BIASA
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


    // ==================================================
    // ERROR MESSAGE
    // ==================================================

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
