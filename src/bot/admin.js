// ======================================================
// ADMIN HANDLER
// ======================================================

import {
  sendMessage
} from "../services/telegram.js";

import {
  select
} from "../database/supabase.js";


// ======================================================
// ADMIN COMMAND
// ======================================================

export async function handleAdminCommand(
  message,
  env
) {

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
      message.chat.id
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
      message.chat.id
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
      message.chat.id
    );

    return;

  }


  // ====================================================
  // /stats
  // ====================================================

  if (
    command === "/stats"
  ) {

    await showStats(
      env,
      message.chat.id
    );

    return;

  }


  // ====================================================
  // COMMAND TIDAK DIKENAL
  // ====================================================

  await sendMessage(
    env,
    message.chat.id,

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

  // Untuk sementara text biasa dari admin
  // tidak diproses sebagai command.

  await sendMessage(
    env,
    message.chat.id,

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
                "📁 File",

              callback_data:
                "admin:files"
            },

            {
              text:
                "👥 User",

              callback_data:
                "admin:users"
            }

          ],

          [

            {
              text:
                "📊 Statistik",

              callback_data:
                "admin:stats"
            }

          ]

        ]

      }

    }
  );

}


// ======================================================
// DAFTAR FILE
// ======================================================

async function showFiles(
  env,
  chatId
) {

  try {

    const files =
      await select(
        env,
        "files",
        "select=id,file_name,media_type,status,expires_at,created_at&order=id.desc&limit=20"
      );


    if (
      !files ||
      files.length === 0
    ) {

      await sendMessage(
        env,
        chatId,

        "📁 Belum ada file."
      );

      return;

    }


    let text =
      "📁 FILE TERBARU\n\n";


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
        `Media: ${file.media_type || "-"}\n`;


      if (
        file.expires_at
      ) {

        text +=
          `Expired: ${file.expires_at}\n`;

      }


      text +=
        "\n";

    }


    await sendMessage(
      env,
      chatId,
      text
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
// DAFTAR USER
// ======================================================

async function showUsers(
  env,
  chatId
) {

  try {

    const files =
      await select(
        env,
        "files",
        "select=owner_telegram_id&order=id.desc&limit=1000"
      );


    const users =
      new Set();


    for (
      const file of files
    ) {

      if (
        file.owner_telegram_id
      ) {

        users.add(
          String(
            file.owner_telegram_id
          )
        );

      }

    }


    await sendMessage(
      env,
      chatId,

      "👥 USER\n\n" +

      `Jumlah user: ${users.size}`
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
// STATISTIK
// ======================================================

async function showStats(
  env,
  chatId
) {

  try {

    const files =
      await select(
        env,
        "files",
        "select=id,status,access_count"
      );


    let total =
      0;

    let active =
      0;

    let expired =
      0;

    let accesses =
      0;


    for (
      const file of files
    ) {

      total++;


      if (
        file.status === "active"
      ) {

        active++;

      }


      if (
        file.status === "expired"
      ) {

        expired++;

      }


      accesses +=
        Number(
          file.access_count || 0
        );

    }


    await sendMessage(
      env,
      chatId,

      "📊 STATISTIK\n\n" +

      `📁 Total file: ${total}\n` +
      `🟢 Aktif: ${active}\n` +
      `🔴 Expired: ${expired}\n` +
      `👁 Total akses: ${accesses}`
    );

  } catch (error) {

    console.error(
      "ADMIN STATS ERROR:",
      error
    );


    await sendMessage(
      env,
      chatId,

      "❌ Gagal mengambil statistik."
    );

  }

}
