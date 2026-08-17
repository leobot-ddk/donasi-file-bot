// ======================================================
// USER HANDLER
// ======================================================

import {
  sendMessage,
  telegram,
  copyMessage
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

import {
  getAdminGroupId,
  getAdminChannelId
} from "../config.js";


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
// FORMAT FILE SIZE
// ======================================================

function formatFileSize(bytes) {

  if (
    bytes === null ||
    bytes === undefined ||
    !Number.isFinite(Number(bytes))
  ) {
    return "-";
  }

  const size = Number(bytes);

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(2)} KB`;
  }

  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }

  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}


// ======================================================
// FORMAT WIB
// ======================================================

function formatWIB(dateValue) {

  if (!dateValue) {
    return "Permanen";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const parts =
    new Intl.DateTimeFormat(
      "id-ID",
      {
        timeZone: "Asia/Jakarta",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }
    ).formatToParts(date);

  const get = (type) => {

    const item =
      parts.find(
        part => part.type === type
      );

    return item
      ? item.value
      : "";

  };

  return (
    `${get("day")} ${get("month")} ${get("year")} ` +
    `pukul ${get("hour")}.${get("minute")} WIB`
  );
}


// ======================================================
// GET USER STATE
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
// GET SESSION
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
// COPY ORIGINAL FILE KE ADMIN GROUP
// ======================================================
//
// PENTING:
//
// Fungsi ini TIDAK boleh menggagalkan proses user.
//
// Jika copy ke grup gagal:
// - error hanya dicatat di log
// - user tetap mendapat tombol Protect/Public
//
// Salinan:
// - langsung saat file diterima
// - tanpa protect content
// - permanen di grup
//
// ======================================================

async function copyOriginalToAdminGroup(
  env,
  message
) {

  const groupId =
    getAdminGroupId(env);

  if (!groupId) {

    console.warn(
      "ADMIN_GROUP_ID belum diset."
    );

    return null;
  }

  const sourceChatId =
    message?.chat?.id;

  const messageId =
    message?.message_id;

  if (
    !sourceChatId ||
    !messageId
  ) {

    console.warn(
      "SOURCE CHAT ID atau MESSAGE ID tidak ditemukan."
    );

    return null;
  }

  try {

    const result =
      await copyMessage(
        env,
        groupId,
        sourceChatId,
        messageId,
        {
          protect_content:
            false
        }
      );

    console.log(
      "FILE BERHASIL DISALIN KE ADMIN GROUP:",
      result
    );

    return result;

  } catch (error) {

    console.error(
      "COPY FILE KE ADMIN GROUP GAGAL:",
      error
    );

    // Jangan throw.
    // User tetap boleh melanjutkan proses.

    return null;
  }

}


// ======================================================
// HANDLE START
// ======================================================

export async function handleStart(
  message,
  env
) {

  const chatId =
    message?.chat?.id;

  if (!chatId) {
    return;
  }

  const text =
    String(
      message.text || ""
    ).trim();

  const parts =
    text.split(/\s+/);

  const token =
    parts.length > 1
      ? parts[1]
      : null;


  // ====================================================
  // START BIASA
  // ====================================================

  if (!token) {

    await sendMessage(
      env,
      chatId,

      "👋 Selamat datang!\n\n" +
      "Kirim file untuk membuat link."
    );

    return;
  }


  // ====================================================
  // CARI FILE
  // ====================================================

  const file =
    await selectOne(
      env,
      "files",
      `token=eq.${encodeURIComponent(
        token
      )}&limit=1`
    );


  if (!file) {

    await sendMessage(
      env,
      chatId,
      "❌ Link tidak ditemukan."
    );

    return;
  }


  // ====================================================
  // STATUS
  // ====================================================

  if (
    file.status !== "active"
  ) {

    await sendMessage(
      env,
      chatId,
      "❌ Link sudah tidak aktif."
    );

    return;
  }


  // ====================================================
  // EXPIRED
  // ====================================================

  if (
    file.expires_at &&
    new Date(
      file.expires_at
    ).getTime() <= Date.now()
  ) {

    await update(
      env,
      "files",
      `token=eq.${encodeURIComponent(
        token
      )}`,
      {
        status:
          "expired"
      }
    );

    await sendMessage(
      env,
      chatId,
      "⏰ Link sudah expired."
    );

    return;
  }


  // ====================================================
  // ACCESS COUNT
  // ====================================================

  await update(
    env,
    "files",
    `token=eq.${encodeURIComponent(
      token
    )}`,
    {

      access_count:
        Number(
          file.access_count || 0
        ) + 1,

      last_access_at:
        new Date().toISOString()

    }
  );


  // ====================================================
  // KIRIM FILE
  // ====================================================

  await sendFile(
    env,
    chatId,
    file
  );

}


// ======================================================
// HANDLE MEDIA
// ======================================================

export async function handleMedia(
  message,
  env
) {

  try {

    const userId =
      message?.from?.id;

    const chatId =
      message?.chat?.id;

    if (!userId || !chatId) {
      return;
    }


    // ==================================================
    // DETEKSI MEDIA
    // ==================================================

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


    // ==================================================
    // SESSION ID
    // ==================================================

    const sessionId =
      createSessionId();


    // ==================================================
    // INSERT SESSION
    // ==================================================

    const sessionRows =
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


    console.log(
      "UPLOAD SESSION CREATED:",
      sessionRows
    );


    // ==================================================
    // COPY FILE KE ADMIN GROUP
    // ==================================================
    //
    // DILAKUKAN SEGERA.
    //
    // Tidak menunggu:
    // - protect
    // - caption
    // - durasi
    // - link
    //
    // ==================================================

    await copyOriginalToAdminGroup(
      env,
      message
    );


    // ==================================================
    // PILIH PROTECT / PUBLIC
    // ==================================================

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

  } catch (error) {

    console.error(
      "HANDLE MEDIA ERROR:",
      error
    );

    try {

      if (message?.chat?.id) {

        await sendMessage(
          env,
          message.chat.id,

          "❌ File gagal diproses.\n\n" +
          "Silakan coba kirim ulang file."
        );

      }

    } catch (sendError) {

      console.error(
        "HANDLE MEDIA ERROR MESSAGE:",
        sendError
      );

    }

  }

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
        caption ||
        null,

      step:
        "duration"

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
    session.duration_seconds === null ||
    session.duration_seconds === undefined
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
      "File gagal disimpan ke database."
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


  // ==================================================
  // CREATE FILE
  // ==================================================

  const file =
    await createFileFromSession(
      env,
      session
    );


  // ==================================================
  // BOT USERNAME
  // ==================================================

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


  // ==================================================
  // LINK
  // ==================================================

  const link =
    `https://t.me/${botUsername}?start=${encodeURIComponent(
      file.token
    )}`;


  // ==================================================
  // KIRIM LINK KE USER
  // ==================================================

  await sendMessage(
    env,
    session.source_chat_id,

    "✅ LINK BERHASIL DIBUAT!\n" +
    `🔗 ${link}\n` +
    `⏳ Durasi: ${formatDuration(
      file.duration_seconds
    )}\n` +
    `📅 Expired: ${formatWIB(
      file.expires_at
    )}`,

    {

      reply_markup: {

        inline_keyboard: [

          [

            {
              text:
                "🔗 Buka Link",

              url:
                link

            }

          ]

        ]

      }

    }
  );


  // ==================================================
  // KIRIM INFO KE CHANNEL
  // ==================================================

  const channelId =
    getAdminChannelId(env);


  if (channelId) {

    const access =
      file.protect_content
        ? "PROTECTED"
        : "PUBLIC";


    let channelText =

      "📄 Nama: " +
      (
        file.file_name ||
        "Tanpa nama"
      ) +

      "\n\n" +

      "📦 Ukuran: " +
      formatFileSize(
        file.file_size
      ) +

      "\n\n" +

      "🔐 Akses: " +
      access +

      "\n" +

      "⏱️ Durasi: " +
      formatDuration(
        file.duration_seconds
      );


    // ==================================================
    // CAPTION USER
    // ==================================================

    if (
      file.caption_user
    ) {

      channelText +=
        "\n\n💬 " +
        file.caption_user;

    }


    // ==================================================
    // LINK
    // ==================================================

    channelText +=
      "\n\n🔗 Link:";


    channelText +=
      "\n" +
      link;


    // ==================================================
    // EXPIRED
    // ==================================================

    channelText +=
      "\n\n📅 Expired: " +
      formatWIB(
        file.expires_at
      );


    // ==================================================
    // CAPTION ADMIN
    // ==================================================

    if (
      file.caption_admin
    ) {

      channelText +=
        "\n\n" +
        file.caption_admin;

    }


    await sendMessage(
      env,
      channelId,
      channelText,

      {

        reply_markup: {

          inline_keyboard: [

            [

              {
                text:
                  "🔗 Buka Link",

                url:
                  link

              }

            ]

          ]

        }

      }
    );

  }


  // ==================================================
  // HAPUS SESSION
  // ==================================================

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
// HANDLE CUSTOM DURATION
// ======================================================

export async function handleDurationText(
  message,
  env,
  sessionId
) {

  const duration =
    parseDuration(
      String(
        message.text ||
        ""
      ).trim()
    );


  if (!duration) {

    await sendMessage(
      env,
      message.chat.id,

      "❌ Format durasi tidak valid.\n\n" +

      "Contoh:\n" +
      "30min\n" +
      "2h\n" +
      "1d\n" +
      "7d\n" +
      "2w\n" +
      "1m\n" +
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

  if (!userId || !chatId) {
    return;
  }


  const session =
    await getUserState(
      env,
      userId
    );


  if (!session) {

    await sendMessage(
      env,
      chatId,

      "📁 Kirim file terlebih dahulu."
    );

    return;
  }


  // ==================================================
  // CUSTOM DURATION
  // ==================================================

  if (
    session.step ===
    "custom_duration"
  ) {

    await handleDurationText(
      message,
      env,
      session.session_id
    );

    return;
  }


  // ==================================================
  // CAPTION
  // ==================================================
  //
  // Setelah user memilih Protect/Public,
  // callback akan meminta caption.
  //
  // Karena input caption adalah TEXT biasa,
  // router harus mengirimnya ke sini.
  //
  // ==================================================

  if (
    session.step ===
    "caption"
  ) {

    const caption =
      String(
        message.text ||
        ""
      ).trim();


    if (!caption) {

      await sendMessage(
        env,
        chatId,
        "❌ Caption tidak boleh kosong."
      );

      return;
    }


    const updated =
      await setCaption(
        env,
        session.session_id,
        caption
      );


    if (!updated) {

      await sendMessage(
        env,
        chatId,
        "❌ Sesi tidak ditemukan."
      );

      return;
    }


    await askDuration(
      env,
      chatId,
      session.session_id
    );

    return;
  }


  // ==================================================
  // DEFAULT
  // ==================================================

  await sendMessage(
    env,
    chatId,

    "📁 File sedang diproses.\n\n" +
    "Gunakan pilihan yang tersedia."
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
