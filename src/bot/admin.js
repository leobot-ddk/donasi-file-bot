// ======================================================
// ADMIN HANDLER - DONASI FILE BOT
// ======================================================

import {
  sendMessage
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
        timeZone: "Asia/Jakarta"
      }
    );

  } catch {

    return String(value);

  }

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


  await sendMessage(
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
  // CAPTION INPUT
  // ====================================================

  if (
    session?.type === "caption"
  ) {

    const caption =
      String(
        message.text || ""
      ).trim();


    if (!caption) {

      await sendMessage(
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


    await sendMessage(
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

  await sendMessage(
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
  chatId
) {

  await sendMessage(
    env,
    chatId,

    "🛠 PANEL ADMIN\n\n" +
    "Pilih menu:",

    {

      reply_markup: {

        inline_keyboard: [

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

        ]

      }

    }
  );

}


// ======================================================
// DASHBOARD
// ======================================================

export async function showDashboard(
  env,
  chatId
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


    await sendMessage(
      env,
      chatId,

      "📊 DASHBOARD\n\n" +

      `📁 Total file: ${total}\n` +
      `🟢 File aktif: ${active}\n` +
      `🔴 File expired: ${expired}\n` +
      `👁 Total akses: ${accesses}\n` +
      `📅 File dibuat hari ini: ${today}`,

      {

        reply_markup: {

          inline_keyboard: [

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

          ]

        }

      }
    );

  } catch (error) {

    console.error(
      "ADMIN DASHBOARD ERROR:",
      error
    );


    await sendMessage(
      env,
      chatId,

      "❌ Gagal mengambil dashboard."
    );

  }

}


// ======================================================
// FILE MENU
// ======================================================

export async function showFiles(
  env,
  chatId
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

      await sendMessage(
        env,
        chatId,

        "📁 Belum ada file.",

        {

          reply_markup: {

            inline_keyboard: [

              [
                {
                  text:
                    "⬅️ Kembali",

                  callback_data:
                    "admin:panel"
                }
              ]

            ]

          }

        }
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
        `Expired: ${formatDate(file.expires_at)}\n`;

      text +=
        "\n";


      buttons.push([

        {
          text:
            `🗑️ ${file.file_name || `File ${file.id}`}`,

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


    await sendMessage(
      env,
      chatId,
      text,

      {

        reply_markup: {

          inline_keyboard:
            buttons

        }

      }
    );

  } catch (error) {

    console.error(
      "ADMIN FILES ERROR:",
      error
    );


    await sendMessage(
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
  fileId
) {

  try {

    const file =
      await selectOne(
        env,
        "files",

        `select=id,file_name,media_type,status,expires_at,created_at,owner_telegram_id,access_count&id=eq.${encodeURIComponent(fileId)}`
      );


    if (!file) {

      await sendMessage(
        env,
        chatId,

        "❌ File tidak ditemukan."
      );

      return;

    }


    const text =

      "📁 DETAIL FILE\n\n" +

      `Nama: ${file.file_name || "-"}\n` +
      `ID: ${file.id}\n` +
      `Pemilik: ${file.owner_telegram_id || "-"}\n` +
      `Media: ${file.media_type || "-"}\n` +
      `Status: ${file.status || "-"}\n` +
      `Akses: ${Number(file.access_count || 0)}\n` +
      `Dibuat: ${formatDate(file.created_at)}\n` +
      `Expired: ${formatDate(file.expires_at)}`;


    const buttons = [];


    if (
      String(
        file.status || ""
      ).toLowerCase() !==
      "inactive"
    ) {

      buttons.push([

        {
          text:
            "🗑️ Nonaktifkan Link",

          callback_data:
            `admin:disable:${file.id}`
        }

      ]);

    }


    buttons.push([

      {
        text:
          "⬅️ Daftar File",

        callback_data:
          "admin:delete"
      }

    ]);


    await sendMessage(
      env,
      chatId,
      text,

      {

        reply_markup: {

          inline_keyboard:
            buttons

        }

      }
    );

  } catch (error) {

    console.error(
      "ADMIN FILE DETAIL ERROR:",
      error
    );


    await sendMessage(
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
  fileId
) {

  try {

    const result =
      await update(
        env,
        "files",

        `id=eq.${encodeURIComponent(fileId)}`,

        {
          status:
            "inactive"
        }
      );


    if (
      !result ||
      !result.length
    ) {

      await sendMessage(
        env,
        chatId,

        "❌ File tidak ditemukan."
      );

      return;

    }


    await sendMessage(
      env,
      chatId,

      "✅ Link berhasil dinonaktifkan."
    );


    await showFileDetail(
      env,
      chatId,
      fileId
    );

  } catch (error) {

    console.error(
      "ADMIN DISABLE FILE ERROR:",
      error
    );


    await sendMessage(
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
  chatId
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
            files: 0,
            accesses: 0
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

      await sendMessage(
        env,
        chatId,

        "👤 Belum ada user.",

        {

          reply_markup: {

            inline_keyboard: [

              [
                {
                  text:
                    "⬅️ Kembali",

                  callback_data:
                    "admin:panel"
                }
              ]

            ]

          }

        }
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


      const isBlocked =
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
        `${isBlocked ? "🔴 Diblokir" : "🟢 Aktif"}\n\n`;


      buttons.push([

        {
          text:
            isBlocked
              ? `🟢 Unblok ${userId}`
              : `🔴 Blokir ${userId}`,

          callback_data:
            isBlocked
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


    await sendMessage(
      env,
      chatId,
      text,

      {

        reply_markup: {

          inline_keyboard:
            buttons

        }

      }
    );

  } catch (error) {

    console.error(
      "ADMIN USERS ERROR:",
      error
    );


    await sendMessage(
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
  userId
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


    await sendMessage(
      env,
      chatId,

      `🔴 User ${userId} berhasil diblokir.`
    );


    await showUsers(
      env,
      chatId
    );

  } catch (error) {

    console.error(
      "ADMIN BLOCK USER ERROR:",
      error
    );


    await sendMessage(
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
  userId
) {

  try {

    await remove(
      env,
      "blocked_users",

      `telegram_user_id=eq.${encodeURIComponent(userId)}`
    );


    await sendMessage(
      env,
      chatId,

      `🟢 User ${userId} berhasil di-unblok.`
    );


    await showUsers(
      env,
      chatId
    );

  } catch (error) {

    console.error(
      "ADMIN UNBLOCK USER ERROR:",
      error
    );


    await sendMessage(
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
  chatId
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


    await sendMessage(
      env,
      chatId,
      text,

      {

        reply_markup: {

          inline_keyboard:
            buttons

        }

      }
    );

  } catch (error) {

    console.error(
      "ADMIN CAPTION ERROR:",
      error
    );


    await sendMessage(
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


  await sendMessage(
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
  captionId
) {

  try {

    await remove(
      env,
      "admin_captions",

      `id=eq.${encodeURIComponent(captionId)}`
    );


    await sendMessage(
      env,
      chatId,

      "✅ Caption berhasil dihapus."
    );


    await showCaptionMenu(
      env,
      chatId
    );

  } catch (error) {

    console.error(
      "ADMIN DELETE CAPTION ERROR:",
      error
    );


    await sendMessage(
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
  chatId
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
            id => id.trim()
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
    "\nMulti-admin menggunakan ADMIN_IDS di Cloudflare Worker.\n\n" +

    "Contoh:\n" +
    "ADMIN_IDS=123456789,987654321";


  await sendMessage(
    env,
    chatId,
    text,

    {

      reply_markup: {

        inline_keyboard: [

          [
            {
              text:
                "⬅️ Kembali",

              callback_data:
                "admin:panel"
            }
          ]

        ]

      }

    }
  );

}


// ======================================================
// EXPORTS
// ======================================================

export {
  checkAdmin
};
