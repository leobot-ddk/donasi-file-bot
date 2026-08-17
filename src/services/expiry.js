// ======================================================
// FILE EXPIRY SERVICE
// ======================================================

import {
  select,
  update
} from "../database/supabase.js";

import {
  deleteMessage
} from "./telegram.js";


// ======================================================
// EXPIRE FILES
// ======================================================

export async function expireFiles(env) {

  const now =
    new Date().toISOString();


  const files =
    await select(
      env,
      "files",
      `status=eq.active&expires_at=not.is.null&expires_at=lte.${encodeURIComponent(now)}&select=*`
    );


  if (
    !files ||
    files.length === 0
  ) {

    return;

  }


  for (
    const file of files
  ) {

    try {

      // ================================================
      // NONAKTIFKAN LINK
      // ================================================

      await update(
        env,
        "files",
        `id=eq.${encodeURIComponent(file.id)}`,
        {
          status:
            "expired"
        }
      );


      // ================================================
      // HAPUS PESAN FILE DARI USER
      // ================================================

      if (
        file.delivery_chat_id &&
        file.delivery_message_id
      ) {

        try {

          await deleteMessage(
            env,
            file.delivery_chat_id,
            file.delivery_message_id
          );

        } catch (error) {

          console.error(
            "DELETE USER FILE ERROR:",
            error
          );

        }

      }


      console.log(
        `FILE EXPIRED: ${file.id}`
      );

    } catch (error) {

      console.error(
        `EXPIRE FILE ERROR ${file.id}:`,
        error
      );

    }

  }

}
