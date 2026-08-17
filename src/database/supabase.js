// ======================================================
// SUPABASE REST API
// ======================================================

export async function sb(
  env,
  path,
  options = {}
) {

  if (!env.SUPABASE_URL) {
    throw new Error(
      "SUPABASE_URL belum diset."
    );
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY belum diset."
    );
  }

  const baseUrl =
    String(
      env.SUPABASE_URL
    ).replace(/\/+$/, "");

  const url =
    `${baseUrl}/rest/v1/${path}`;

  const headers = {

    apikey:
      env.SUPABASE_SERVICE_ROLE_KEY,

    Authorization:
      `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,

    "Content-Type":
      "application/json",

    ...(options.headers || {})

  };

  const response =
    await fetch(
      url,
      {
        ...options,
        headers
      }
    );

  const text =
    await response.text();

  if (!response.ok) {

    throw new Error(
      `Supabase ${response.status}: ${text}`
    );

  }

  if (!text) {
    return null;
  }

  try {

    return JSON.parse(text);

  } catch {

    return text;

  }

}


// ======================================================
// SELECT
// ======================================================

export async function select(
  env,
  table,
  query = ""
) {

  return sb(
    env,
    `${table}${query ? `?${query}` : ""}`,
    {
      method: "GET",

      headers: {
        Accept:
          "application/json"
      }
    }
  );

}


// ======================================================
// SELECT ONE
// ======================================================

export async function selectOne(
  env,
  table,
  query = ""
) {

  const rows =
    await select(
      env,
      table,
      query
    );

  if (
    !Array.isArray(rows) ||
    !rows.length
  ) {

    return null;

  }

  return rows[0];

}


// ======================================================
// INSERT
// ======================================================

export async function insert(
  env,
  table,
  data,
  returnData = true
) {

  return sb(
    env,
    table,
    {
      method: "POST",

      headers: {

        Prefer:
          returnData
            ? "return=representation"
            : "return=minimal"

      },

      body:
        JSON.stringify(data)

    }
  );

}


// ======================================================
// UPDATE
// ======================================================

export async function update(
  env,
  table,
  query,
  data
) {

  return sb(
    env,
    `${table}?${query}`,
    {
      method: "PATCH",

      headers: {

        Prefer:
          "return=representation"

      },

      body:
        JSON.stringify(data)

    }
  );

}


// ======================================================
// DELETE
// ======================================================

export async function remove(
  env,
  table,
  query
) {

  return sb(
    env,
    `${table}?${query}`,
    {
      method: "DELETE",

      headers: {

        Prefer:
          "return=minimal"

      }

    }
  );

}
