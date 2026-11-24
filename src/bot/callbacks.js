// ======================================================
// CALLBACK HANDLER
// DONASI FILE BOT
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

import {
  isAdmin
} from "../config.js";

import {
  showAdminPanel,
  showDashboard,
  showFiles,
  showFileDetail,
  deleteFile,
  showUsers,
  blockUser,
  unblockUser,
  showCaptionMenu,
  startAddCaption,
  deleteCaption,
  showAdmins,
  editAdminMessage
} from "./admin.js";


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
// GET CALLBACK MESSAGE DATA
// ======================================================

function getMessageData(
  callback
) {

  return {

    chatId:
      callback?.message?.chat?.id,

    messageId:
      callback?.message?.message_id

  };

}


// ======================================================
// HANDLE ADMIN CALLBACK
// ======================================================

async function handleAdminCallback(
  callback,
  env,
  data
) {

  const userId =
    callback?.from?.id;

  const {
    chatId,
    messageId
  } =
    getMessageData(
      callback
    );


  // ====================================================
  // SECURITY
  // ====================================================

  if (
    !isAdmin(
      userId,
      env
    )
  ) {

    await answerCallback(
      env,
      callback.id,
      "❌ Kamu bukan admin."
    );

    return true;

  }


  // ====================================================
  // ADMIN PANEL
  // ====================================================

  if (
    data ===
    "admin:panel"
  ) {

    await answerCallback(
      env,
      callback.id
    );


    await showAdminPanel(
      env,
      chatId,
      messageId
    );


    return true;

  }


  // ====================================================
  // DASHBOARD
  // ====================================================

  if (
    data ===
    "admin:dashboard"
  ) {

    await answerCallback(
      env,
      callback.id,
      "📊 Dashboard"
    );


    await showDashboard(
      env,
      chatId,
      messageId
    );


    return true;

  }


  // ====================================================
  // FILE LIST
  // ====================================================

  if (
    data ===
    "admin:delete" ||
    data ===
    "admin:files"
  ) {

    await answerCallback(
      env,
      callback.id,
      "📁 Daftar file"
    );


    await showFiles(
      env,
      chatId,
      messageId
    );


    return true;

  }


  // ====================================================
  // FILE DETAIL
  // ====================================================

  if (
    data.startsWith(
      "admin:file:"
    )
  ) {

    const fileId =
      data.substring(
        "admin:file:".length
      );


    if (!fileId) {

      await answerCallback(
        env,
        callback.id,
        "❌ ID file tidak valid."
      );

      return true;

    }


    await answerCallback(
      env,
      callback.id
    );


    await showFileDetail(
      env,
      chatId,
      fileId,
      messageId
    );


    return true;

  }


  // ====================================================
  // DELETE FILE
  // ====================================================
  //
  // Menghapus:
  // - Pesan file yang dikirim bot ke user.
  // - Data file dari database.
  //
  // Tidak menghapus:
  // - Salinan file di grup admin.
  // - File asli di Telegram.
  //
  // ====================================================

  if (
    data.startsWith(
      "admin:deletefile:"
    )
  ) {

    const fileId =
      data.substring(
        "admin:deletefile:".length
      );


    if (!fileId) {

      await answerCallback(
        env,
        callback.id,
        "❌ ID file tidak valid."
      );

      return true;

    }


    await answerCallback(
      env,
      callback.id,
      "🗑️ Menghapus link..."
    );


    await deleteFile(
      env,
      chatId,
      fileId,
      messageId
    );


    return true;

  }

  // ====================================================
  // USER LIST PAGINATION
  // ====================================================

  if (data.startsWith("admin:users:page:")) {
    const page = Number(data.substring("admin:users:page:".length));
    await answerCallback(env, callback.id);
    await showUsers(env, chatId, messageId, Number.isInteger(page) && page >= 0 ? page : 0);
    return true;
  }

  
  // ====================================================
  // USER LIST
  // ====================================================

  if (
    data ===
    "admin:users"
  ) {

    await answerCallback(
      env,
      callback.id,
      "👤 User"
    );


    await showUsers(
      env,
      chatId,
      messageId
    );


    return true;

  }


  // ====================================================
  // BLOCK USER
  // ====================================================

  if (
    data.startsWith(
      "admin:block:"
    )
  ) {

    const blockParts = data.substring("admin:block:".length).split(":");
    const targetUserId = String(blockParts[0] ?? "").trim();
    const requestedPage = blockParts[1] ?? "0";
    const page = /^\d+$/.test(requestedPage) ? Number(requestedPage) : 0;


    if (!/^\d+$/.test(targetUserId)) {

      await answerCallback(
        env,
        callback.id,
        "❌ User ID tidak valid."
      );

      return true;

    }


    if (
      String(targetUserId) ===
      String(userId)
    ) {

      await answerCallback(
        env,
        callback.id,
        "❌ Kamu tidak bisa memblokir diri sendiri."
      );

      return true;

    }


    const blocked = await blockUser(
      env,
      chatId,
      userId,
      targetUserId,
      messageId,
      page
    );

    await answerCallback(
      env,
      callback.id,
      blocked ? "🔴 User berhasil diblokir." : "❌ Gagal memblokir user."
    );

    return true;

  }

  
  // ====================================================
  // UNBLOCK USER
  // ====================================================

  if (
    data.startsWith(
      "admin:unblock:"
    )
  ) {

    const targetUserId =
      data.substring(
        "admin:unblock:".length
      );


    if (!targetUserId) {

      await answerCallback(
        env,
        callback.id,
        "❌ User ID tidak valid."
      );

      return true;

    }


    await answerCallback(
      env,
      callback.id,
      "🟢 User di-unblock."
    );


    await unblockUser(
      env,
      chatId,
      targetUserId,
      messageId
    );


    return true;

  }


  // ====================================================
  // CAPTION MENU
  // ====================================================

  if (
    data ===
    "admin:caption"
  ) {

    await answerCallback(
      env,
      callback.id,
      "📝 Caption"
    );


    await showCaptionMenu(
      env,
      chatId,
      messageId
    );


    return true;

  }


  // ====================================================
  // ADD CAPTION
  // ====================================================

  if (
    data ===
    "admin:caption:add"
  ) {

    await answerCallback(
      env,
      callback.id
    );


    await startAddCaption(
      env,
      userId,
      chatId
    );


    return true;

  }


  // ====================================================
  // DELETE CAPTION
  // ====================================================

  if (
    data.startsWith(
      "admin:caption:delete:"
    )
  ) {

    const captionId =
      data.substring(
        "admin:caption:delete:".length
      );


    if (!captionId) {

      await answerCallback(
        env,
        callback.id,
        "❌ ID caption tidak valid."
      );

      return true;

    }


    await answerCallback(
      env,
      callback.id,
      "🗑️ Caption dihapus."
    );


    await deleteCaption(
      env,
      chatId,
      captionId,
      messageId
    );


    return true;

  }


  // ====================================================
  // ADMIN MENU
  // ====================================================

  if (
    data ===
    "admin:admins"
  ) {

    await answerCallback(
      env,
      callback.id,
      "⚙️ Admin"
    );


    await showAdmins(
      env,
      chatId,
      messageId
    );


    return true;

  }


  return false;

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


    if (
      !data ||
      !callbackId
    ) {

      return;

    }


    // ==================================================
    // ADMIN CALLBACK
    // ==================================================

    if (
      data.startsWith(
        "admin:"
      )
    ) {

      const handled =
        await handleAdminCallback(
          callback,
          env,
          data
        );


      if (handled) {
        return;
      }

    }


    // ==================================================
    // PROTECT / PUBLIC
    // ==================================================

    if (
      data.startsWith(
        "protect:"
      )
    ) {

      const parts =
        data.split(":");

      const value =
        parts[1];

      const sessionId =
        parts
          .slice(2)
          .join(":");


      const protect =
        value ===
        "on";


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
      data.startsWith(
        "caption:"
      )
    ) {

      const parts =
        data.split(":");


      const sessionId =
        parts
          .slice(2)
          .join(":");


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
      data.startsWith(
        "duration:"
      )
    ) {

      const parts =
        data.split(":");


      const durationType =
        parts[1];


      const sessionId =
        parts
          .slice(2)
          .join(":");


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
        durationType ===
        "custom"
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
              "1h\n" +
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
        durationType ===
        "forever"
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
      // STANDARD DURATION
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
