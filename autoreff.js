// Impor modul yang dibutuhkan
require('dotenv').config(); // Untuk memuat variabel dari .env
const axios = require('axios');   // Untuk membuat permintaan HTTP

// Daftar nama dasar untuk generasi email (bisa Anda sesuaikan)
const baseNamesForEmail = [
  'ade', 'ayu', 'bambang', 'cindy', 'dodi', 'eka', 'fajar', 'fitri', 'gita', 
  'hari', 'ida', 'ivan', 'joni', 'lia', 'maya', 'nanda', 'oki', 'rani', 
  'sari', 'tio', 'ulan', 'vicky', 'widi', 'yani', 'zainal'
];

/**
 * Menghasilkan alamat email acak.
 * @returns {string} Alamat email acak.
 */
const generateRandomEmail = () => {
  const name = baseNamesForEmail[Math.floor(Math.random() * baseNamesForEmail.length)];
  const number = Math.floor(Math.random() * 1000); // Angka 0-999
  const suffix = Math.random().toString(36).substring(2, 6); // String acak pendek
  return `${name}${number}${suffix}@gmail.com`;
};

/**
 * Memberikan jeda (delay) dalam milidetik.
 * @param {number} ms - Durasi jeda dalam milidetik.
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mengirim permintaan referral ke API OpenDesci.
 * @param {string} email - Alamat email yang akan dikirimi referral.
 * @returns {Promise<boolean>} - True jika berhasil, false jika gagal.
 */
const sendReferralRequest = async (email) => {
  const apiUrl = 'https://api.opendesci.org/v1/referrals/';
  const bearerToken = process.env.BEARER_TOKEN;

  try {
    const response = await axios.post(
      apiUrl,
      { emails: [email] },
      {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 20000
      }
    );

    if (response.status === 200 || response.status === 201) {
      console.log(`✔️  Referral untuk ${email} | Status: ${response.status} - Berhasil.`); // Log tanpa warna
      return true;
    } else {
      console.log(`⚠️  Referral untuk ${email} | Status: ${response.status} - Respons tidak biasa: ${JSON.stringify(response.data)}`); // Log tanpa warna
      return false;
    }
  } catch (error) {
    let errorMessage = error.message;
    let errorCode = 'NET_ERR';

    if (error.response) {
      errorCode = error.response.status;
      const errorData = error.response.data;
      if (errorData && (errorData.detail || errorData.error)) {
        errorMessage = errorData.detail || errorData.error;
      } else if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else {
        errorMessage = JSON.stringify(errorData);
      }
    }
    console.log(`❌ Referral untuk ${email} | Status: ${errorCode} | Error: ${errorMessage}`); // Log tanpa warna
    return false;
  }
};

/**
 * Fungsi utama untuk menjalankan skrip.
 */
const main = async () => {
  const args = process.argv.slice(2);
  const numberOfReferrals = parseInt(args[0]);

  if (!process.env.BEARER_TOKEN) {
    console.error('Kesalahan: BEARER_TOKEN tidak ditemukan di file .env.'); // Log tanpa warna
    console.error('Mohon buat file .env dan tambahkan: BEARER_TOKEN=token_anda_yang_valid'); // Log tanpa warna
    process.exit(1);
  }

  if (isNaN(numberOfReferrals) || numberOfReferrals < 1) {
    console.error('Penggunaan: node autoreff.js <jumlah_referral>'); // Log tanpa warna
    console.error('Contoh: node autoreff.js 50'); // Log tanpa warna
    process.exit(1);
  }

  const delayBetweenRequestsMs = 7000; 

  console.log(`🚀 Memulai pengiriman ${numberOfReferrals} undangan referral...`); // Log tanpa warna
  console.log(`    Jeda antar permintaan: ${delayBetweenRequestsMs / 1000} detik.`); // Log tanpa warna

  let successfulReferrals = 0;
  let failedReferrals = 0;

  for (let i = 0; i < numberOfReferrals; i++) {
    const targetEmail = generateRandomEmail();
    console.log(`[${i + 1}/${numberOfReferrals}] Mencoba mengirim ke: ${targetEmail}`); // Log tanpa warna

    const success = await sendReferralRequest(targetEmail);
    if (success) {
      successfulReferrals++;
    } else {
      failedReferrals++;
    }

    if (i < numberOfReferrals - 1) {
      await delay(delayBetweenRequestsMs);
    }
  }

  console.log(`\n🎉 Proses Selesai!`); // Log tanpa warna
  console.log(`    Berhasil mengirim: ${successfulReferrals} referral.`); // Log tanpa warna
  if (failedReferrals > 0) {
    console.log(`    Gagal mengirim: ${failedReferrals} referral.`); // Log tanpa warna
  }
  console.log('    Silakan periksa log di atas untuk detail setiap pengiriman.'); // Log tanpa warna
};

main().catch(error => {
  console.error('❌ Terjadi kesalahan fatal dalam skrip:', error); // Log tanpa warna
  process.exit(1);
});
