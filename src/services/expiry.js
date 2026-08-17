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
// EXPIRE FILES
// ======================================================
//
// Tugas:
// 1. Cari file yang sudah expired
// 2. Hapus pesan file yang dikirim bot
// 3. Tandai file sebagai expired
// 4. Simpan deleted_at jika Telegram berhasil menghapus
//
// File yang gagal dihapus akan dicoba lagi pada cron berikutnya.
//
// ======================================================

export async function expireFiles(
  env
) {

  try {

    // ==================================================
    // WAKTU SEKARANG
    // ==================================================

    const now =
      new Date().toISOString();


    // ==================================================
    // CARI FILE YANG SUDAH EXPIRED
    // ==================================================
    //
    // Ada 2 kondisi:
    //
    // 1. status = active dan expires_at sudah lewat
    //
    // 2. status = expired tetapi deleted_at masih null
    //
    // Kondisi nomor 2 penting agar file yang gagal dihapus
    // pada cron sebelumnya bisa dicoba kembali.
    //
    // ==================================================

    const filter =
      `expires_at=not.is.null` +
      `&expires_at=lte.${encodeURIComponent(now)}` +
      `&or=(status.eq.active,and(status.eq.expired,deleted_at.is.null))` +
      `&select=*`;


    const response =
      await fetch(
        `${env.SUPABASE_URL}/rest/v1/files?${filter}`,
        {

          method:
            "GET",

          headers: {

            apikey:
              env.SUPABASE_ANON_KEY,

            Authorization:
              `Bearer ${env.SUPABASE_ANON_KEY}`

          }

        }
      );


    // ==================================================
    // CEK RESPONSE SUPABASE
    // ==================================================

    if (!response.ok) {

      const text =
        await response.text();

      throw new Error(
        `Supabase expire query error: ${text}`
      );

    }


    const files =
      await response.json();


    // ==================================================
    // TIDAK ADA FILE
    // ==================================================

    if (
      !Array.isArray(files) ||
      files.length === 0
    ) {

      console.log(
        "EXPIRE FILES: tidak ada file yang perlu diproses."
      );


      return {

        expired:
          0,

        deleted:
          0,

        failed:
          0

      };

    }


    let expiredCount =
      0;

    let deletedCount =
      0;

    let failedCount =
      0;


    // ==================================================
    // PROSES SATU PER SATU
    // ==================================================

    for (
      const file of files
    ) {

      console.log(
        "EXPIRE FILE PROCESS:",
        {
          id:
            file.id,

          status:
            file.status,

          expires_at:
            file.expires_at,

          sent_chat_id:
            file.sent_chat_id,

          sent_message_id:
            file.sent_message_id,

          deleted_at:
            file.deleted_at
        }
      );


      // ================================================
      // TANDAI EXPIRED TERLEBIH DAHULU
      // ================================================

      if (
        file.status !== "expired"
      ) {

        try {

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


          expiredCount++;

        } catch (error) {

          console.error(
            "UPDATE EXPIRED ERROR:",
            {
              fileId:
                file.id,

              error
            }
          );


          // Jangan lanjut menghapus jika status gagal
          // diperbarui.

          failedCount++;

          continue;

        }

      }


      // ================================================
      // JIKA SUDAH TERHAPUS
      // ================================================

      if (
        file.deleted_at
      ) {

        continue;

      }


      // ================================================
      // TIDAK ADA DATA PESAN BOT
      // ================================================
      //
      // Kalau file belum pernah dikirim melalui link,
      // memang tidak ada message_id yang bisa dihapus.
      //
      // Tetap dianggap expired.
      //
      // ================================================

      if (
        !file.sent_chat_id ||
        !file.sent_message_id
      ) {

        console.log(
          "EXPIRE FILE: tidak ada pesan bot yang perlu dihapus.",
          {
            fileId:
              file.id
          }
        );


        continue;

      }


      // ================================================
      // HAPUS PESAN FILE DARI TELEGRAM
      // ================================================

      let deleted =
        false;


      try {

        deleted =
          await deleteBotFile(
            env,
            file.sent_chat_id,
            file.sent_message_id
          );

      } catch (error) {

        console.error(
          "DELETE TELEGRAM FILE ERROR:",
          {
            fileId:
              file.id,

            chatId:
              file.sent_chat_id,

            messageId:
              file.sent_message_id,

            error
          }
        );

        deleted =
          false;

      }


      // ================================================
      // JIKA BERHASIL DIHAPUS
      // ================================================

      if (deleted) {

        deletedCount++;


        try {

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
            "FILE BERHASIL DIHAPUS:",
            {
              fileId:
                file.id,

              chatId:
                file.sent_chat_id,

              messageId:
                file.sent_message_id
            }
          );

        } catch (error) {

          console.error(
            "UPDATE DELETED_AT ERROR:",
            {
              fileId:
                file.id,

              error
            }
          );


          failedCount++;

        }


        continue;

      }


      // ================================================
      // JIKA GAGAL DIHAPUS
      // ================================================
      //
      // Jangan isi deleted_at.
      //
      // Dengan begitu cron berikutnya akan mencoba
      // menghapus pesan ini lagi.
      //
      // ================================================

      failedCount++;


      console.error(
        "FILE BELUM TERHAPUS - AKAN DICOBA LAGI:",
        {
          fileId:
            file.id,

          chatId:
            file.sent_chat_id,

          messageId:
            file.sent_message_id
        }
      );

    }


    // ==================================================
    // LOG HASIL
    // ==================================================

    console.log(
      "EXPIRE FILES RESULT:",
      {

        expired:
          expiredCount,

        deleted:
          deletedCount,

        failed:
          failedCount

      }
    );


    return {

      expired:
        expiredCount,

      deleted:
        deletedCount,

      failed:
        failedCount

    };

  } catch (error) {

    console.error(
      "EXPIRE FILES ERROR:",
      error
    );


    throw error;

  }

}
