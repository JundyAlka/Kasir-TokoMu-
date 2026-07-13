export function generateDynamicQris(basePayload: string, amount: number): string {
  if (!basePayload || amount <= 0) return basePayload;

  // Hapus tag 63 (CRC) yang ada di akhir (6304 + 4 karakter CRC = 8 karakter)
  let payloadWithoutCrc = basePayload;
  if (basePayload.length > 8 && basePayload.includes("6304")) {
    const lastIndex = basePayload.lastIndexOf("6304");
    if (lastIndex === basePayload.length - 8) {
      payloadWithoutCrc = basePayload.slice(0, lastIndex);
    }
  }

  // Jika payload sudah memiliki tag 54 (Amount), kita harus mereplace-nya.
  // Tapi untuk keamanan dan kesederhanaan, asumsikan basePayload adalah QRIS statis tanpa tag 54.
  // Jika tag 54 sudah ada, kita bisa menggunakan RegExp sederhana untuk membuangnya, 
  // namun format QRIS adalah TLV (Tag Length Value).
  // Tag 54 -> 54 + 2 digit panjang + nilai.
  // Contoh regex kasar untuk membuang tag 54 yang ada:
  payloadWithoutCrc = payloadWithoutCrc.replace(/54(?:[0-9]{2})(?:[0-9]+)(?=55|56|57|58|59|60|61|62|63)/g, "");

  const amountStr = amount.toString();
  const amountLen = amountStr.length.toString().padStart(2, "0");
  const amountTag = `54${amountLen}${amountStr}`;

  // Sisipkan amountTag dan tambahkan tag 63 kembali untuk dihitung CRC-nya
  let nextPayload = payloadWithoutCrc + amountTag + "6304";

  // Hitung CRC16-CCITT (Polynomial: 0x1021, Initial Value: 0xFFFF)
  let crc = 0xffff;
  for (let i = 0; i < nextPayload.length; i++) {
    crc ^= nextPayload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
    }
  }

  const finalCrc = (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
  return nextPayload + finalCrc;
}
