// â”€â”€ Comprobante: descargar y compartir â”€â”€
const getReceiptCanvas = async () => {
  const card    = document.querySelector('.receipt-card');
  const toHide  = card.querySelectorAll('.receipt-actions, .btn-primary');
  toHide.forEach(el => el.style.display = 'none');
  try {
    return await html2canvas(card, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
  } finally {
    toHide.forEach(el => el.style.display = '');
  }
};

const downloadReceipt = async () => {
  try {
    const canvas = await getReceiptCanvas();
    const link = document.createElement('a');
    link.download = `comprobante-nodo-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Comprobante descargado', 3000, 'success');
  } catch {
    showToast('No se pudo descargar el comprobante', 3500, 'error');
  }
};

const shareReceipt = async () => {
  const amount  = document.getElementById('receiptAmount').textContent.trim();
  const toInfo  = document.getElementById('receiptToInfo').innerText.trim();
  const dateStr = document.getElementById('receiptDateTime').textContent.trim();
  const text    = `Comprobante Nodo\n${amount}\nPara: ${toInfo}\n${dateStr}`;

  try {
    const canvas = await getReceiptCanvas();

    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'comprobante-nodo.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'Comprobante Nodo', files: [file] });
      } else if (navigator.share) {
        await navigator.share({ title: 'Comprobante Nodo', text });
      } else {
        await navigator.clipboard.writeText(text);
        showToast('Texto copiado al portapapeles');
      }
    }, 'image/png');
  } catch (err) {
    if (err.name !== 'AbortError') showToast('No se pudo compartir el comprobante');
  }
};

