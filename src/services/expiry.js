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
// 1. Cari file aktif yang mempunyai expires_at
// 2. Cek expired menggunakan JavaScript
// 3. Hapus pesan file dari Telegram
// 4. Tandai file sebagai expired
//
// ALUR BOT TIDAK DIUBAH.
//
// ======================================================

export async function expireFiles(
  env
) {

  try {

    // ==================================================
    // CEK ENV
    // ==================================================

    if (!env.SUPABASE_URL) {

      return {

        ok:
          false,

        stage:
          "env",

        error:
          "SUPABASE_URL tidak tersedia."

      };

    }


    if (!env.SUPABASE_ANON_KEY) {

      return {

        ok:
          false,

        stage:
          "env",

        error:
          "SUPABASE_ANON_KEY tidak tersedia."

      };

    }


    // ==================================================
    // WAKTU SEKARANG
    // ==================================================

    const now =
      Date.now();


    // ==================================================
    // AMBIL SEMUA FILE ACTIVE
    // YANG MEMILIKI EXPIRES_AT
    // ==================================================

    const queryUrl =
      `${env.SUPABASE_URL}/rest/v1/files` +
      `?status=eq.active` +
      `&expires_at=not.is.null` +
      `&select=*`;


    const response =
      await fetch(
        queryUrl,
        {

          method:
            "GET",

          headers: {

            apikey:
              env.SUPABASE_ANON_KEY,

            Authorization:
              `Bearer ${env.SUPABASE_ANON_KEY}`,

            Accept:
              "application/json"

          }

        }
      );


    const responseText =
      await response.text();


    // ==================================================
    // CEK RESPONSE SUPABASE
    // ==================================================

    if (!response.ok) {

      return {

        ok:
          false,

        stage:
          "supabase_query",

        status:
          response.status,

        error:
          responseText

      };

    }


    // ==================================================
    // PARSE JSON
    // ==================================================

    let files;

    try {

      files =
        JSON.parse(
          responseText
        );

    } catch (
      error
    ) {

      return {

        ok:
          false,

        stage:
          "json",

        error:
          responseText

      };

    }


    if (
      !Array.isArray(files)
    ) {

      return {

        ok:
          false,

        stage:
          "files",

        error:
          "Response files bukan array.",

        response:
          responseText

      };

    }


    // ==================================================
    // FILTER EXPIRED DI JAVASCRIPT
    // ==================================================

    const expiredFiles =
      files.filter(
        file => {

          if (
            !file.expires_at
          ) {

            return false;

          }

          const expiresTime =
            new Date(
              file.expires_at
            ).getTime();


          if (
            Number.isNaN(
              expiresTime
            )
          ) {

            return false;

          }


          return (
            expiresTime <= now
          );

        }
      );


    // ==================================================
    // TIDAK ADA FILE EXPIRED
    // ==================================================

    if (
      expiredFiles.length === 0
    ) {

      return {

        ok:
          true,

        checked:
          files.length,

        expired:
          0,

        deleted:
          0,

        message:
          "Tidak ada file expired."

      };

    }


    let expiredCount =
      0;

    let deletedCount =
      0;


    const results = [];


    // ==================================================
    // PROSES FILE EXPIRED
    // ==================================================

    for (
      const file of expiredFiles
    ) {

      let telegramDeleted =
        false;

      let telegramError =
        null;


      // ================================================
      // HAPUS PESAN FILE DARI TELEGRAM
      // ================================================

      if (
        file.sent_chat_id &&
        file.sent_message_id
      ) {

        try {

          telegramDeleted =
            await deleteBotFile(
              env,
              file.sent_chat_id,
              file.sent_message_id
            );

        } catch (
          error
        ) {

          telegramError =
            error?.message ||
            String(error);

        }


        if (
          telegramDeleted
        ) {

          deletedCount++;

        }

      }


      // ================================================
      // TANDAI EXPIRED
      // ================================================

      let updateError =
        null;


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


        expiredCount++;

      } catch (
        error
      ) {

        updateError =
          error?.message ||
          String(error);

      }


      // ================================================
      // HASIL FILE
      // ================================================

      results.push({

        id:
          file.id,

        token:
          file.token,

        expires_at:
          file.expires_at,

        sent_chat_id:
          file.sent_chat_id,

        sent_message_id:
          file.sent_message_id,

        telegram_deleted:
          telegramDeleted,

        telegram_error:
          telegramError,

        status:
          updateError
            ? "update_failed"
            : "expired",

        update_error:
          updateError

      });

    }


    // ==================================================
    // HASIL
    // ==================================================

    return {

      ok:
        true,

      checked:
        files.length,

      found_expired:
        expiredFiles.length,

      expired:
        expiredCount,

      deleted:
        deletedCount,

      results

    };

  } catch (
    error
  ) {

    return {

      ok:
        false,

      stage:
        "exception",

      error:
        error?.message ||
        String(error),

      name:
        error?.name ||
        null,

      stack:
        error?.stack ||
        null

    };

  }

}
