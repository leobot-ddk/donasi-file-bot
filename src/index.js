import { handleUpdate } from "./bot/router.js";
import { expireFiles } from "./services/expiry.js";

export default {

  async fetch(request, env, ctx) {

    const url =
      new URL(request.url);


    // ================================================
    // HEALTH CHECK
    // ================================================

    if (
      url.pathname === "/health"
    ) {

      return Response.json({

        ok: true,

        service:
          "donasi-file-bot"

      });

    }


    // ================================================
    // WEBHOOK TELEGRAM
    // ================================================

    if (
      url.pathname !== "/webhook"
    ) {

      return new Response(
        "OK"
      );

    }


    if (
      request.method !== "POST"
    ) {

      return new Response(
        "OK"
      );

    }


    try {

      const update =
        await request.json();


      await handleUpdate(
        update,
        env
      );


      return Response.json({

        ok: true

      });

    } catch (error) {

      console.error(
        "WEBHOOK ERROR:",
        error
      );


      return Response.json(

        {
          ok: false,

          error:
            error?.message ||
            String(error)
        },

        {
          status: 200
        }

      );

    }

  },


  // ================================================
  // CRON
  // ================================================

  async scheduled(
    event,
    env,
    ctx
  ) {

    // ==============================================
    // CRON START
    // ==============================================

    console.log(
      "CRON START:",
      new Date().toISOString()
    );


    try {

      // ============================================
      // JALANKAN EXPIRE FILES
      // ============================================

      console.log(
        "CRON MENJALANKAN EXPIRE FILES"
      );


      const result =
        await expireFiles(
          env
        );


      // ============================================
      // HASIL EXPIRE FILES
      // ============================================

      console.log(
        "CRON EXPIRE RESULT:",
        result
      );


      // ============================================
      // CRON SELESAI
      // ============================================

      console.log(
        "CRON SELESAI:",
        new Date().toISOString()
      );

    } catch (error) {

      // ============================================
      // ERROR CRON
      // ============================================

      console.error(
        "CRON ERROR:",
        error
      );

    }

  }

};
