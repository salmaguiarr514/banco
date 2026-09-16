document.addEventListener("DOMContentLoaded", () => {
  // ── Generar QR para cobrar ──
  const btnQrCharge      = document.getElementById("btn-qr-charge");
  const qrGeneratorModal = document.getElementById("qrGeneratorModal");
  const qrContainer      = document.getElementById("qrcode-container");

  btnQrCharge?.addEventListener("click", () => {
    if (!cuentaActiva) return void showToast("Cargando datos de cuenta...", 3000, "info");
    qrContainer.innerHTML = "";
    qrGeneratorModal.classList.remove("hidden");
    document.getElementById("qrAccountDetail").textContent = `${cuentaActiva.alias} | ${cuentaActiva.cbu}`;
    const qrData = JSON.stringify({ cbu: cuentaActiva.cbu, alias: cuentaActiva.alias, banco: "Nodo", v: "1.0" });
    new QRCode(qrContainer, {
      text: qrData,
      width: 256, height: 256,
      colorDark: "#0F172A", colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  });

  // ── Leer QR para pagar ──
  const btnQrPay       = document.getElementById("btn-qr-pay");
  const qrScannerModal = document.getElementById("qrScannerModal");

  window.stopScanner = async () => {
    if (html5QrCode) {
      await html5QrCode.stop();
      qrScannerModal.classList.add("hidden");
    }
  };

  btnQrPay?.addEventListener("click", async () => {
    if (html5QrCode) {
      try { await html5QrCode.stop(); } catch {}
      html5QrCode = null;
    }
    qrScannerModal.classList.remove("hidden");
    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => {
      try {
        const data = JSON.parse(decodedText);
        if (data.cbu || data.alias) {
          stopScanner();
          openTransferModal();
          const inputDestino = document.getElementById("cbuDestino");
          inputDestino.value = data.alias || data.cbu;
          inputDestino.dispatchEvent(new Event("input"));
          showToast(`QR detectado: ${data.alias || data.cbu}`, 3000, "success");
        }
      } catch {
        showToast("QR no reconocido como formato Nodo", 3500, "error");
        stopScanner();
        openTransferModal();
        document.getElementById("cbuDestino").value = decodedText;
        document.getElementById("cbuDestino").dispatchEvent(new Event("input"));
      }
    });
  });
});
