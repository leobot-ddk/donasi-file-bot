// ======================================================
// ADMIN HANDLER - DONASI FILE BOT
// ======================================================

import {
  sendMessage,
  telegram
} from "../services/telegram.js";

import {
  select,
  selectOne,
  insert,
  update,
  remove
} from "../database/supabase.js";

import {
  isAdmin
} from "../config.js";


// ======================================================
// ADMIN SESSION
// ======================================================

const adminSessions = new Map();


// ======================================================
// CHECK ADMIN
// ======================================================

function checkAdmin(
  userId,
  env
) {

  return isAdmin(
    userId,
    env
  );

}


// ======================================================
// FORMAT DATE
// ======================================================

function formatDate(
  value
) {

  if (!value) {
    return "-";
  }

  try {

    return new Date(
      value
    ).toLocaleString(
      "id-ID",
      {
        timeZone:
          "Asia/Jakarta"
      }
    );

  } catch {

    return String(value);

  }

}


// ======================================================
// EDIT ADMIN MESSAGE
// ======================================================

export async function editAdminMessage(
  env,
  chatId,
  messageId,
  text,
  keyboard = null
) {

  if (
    !chatId ||
    !messageId
  ) {

    return false;

  }

  try {

    const params = {

      chat_id:
        chatId,

      message_id:
        messageId,

      text

    };


    if (keyboard) {

      params.reply_markup = {

        inline_keyboard:
          keyboard

      };

    } else {

      params.reply_markup = {

        inline_keyboard:
          []

      };

    }


    await telegram(
      env,
      "editMessageText",
      params
    );


    return true;

  } catch (error) {

    console.error(
      "EDIT ADMIN MESSAGE ERROR:",
      error
    );


    return false;

  }

}


// ======================================================
// SEND ADMIN MESSAGE
// ======================================================

async function sendAdminMessage(
  env,
  chatId,
  text,
  keyboard = null
) {

  return sendMessage(
    env,
    chatId,
    text,

    keyboard
      ? {
          reply_markup: {
            inline_keyboard:
              keyboard
          }
        }
      : undefined
  );

}


// ======================================================
// ADMIN COMMAND
// ======================================================

export async function handleAdminCommand(
  message,
  env
) {

  const userId =
    message?.from?.id;

  const chatId =
    message?.chat?.id;


  if (
    !checkAdmin(
      userId,
      env
    )
  ) {

    return;

  }


  const text =
    String(
      message.text || ""
    ).trim();


  const command =
    text
      .split(/\s+/)[0]
      .toLowerCase();


  // ====================================================
  // /admin
  // ====================================================

  if (
    command === "/admin" ||
    command === "/panel"
  ) {

    await showAdminPanel(
      env,
      chatId
    );

    return;

  }


  // ====================================================
  // /files
  // ====================================================

  if (
    command === "/files"
  ) {

    await showFiles(
      env,
      chatId
    );

    return;

  }


  // ====================================================
  // /users
  // ====================================================

  if (
    command === "/users"
  ) {

    await showUsers(
      env,
      chatId
    );

    return;

  }


  // ====================================================
  // /stats
  // ====================================================

  if (
    command === "/stats"
  ) {

    await showDashboard(
      env,
      chatId
    );

    return;

  }


  await sendAdminMessage(
    env,
    chatId,

    "❌ Command admin tidak dikenal.\n\n" +

    "/admin\n" +
    "/files\n" +
    "/users\n" +
    "/stats"
  );

}


// ======================================================
// ADMIN TEXT
// ======================================================

export async function handleAdminText(
  message,
  env
) {

  const userId =
    message?.from?.id;

  const chatId =
    message?.chat?.id;


  if (
    !checkAdmin(
      userId,
      env
    )
  ) {

    return;

  }


  const session =
    adminSessions.get(
      String(userId)
    );


  // ====================================================
  // ADD CAPTION
  // ====================================================

  if (
    session?.type === "caption"
  ) {

    const caption =
      String(
        message.text || ""
      ).trim();


    if (!caption) {

      await sendAdminMessage(
        env,
        chatId,

        "❌ Caption tidak boleh kosong."
      );

      return;

    }


    await insert(
      env,
      "admin_captions",
      {

        caption,

        created_by:
          userId

      }
    );


    adminSessions.delete(
      String(userId)
    );


    await sendAdminMessage(
      env,
      chatId,

      "✅ Caption berhasil ditambahkan."
    );


    await showCaptionMenu(
      env,
      chatId
    );


    return;

  }


  // ====================================================
  // DEFAULT
  // ====================================================

  await sendAdminMessage(
    env,
    chatId,

    "⚙️ Panel admin tersedia.\n\n" +
    "Gunakan /admin"
  );

}


// ======================================================
// ADMIN PANEL
// ======================================================

export async function showAdminPanel(
  env,
  chatId,
  messageId = null
) {

  const text =
    "🛠 PANEL ADMIN\n\n" +
    "Pilih menu:";


  const keyboard = [

    [
      {
        text:
          "📊 Dashboard",

        callback_data:
          "admin:dashboard"
      }
    ],

    [
      {
        text:
          "🗑️ Hapus Link",

        callback_data:
          "admin:delete"
      },

      {
        text:
          "👤 User",

        callback_data:
          "admin:users"
      }
    ],

    [
      {
        text:
          "📝 Caption",

        callback_data:
          "admin:caption"
      },

      {
        text:
          "⚙️ Admin",

        callback_data:
          "admin:admins"
      }
    ]

  ];


  if (
    messageId
  ) {

    const edited =
      await editAdminMessage(
        env,
        chatId,
        messageId,
        text,
        keyboard
      );


    if (edited) {
      return;
    }

  }


  await sendAdminMessage(
    env,
    chatId,
    text,
    keyboard
  );

}


// ======================================================
// DASHBOARD
// ======================================================

export async function showDashboard(
  env,
  chatId,
  messageId = null
) {

  try {

    const files =
      await select(
        env,
        "files",
        "select=id,status,access_count,created_at,expires_at"
      );


    let total =
      0;

    let active =
      0;

    let expired =
      0;

    let accesses =
      0;

    let today =
      0;


    const now =
      new Date();


    const todayString =
      now
        .toISOString()
        .slice(
          0,
          10
        );


    for (
      const file of files || []
    ) {

      total++;


      const status =
        String(
          file.status || ""
        ).toLowerCase();


      if (
        status === "active"
      ) {

        active++;

      }


      if (
        status === "expired"
      ) {

        expired++;

      }


      accesses +=
        Number(
          file.access_count || 0
        );


      if (
        file.created_at &&
        String(
          file.created_at
        ).startsWith(
          todayString
        )
      ) {

        today++;

      }

    }


    const text =

      "📊 DASHBOARD\n\n" +

      `📁 Total file: ${total}\n` +
      `🟢 File aktif: ${active}\n` +
      `🔴 File expired: ${expired}\n` +
      `👁 Total akses: ${accesses}\n` +
      `📅 File dibuat hari ini: ${today}`;


    const keyboard = [

      [
        {
          text:
            "🔄 Refresh",

          callback_data:
            "admin:dashboard"
        }
      ],

      [
        {
          text:
            "⬅️ Kembali",

          callback_data:
            "admin:panel"
        }
      ]

    ];


    if (
      messageId
    ) {

      const edited =
        await editAdminMessage(
          env,
          chatId,
          messageId,
          text,
          keyboard
        );


      if (edited) {
        return;
      }

    }


    await sendAdminMessage(
      env,
      chatId,
      text,
      keyboard
    );

  } catch (error) {

    console.error(
      "ADMIN DASHBOARD ERROR:",
      error
    );


    await sendAdminMessage(
      env,
      chatId,

      "❌ Gagal mengambil dashboard."
    );

  }

}


// ======================================================
// DAFTAR FILE
// ======================================================

export async function showFiles(
  env,
  chatId,
  messageId = null
) {

  try {

    const files =
      await select(
        env,
        "files",
        "select=id,file_name,media_type,status,expires_at,created_at,owner_telegram_id,access_count&order=id.desc&limit=30"
      );


    if (
      !files ||
      files.length === 0
    ) {

      const text =
        "📁 Belum ada file.";


      const keyboard = [

        [
          {
            text:
              "⬅️ Kembali",

            callback_data:
              "admin:panel"
          }
        ]

      ];


      if (
        messageId &&
        await editAdminMessage(
          env,
          chatId,
          messageId,
          text,
          keyboard
        )
      ) {

        return;

      }


      await sendAdminMessage(
        env,
        chatId,
        text,
        keyboard
      );

      return;

    }


    let text =
      "📁 DAFTAR FILE\n\n";


    const buttons = [];


    for (
      let i = 0;
      i < files.length;
      i++
    ) {

      const file =
        files[i];


      text +=
        `${i + 1}. ${file.file_name || "File"}\n`;

      text +=
        `ID: ${file.id}\n`;

      text +=
        `Status: ${file.status || "-"}\n`;

      text +=
        `Pemilik: ${file.owner_telegram_id || "-"}\n`;

      text +=
        `Akses: ${Number(file.access_count || 0)}\n`;

      text +=
        `Expired: ${formatDate(file.expires_at)}\n\n`;


      buttons.push([

        {
          text:
            `📁 ${file.file_name || `File ${file.id}`}`,

          callback_data:
            `admin:file:${file.id}`
        }

      ]);

    }


    buttons.push([

      {
        text:
          "⬅️ Kembali",

        callback_data:
          "admin:panel"
      }

    ]);


    if (
      messageId &&
      await editAdminMessage(
        env,
        chatId,
        messageId,
        text,
        buttons
      )
    ) {

      return;

    }


    await sendAdminMessage(
      env,
      chatId,
      text,
      buttons
    );

  } catch (error) {

    console.error(
      "ADMIN FILES ERROR:",
      error
    );


    await sendAdminMessage(
      env,
      chatId,

      "❌ Gagal mengambil daftar file."
    );

  }

}


// ======================================================
// FILE DETAIL
// ======================================================

export async function showFileDetail(
  env,
  chatId,
  fileId,
  messageId = null
) {

  try {

    const file =
      await selectOne(
        env,
        "files",

        `select=id,file_name,media_type,status,expires_at,created_at,owner_telegram_id,access_count,token&id=eq.${encodeURIComponent(fileId)}`
      );


    if (!file) {

      await sendAdminMessage(
        env,
        chatId,

        "❌ File tidak ditemukan."
      );

      return;

    }


    const text =

      "📁 DETAIL FILE\n\n" +

      `Nama: ${file.file_name || "-"}\n` +
      `Token: ${file.token || "-"}\n` +
      `ID: ${file.id}\n` +
      `Pemilik: ${file.owner_telegram_id || "-"}\n` +
      `Media: ${file.media_type || "-"}\n` +
      `Status: ${file.status || "-"}\n` +
      `Akses: ${Number(file.access_count || 0)}\n` +
      `Dibuat: ${formatDate(file.created_at)}\n` +
      `Expired: ${formatDate(file.expires_at)}`;


    const keyboard = [];


    if (
      String(
        file.status || ""
      ).toLowerCase() !==
      "inactive"
    ) {

      keyboard.push([

        {
          text:
            "🗑️ Nonaktifkan Link",

          callback_data:
            `admin:disable:${file.id}`
        }

      ]);

    }


    keyboard.push([

      {
        text:
          "⬅️ Daftar File",

        callback_data:
          "admin:delete"
      }

    ]);


    if (
      messageId &&
      await editAdminMessage(
        env,
        chatId,
        messageId,
        text,
        keyboard
      )
    ) {

      return;

    }


    await sendAdminMessage(
      env,
      chatId,
      text,
      keyboard
    );

  } catch (error) {

    console.error(
      "ADMIN FILE DETAIL ERROR:",
      error
    );


    await sendAdminMessage(
      env,
      chatId,

      "❌ Gagal mengambil detail file."
    );

  }

}


// ======================================================
// DISABLE FILE
// ======================================================

export async function disableFile(
  env,
  chatId,
  fileId,
  messageId = null
) {

  try {

    const result =
      await update(
        env,
        "files",

        `id=eq.${encodeURIComponent(fileId)}`,

        {
          status:
            "inactive",

          deleted_at:
            new Date().toISOString()

        }
      );


    if (
      !result ||
      !result.length
    ) {

      await sendAdminMessage(
        env,
        chatId,

        "❌ File tidak ditemukan."
      );

      return;

    }


    await showFileDetail(
      env,
      chatId,
      fileId,
      messageId
    );

  } catch (error) {

    console.error(
      "ADMIN DISABLE FILE ERROR:",
      error
    );


    await sendAdminMessage(
      env,
      chatId,

      "❌ Gagal menonaktifkan link."
    );

  }

}


// ======================================================
// USER LIST
// ======================================================

export async function showUsers(
  env,
  chatId,
  messageId = null
) {

  try {

    const files =
      await select(
        env,
        "files",
        "select=owner_telegram_id,access_count&order=id.desc&limit=5000"
      );


    const stats =
      new Map();


    for (
      const file of files || []
    ) {

      const userId =
        file.owner_telegram_id;


      if (!userId) {
        continue;
      }


      const key =
        String(userId);


      if (!stats.has(key)) {

        stats.set(
          key,
          {
            files:
              0,

            accesses:
              0
          }
        );

      }


      const item =
        stats.get(key);


      item.files++;

      item.accesses +=
        Number(
          file.access_count || 0
        );

    }


    const blocked =
      await select(
        env,
        "blocked_users",
        "select=telegram_user_id"
      );


    const blockedSet =
      new Set(
        (blocked || [])
          .map(
            item =>
              String(
                item.telegram_user_id
              )
          )
      );


    if (
      stats.size === 0
    ) {

      const text =
        "👤 Belum ada user.";


      const keyboard = [

        [
          {
            text:
              "⬅️ Kembali",

            callback_data:
              "admin:panel"
          }
        ]

      ];


      if (
        messageId &&
        await editAdminMessage(
          env,
          chatId,
          messageId,
          text,
          keyboard
        )
      ) {

        return;

      }


      await sendAdminMessage(
        env,
        chatId,
        text,
        keyboard
      );

      return;

    }


    let text =
      "👤 DAFTAR USER\n\n";


    const buttons = [];


    let index =
      0;


    for (
      const [
        userId,
        data
      ] of stats
    ) {

      index++;


      const blocked =
        blockedSet.has(
          userId
        );


      text +=
        `${index}. ${userId}\n`;

      text +=
        `📁 File: ${data.files}\n`;

      text +=
        `👁 Akses: ${data.accesses}\n`;

      text +=
        `${blocked ? "🔴 Diblokir" : "🟢 Aktif"}\n\n`;


      buttons.push([

        {
          text:
            blocked
              ? `🟢 Unblok ${userId}`
              : `🔴 Blokir ${userId}`,

          callback_data:
            blocked
              ? `admin:unblock:${userId}`
              : `admin:block:${userId}`
        }

      ]);

    }


    buttons.push([

      {
        text:
          "⬅️ Kembali",

        callback_data:
          "admin:panel"
      }

    ]);


    if (
      messageId &&
      await editAdminMessage(
        env,
        chatId,
        messageId,
        text,
        buttons
      )
    ) {

      return;

    }


    await sendAdminMessage(
      env,
      chatId,
      text,
      buttons
    );

  } catch (error) {

    console.error(
      "ADMIN USERS ERROR:",
      error
    );


    await sendAdminMessage(
      env,
      chatId,

      "❌ Gagal mengambil data user."
    );

  }

}


// ======================================================
// BLOCK USER
// ======================================================

export async function blockUser(
  env,
  chatId,
  adminId,
  userId,
  messageId = null
) {

  try {

    await insert(
      env,
      "blocked_users",
      {

        telegram_user_id:
          Number(userId),

        blocked_by:
          Number(adminId),

        reason:
          "Blocked by admin"

      }
    );


    await showUsers(
      env,
      chatId,
      messageId
    );

  } catch (error) {

    console.error(
      "ADMIN BLOCK USER ERROR:",
      error
    );


    await sendAdminMessage(
      env,
      chatId,

      "❌ Gagal memblokir user."
    );

  }

}


// ======================================================
// UNBLOCK USER
// ======================================================

export async function unblockUser(
  env,
  chatId,
  userId,
  messageId = null
) {

  try {

    await remove(
      env,
      "blocked_users",

      `telegram_user_id=eq.${encodeURIComponent(userId)}`
    );


    await showUsers(
      env,
      chatId,
      messageId
    );

  } catch (error) {

    console.error(
      "ADMIN UNBLOCK USER ERROR:",
      error
    );


    await sendAdminMessage(
      env,
      chatId,

      "❌ Gagal melakukan unblock."
    );

  }

}


// ======================================================
// CAPTION MENU
// ======================================================

export async function showCaptionMenu(
  env,
  chatId,
  messageId = null
) {

  try {

    const captions =
      await select(
        env,
        "admin_captions",
        "select=id,caption,created_at,created_by&order=id.desc&limit=20"
      );


    let text =
      "📝 CAPTION ADMIN\n\n";


    if (
      !captions ||
      captions.length === 0
    ) {

      text +=
        "Belum ada caption.";

    } else {

      for (
        let i = 0;
        i < captions.length;
        i++
      ) {

        const caption =
          captions[i];


        text +=
          `${i + 1}. ${caption.caption}\n`;

        text +=
          `Dibuat: ${formatDate(caption.created_at)}\n\n`;

      }

    }


    const buttons = [

      [
        {
          text:
            "➕ Tambah Caption",

          callback_data:
            "admin:caption:add"
        }
      ]

    ];


    if (
      captions &&
      captions.length
    ) {

      for (
        const caption of captions
      ) {

        buttons.push([

          {
            text:
              `🗑️ Hapus #${caption.id}`,

            callback_data:
              `admin:caption:delete:${caption.id}`
          }

        ]);

      }

    }


    buttons.push([

      {
        text:
          "⬅️ Kembali",

        callback_data:
          "admin:panel"
      }

    ]);


    if (
      messageId &&
      await editAdminMessage(
        env,
        chatId,
        messageId,
        text,
        buttons
      )
    ) {

      return;

    }


    await sendAdminMessage(
      env,
      chatId,
      text,
      buttons
    );

  } catch (error) {

    console.error(
      "ADMIN CAPTION ERROR:",
      error
    );


    await sendAdminMessage(
      env,
      chatId,

      "❌ Gagal mengambil caption."
    );

  }

}


// ======================================================
// START ADD CAPTION
// ======================================================

export async function startAddCaption(
  env,
  userId,
  chatId
) {

  adminSessions.set(
    String(userId),
    {
      type:
        "caption"
    }
  );


  await sendAdminMessage(
    env,
    chatId,

    "📝 Kirim caption/pesan admin sekarang.\n\n" +
    "Pesan berikutnya akan disimpan sebagai caption."
  );

}


// ======================================================
// DELETE CAPTION
// ======================================================

export async function deleteCaption(
  env,
  chatId,
  captionId,
  messageId = null
) {

  try {

    await remove(
      env,
      "admin_captions",

      `id=eq.${encodeURIComponent(captionId)}`
    );


    await showCaptionMenu(
      env,
      chatId,
      messageId
    );

  } catch (error) {

    console.error(
      "ADMIN DELETE CAPTION ERROR:",
      error
    );


    await sendAdminMessage(
      env,
      chatId,

      "❌ Gagal menghapus caption."
    );

  }

}


// ======================================================
// ADMIN LIST
// ======================================================

export async function showAdmins(
  env,
  chatId,
  messageId = null
) {

  const raw =
    String(
      env.ADMIN_IDS || ""
    ).trim();


  const admins =
    raw
      ? raw
          .split(",")
          .map(
            id =>
              id.trim()
          )
          .filter(Boolean)
      : [];


  let text =
    "⚙️ ADMIN\n\n";


  if (
    admins.length === 0
  ) {

    text +=
      "Belum ada admin.";

  } else {

    text +=
      "Daftar admin:\n\n";


    admins.forEach(
      (
        id,
        index
      ) => {

        text +=
          `${index + 1}. ${id}\n`;

      }
    );

  }


  text +=
    "\nMulti-admin menggunakan ADMIN_IDS di Cloudflare Worker.";


  const keyboard = [

    [
      {
        text:
          "⬅️ Kembali",

        callback_data:
          "admin:panel"
      }
    ]

  ];


  if (
    messageId &&
    await editAdminMessage(
      env,
      chatId,
      messageId,
      text,
      keyboard
    )
  ) {

    return;

  }


  await sendAdminMessage(
    env,
    chatId,
    text,
    keyboard
  );

}


// ======================================================
// ADMIN SESSION CHECK
// ======================================================

export function hasAdminSession(
  userId
) {

  if (!userId) {
    return false;
  }

  return adminSessions.has(
    String(userId)
  );

}


// ======================================================
// EXPORTS
// ======================================================

export {
  checkAdmin
};
