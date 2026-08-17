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
    // LOG UNTUK MEMASTIKAN CRON BERJALAN
    // ==============================================

    console.log(
      "CRON BERJALAN:",
      new Date().toISOString()
    );


    // ==============================================
    // JALANKAN EXPIRE FILES
    // ==============================================

    ctx.waitUntil(

      expireFiles(
        env
      ).catch(error => {

        console.error(
          "EXPIRY ERROR:",
          error
        );

      })

    );

  }

};
