// ======================================================
// FILE EXPIRY SERVICE
// ======================================================

import {
  select,
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
//
// 1. Ambil file active yang memiliki expires_at
// 2. Cek expired berdasarkan waktu Worker
// 3. Hapus pesan file dari Telegram jika ada
// 4. Tandai file sebagai expired
//
// Menggunakan database/supabase.js
// sehingga menggunakan SUPABASE_SERVICE_ROLE_KEY.
// ======================================================

export async function expireFiles(
  env
) {

  console.log(
    "========== EXPIRY START =========="
  );


  try {

    // ==================================================
    // WAKTU SEKARANG
    // ==================================================

    const now =
      new Date();


    console.log(
      "EXPIRY NOW UTC:",
      now.toISOString()
    );


    console.log(
      "EXPIRY NOW MS:",
      now.getTime()
    );


    // ==================================================
    // AMBIL FILE ACTIVE
    // ==================================================

    console.log(
      "MENGAMBIL FILE ACTIVE..."
    );


    const files =
      await select(
        env,
        "files",
        [
          "status=eq.active",
          "expires_at=not.is.null",
          "select=id,token,status,expires_at,sent_chat_id,sent_message_id",
          "order=expires_at.asc"
        ].join("&")
      );


    // ==================================================
    // CEK HASIL QUERY
    // ==================================================

    console.log(
      "JUMLAH FILE ACTIVE:",
      Array.isArray(files)
        ? files.length
        : "BUKAN ARRAY"
    );


    if (
      !Array.isArray(files)
    ) {

      throw new Error(
        "Response tabel files bukan array."
      );

    }


    // ==================================================
    // TIDAK ADA FILE ACTIVE
    // ==================================================

    if (
      files.length === 0
    ) {

      console.log(
        "TIDAK ADA FILE ACTIVE DENGAN EXPIRES_AT."
      );

      console.log(
        "========== EXPIRY END =========="
      );

      return {

        ok:
          true,

        checked:
          0,

        expired:
          0,

        deleted:
          0

      };

    }


    // ==================================================
    // TAMPILKAN FILE YANG DICEK
    // ==================================================

    for (
      const file of files
    ) {

      console.log(
        "FILE:",
        {
          id:
            file.id,

          token:
            file.token,

          status:
            file.status,

          expires_at:
            file.expires_at,

          sent_chat_id:
            file.sent_chat_id,

          sent_message_id:
            file.sent_message_id
        }
      );

    }


    // ==================================================
    // CARI YANG SUDAH EXPIRED
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

            console.error(
              "EXPIRES_AT INVALID:",
              file.id,
              file.expires_at
            );

            return false;

          }


          return (
            expiresTime <=
            now.getTime()
          );

        }
      );


    console.log(
      "JUMLAH FILE EXPIRED:",
      expiredFiles.length
    );


    // ==================================================
    // TIDAK ADA YANG EXPIRED
    // ==================================================

    if (
      expiredFiles.length === 0
    ) {

      console.log(
        "BELUM ADA FILE YANG EXPIRED."
      );

      console.log(
        "========== EXPIRY END =========="
      );

      return {

        ok:
          true,

        checked:
          files.length,

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
    // PROSES FILE EXPIRED
    // ==================================================

    for (
      const file of expiredFiles
    ) {

      console.log(
        "================================"
      );

      console.log(
        "MEMPROSES FILE EXPIRED:",
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


      // ================================================
      // HAPUS PESAN TELEGRAM
      // ================================================

      if (
        file.sent_chat_id !== null &&
        file.sent_chat_id !== undefined &&
        file.sent_message_id !== null &&
        file.sent_message_id !== undefined
      ) {

        console.log(
          "MENGHAPUS PESAN TELEGRAM:",
          {
            chat_id:
              file.sent_chat_id,

            message_id:
              file.sent_message_id
          }
        );


        try {

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


          if (
            deleted === true
          ) {

            deletedCount++;

          }

        } catch (
          telegramError
        ) {

          console.error(
            "DELETE TELEGRAM ERROR:",
            telegramError?.message ||
            String(telegramError)
          );

        }

      } else {

        console.log(
          "FILE TIDAK MEMPUNYAI PESAN TELEGRAM."
        );

      }


      // ================================================
      // TANDAI EXPIRED
      // ================================================

      console.log(
        "MENANDAI DATABASE SEBAGAI EXPIRED..."
      );


      try {

        const result =
          await update(
            env,
            "files",
            `id=eq.${encodeURIComponent(
              file.id
            )}&status=eq.active`,
            {

              status:
                "expired",

              deleted_at:
                new Date().toISOString()

            }
          );


        console.log(
          "HASIL UPDATE DATABASE:",
          result
        );


        expiredCount++;


        console.log(
          "FILE BERHASIL DITANDAI EXPIRED:",
          file.id
        );

      } catch (
        updateError
      ) {

        console.error(
          "UPDATE EXPIRED ERROR:",
          updateError?.message ||
          String(updateError)
        );

      }

    }


    // ==================================================
    // HASIL AKHIR
    // ==================================================

    console.log(
      "================================"
    );

    console.log(
      "EXPIRY SELESAI:",
      {
        checked:
          files.length,

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

      ok:
        true,

      checked:
        files.length,

      expired:
        expiredCount,

      deleted:
        deletedCount

    };

  } catch (
    error
  ) {

    // ==================================================
    // ERROR
    // ==================================================

    console.error(
      "========== EXPIRY ERROR =========="
    );

    console.error(
      "ERROR MESSAGE:",
      error?.message ||
      String(error)
    );

    console.error(
      "ERROR STACK:",
      error?.stack ||
      ""
    );

    console.error(
      "========== EXPIRY ERROR END =========="
    );


    throw error;

  }

}
