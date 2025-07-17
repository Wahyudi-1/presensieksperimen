/**
 * =================================================================
 * SCRIPT UTAMA FRONTEND - SISTEM PRESENSI QR (DENGAN MODUL KEDISIPLINAN)
 * =================================================================
 * @version 2.7 - Feature: Discipline Notes Module
 * @author Gemini AI Expert for User
 *
 * PERUBAHAN UTAMA:
 * - [FITUR] Menambahkan state `disciplineOptions` untuk menyimpan cache daftar pelanggaran.
 * - [FITUR] Menambahkan semua fungsi logika untuk halaman Catatan Kedisiplinan:
 *   - `loadDisciplineOptions`: Mengambil daftar pelanggaran dari backend.
 *   - `handleNisnInput`: Mencari nama siswa secara otomatis.
 *   - `handleTingkatInput`: Memberikan saran pelanggaran dinamis.
 *   - `submitDisciplineNote`: Menyimpan catatan baru.
 *   - `searchDisciplineHistory`: Mencari riwayat pelanggaran.
 *   - `renderDisciplineHistoryTable` & `exportDisciplineHistory`.
 * - [FITUR] Menambahkan semua event listener yang diperlukan untuk halaman baru.
 * - [FITUR] Memperbarui logika inisialisasi dan navigasi untuk mendukung modul baru.
 */

// ====================================================================
// TAHAP 1: KONFIGURASI GLOBAL DAN STATE APLIKASI
// ====================================================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzFSnigvU9p3hZLXLx5WHm_26lrBR9opKo_vzU9eTf_xd0thfK7HdGHyFTfvdKsJS9O/exec";

const AppState = {
    siswa: [],
    users: [],
    rekap: [],
    // [PERUBAHAN] Menambahkan state baru
    disciplineOptions: [],
};

let qrScannerDatang, qrScannerPulang;
let isScanning = { datang: false, pulang: false };
let currentDisciplineStudent = null; // Menyimpan data siswa yg NISN-nya diinput

// ====================================================================
// TAHAP 2: FUNGSI-FUNGSI PEMBANTU (HELPERS)
// ====================================================================

function showLoading(isLoading) {
    const loader = document.getElementById('loadingIndicator');
    if (loader) {
        loader.style.display = isLoading ? 'flex' : 'none';
    }
}
function showStatusMessage(message, type = 'info', duration = 5000) {
    const statusEl = document.getElementById('statusMessage');
    if (!statusEl) { alert(message); return; }
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    statusEl.style.display = 'block';
    window.scrollTo(0, 0);
    setTimeout(() => { statusEl.style.display = 'none'; }, duration);
}
function playSound(type) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, audioContext.currentTime + 0.05);
        oscillator.type = (type === 'success') ? 'sine' : 'square';
        oscillator.frequency.setValueAtTime((type === 'success') ? 600 : 200, audioContext.currentTime);
        oscillator.start(audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.3);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) { console.warn("Web Audio API tidak didukung atau gagal.", e); }
}
async function makeApiCall(url, options = {}, showLoader = true) {
    if (showLoader) showLoading(true);
    try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const result = await response.json();
        if (result.status === 'success') return result;
        else throw new Error(result.message || 'Terjadi kesalahan pada server.');
    } catch (error) {
        showStatusMessage(`Kesalahan: ${error.message}`, 'error');
        playSound('error');
        return null;
    } finally {
        if (showLoader) showLoading(false);
    }
}
function setupPasswordToggle() {
    const toggleIcon = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    if (!toggleIcon || !passwordInput) return;
    const eyeIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>`;
    const eyeSlashIcon = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243l-4.243-4.243" /></svg>`;
    toggleIcon.innerHTML = eyeIcon;
    toggleIcon.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        toggleIcon.innerHTML = isPassword ? eyeSlashIcon : eyeIcon;
    });
}

// ====================================================================
// TAHAP 3: FUNGSI-FUNGSI UTAMA
// ====================================================================

// --- 3.1, 3.2, 3.3, 3.4, 3.5 (TIDAK ADA PERUBAHAN) ---
// Bagian Otentikasi, Presensi, Rekap, Manajemen Siswa, dan Manajemen Pengguna
// tetap sama seperti kode sebelumnya.
// (Kode dari bagian-bagian ini tidak saya sertakan ulang untuk keringkasan,
// namun pada file asli Anda, biarkan kode tersebut apa adanya).
function checkAuthentication(){/*...kode lama...*/};async function handleLogin(){/*...kode lama...*/};function handleLogout(){/*...kode lama...*/};function startQrScanner(type){/*...kode lama...*/};function stopQrScanner(type){/*...kode lama...*/};async function processQrScan(qrData,type){/*...kode lama...*/};async function loadRawRekapData(force){/*...kode lama...*/};function filterAndRenderRekap(){/*...kode lama...*/};function renderRekapTable(data){/*...kode lama...*/};function exportRekapToExcel(){/*...kode lama...*/};async function loadSiswaAndRenderTable(force){/*...kode lama...*/};function renderSiswaTable(siswaArray){/*...kode lama...*/};async function saveSiswa(){/*...kode lama...*/};function editSiswaHandler(nisn){/*...kode lama...*/};function resetFormSiswa(){/*...kode lama...*/};async function deleteSiswaHandler(nisn){/*...kode lama...*/};function generateQRHandler(nisn){/*...kode lama...*/};function printQrCode(){/*...kode lama...*/};async function loadUsers(force){/*...kode lama...*/};function renderUsersTable(usersArray){/*...kode lama...*/};async function saveUser(){/*...kode lama...*/};function editUserHandler(username){/*...kode lama...*/};async function deleteUserHandler(username){/*...kode lama...*/};function resetFormPengguna(){/*...kode lama...*/};async function loadAllSiswaIntoCache(){/*...kode lama...*/};

// --- [PERUBAHAN] 3.6. CATATAN KEDISIPLINAN (FUNGSI-FUNGSI BARU) ---

/**
 * Mengambil semua opsi pelanggaran dari backend dan menyimpannya di cache.
 */
async function loadDisciplineOptions() {
    if (AppState.disciplineOptions.length > 0) return; // Gunakan cache jika sudah ada

    console.log("Mengambil opsi kedisiplinan dari server...");
    const result = await makeApiCall(`${SCRIPT_URL}?action=getDisciplineOptions`, {}, false);
    if (result) {
        AppState.disciplineOptions = result.data;
        // Mengisi datalist untuk tingkat
        const tingkatList = document.getElementById('tingkatList');
        const uniqueTingkat = [...new Set(result.data.map(item => item.tingkat))];
        tingkatList.innerHTML = uniqueTingkat.map(t => `<option value="${t}">`).join('');
        console.log("Opsi kedisiplinan berhasil dimuat.");
    }
}

/**
 * Menangani input NISN: mencari nama siswa dan menyimpannya.
 */
function handleNisnInput() {
    const nisn = document.getElementById('disiplinNisn').value;
    const namaEl = document.getElementById('disiplinNama');
    
    currentDisciplineStudent = null;
    namaEl.value = '';

    if (!nisn) return;

    const siswa = AppState.siswa.find(s => s.NISN == nisn);
    if (siswa) {
        namaEl.value = `${siswa.Nama} - Kelas ${siswa.Kelas}`;
        currentDisciplineStudent = siswa; // Simpan data siswa yang ditemukan
    } else {
        namaEl.value = 'Siswa tidak ditemukan';
    }
}

/**
 * Menangani input Tingkat: menyaring dan menampilkan saran pelanggaran.
 */
function handleTingkatInput() {
    const tingkat = document.getElementById('disiplinTingkat').value;
    const pelanggaranList = document.getElementById('pelanggaranList');

    if (!tingkat) {
        pelanggaranList.innerHTML = '';
        return;
    }

    const filteredOptions = AppState.disciplineOptions.filter(opt => opt.tingkat.toLowerCase() === tingkat.toLowerCase());
    pelanggaranList.innerHTML = filteredOptions.map(opt => `<option value="${opt.deskripsi}">`).join('');
}

/**
 * Mengirim catatan kedisiplinan ke backend.
 */
async function submitDisciplineNote() {
    if (!currentDisciplineStudent) {
        return showStatusMessage("NISN siswa tidak valid atau belum diisi.", "error");
    }

    const loggedInUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
    if (!loggedInUser) {
        return showStatusMessage("Sesi Anda telah berakhir, silakan login ulang.", "error");
    }

    const formData = new FormData();
    formData.append('action', 'submitDisciplineNote');
    formData.append('tanggal', document.getElementById('disiplinTanggal').value);
    formData.append('nisn', currentDisciplineStudent.NISN);
    formData.append('nama', currentDisciplineStudent.Nama);
    formData.append('kelas', currentDisciplineStudent.Kelas);
    formData.append('tingkat', document.getElementById('disiplinTingkat').value);
    formData.append('pelanggaran', document.getElementById('disiplinPelanggaran').value);
    formData.append('pencatat', loggedInUser.nama);

    const result = await makeApiCall(SCRIPT_URL, { method: 'POST', body: formData });
    if (result) {
        showStatusMessage(result.message, 'success');
        document.getElementById('formDisiplin').reset();
        currentDisciplineStudent = null; // Reset siswa yang dipilih
        document.getElementById('riwayatDisiplinTableBody').innerHTML = ''; // Kosongkan riwayat
        document.getElementById('exportDisiplinButton').style.display = 'none';
    }
}

/**
 * Mencari riwayat pelanggaran berdasarkan NISN.
 */
async function searchDisciplineHistory() {
    const nisn = document.getElementById('searchDisiplinNisn').value;
    if (!nisn) {
        return showStatusMessage("Masukkan NISN untuk mencari riwayat.", "info");
    }
    const params = new URLSearchParams({ action: 'searchDisciplineHistory', nisn }).toString();
    const result = await makeApiCall(`${SCRIPT_URL}?${params}`);
    if (result) {
        renderDisciplineHistoryTable(result.data);
    }
}

/**
 * Merender data riwayat ke dalam tabel.
 */
function renderDisciplineHistoryTable(data) {
    const tableBody = document.getElementById('riwayatDisiplinTableBody');
    const exportButton = document.getElementById('exportDisiplinButton');
    
    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Tidak ada riwayat pelanggaran ditemukan untuk NISN ini.</td></tr>';
        exportButton.style.display = 'none';
    } else {
        tableBody.innerHTML = data.map(row => `
            <tr>
                <td data-label="Tanggal">${row.Tanggal}</td>
                <td data-label="Tingkat">${row.Tingkat}</td>
                <td data-label="Pelanggaran">${row.Pelanggaran}</td>
                <td data-label="Pencatat">${row.Pencatat}</td>
            </tr>
        `).join('');
        exportButton.style.display = 'inline-block';
    }
}

/**
 * Mengekspor hasil pencarian riwayat ke Excel.
 */
function exportDisciplineHistory() {
    const tableBody = document.getElementById('riwayatDisiplinTableBody');
    if (tableBody.rows.length === 0 || (tableBody.rows.length === 1 && tableBody.rows[0].cells.length === 1)) {
        return showStatusMessage('Tidak ada data untuk diekspor.', 'info');
    }
    const nisn = document.getElementById('searchDisiplinNisn').value;
    const table = document.querySelector("#disiplinSection .table-container table");
    const wb = XLSX.utils.table_to_book(table, { sheet: "Riwayat Pelanggaran" });
    XLSX.writeFile(wb, `Riwayat_Disiplin_${nisn}.xlsx`);
}

// ====================================================================
// TAHAP 4: INISIALISASI DAN EVENT LISTENERS
// ====================================================================

function setupDashboardListeners() {
    document.getElementById('logoutButton')?.addEventListener('click', handleLogout);
    document.querySelectorAll('.section-nav button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.section-nav button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            stopQrScanner('datang');
            stopQrScanner('pulang');
            const sectionId = button.dataset.section;
            document.querySelectorAll('.content-section').forEach(section => {
                section.style.display = section.id === sectionId ? 'block' : 'none';
            });
            const actions = {
                datangSection: () => startQrScanner('datang'),
                pulangSection: () => startQrScanner('pulang'),
                rekapSection: async () => {
                    const today = new Date().toISOString().slice(0, 10);
                    document.getElementById('rekapFilterTanggalMulai').value = today;
                    document.getElementById('rekapFilterTanggalSelesai').value = today;
                    await loadRawRekapData();
                    filterAndRenderRekap();
                },
                siswaSection: () => loadSiswaAndRenderTable(),
                penggunaSection: () => loadUsers(),
                // [PERUBAHAN] Menambahkan aksi untuk tab baru
                disiplinSection: () => {
                    document.getElementById('disiplinTanggal').valueAsDate = new Date();
                }
            };
            actions[sectionId]?.();
        });
    });

    document.getElementById('refreshSiswaButton')?.addEventListener('click', () => loadSiswaAndRenderTable(true));
    document.getElementById('refreshUsersButton')?.addEventListener('click', () => loadUsers(true));
    document.getElementById('refreshRekapButton')?.addEventListener('click', async () => {
        await loadRawRekapData(true);
        filterAndRenderRekap();
    });
    
    document.getElementById('filterRekapButton')?.addEventListener('click', filterAndRenderRekap);
    document.getElementById('exportRekapButton')?.addEventListener('click', exportRekapToExcel);
    document.getElementById('formSiswa')?.addEventListener('submit', (e) => { e.preventDefault(); saveSiswa(); });
    document.getElementById('resetSiswaButton')?.addEventListener('click', resetFormSiswa);
    document.getElementById('formPengguna')?.addEventListener('submit', (e) => { e.preventDefault(); saveUser(); });
    document.getElementById('resetPenggunaButton')?.addEventListener('click', resetFormPengguna);
    document.querySelector('#qrModal .modal-close-button')?.addEventListener('click', () => {
        document.getElementById('qrModal').style.display = 'none';
    });
    document.getElementById('printQrButton')?.addEventListener('click', printQrCode);

    // [PERUBAHAN] Menambahkan event listener baru untuk halaman Kedisiplinan
    document.getElementById('disiplinNisn')?.addEventListener('change', handleNisnInput);
    document.getElementById('disiplinTingkat')?.addEventListener('input', handleTingkatInput);
    document.getElementById('formDisiplin')?.addEventListener('submit', (e) => {
        e.preventDefault();
        submitDisciplineNote();
    });
    document.getElementById('searchDisiplinButton')?.addEventListener('click', searchDisciplineHistory);
    document.getElementById('exportDisiplinButton')?.addEventListener('click', exportDisciplineHistory);
}

async function initDashboardPage() {
    checkAuthentication();
    setupDashboardListeners();
    await loadAllSiswaIntoCache(); 
    // [PERUBAHAN] Panggil fungsi baru untuk memuat opsi pelanggaran
    await loadDisciplineOptions();
    document.querySelector('.section-nav button[data-section="datangSection"]')?.click();
}

function initLoginPage() {
    checkAuthentication();
    setupPasswordToggle();
    document.querySelector('.login-box form')?.addEventListener('submit', (e) => { e.preventDefault(); handleLogin(); });
}

// ====================================================================
// TAHAP 5: TITIK MASUK APLIKASI (ENTRY POINT)
// ====================================================================
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('dashboard.html')) {
        initDashboardPage();
    } else {
        initLoginPage();
    }
});
