import { handleUpdate } from "./bot/router.js";
import { expireFiles } from "./services/expiry.js";

export default {

  async fetch(request, env, ctx) {

    const url = new URL(request.url);

    // ================================================
    // HEALTH CHECK
    // ================================================

    if (url.pathname === "/health") {

      return Response.json({
        ok: true,
        service: "donasi-file-bot"
      });

    }


    // ================================================
    // MANUAL EXPIRY TEST
    // ================================================

    if (
      url.pathname === "/expiry-test"
    ) {

      console.log(
        "========== MANUAL EXPIRY TEST =========="
      );

      try {

        const result =
          await expireFiles(env);

        console.log(
          "MANUAL EXPIRY RESULT:",
          result
        );

        console.log(
          "========== MANUAL EXPIRY TEST END =========="
        );

        return Response.json({
          ok: true,
          result
        });

      } catch (error) {

        console.error(
          "MANUAL EXPIRY ERROR:",
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
            status: 500
          }
        );

      }

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

    console.log(
      "========== CRON START =========="
    );

    console.log(
      "CRON:",
      event?.cron
    );

    console.log(
      "SCHEDULED TIME:",
      event?.scheduledTime
    );

    try {

      await expireFiles(env);

      console.log(
        "========== CRON END =========="
      );

    } catch (error) {

      console.error(
        "========== CRON ERROR =========="
      );

      console.error(
        "ERROR:",
        error
      );

      console.error(
        "MESSAGE:",
        error?.message
      );

      console.error(
        "STACK:",
        error?.stack
      );

      console.error(
        "========== CRON ERROR END =========="
      );

    }

  }

};
