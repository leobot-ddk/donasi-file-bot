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
// GET SESSION TERBARU USER
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
// HANDLE START
// ======================================================

export async function handleStart(
  message,
  env
) {

  const chatId =
    message.chat?.id;

  if (!chatId) {
    return;
  }


  const text =
    String(
      message.text || ""
    );


  const parts =
    text
      .trim()
      .split(/\s+/);


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
      "Kirim file ke bot untuk membuat link."
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

      "❌ Link tidak ditemukan atau sudah tidak tersedia."
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
      chatId,

      "❌ Link ini sudah tidak aktif."
    );

    return;

  }


  // ====================================================
  // CEK EXPIRED
  // ====================================================

  if (
    file.expires_at
  ) {

    const expires =
      new Date(
        file.expires_at
      ).getTime();


    if (
      Number.isFinite(expires) &&
      Date.now() >= expires
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

        "❌ Link ini sudah kedaluwarsa."
      );

      return;

    }

  }


  // ====================================================
  // KIRIM FILE KE USER
  // ====================================================

  await sendFile(
    env,
    chatId,
    file
  );


  // ====================================================
  // UPDATE ACCESS
  // ====================================================

  const accessCount =
    Number(
      file.access_count || 0
    );


  await update(
    env,
    "files",
    `token=eq.${encodeURIComponent(
      token
    )}`,
    {

      access_count:
        accessCount + 1,

      last_access_at:
        new Date().toISOString()

    }
  );

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
// FORMAT FILE SIZE
// ======================================================

function formatFileSize(
  size
) {

  const bytes =
    Number(size);


  if (
    !Number.isFinite(bytes) ||
    bytes <= 0
  ) {

    return "Tidak diketahui";

  }


  if (
    bytes < 1024
  ) {

    return `${bytes} B`;

  }


  if (
    bytes < 1024 * 1024
  ) {

    return (
      `${(
        bytes / 1024
      ).toFixed(2)} KB`
    );

  }


  if (
    bytes < 1024 * 1024 * 1024
  ) {

    return (
      `${(
        bytes /
        (1024 * 1024)
      ).toFixed(2)} MB`
    );

  }


  return (
    `${(
      bytes /
      (1024 * 1024 * 1024)
    ).toFixed(2)} GB`
  );

}


// ======================================================
// FORMAT EXPIRED WIB
// ======================================================

export function formatExpiredWIB(
  expiresAt
) {

  if (!expiresAt) {
    return "Selamanya";
  }


  const date =
    new Date(
      expiresAt
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "Tidak diketahui";

  }


  const formatter =
    new Intl.DateTimeFormat(
      "id-ID",
      {

        timeZone:
          "Asia/Jakarta",

        day:
          "2-digit",

        month:
          "long",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hour12:
          false

      }
    );


  return (
    `${formatter.format(
      date
    )} WIB`
  );

}


// ======================================================
// FORMAT DURASI CHANNEL
// ======================================================

export function formatChannelDuration(
  seconds
) {

  if (
    seconds === null ||
    seconds === undefined
  ) {

    return "Selamanya";

  }


  const value =
    Number(seconds);


  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {

    return "Selamanya";

  }


  const minute =
    60;

  const hour =
    60 * minute;

  const day =
    24 * hour;

  const week =
    7 * day;

  const month =
    30 * day;


  if (
    value % month === 0
  ) {

    const months =
      value / month;


    return (
      months === 1
        ? "1 bulan"
        : `${months} bulan`
    );

  }


  if (
    value % week === 0
  ) {

    const weeks =
      value / week;


    return (
      weeks === 1
        ? "1 minggu"
        : `${weeks} minggu`
    );

  }


  if (
    value % day === 0
  ) {

    const days =
      value / day;


    return (
      days === 1
        ? "1 hari"
        : `${days} hari`
    );

  }


  if (
    value % hour === 0
  ) {

    const hours =
      value / hour;


    return (
      hours === 1
        ? "1 jam"
        : `${hours} jam`
    );

  }


  if (
    value % minute === 0
  ) {

    const minutes =
      value / minute;


    return (
      minutes === 1
        ? "1 menit"
        : `${minutes} menit`
    );

  }


  return formatDuration(
    value
  );

}


// ======================================================
// BUILD CHANNEL MESSAGE
// ======================================================
//
// Dipisahkan menjadi function agar admin juga dapat
// menggunakan format yang sama ketika caption_admin
// diubah.
//
// ======================================================

export function buildChannelMessage(
  file,
  link
) {

  const fileName =
    file.file_name ||
    "Tanpa nama";


  const size =
    formatFileSize(
      file.file_size
    );


  const access =
    file.protect_content
      ? "PROTECTED"
      : "PUBLIC";


  const duration =
    formatChannelDuration(
      file.duration_seconds
    );


  const lines = [];


  // ====================================================
  // INFORMASI FILE
  // ====================================================

  lines.push(
    `📄 Nama: ${fileName}`
  );


  lines.push(
    `📦 Ukuran: ${size}`
  );


  lines.push("");


  // ====================================================
  // AKSES
  // ====================================================

  lines.push(
    `🔐 Akses: ${access}`
  );


  lines.push(
    `⏱️ Durasi: ${duration}`
  );


  // ====================================================
  // CAPTION USER
  // ====================================================

  if (
    file.caption_user &&
    String(
      file.caption_user
    ).trim()
  ) {

    lines.push("");


    lines.push(
      "💬 Caption User:"
    );


    lines.push(
      String(
        file.caption_user
      )
    );

  }


  // ====================================================
  // CAPTION ADMIN
  // ====================================================

  if (
    file.caption_admin &&
    String(
      file.caption_admin
    ).trim()
  ) {

    lines.push("");


    lines.push(
      "📝 Caption Admin:"
    );


    lines.push(
      String(
        file.caption_admin
      )
    );

  }


  // ====================================================
  // LINK
  // ====================================================

  lines.push("");


  lines.push(
    "🔗 Link:"
  );


  // ====================================================
  // EXPIRED
  // ====================================================

  lines.push("");


  lines.push(
    `📅 Expired: ${formatExpiredWIB(
      file.expires_at
    )}`
  );


  return lines.join(
    "\n"
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
  // GROUP
  // ====================================================

  const groupId =
    getAdminGroupId(
      env
    );


  if (!groupId) {

    throw new Error(
      "ADMIN_GROUP_ID belum diset."
    );

  }


  // ====================================================
  // CHANNEL
  // ====================================================

  const channelId =
    getAdminChannelId(
      env
    );


  if (!channelId) {

    throw new Error(
      "ADMIN_CHANNEL_ID belum diset."
    );

  }


  // ====================================================
  // COPY FILE KE GROUP
  // ====================================================
  //
  // Selalu:
  // - tanpa protect
  // - permanen
  // - file asli
  //
  // ====================================================

  const groupMessage =
    await copyMessage(
      env,
      groupId,
      session.source_chat_id,
      session.source_message_id,
      {

        protect_content:
          false,

        reply_markup: {

          inline_keyboard: [

            [

              {

                text:
                  "👤 User Pengirim",

                url:
                  `tg://user?id=${session.telegram_id}`

              }

            ]

          ]

        }

      }
    );


  const groupMessageId =
    groupMessage?.message_id;


  if (!groupMessageId) {

    throw new Error(
      "Salinan file ke grup gagal."
    );

  }


  // ====================================================
  // DATA FILE
  // ====================================================

  const fileData = {

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

    group_message_id:
      groupMessageId,

    channel_message_id:
      null,

    access_count:
      0

  };


  // ====================================================
  // INSERT SUPABASE
  // ====================================================

  const rows =
    await insert(
      env,
      "files",
      fileData
    );


  if (
    !Array.isArray(rows) ||
    !rows[0]
  ) {

    throw new Error(
      "Data file gagal disimpan ke Supabase."
    );

  }


  const file =
    rows[0];


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
  // LINK PENDEK
  // ====================================================

  const link =
    `https://t.me/${botUsername}?start=${encodeURIComponent(
      file.token
    )}`;


  // ====================================================
  // CHANNEL TEXT
  // ====================================================

  const channelText =
    buildChannelMessage(
      file,
      link
    );


  // ====================================================
  // KIRIM PESAN CHANNEL
  // ====================================================

  const channelMessage =
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


  const channelMessageId =
    channelMessage?.message_id;


  if (!channelMessageId) {

    throw new Error(
      "Pesan informasi ke channel gagal."
    );

  }


  // ====================================================
  // SIMPAN CHANNEL MESSAGE ID
  // ====================================================

  await update(
    env,
    "files",
    `id=eq.${encodeURIComponent(
      file.id
    )}`,
    {

      channel_message_id:
        channelMessageId

    }
  );


  return {

    ...file,

    channel_message_id:
      channelMessageId,

    link

  };

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
  // CREATE FILE
  // ====================================================

  const result =
    await createFileFromSession(
      env,
      session
    );


  const file =
    result;


  const link =
    result.link;


  // ====================================================
  // KIRIM LINK KE USER
  // ====================================================

  await sendMessage(
    env,
    session.source_chat_id,

    "✅ LINK BERHASIL DIBUAT!\n" +

    `🔗 ${link}\n` +

    `⏳ Durasi: ${formatChannelDuration(
      file.duration_seconds
    )}\n` +

    `berakhir: ${formatExpiredWIB(
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
    message.from?.id;

  const chatId =
    message.chat?.id;


  const text =
    String(
      message.text || ""
    ).trim();


  if (
    !userId ||
    !chatId ||
    !text
  ) {

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

      "📁 Silakan kirim file terlebih dahulu."
    );

    return;

  }


  // ====================================================
  // CUSTOM DURATION
  // ====================================================

  if (
    session.duration_seconds === null &&
    session.caption_user !== null &&
    session.caption_user !== undefined
  ) {

    await handleDurationText(
      message,
      env,
      session.session_id
    );

    return;

  }


  // ====================================================
  // INPUT CAPTION
  // ====================================================

  if (
    session.caption_user === null ||
    session.caption_user === undefined
  ) {

    await setCaption(
      env,
      session.session_id,
      text
    );


    await askDuration(
      env,
      chatId,
      session.session_id
    );


    return;

  }


  // ====================================================
  // FALLBACK CUSTOM DURATION
  // ====================================================

  await handleDurationText(
    message,
    env,
    session.session_id
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

    // ==================================================
    // PHOTO
    // ==================================================

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


    // ==================================================
    // VIDEO
    // ==================================================

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


    // ==================================================
    // AUDIO
    // ==================================================

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


    // ==================================================
    // VOICE
    // ==================================================

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


    // ==================================================
    // ANIMATION
    // ==================================================

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


    // ==================================================
    // VIDEO NOTE
    // ==================================================

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


    // ==================================================
    // STICKER
    // ==================================================

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


    // ==================================================
    // DOCUMENT
    // ==================================================

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
