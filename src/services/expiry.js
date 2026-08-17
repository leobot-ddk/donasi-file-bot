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
// 2. Hapus file yang pernah dikirim bot
// 3. Tandai file sebagai expired
//
// ALUR TIDAK DIUBAH.
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
      new Date().toISOString();


    // ==================================================
    // QUERY FILE EXPIRED
    // ==================================================

    const queryUrl =
      `${env.SUPABASE_URL}/rest/v1/files` +
      `?expires_at=not.is.null` +
      `&expires_at=lte.${encodeURIComponent(now)}` +
      `&status=eq.active` +
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
    // SUPABASE ERROR
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
    // PARSE RESPONSE
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
    // TIDAK ADA FILE EXPIRED
    // ==================================================

    if (
      files.length === 0
    ) {

      return {

        ok:
          true,

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
    // PROSES FILE
    // ==================================================

    for (
      const file of files
    ) {

      let telegramDeleted =
        false;

      let telegramError =
        null;


      // ================================================
      // HAPUS PESAN FILE BOT
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


        results.push({

          id:
            file.id,

          token:
            file.token,

          sent_chat_id:
            file.sent_chat_id,

          sent_message_id:
            file.sent_message_id,

          telegram_deleted:
            telegramDeleted,

          telegram_error:
            telegramError,

          status:
            "expired"

        });

      } catch (
        error
      ) {

        results.push({

          id:
            file.id,

          token:
            file.token,

          sent_chat_id:
            file.sent_chat_id,

          sent_message_id:
            file.sent_message_id,

          telegram_deleted:
            telegramDeleted,

          telegram_error:
            telegramError,

          status:
            "update_failed",

          update_error:
            error?.message ||
            String(error)

        });

      }

    }


    // ==================================================
    // HASIL
    // ==================================================

    return {

      ok:
        true,

      expired:
        expiredCount,

      deleted:
        deletedCount,

      checked:
        files.length,

      results

    };

  } catch (
    error
  ) {

    // ==================================================
    // ERROR
    // ==================================================

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
