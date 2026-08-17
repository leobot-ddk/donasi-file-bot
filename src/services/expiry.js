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
      "SUPABASE_ANON_KEY:",
      env.SUPABASE_ANON_KEY
        ? "ADA"
        : "TIDAK ADA"
    );


    if (!env.SUPABASE_URL) {

      throw new Error(
        "SUPABASE_URL tidak tersedia."
      );

    }


    if (!env.SUPABASE_ANON_KEY) {

      throw new Error(
        "SUPABASE_ANON_KEY tidak tersedia."
      );

    }


    // ==================================================
    // WAKTU SEKARANG
    // ==================================================

    const now =
      new Date().toISOString();


    console.log(
      "EXPIRY NOW:",
      now
    );


    // ==================================================
    // QUERY FILE EXPIRED
    // ==================================================

    const queryUrl =
      `${env.SUPABASE_URL}/rest/v1/files` +
      `?expires_at=not.is.null` +
      `&expires_at=lte.${encodeURIComponent(now)}` +
      `&status=eq.active` +
      `&select=*`;


    console.log(
      "EXPIRY QUERY START"
    );


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


    console.log(
      "EXPIRY QUERY STATUS:",
      response.status
    );


    const responseText =
      await response.text();


    console.log(
      "EXPIRY QUERY RESPONSE:",
      responseText
    );


    if (!response.ok) {

      throw new Error(
        `Supabase expire query error ` +
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

    } catch (error) {

      throw new Error(
        "Response Supabase bukan JSON: " +
        responseText
      );

    }


    console.log(
      "EXPIRY FILE COUNT:",
      Array.isArray(files)
        ? files.length
        : "BUKAN ARRAY"
    );


    if (
      !Array.isArray(files) ||
      files.length === 0
    ) {

      console.log(
        "TIDAK ADA FILE EXPIRED."
      );

      console.log(
        "========== EXPIRY END =========="
      );

      return {

        expired:
          0,

        deleted:
          0

      };

    }


    let expiredCount =
      0;

    let deletedCount =
      0;


    // ==================================================
    // PROSES FILE
    // ==================================================

    for (
      const file of files
    ) {

      console.log(
        "--------------------------------"
      );

      console.log(
        "MEMPROSES FILE ID:",
        file.id
      );

      console.log(
        "TOKEN:",
        file.token
      );

      console.log(
        "EXPIRES AT:",
        file.expires_at
      );

      console.log(
        "SENT CHAT ID:",
        file.sent_chat_id
      );

      console.log(
        "SENT MESSAGE ID:",
        file.sent_message_id
      );


      // ================================================
      // HAPUS PESAN FILE YANG DIKIRIM BOT
      // ================================================

      if (
        file.sent_chat_id &&
        file.sent_message_id
      ) {

        console.log(
          "MENCOBA HAPUS PESAN TELEGRAM..."
        );


        const deleted =
          await deleteBotFile(
            env,
            file.sent_chat_id,
            file.sent_message_id
          );


        console.log(
          "HASIL DELETE TELEGRAM:",
          deleted
        );


        if (deleted) {

          deletedCount++;

        }

      } else {

        console.log(
          "TIDAK ADA sent_chat_id / sent_message_id."
        );

      }


      // ================================================
      // TANDAI EXPIRED
      // ================================================

      console.log(
        "MENANDAI FILE EXPIRED..."
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
              "expired",

            deleted_at:
              new Date().toISOString()

          }
        );


      console.log(
        "HASIL UPDATE EXPIRED:",
        updateResult
      );


      expiredCount++;


      console.log(
        "FILE BERHASIL DIPROSES:",
        file.id
      );

    }


    // ==================================================
    // HASIL
    // ==================================================

    console.log(
      "================================"
    );

    console.log(
      "EXPIRE FILES SELESAI:",
      {
        expired:
          expiredCount,

        deleted:
          deletedCount
      }
    );

    console.log(
      "========== EXPIRY END =========="
    );


    return {

      expired:
        expiredCount,

      deleted:
        deletedCount

    };

  } catch (error) {

    // ==================================================
    // ERROR DETAIL LENGKAP
    // ==================================================

    console.error(
      "========== EXPIRY ERROR =========="
    );

    console.error(
      "ERROR TYPE:",
      typeof error
    );

    console.error(
      "ERROR NAME:",
      error?.name
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
      JSON.stringify(
        error,
        Object.getOwnPropertyNames(error)
      )
    );

    console.error(
      "========== EXPIRY ERROR END =========="
    );


    throw error;

  }

      }
