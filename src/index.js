// ======================================================
// MAIN WORKER
// ======================================================

import {
  handleUpdate
} from "./bot/router.js";

import {
  expireFiles
} from "./services/expiry.js";


// ======================================================
// WORKER
// ======================================================

export default {

  // ====================================================
  // FETCH
  // ====================================================

  async fetch(
    request,
    env,
    ctx
  ) {

    // ==================================================
    // CEK FILE EXPIRED
    // ==================================================
    //
    // Setiap request ke Worker akan menjalankan
    // pengecekan file expired di background.
    //
    // Ini tidak mengubah alur webhook Telegram.
    //
    // ==================================================

    ctx.waitUntil(

      expireFiles(
        env
      ).catch(error => {

        console.error(
          "EXPIRY FETCH ERROR:",
          error
        );

      })

    );


    const url =
      new URL(request.url);


    // ==================================================
    // HEALTH CHECK
    // ==================================================

    if (
      url.pathname === "/health"
    ) {

      return Response.json({

        ok:
          true,

        service:
          "donasi-file-bot"

      });

    }


    // ==================================================
    // WEBHOOK TELEGRAM
    // ==================================================

    if (
      url.pathname !== "/webhook"
    ) {

      return new Response(
        "OK"
      );

    }


    // ==================================================
    // METHOD
    // ==================================================

    if (
      request.method !== "POST"
    ) {

      return new Response(
        "OK"
      );

    }


    // ==================================================
    // HANDLE TELEGRAM UPDATE
    // ==================================================

    try {

      const update =
        await request.json();


      await handleUpdate(
        update,
        env
      );


      return Response.json({

        ok:
          true

      });

    } catch (
      error
    ) {

      console.error(
        "WEBHOOK ERROR:",
        error
      );


      return Response.json(

        {

          ok:
            false,

          error:
            error?.message ||
            String(error)

        },

        {

          status:
            200

        }

      );

    }

  },


  // ====================================================
  // CRON
  // ====================================================
  //
  // Tetap dipakai sebagai pengecekan otomatis setiap
  // 1 menit.
  //
  // ====================================================

  async scheduled(
    event,
    env,
    ctx
  ) {

    console.log(
      "=================================================="
    );

    console.log(
      "CRON BERJALAN:",
      new Date().toISOString()
    );

    console.log(
      "Menjalankan expireFiles..."
    );


    // ==================================================
    // EXPIRE FILES
    // ==================================================

    try {

      const result =
        await expireFiles(
          env
        );


      console.log(
        "CRON EXPIRE RESULT:",
        result
      );


    } catch (
      error
    ) {

      console.error(
        "CRON EXPIRY ERROR:",
        error
      );

    }


    console.log(
      "CRON SELESAI:",
      new Date().toISOString()
    );

    console.log(
      "=================================================="
    );

  }

};
