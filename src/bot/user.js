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
  select,
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

  const size =
    Number(bytes);

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

  const date =
    new Date(dateValue);

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

  const get =
    type => {

      const part =
        parts.find(
          item => item.type === type
        );

      return part
        ? part.value
        : "";

    };

  return (
    `${get("day")} ${get("month")} ${get("year")} ` +
    `pukul ${get("hour")}.${get("minute")} WIB`
  );

}


// ======================================================
// GET SESSION USER
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
// COPY FILE LANGSUNG KE GRUP ADMIN
// ======================================================
//
// File langsung disalin ketika user mengirim file.
//
// Tidak menunggu:
// - protect/public
// - caption
// - durasi
// - link
//
// Salinan permanen di grup admin.
//
// Jika user memiliki username:
//   👤 User Pengirim
//   -> https://t.me/username
//
// Jika user tidak memiliki username:
//   👤 Nama User (ID: 123456789)
//
// Tidak menggunakan:
//   tg://user?id=...
//
// karena dapat menyebabkan:
//   BUTTON_USER_PRIVACY_RESTRICTED
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


  const messageId =
    message.message_id;

  const sourceChatId =
    message.chat?.id;

  const user =
    message.from;


  if (
    !messageId ||
    !sourceChatId
  ) {

    console.warn(
      "COPY FILE: source chat/message ID kosong.",
      {
        sourceChatId,
        messageId
      }
    );

    return null;

  }


  try {

    const username =
      String(
        user?.username ||
        ""
      ).trim();


    const firstName =
      String(
        user?.first_name ||
        ""
      ).trim();


    const lastName =
      String(
        user?.last_name ||
        ""
      ).trim();


    const userId =
      user?.id;


    const fullName =
      [
        firstName,
        lastName
      ]
        .filter(Boolean)
        .join(" ")
        .trim();


    const displayName =
      fullName ||
      username ||
      "User";


    const extra = {

      protect_content:
        false

    };


    // ==================================================
    // USER PUNYA USERNAME
    // ==================================================

    if (username) {

      extra.reply_markup = {

        inline_keyboard: [

          [

            {
              text:
                "👤 User Pengirim",

              url:
                `https://t.me/${encodeURIComponent(
                  username
                )}`

            }

          ]

        ]

      };

    }


    // ==================================================
    // USER TIDAK PUNYA USERNAME
    // ==================================================
    //
    // Jangan menggunakan:
    // tg://user?id=...
    //
    // karena dapat ditolak Telegram.
    //
    // Tombol hanya menampilkan:
    // nama + ID user.
    //
    // ==================================================

    else {

      extra.reply_markup = {

        inline_keyboard: [

          [

            {
              text:
                `👤 ${displayName} (ID: ${userId || "-"})`,

              callback_data:
                `admin:user:${String(
                  userId || ""
                ).slice(0, 50)}`

            }

          ]

        ]

      };

    }


    const result =
      await copyMessage(
        env,
        groupId,
        sourceChatId,
        messageId,
        extra
      );


    console.log(
      "COPY FILE KE ADMIN GROUP BERHASIL:",
      {

        groupId,

        sourceChatId,

        messageId,

        userId,

        username:
          username || null,

        result

      }
    );


    return result;

  } catch (error) {

    console.error(
      "COPY FILE KE ADMIN GROUP ERROR:",
      error
    );

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
    message.chat?.id;

  if (!chatId) {
    return;
  }

  const text =
    String(
      message.text ||
      ""
    ).trim();

  const parts =
    text.split(/\s+/);

  const token =
    parts.length > 1
      ? parts[1]
      : null;


  // ====================================================
  // START TANPA TOKEN
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
    new Date(file.expires_at).getTime()
      <= Date.now()
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
        Number(file.access_count || 0) + 1,

      last_access_at:
        new Date().toISOString()

    }
  );


  // ====================================================
  // KIRIM FILE
  // ====================================================

  const sentMessage =
    await sendFile(
      env,
      chatId,
      file
    );


  // ====================================================
  // SIMPAN PESAN FILE BOT
  // ====================================================

  if (
    sentMessage &&
    sentMessage.message_id
  ) {

    await update(
      env,
      "files",
      `id=eq.${encodeURIComponent(
        file.id
      )}`,
      {

        sent_chat_id:
          chatId,

        sent_message_id:
          sentMessage.message_id

      }
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


  // ====================================================
  // SESSION
  // ====================================================

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
        null,

      step:
        "protect"

    },
    false
  );


  // ====================================================
  // COPY LANGSUNG KE GRUP ADMIN
  // ====================================================

  await copyOriginalToAdminGroup(
    env,
    message
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
        Boolean(value),

      step:
        "caption"

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
        caption || null,

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
// GET ACTIVE ADMIN CAPTION
// ======================================================
//
// Caption yang digunakan adalah caption terbaru
// dari tabel admin_captions.
//
// Jika tidak ada caption admin:
// caption_admin = null
//
// ======================================================

async function getActiveAdminCaption(
  env
) {

  try {

    const captions =
      await select(
        env,
        "admin_captions",
        "select=id,caption,created_at&order=id.desc&limit=1"
      );


    if (
      !captions ||
      !captions.length
    ) {

      return null;

    }


    const caption =
      captions[0]?.caption;


    if (
      caption === null ||
      caption === undefined
    ) {

      return null;

    }


    const value =
      String(
        caption
      ).trim();


    return value ||
      null;

  } catch (error) {

    console.error(
      "GET ACTIVE ADMIN CAPTION ERROR:",
      error
    );

    return null;

  }

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
  // AMBIL CAPTION ADMIN TERBARU
  // ====================================================

  const adminCaption =
    await getActiveAdminCaption(
      env
    );


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
          adminCaption,

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


  const file =
    await createFileFromSession(
      env,
      session
    );


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


  const link =
    `https://t.me/${botUsername}?start=${encodeURIComponent(
      file.token
    )}`;


  // ====================================================
  // USER
  // ====================================================

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


  // ====================================================
  // CHANNEL ADMIN
  // ====================================================

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


    if (
      file.caption_user
    ) {

      channelText +=
        "\n\n💬 " +
        file.caption_user;

    }


    channelText +=
      "\n\n🔗 Link:";


    channelText +=
      "\n" +
      link;


    channelText +=
      "\n\n📅 Expired: " +
      formatWIB(
        file.expires_at
      );


    // ==================================================
    // CAPTION ADMIN
    // ==================================================
    //
    // Hanya:
    // 📝 + isi caption admin
    //
    // Tidak ada teks tambahan.
    //
    // ==================================================

    if (
      file.caption_admin
    ) {

      channelText +=
        "\n\n📝 " +
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
//
// Setelah user memilih Protect/Public:
// step = caption
//
// Text berikutnya menjadi caption.
//
// Setelah caption:
// step = duration
//
// Custom duration:
// step = custom_duration
//
// ======================================================

export async function handleText(
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


  // ====================================================
  // CUSTOM DURATION
  // ====================================================

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


  // ====================================================
  // CAPTION
  // ====================================================

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
        "❌ Sesi sudah tidak ditemukan."
      );

      return;

    }


    await sendMessage(
      env,
      chatId,
      "✅ Caption disimpan."
    );


    await askDuration(
      env,
      chatId,
      session.session_id
    );

    return;

  }


  // ====================================================
  // STEP LAIN
  // ====================================================

  await sendMessage(
    env,
    chatId,

    "⚙️ Silakan gunakan tombol yang tersedia."
  );

}


// ======================================================
// SEND FILE
// ======================================================
//
// Fungsi ini mengembalikan hasil Telegram API.
//
// message_id digunakan handleStart() untuk menyimpan:
//
// sent_chat_id
// sent_message_id
//
// Dengan begitu expiry.js dapat menghapus pesan file
// yang dikirim bot setelah masa berlaku habis.
//
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
