// ======================================================
// FORMAT DURASI
// ======================================================

export function formatDuration(seconds) {

  if (
    seconds === null ||
    seconds === undefined ||
    Number(seconds) <= 0
  ) {

    return "Selamanya";

  }

  const total =
    Number(seconds);

  if (
    !Number.isFinite(total) ||
    total <= 0
  ) {

    return "Selamanya";

  }

  const minute =
    60;

  const hour =
    60 * minute;

  const day =
    24 * hour;

  const week =
    7 * day;

  const month =
    30 * day;


  if (
    total % month === 0
  ) {

    return `${total / month} bulan`;

  }


  if (
    total % week === 0
  ) {

    return `${total / week} minggu`;

  }


  if (
    total % day === 0
  ) {

    return `${total / day} hari`;

  }


  if (
    total % hour === 0
  ) {

    return `${total / hour} jam`;

  }


  if (
    total % minute === 0
  ) {

    return `${total / minute} menit`;

  }


  return `${total} detik`;

}


// ======================================================
// PARSE DURASI
// ======================================================
//
// Contoh:
// 1h
// 2h
// 3d
// 7d
// 2w
// 1m
// 6mo
//
// Minimal custom duration = 1 jam.
//
// Tidak menerima:
// 30s
// 30sec
// 30min
// 30minutes
//
// forever / selamanya = tanpa expiry
// ======================================================

export function parseDuration(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return null;

  }


  const input =
    String(value)
      .trim()
      .toLowerCase();


  // ====================================================
  // SELAMANYA
  // ====================================================

  if (
    input === "forever" ||
    input === "permanent" ||
    input === "permanen" ||
    input === "selamanya" ||
    input === "unlimited"
  ) {

    return {

      seconds: null,

      label:
        "Selamanya"

    };

  }


  // ====================================================
  // FORMAT
  // ====================================================
  //
  // Hanya menerima:
  // h  = jam
  // d  = hari
  // w  = minggu
  // m  = bulan
  //
  // Menit dan detik sengaja tidak tersedia.
  // ====================================================

  const match =
    input.match(
      /^(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|d|day|days|w|week|weeks|m|mo|month|months)$/
    );


  if (!match) {

    return null;

  }


  const amount =
    Number(match[1]);

  const unit =
    match[2];


  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {

    return null;

  }


  let seconds;


  // ====================================================
  // JAM
  // ====================================================

  if (
    [
      "h",
      "hr",
      "hrs",
      "hour",
      "hours"
    ].includes(unit)
  ) {

    seconds =
      amount *
      60 *
      60;

  }


  // ====================================================
  // HARI
  // ====================================================

  else if (
    [
      "d",
      "day",
      "days"
    ].includes(unit)
  ) {

    seconds =
      amount *
      24 *
      60 *
      60;

  }


  // ====================================================
  // MINGGU
  // ====================================================

  else if (
    [
      "w",
      "week",
      "weeks"
    ].includes(unit)
  ) {

    seconds =
      amount *
      7 *
      24 *
      60 *
      60;

  }


  // ====================================================
  // BULAN
  // ====================================================

  else if (
    [
      "m",
      "mo",
      "month",
      "months"
    ].includes(unit)
  ) {

    seconds =
      amount *
      30 *
      24 *
      60 *
      60;

  }


  else {

    return null;

  }


  // ====================================================
  // MINIMAL 1 JAM
  // ====================================================

  const minimumDuration =
    60 * 60;


  if (
    seconds < minimumDuration
  ) {

    return null;

  }


  // ====================================================
  // VALIDASI AKHIR
  // ====================================================

  if (
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {

    return null;

  }


  return {

    seconds,

    label:
      formatDuration(
        seconds
      )

  };

}


// ======================================================
// NAMA FILE
// ======================================================

export function fileDisplayName(
  file
) {

  if (!file) {

    return "File";

  }

  if (
    file.file_name
  ) {

    return file.file_name;

  }

  if (
    file.media_type
  ) {

    return (
      String(
        file.media_type
      )
        .charAt(0)
        .toUpperCase() +

      String(
        file.media_type
      ).slice(1)
    );

  }

  return "File";

}
