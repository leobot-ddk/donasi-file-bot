// ======================================================
// USER HANDLER
// ======================================================

import {
  sendMessage,
  telegram
} from "../services/telegram.js";

import {
  insert,
  selectOne,
  update,
  remove
} from "../database/supabase.js";

import {
  getMedia
} from "../utils/media.js";

import {
  createFileToken
} from "../utils/token.js";

import {
  parseDuration,
  formatDuration
} from "../utils/format.js";


// ======================================================
// SESSION ID
// ======================================================

function createSessionId() {

  return (
    crypto.randomUUID() +
    "-" +
    Date.now().toString(36)
  );

}


// ======================================================
// GET USER SESSION TERBARU
// ======================================================

export async function getUserState(
  env,
  userId
) {

  return selectOne(
    env,
    "upload_sessions",
    `telegram_id=eq.${encodeURIComponent(
      userId
    )}&order=created_at.desc&limit=1`
  );

}


// ======================================================
// GET SESSION BY ID
// ======================================================

export async function getSession(
  env,
  sessionId
) {

  return selectOne(
    env,
    "upload_sessions",
    `session_id=eq.${encodeURIComponent(
      sessionId
    )}&limit=1`
  );

}


// ======================================================
// GET FILE BY TOKEN
// ======================================================

export async function getFileByToken(
  env,
  token
) {

  if (!token) {
    return null;
  }

  return selectOne(
    env,
    "files",
    `token=eq.${encodeURIComponent(
      token
    )}&limit=1`
  );

}


// ======================================================
// HANDLE /START
// ======================================================

export async function handleStart(
  message,
  env
) {

  const chatId =
    message?.chat?.id;

  const userId =
    message?.from?.id;

  if (!chatId || !userId) {
    return;
  }


  const text =
    typeof message.text === "string"
      ? message.text.trim()
      : "";


  // ====================================================
  // AMBIL PARAMETER /start
  //
  // Contoh:
  // /start
  // /start ABC123
  // ====================================================

  const parts =
    text.split(/\s+/);

  const startParameter =
    parts.length > 1
      ? parts[1]
      : null;


  // ====================================================
  // /start TANPA TOKEN
  // ====================================================

  if (!startParameter) {

    await sendMessage(
      env,
      chatId,

      "👋 Selamat datang!\n\n" +
      "📁 Bot ini digunakan untuk membuat link file.\n\n" +
      "Kirim file ke bot untuk mulai."
    );

    return;
  }


  // ====================================================
  // /start DENGAN TOKEN
  // ====================================================

  const file =
    await getFileByToken(
      env,
      startParameter
    );


  if (!file) {

    await sendMessage(
      env,
      chatId,

      "❌ Link file tidak ditemukan.\n\n" +
      "Kemungkinan link salah atau file sudah dihapus."
    );

    return;
  }


  // ====================================================
  // CEK STATUS FILE
  // ====================================================

  if (
    file.status &&
    file.status !== "active"
  ) {

    await sendMessage(
      env,
      chatId,

      "❌ File sudah tidak tersedia."
    );

    return;
  }


  // ====================================================
  // CEK EXPIRY
  // ====================================================

  if (file.expires_at) {

    const expiresAt =
      new Date(
        file.expires_at
      ).getTime();

    if (
      Number.isFinite(expiresAt) &&
      expiresAt <= Date.now()
    ) {

      // Tandai expired
      try {

        await update(
          env,
          "files",
          `token=eq.${encodeURIComponent(
            startParameter
          )}`,
          {
            status:
              "expired"
          }
        );

      } catch (error) {

        console.error(
          "UPDATE EXPIRED FILE ERROR:",
          error
        );

      }


      await sendMessage(
        env,
        chatId,

        "⏰ Link file sudah kedaluwarsa."
      );

      return;
    }

  }


  // ====================================================
  // KIRIM FILE
  // ====================================================

  try {

    await sendFile(
      env,
      chatId,
      file
    );


    // ==================================================
    // UPDATE ACCESS COUNT
    // ==================================================

    const currentCount =
      Number(
        file.access_count || 0
      );


    await update(
      env,
      "files",
      `token=eq.${encodeURIComponent(
        startParameter
      )}`,
      {

        access_count:
          currentCount + 1,

        last_access_at:
          new Date().toISOString()

      }
    );


  } catch (error) {

    console.error(
      "SEND FILE ERROR:",
      error
    );


    await sendMessage(
      env,
      chatId,

      "❌ Gagal mengirim file.\n\n" +
      "Silakan coba lagi."
    );

  }

}


// ======================================================
// HANDLE MEDIA
// ======================================================

export async function handleMedia(
  message,
  env
) {

  const userId =
    message.from?.id;

  const chatId =
    message.chat?.id;


  if (!userId || !chatId) {
    return;
  }


  const media =
    getMedia(message);


  if (!media) {

    await sendMessage(
      env,
      chatId,

      "❌ Jenis file tidak didukung."
    );

    return;
  }


  const sessionId =
    createSessionId();


  // ====================================================
  // SIMPAN SESSION
  // ====================================================

  await insert(
    env,
    "upload_sessions",
    {

      session_id:
        sessionId,

      telegram_id:
        userId,

      source_chat_id:
        chatId,

      source_message_id:
        message.message_id,

      media_type:
        media.type,

      telegram_file_id:
        media.fileId,

      file_name:
        media.fileName ||
        null,

      mime_type:
        media.mimeType ||
        null,

      file_size:
        media.fileSize ||
        null,

      caption_user:
        message.caption ||
        null,

      protect_content:
        false,

      duration_seconds:
        null

    },
    false
  );


  // ====================================================
  // PILIH PROTECT / PUBLIC
  // ====================================================

  await sendMessage(
    env,
    chatId,

    "📁 File diterima.\n\n" +
    "Pilih:",

    {

      reply_markup: {

        inline_keyboard: [

          [

            {
              text:
                "🔒 Protect Content",

              callback_data:
                `protect:on:${sessionId}`
            },

            {
              text:
                "🌐 Public",

              callback_data:
                `protect:off:${sessionId}`
            }

          ]

        ]

      }

    }
  );

}


// ======================================================
// SET PROTECT
// ======================================================

export async function setProtect(
  env,
  sessionId,
  value
) {

  const session =
    await getSession(
      env,
      sessionId
    );


  if (!session) {
    return null;
  }


  await update(
    env,
    "upload_sessions",
    `session_id=eq.${encodeURIComponent(
      sessionId
    )}`,
    {

      protect_content:
        Boolean(value)

    }
  );


  return getSession(
    env,
    sessionId
  );

}


// ======================================================
// ASK CAPTION
// ======================================================

export async function askCaption(
  env,
  chatId,
  sessionId
) {

  await sendMessage(
    env,
    chatId,

    "📝 Kirim caption.\n\n" +
    "Atau pilih tanpa caption.",

    {

      reply_markup: {

        inline_keyboard: [

          [

            {
              text:
                "➡️ Tanpa Caption",

              callback_data:
                `caption:none:${sessionId}`
            }

          ]

        ]

      }

    }
  );

}


// ======================================================
// SET CAPTION
// ======================================================

export async function setCaption(
  env,
  sessionId,
  caption
) {

  const session =
    await getSession(
      env,
      sessionId
    );


  if (!session) {
    return null;
  }


  await update(
    env,
    "upload_sessions",
    `session_id=eq.${encodeURIComponent(
      sessionId
    )}`,
    {

      caption_user:
        caption || null

    }
  );


  return getSession(
    env,
    sessionId
  );

}


// ======================================================
// ASK DURATION
// ======================================================

export async function askDuration(
  env,
  chatId,
  sessionId
) {

  await sendMessage(
    env,
    chatId,

    "⏳ Pilih durasi link:",

    {

      reply_markup: {

        inline_keyboard: [

          [

            {
              text:
                "♾ Selamanya",

              callback_data:
                `duration:forever:${sessionId}`
            }

          ],

          [

            {
              text:
                "1 Hari",

              callback_data:
                `duration:1d:${sessionId}`
            },

            {
              text:
                "7 Hari",

              callback_data:
                `duration:7d:${sessionId}`
            }

          ],

          [

            {
              text:
                "30 Hari",

              callback_data:
                `duration:30d:${sessionId}`
            },

            {
              text:
                "✏️ Custom",

              callback_data:
                `duration:custom:${sessionId}`
            }

          ]

        ]

      }

    }
  );

}


// ======================================================
// SET DURATION
// ======================================================

export async function setDuration(
  env,
  sessionId,
  seconds
) {

  const session =
    await getSession(
      env,
      sessionId
    );


  if (!session) {
    return null;
  }


  await update(
    env,
    "upload_sessions",
    `session_id=eq.${encodeURIComponent(
      sessionId
    )}`,
    {

      duration_seconds:
        seconds

    }
  );


  return getSession(
    env,
    sessionId
  );

}


// ======================================================
// CREATE FILE
// ======================================================

export async function createFileFromSession(
  env,
  session
) {

  const token =
    createFileToken();


  const seconds =
    session.duration_seconds == null
      ? null
      : Number(
          session.duration_seconds
        );


  let expiresAt =
    null;


  if (
    seconds !== null &&
    Number.isFinite(seconds) &&
    seconds > 0
  ) {

    expiresAt =
      new Date(
        Date.now() +
        seconds * 1000
      ).toISOString();

  }


  // ====================================================
  // INSERT KE TABEL files
  // ====================================================

  const rows =
    await insert(
      env,
      "files",
      {

        token,

        owner_telegram_id:
          session.telegram_id,

        media_type:
          session.media_type,

        telegram_file_id:
          session.telegram_file_id,

        file_name:
          session.file_name ||
          null,

        mime_type:
          session.mime_type ||
          null,

        file_size:
          session.file_size ||
          null,

        caption_user:
          session.caption_user ||
          null,

        caption_admin:
          null,

        protect_content:
          Boolean(
            session.protect_content
          ),

        duration_seconds:
          seconds,

        expires_at:
          expiresAt,

        status:
          "active",

        access_count:
          0

      }
    );


  if (
    !Array.isArray(rows) ||
    !rows[0]
  ) {

    throw new Error(
      "File gagal disimpan."
    );

  }


  return rows[0];

}


// ======================================================
// FINISH FILE
// ======================================================

export async function finishFile(
  env,
  sessionId
) {

  const session =
    await getSession(
      env,
      sessionId
    );


  if (!session) {

    throw new Error(
      "Sesi file tidak ditemukan."
    );

  }


  // ====================================================
  // CEK DURASI
  // ====================================================

  if (
    session.duration_seconds ===
      undefined ||
    session.duration_seconds ===
      null
  ) {

    throw new Error(
      "Durasi file belum dipilih."
    );

  }


  // ====================================================
  // BUAT FILE
  // ====================================================

  const file =
    await createFileFromSession(
      env,
      session
    );


  // ====================================================
  // BOT USERNAME
  // ====================================================

  const botUsername =
    String(
      env.TELEGRAM_BOT_USERNAME ||
      ""
    ).replace(
      /^@/,
      ""
    );


  if (!botUsername) {

    throw new Error(
      "TELEGRAM_BOT_USERNAME belum diset."
    );

  }


  // ====================================================
  // BUAT LINK
  // ====================================================

  const link =
    `https://t.me/${botUsername}?start=${encodeURIComponent(
      file.token
    )}`;


  // ====================================================
  // KIRIM LINK
  // ====================================================

  await sendMessage(
    env,
    session.source_chat_id,

    "✅ LINK BERHASIL DIBUAT!\n\n" +

    `🔗 ${link}\n\n` +

    `⏳ Durasi: ${
      formatDuration(
        file.duration_seconds
      )
    }`
  );


  // ====================================================
  // HAPUS SESSION
  // ====================================================

  await remove(
    env,
    "upload_sessions",
    `session_id=eq.${encodeURIComponent(
      sessionId
    )}`
  );


  return {

    file,

    link

  };

}


// ======================================================
// HANDLE CUSTOM DURATION TEXT
// ======================================================

export async function handleDurationText(
  message,
  env,
  sessionId
) {

  const duration =
    parseDuration(
      message.text
    );


  if (!duration) {

    await sendMessage(
      env,
      message.chat.id,

      "❌ Format durasi tidak valid.\n\n" +

      "Contoh:\n" +
      "1d\n" +
      "7d\n" +
      "30d\n" +
      "2h\n" +
      "2w\n" +
      "1m\n" +
      "30min\n" +
      "forever"
    );

    return;

  }


  await setDuration(
    env,
    sessionId,
    duration.seconds
  );


  await finishFile(
    env,
    sessionId
  );

}


// ======================================================
// HANDLE TEXT
// ======================================================

export async function handleText(
  message,
  env
) {

  const userId =
    message?.from?.id;

  const chatId =
    message?.chat?.id;

  const text =
    typeof message?.text === "string"
      ? message.text.trim()
      : "";


  if (!userId || !chatId || !text) {
    return;
  }


  // ====================================================
  // CARI SESSION TERBARU
  // ====================================================

  const session =
    await getUserState(
      env,
      userId
    );


  // ====================================================
  // JIKA SESSION SEDANG MENUNGGU CUSTOM DURATION
  // ====================================================

  if (
    session &&
    session.duration_seconds === null
  ) {

    const duration =
      parseDuration(
        text
      );


    if (duration) {

      await setDuration(
        env,
        session.session_id,
        duration.seconds
      );


      await finishFile(
        env,
        session.session_id
      );

      return;

    }

  }


  // ====================================================
  // TEXT BIASA
  // ====================================================

  await sendMessage(
    env,
    chatId,

    "📁 Kirim file yang ingin dibuatkan link."
  );

}


// ======================================================
// SEND FILE
// ======================================================

export async function sendFile(
  env,
  chatId,
  file
) {

  const common = {

    chat_id:
      chatId,

    protect_content:
      Boolean(
        file.protect_content
      )

  };


  switch (
    file.media_type
  ) {

    case "photo":

      return telegram(
        env,
        "sendPhoto",
        {

          ...common,

          photo:
            file.telegram_file_id,

          caption:
            file.caption_user ||
            undefined

        }
      );


    case "video":

      return telegram(
        env,
        "sendVideo",
        {

          ...common,

          video:
            file.telegram_file_id,

          caption:
            file.caption_user ||
            undefined

        }
      );


    case "audio":

      return telegram(
        env,
        "sendAudio",
        {

          ...common,

          audio:
            file.telegram_file_id,

          caption:
            file.caption_user ||
            undefined

        }
      );


    case "voice":

      return telegram(
        env,
        "sendVoice",
        {

          ...common,

          voice:
            file.telegram_file_id,

          caption:
            file.caption_user ||
            undefined

        }
      );


    case "animation":

      return telegram(
        env,
        "sendAnimation",
        {

          ...common,

          animation:
            file.telegram_file_id,

          caption:
            file.caption_user ||
            undefined

        }
      );


    case "video_note":

      return telegram(
        env,
        "sendVideoNote",
        {

          ...common,

          video_note:
            file.telegram_file_id

        }
      );


    case "sticker":

      return telegram(
        env,
        "sendSticker",
        {

          ...common,

          sticker:
            file.telegram_file_id

        }
      );


    case "document":

    default:

      return telegram(
        env,
        "sendDocument",
        {

          ...common,

          document:
            file.telegram_file_id,

          caption:
            file.caption_user ||
            undefined

        }
      );

  }

}
