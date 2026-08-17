// ======================================================
// FILE EXPIRY SERVICE
// ======================================================

import {
  selectOne,
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
// ======================================================

export async function expireFiles(
  env
) {

  try {

    // ==================================================
    // CARI FILE EXPIRED
    // ==================================================

    const now =
      new Date().toISOString();


    const response =
      await fetch(
        `${env.SUPABASE_URL}/rest/v1/files` +
        `?expires_at=not.is.null` +
        `&expires_at=lte.${encodeURIComponent(now)}` +
        `&status=eq.active` +
        `&select=*`,
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


    if (!response.ok) {

      const text =
        await response.text();

      throw new Error(
        `Supabase expire query error: ${text}`
      );

    }


    const files =
      await response.json();


    if (
      !Array.isArray(files) ||
      files.length === 0
    ) {

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

      // ================================================
      // HAPUS PESAN FILE YANG DIKIRIM BOT
      // ================================================

      if (
        file.sent_chat_id &&
        file.sent_message_id
      ) {

        const deleted =
          await deleteBotFile(
            env,
            file.sent_chat_id,
            file.sent_message_id
          );


        if (deleted) {

          deletedCount++;

        }

      }


      // ================================================
      // TANDAI EXPIRED
      // ================================================

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

    }


    console.log(
      "EXPIRE FILES:",
      {
        expired:
          expiredCount,

        deleted:
          deletedCount

      }
    );


    return {

      expired:
        expiredCount,

      deleted:
        deletedCount

    };

  } catch (error) {

    console.error(
      "EXPIRE FILES ERROR:",
      error
    );

    throw error;

  }

}
