// ======================================================
// USER HANDLER
// ======================================================

import {
  telegram,
  sendMessage
} from "../services/telegram.js";

import {
  insert,
  selectOne
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
// USER STATE
// ======================================================
//
// State disimpan di memory Worker.
// Digunakan hanya untuk proses:
// file -> protect -> caption -> duration
//
// Data file final tetap disimpan di Supabase.
//
// ======================================================

const states = new Map();


// ======================================================
// HANDLE /START
// ======================================================

export async function handleStart(
  message,
  env
) {

  const parts =
    String(
      message.text || ""
    )
      .trim()
      .split(/\s+/);

  const token =
    parts[1];


  // ====================================================
  // /start tanpa token
  // ====================================================

  if (!token) {

    await sendMessage(
      env,
      message.chat.id,

      "👋 Selamat datang di DONASI FILE!\n\n" +
      "📤 Kirim file untuk membuat link."
    );

    return;

  }


  // ====================================================
  // /start TOKEN
  // ====================================================

  const file =
    await selectOne(
      env,
      "files",
      `token=eq.${encodeURIComponent(token)}&select=*`
    );


  if (!file) {

    await sendMessage(
      env,
      message.chat.id,
      "❌ Link file tidak ditemukan."
    );

    return;

  }


  // ====================================================
  // CEK STATUS
  // ====================================================

  if (
    file.status !== "active"
  ) {

    await sendMessage(
      env,
      message.chat.id,
      "❌ Link file sudah tidak aktif."
    );

    return;

  }


  // ====================================================
  // CEK EXPIRY
  // ====================================================

  if (
    file.expires_at &&
    new Date(
      file.expires_at
    ) <= new Date()
  ) {

    await sendMessage(
      env,
      message.chat.id,
      "❌ Link file sudah kedaluwarsa."
    );

    return;

  }


  // ====================================================
  // KIRIM FILE
  // ====================================================

  const sent =
    await sendFile(
      env,
      message.chat.id,
      file
    );


  // ====================================================
  // CATAT ACCESS
  // ====================================================

  try {

    await insert(
      env,
      "deliveries",
      {
        file_id:
          file.id,

        telegram_chat_id:
          message.chat.id,

        telegram_message_id:
          sent.message_id
      },
      false
    );

  } catch (error) {

    console.error(
      "DELIVERY INSERT ERROR:",
      error
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


  if (
    !userId ||
    !chatId
  ) {

    return;

  }


  const media =
    getMedia(message);


  if (!media) {

    return;

  }


  // ====================================================
  // SIMPAN STATE PER USER
  // ====================================================

  states.set(
    String(userId),
    {

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
        media.fileName,

      mime_type:
        media.mimeType,

      file_size:
        media.fileSize,

      caption_user:
        message.caption || null,

      protect_content:
        false,

      duration_seconds:
        null

    }
  );


  // ====================================================
  // PILIH PROTECT / PUBLIC
  // ====================================================

  await sendMessage(
    env,
    chatId,

    "📁 File diterima.\n\n" +
    "Pilih jenis link:",

    {

      reply_markup: {

        inline_keyboard: [

          [

            {
              text:
                "🔒 Protect Content",

              callback_data:
                "protect:on"
            },

            {
              text:
                "🌐 Public",

              callback_data:
                "protect:off"
            }

          ]

        ]

      }

    }
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
    message.from?.id;

  const chatId =
    message.chat?.id;


  if (
    !userId ||
    !chatId
  ) {

    return;

  }


  const key =
    String(userId);


  const state =
    states.get(key);


  // ====================================================
  // TIDAK ADA PROSES
  // ====================================================

  if (!state) {

    await sendMessage(
      env,
      chatId,

      "📤 Kirim file terlebih dahulu."
    );

    return;

  }


  // ====================================================
  // CUSTOM DURASI
  // ====================================================

  const duration =
    parseDuration(
      message.text
    );


  if (!duration) {

    await sendMessage(
      env,
      chatId,

      "❌ Format durasi tidak valid.\n\n" +
      "Contoh:\n" +
      "• forever\n" +
      "• 1h\n" +
      "• 1d\n" +
      "• 7d\n" +
      "• 30d\n" +
      "• 2w\n" +
      "• 1m"
    );

    return;

  }


  state.duration_seconds =
    duration.seconds;


  // ====================================================
  // BUAT FILE
  // ====================================================

  try {

    await finishFile(
      env,
      userId,
      chatId,
      state
    );

    states.delete(key);

  } catch (error) {

    console.error(
      "FINISH FILE ERROR:",
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
// SET PROTECT
// ======================================================

export function setProtect(
  userId,
  value
) {

  const key =
    String(userId);

  const state =
    states.get(key);


  if (!state) {

    return false;

  }


  state.protect_content =
    Boolean(value);


  return true;

}


// ======================================================
// TAMPILKAN PILIHAN CAPTION
// ======================================================

export async function askCaption(
  env,
  chatId
) {

  await sendMessage(
    env,
    chatId,

    "📝 Caption?\n\n" +
    "Kirim caption yang ingin ditambahkan.\n" +
    "Atau tekan tombol di bawah jika tanpa caption.",

    {

      reply_markup: {

        inline_keyboard: [

          [

            {
              text:
                "➡️ Tanpa Caption",

              callback_data:
                "caption:none"
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

export function setCaption(
  userId,
  caption
) {

  const key =
    String(userId);

  const state =
    states.get(key);


  if (!state) {

    return false;

  }


  state.caption_user =
    caption || null;


  return true;

}


// ======================================================
// TAMPILKAN PILIHAN DURASI
// ======================================================

export async function askDuration(
  env,
  chatId
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
                "duration:forever"
            }

          ],

          [

            {
              text:
                "1 Hari",

              callback_data:
                "duration:1d"
            },

            {
              text:
                "7 Hari",

              callback_data:
                "duration:7d"
            }

          ],

          [

            {
              text:
                "30 Hari",

              callback_data:
                "duration:30d"
            },

            {
              text:
                "✏️ Custom",

              callback_data:
                "duration:custom"
            }

          ]

        ]

      }

    }
  );

}


// ======================================================
// SET DURASI DARI CALLBACK
// ======================================================

export function setDuration(
  userId,
  seconds
) {

  const key =
    String(userId);

  const state =
    states.get(key);


  if (!state) {

    return false;

  }


  state.duration_seconds =
    seconds;

  return true;

}


// ======================================================
// BUAT FILE FINAL
// ======================================================

export async function createFileFromState(
  env,
  userId,
  state
) {

  const token =
    createFileToken();


  const seconds =
    state.duration_seconds == null
      ? null
      : Number(
          state.duration_seconds
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


  const rows =
    await insert(
      env,
      "files",
      {

        token,

        owner_telegram_id:
          userId,

        source_chat_id:
          state.source_chat_id,

        source_message_id:
          state.source_message_id,

        media_type:
          state.media_type,

        telegram_file_id:
          state.telegram_file_id,

        file_name:
          state.file_name || null,

        mime_type:
          state.mime_type || null,

        file_size:
          state.file_size || null,

        caption_user:
          state.caption_user || null,

        protect_content:
          Boolean(
            state.protect_content
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
  userId,
  chatId,
  state
) {

  const file =
    await createFileFromState(
      env,
      userId,
      state
    );


  const botUsername =
    String(
      env.TELEGRAM_BOT_USERNAME ||
      ""
    )
      .replace(
        /^@/,
        ""
      );


  if (!botUsername) {

    throw new Error(
      "TELEGRAM_BOT_USERNAME belum diset."
    );

  }


  const link =
    `https://t.me/${botUsername}?start=${encodeURIComponent(file.token)}`;


  await sendMessage(
    env,
    chatId,

    "✅ LINK BERHASIL DIBUAT!\n\n" +

    `🔗 ${link}\n\n` +

    `⏳ Durasi: ${
      formatDuration(
        file.duration_seconds
      )
    }`
  );


  return {
    file,
    link
  };

}


// ======================================================
// KIRIM FILE
// ======================================================

async function sendFile(
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
