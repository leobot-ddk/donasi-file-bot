// ======================================================
// FILE EXPIRY SERVICE
// ======================================================

import {
  update
} from "../database/supabase.js";

import {
  deleteBotFile
} from "./telegram.js";


// ======================================================
// EXPIRE + CLEANUP FILES
// ======================================================
//
// Menangani:
//
// 1. File ACTIVE yang sudah expired
// 2. File EXPIRED yang belum berhasil dihapus Telegram
//
// Penting:
// Jangan hanya mencari status=active.
// File yang sebelumnya sudah ditandai expired tetapi
// gagal dihapus Telegram harus dicoba kembali.
//
// ======================================================

export async function expireFiles(
  env
) {

  console.log(
    "========== EXPIRY START =========="
  );


  try {

    // ==================================================
    // CEK ENV
    // ==================================================

    console.log(
      "SUPABASE_URL:",
      env.SUPABASE_URL
        ? "ADA"
        : "TIDAK ADA"
    );

    console.log(
      "SUPABASE_SERVICE_ROLE_KEY:",
      env.SUPABASE_SERVICE_ROLE_KEY
        ? "ADA"
        : "TIDAK ADA"
    );

    console.log(
      "TELEGRAM_BOT_TOKEN:",
      env.TELEGRAM_BOT_TOKEN
        ? "ADA"
        : "TIDAK ADA"
    );


    if (!env.SUPABASE_URL) {

      throw new Error(
        "SUPABASE_URL tidak tersedia."
      );

    }


    if (!env.SUPABASE_SERVICE_ROLE_KEY) {

      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY tidak tersedia."
      );

    }


    if (!env.TELEGRAM_BOT_TOKEN) {

      throw new Error(
        "TELEGRAM_BOT_TOKEN tidak tersedia."
      );

    }


    // ==================================================
    // WAKTU SEKARANG
    // ==================================================

    const now =
      new Date().toISOString();


    console.log(
      "WORKER NOW:",
      now
    );


    // ==================================================
    // QUERY
    // ==================================================
    //
    // Ambil:
    //
    // A. ACTIVE yang sudah expired
    //
    // B. EXPIRED yang belum deleted_at
    //
    // B diperlukan supaya pesan Telegram lama yang
    // sebelumnya gagal dihapus bisa dicoba lagi.
    //
    // ==================================================

    const baseUrl =
      String(
        env.SUPABASE_URL
      ).replace(
        /\/+$/,
        ""
      );


    const query =
      [
        "select=*",
        "or=" +
          encodeURIComponent(
            `(and(status.eq.active,expires_at.not.is.null,expires_at.lte.${now}),and(status.eq.expired,deleted_at.is.null))`
          )
      ].join("&");


    const queryUrl =
      `${baseUrl}/rest/v1/files?${query}`;


    console.log(
      "EXPIRY QUERY:",
      queryUrl
    );


    // ==================================================
    // REQUEST SUPABASE
    // ==================================================

    const response =
      await fetch(
        queryUrl,
        {

          method:
            "GET",

          headers: {

            apikey:
              env.SUPABASE_SERVICE_ROLE_KEY,

            Authorization:
              `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,

            Accept:
              "application/json"

          }

        }
      );


    console.log(
      "SUPABASE STATUS:",
      response.status
    );


    const responseText =
      await response.text();


    console.log(
      "SUPABASE RESPONSE:",
      responseText
    );


    if (!response.ok) {

      throw new Error(
        `Supabase expiry query error ` +
        `HTTP ${response.status}: ` +
        responseText
      );

    }


    let files;

    try {

      files =
        JSON.parse(
          responseText
        );

    } catch {

      throw new Error(
        "Response Supabase bukan JSON."
      );

    }


    console.log(
      "FILES DITEMUKAN:",
      Array.isArray(files)
        ? files.length
        : "BUKAN ARRAY"
    );


    if (
      !Array.isArray(files) ||
      files.length === 0
    ) {

      console.log(
        "TIDAK ADA FILE YANG PERLU DIPROSES."
      );

      console.log(
        "========== EXPIRY END =========="
      );

      return {

        checked:
          0,

        expired:
          0,

        deleted:
          0

      };

    }


    let checkedCount =
      0;

    let expiredCount =
      0;

    let deletedCount =
      0;


    // ==================================================
    // PROSES SATU PER SATU
    // ==================================================

    for (
      const file of files
    ) {

      checkedCount++;


      console.log(
        "----------------------------------------"
      );

      console.log(
        "PROCESS FILE:",
        file.id
      );

      console.log(
        "TOKEN:",
        file.token
      );

      console.log(
        "STATUS:",
        file.status
      );

      console.log(
        "EXPIRES AT:",
        file.expires_at
      );

      console.log(
        "SENT CHAT:",
        file.sent_chat_id
      );

      console.log(
        "SENT MESSAGE:",
        file.sent_message_id
      );

      console.log(
        "DELETED AT:",
        file.deleted_at
      );


      // =================================================
      // TENTUKAN SUDAH EXPIRED
      // =================================================

      const isExpired =
        file.status === "expired" ||
        (
          file.status === "active" &&
          file.expires_at &&
          new Date(
            file.expires_at
          ).getTime() <= Date.now()
        );


      if (!isExpired) {

        console.log(
          "FILE BELUM EXPIRED."
        );

        continue;

      }


      // =================================================
      // HAPUS PESAN TELEGRAM
      // =================================================

      let telegramDeleted =
        false;


      if (
        file.sent_chat_id !== null &&
        file.sent_chat_id !== undefined &&
        file.sent_message_id !== null &&
        file.sent_message_id !== undefined
      ) {

        console.log(
          "MENCOBA DELETE TELEGRAM..."
        );


        try {

          telegramDeleted =
            await deleteBotFile(
              env,
              file.sent_chat_id,
              file.sent_message_id
            );


          console.log(
            "TELEGRAM DELETE RESULT:",
            telegramDeleted
          );

        } catch (error) {

          console.error(
            "TELEGRAM DELETE ERROR:",
            error?.message ||
            error
          );

          console.error(
            "TELEGRAM DELETE STACK:",
            error?.stack
          );

          telegramDeleted =
            false;

        }

      } else {

        console.log(
          "TIDAK ADA sent_chat_id / sent_message_id."
        );

      }


      // =================================================
      // JIKA BERHASIL DIHAPUS
      // =================================================

      if (telegramDeleted) {

        deletedCount++;


        console.log(
          "PESAN TELEGRAM BERHASIL DIHAPUS."
        );


        // -----------------------------------------------
        // Tandai expired + deleted_at
        // -----------------------------------------------

        const updateResult =
          await update(
            env,
            "files",
            `id=eq.${encodeURIComponent(
              file.id
            )}`,
            {

              status:
                "expired",

              deleted_at:
                new Date().toISOString()

            }
          );


        console.log(
          "DATABASE UPDATED:",
          updateResult
        );


        expiredCount++;


        continue;

      }


      // =================================================
      // TELEGRAM TIDAK BERHASIL DIHAPUS
      // =================================================
      //
      // Jangan mengisi deleted_at.
      //
      // Dengan begitu cron berikutnya akan mencoba lagi.
      //
      // =================================================

      console.log(
        "PESAN TELEGRAM BELUM BERHASIL DIHAPUS."
      );


      // =================================================
      // JIKA FILE MASIH ACTIVE
      // TANDAI EXPIRED
      // =================================================

      if (
        file.status === "active"
      ) {

        console.log(
          "MENANDAI FILE SEBAGAI EXPIRED..."
        );


        const updateResult =
          await update(
            env,
            "files",
            `id=eq.${encodeURIComponent(
              file.id
            )}`,
            {

              status:
                "expired"

            }
          );


        console.log(
          "STATUS EXPIRED RESULT:",
          updateResult
        );


        expiredCount++;

      } else {

        console.log(
          "FILE SUDAH EXPIRED, MENUNGGU RETRY CRON."
        );

      }

    }


    // ==================================================
    // HASIL AKHIR
    // ==================================================

    const result = {

      checked:
        checkedCount,

      expired:
        expiredCount,

      deleted:
        deletedCount

    };


    console.log(
      "========================================"
    );

    console.log(
      "EXPIRY RESULT:",
      result
    );

    console.log(
      "========== EXPIRY END =========="
    );


    return result;


  } catch (error) {

    console.error(
      "========== EXPIRY ERROR =========="
    );

    console.error(
      "ERROR MESSAGE:",
      error?.message
    );

    console.error(
      "ERROR STACK:",
      error?.stack
    );

    console.error(
      "ERROR FULL:",
      error
    );

    console.error(
      "========== EXPIRY ERROR END =========="
    );


    throw error;

  }

            }
