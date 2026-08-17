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
    // SUPABASE DIAGNOSTIC
    // ================================================

    if (
      url.pathname === "/supabase-test"
    ) {

      console.log(
        "========== SUPABASE TEST =========="
      );

      try {

        // ----------------------------------------------
        // CEK ENV
        // ----------------------------------------------

        const supabaseUrl =
          String(
            env.SUPABASE_URL || ""
          ).replace(
            /\/+$/,
            ""
          );

        const hasServiceRoleKey =
          Boolean(
            env.SUPABASE_SERVICE_ROLE_KEY
          );


        console.log(
          "SUPABASE URL:",
          supabaseUrl
            ? supabaseUrl
            : "TIDAK ADA"
        );

        console.log(
          "SERVICE ROLE KEY:",
          hasServiceRoleKey
            ? "ADA"
            : "TIDAK ADA"
        );


        if (!supabaseUrl) {

          return Response.json({

            ok:
              false,

            stage:
              "env",

            error:
              "SUPABASE_URL tidak tersedia."

          });

        }


        if (!hasServiceRoleKey) {

          return Response.json({

            ok:
              false,

            stage:
              "env",

            error:
              "SUPABASE_SERVICE_ROLE_KEY tidak tersedia."

          });

        }


        // ----------------------------------------------
        // QUERY FILES
        // ----------------------------------------------

        const query =
          supabaseUrl +
          "/rest/v1/files" +
          "?select=id,token,status,expires_at,sent_chat_id,sent_message_id" +
          "&order=id.desc" +
          "&limit=20";


        console.log(
          "SUPABASE QUERY:",
          query
        );


        const response =
          await fetch(
            query,
            {

              method:
                "GET",

              headers: {

                apikey:
                  env.SUPABASE_SERVICE_ROLE_KEY,

                Authorization:
                  `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,

                Accept:
                  "application/json"

              }

            }
          );


        console.log(
          "SUPABASE HTTP STATUS:",
          response.status
        );


        const text =
          await response.text();


        console.log(
          "SUPABASE RESPONSE:",
          text
        );


        if (!response.ok) {

          return Response.json({

            ok:
              false,

            stage:
              "supabase",

            status:
              response.status,

            error:
              text

          });

        }


        // ----------------------------------------------
        // PARSE JSON
        // ----------------------------------------------

        let rows;

        try {

          rows =
            JSON.parse(
              text
            );

        } catch {

          return Response.json({

            ok:
              false,

            stage:
              "json",

            error:
              "Response Supabase bukan JSON.",

            raw:
              text

          });

        }


        // ----------------------------------------------
        // WAKTU WORKER
        // ----------------------------------------------

        const now =
          new Date();


        // ----------------------------------------------
        // CEK ACTIVE YANG SUDAH EXPIRED
        // ----------------------------------------------

        const expired =
          Array.isArray(rows)
            ? rows.filter(
                row => {

                  if (
                    row.status !==
                    "active"
                  ) {

                    return false;

                  }

                  if (
                    !row.expires_at
                  ) {

                    return false;

                  }

                  const expires =
                    new Date(
                      row.expires_at
                    ).getTime();


                  return (
                    !Number.isNaN(expires) &&
                    expires <=
                      now.getTime()
                  );

                }
              )
            : [];


        console.log(
          "JUMLAH ROW:",
          Array.isArray(rows)
            ? rows.length
            : 0
        );


        console.log(
          "JUMLAH ACTIVE EXPIRED:",
          expired.length
        );


        console.log(
          "========== SUPABASE TEST END =========="
        );


        return Response.json({

          ok:
            true,

          supabase_url:
            supabaseUrl,

          service_role_key:
            "ADA",

          worker_now:
            now.toISOString(),

          total_rows:
            Array.isArray(rows)
              ? rows.length
              : 0,

          active_expired:
            expired.length,

          rows:
            Array.isArray(rows)
              ? rows
              : []

        });

      } catch (error) {

        console.error(
          "SUPABASE TEST ERROR:",
          error
        );


        return Response.json(
          {

            ok:
              false,

            stage:
              "exception",

            error:
              error?.message ||
              String(error)

          },
          {
            status:
              500
          }
        );

      }

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
          await expireFiles(
            env
          );


        console.log(
          "MANUAL EXPIRY RESULT:",
          result
        );


        console.log(
          "========== MANUAL EXPIRY TEST END =========="
        );


        return Response.json({

          ok:
            true,

          result

        });

      } catch (error) {

        console.error(
          "MANUAL EXPIRY ERROR:",
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
              500

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

        ok:
          true

      });

    } catch (error) {

      console.error(
        "WEBHOOK ERROR:",
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

      const result =
        await expireFiles(
          env
        );


      console.log(
        "CRON EXPIRY RESULT:",
        result
      );


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
