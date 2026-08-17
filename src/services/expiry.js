// ======================================================
// EXPIRY SERVICE
// ======================================================

import {
  telegram
} from "./telegram.js";

import {
  select
} from "../database/supabase.js";


// ======================================================
// PROCESS EXPIRED FILES
// ======================================================

export async function processExpiredFiles(env) {

  const now =
    new Date().toISOString();


  // ====================================================
  // CARI FILE EXPIRED
  // ====================================================

  const files =
    await select(
      env,
      "files",
      `status=eq.active&expires_at=not.is.null&expires_at=lte.${encodeURIComponent(now)}&limit=100`
    );


  if (
    !Array.isArray(files) ||
    files.length === 0
  ) {

    return {
      checked: 0,
      deleted: 0
    };

  }


  let deleted = 0;


  // ====================================================
  // PROSES SATU PER SATU
  // ====================================================

  for (const file of files) {

    try {

      // -----------------------------------------------
      // HAPUS PESAN FILE DARI USER
      // -----------------------------------------------

      if (
        file.delivery_chat_id &&
        file.delivery_message_id
      ) {

        try {

          await telegram(
            env,
            "deleteMessage",
            {

              chat_id:
                file.delivery_chat_id,

              message_id:
                file.delivery_message_id

            }
          );

          deleted++;

        } catch (error) {

          console.error(
            "DELETE EXPIRED MESSAGE ERROR:",
            {
              token: file.token,
              error
            }
          );

        }

      }


      // -----------------------------------------------
      // UPDATE STATUS FILE
      // -----------------------------------------------

      await updateExpired(
        env,
        file.token
      );

    } catch (error) {

      console.error(
        "PROCESS EXPIRED FILE ERROR:",
        {
          token: file.token,
          error
        }
      );

    }

  }


  return {

    checked:
      files.length,

    deleted

  };

}


// ======================================================
// UPDATE STATUS
// ======================================================

async function updateExpired(
  env,
  token
) {

  const {
    update
  } = await import(
    "../database/supabase.js"
  );


  await update(
    env,
    "files",
    `token=eq.${encodeURIComponent(
      token
    )}`,
    {

      status:
        "expired"

    }
  );

}
