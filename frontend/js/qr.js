// ── QR Interbancario — Módulo COBRAR + PAGAR ──
// Spec: qr-interbancario-jwt.md  |  Firma: ES256, lib: WebCrypto nativa

// ─── Helpers JWT (sin dependencias externas) ─────────────────────────────────

const _b64urlToUint8 = (str) => {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
};

const _b64urlToObj = (str) => {
  try { return JSON.parse(new TextDecoder().decode(_b64urlToUint8(str))); }
  catch { return null; }
};

// Retorna { header, payload } sin verificar la firma
const _decodeJwt = (token) => {
  const parts = (token || '').split('.');
  if (parts.length !== 3) return null;
  const header  = _b64urlToObj(parts[0]);
  const payload = _b64urlToObj(parts[1]);
  if (!header || !payload) return null;
  return { header, payload, raw: token };
};

// Verifica firma ES256 con clave pública JWK usando WebCrypto
// Lanza un error descriptivo si falla
const _verifyES256 = async (token, pubJwk) => {
  const [h, p, s] = token.split('.');
  const sigInput = new TextEncoder().encode(`${h}.${p}`);
  const sig      = _b64urlToUint8(s);

  const key = await crypto.subtle.importKey(
    'jwk', pubJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['verify']
  );

  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    key, sig, sigInput
  );

  if (!valid) throw new Error('firma_invalida');
  const payload = _b64urlToObj(p);
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error('vencido');
  return payload;
};

// ─── Lógica de verificación por capas (sección 7 de la spec) ─────────────────

const _parseQrPayload = async (rawText) => {
  // Capa 1 y 2: ¿Es un JWT?
  const decoded = _decodeJwt(rawText);
  if (decoded) {
    const iss     = decoded.payload?.iss;
    const bankKey = KNOWN_BANKS[iss];

    if (bankKey) {
      // Banco conocido localmente — verificar firma
      try {
        const payload = await _verifyES256(rawText, bankKey.publicKeyJwk);
        return { ok: true, verified: true, bankName: bankKey.bankName, payload };
      } catch (e) {
        const msg = e.message === 'vencido'
          ? 'El código QR es inválido o se encuentra vencido'
          : 'El código QR es inválido o se encuentra vencido';
        return { ok: false, error: msg };
      }
    } else {
      // Banco no registrado localmente — intentar auto-discovery
      try {
        const discovered = await apiFetch(`/qr/discover/${iss}`);
        if (discovered?.publicKeyJwk) {
          // Guardar en caché para el resto de la sesión
          KNOWN_BANKS[iss] = {
            bankName: discovered.bankName || `Banco ${iss}`,
            kid: discovered.kid,
            publicKeyJwk: discovered.publicKeyJwk,
          };
          const payload = await _verifyES256(rawText, discovered.publicKeyJwk);
          return { ok: true, verified: true, bankName: KNOWN_BANKS[iss].bankName, payload };
        }
      } catch {}

      // Sin clave disponible — advertencia amarilla
      const p = decoded.payload;
      if (p?.cbu && p?.moneda) {
        return {
          ok: true,
          verified: false,
          warn: 'Origen no verificado de forma directa. Revisá los datos antes de transferir.',
          payload: p,
        };
      }
      return { ok: false, error: 'Formato de QR no reconocido' };
    }
  }

  // Capa 3: ¿Es JSON plano { cbu, alias, monto, moneda }?
  try {
    const data = JSON.parse(rawText);
    if (data.cbu || data.alias) {
      return {
        ok: true, verified: false,
        payload: { cbu: data.cbu, alias: data.alias, monto: data.monto, moneda: data.moneda || 'ARS' },
      };
    }
  } catch {}

  // Capa 4: formato legacy interno MONIXQR: / MONIXPAY: (fallback)
  if (rawText.startsWith('MONIXQR:') || rawText.startsWith('MONIXPAY:') || rawText.startsWith('NODOPAY:')) {
    const rest = rawText.split(':').slice(1).join(':');
    return {
      ok: true, verified: false,
      payload: { cbu: rest, moneda: 'ARS' },
    };
  }

  return { ok: false, error: 'QR no reconocido' };
};

// ─── Módulo COBRAR ─────────────────────────────────────────────────────────────

const _openCobrarModal = () => {
  if (!cuentaActiva) return void showToast('Cargando datos de cuenta…', 3000, 'info');

  // Reset step
  document.getElementById('qrStep1')?.removeAttribute('hidden');
  document.getElementById('qrStep2')?.setAttribute('hidden', '');
  document.getElementById('qrMonto').value = '';
  document.getElementById('qrMonedaARS').classList.add('active');
  document.getElementById('qrMonedaUSD').classList.remove('active');
  document.getElementById('qrAccountDetail').textContent =
    `${cuentaActiva.alias || ''} · ${cuentaActiva.cbu}`;

  document.getElementById('qrGeneratorModal').classList.remove('hidden');
};

let _qrJwt = ''; // el JWT actual para "Copiar código"

const _generarQR = async () => {
  const monto   = document.getElementById('qrMonto').value.replace(/\./g, '').replace(/,/, '.').trim();
  const moneda  = document.getElementById('qrMonedaARS').classList.contains('active') ? 'ARS' : 'USD';
  const btnGen  = document.getElementById('btnGenerarQR');

  btnGen.disabled = true;
  btnGen.textContent = 'Generando…';

  try {
    const body = { cbu: cuentaActiva.cbu, alias: cuentaActiva.alias, moneda };
    if (monto && !isNaN(Number(monto)) && Number(monto) > 0) body.monto = Number(monto);

    const data = await apiFetch('/qr/firmar', { method: 'POST', body: JSON.stringify(body) });
    _qrJwt = data.jwt;

    // Renderizar QR
    const container = document.getElementById('qrcode-container');
    container.innerHTML = '';
    new QRCode(container, {
      text: _qrJwt,
      width: 256, height: 256,
      colorDark: '#0F172A', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });

    // Info de monto
    const infoEl = document.getElementById('qrInfoMonto');
    if (infoEl) {
      infoEl.textContent = body.monto
        ? `Monto: $${body.monto.toLocaleString('es-AR')} ${moneda}`
        : 'Sin monto fijo — el pagador elige el monto';
    }

    // Sincronizar cuenta en step 2
    const d2 = document.getElementById('qrAccountDetail2');
    if (d2) d2.textContent = document.getElementById('qrAccountDetail').textContent;

    // Pasar a step 2
    document.getElementById('qrStep1').setAttribute('hidden', '');
    document.getElementById('qrStep2').removeAttribute('hidden');
  } catch (err) {
    showToast(err.message || 'No se pudo generar el QR', 4000, 'error');
  } finally {
    btnGen.disabled = false;
    btnGen.textContent = 'Generar QR';
  }
};

const _copiarQR = async () => {
  if (!_qrJwt) return;
  try {
    await navigator.clipboard.writeText(_qrJwt);
    showToast('Código copiado al portapapeles', 2500, 'success');
  } catch {
    showToast('No se pudo copiar. Intentá manualmente.', 3000, 'error');
  }
};

const _compartirQR = async () => {
  if (!_qrJwt) return;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Cobrar con NODO', text: _qrJwt });
    } catch {}
  } else {
    await _copiarQR();
  }
};

// ─── Módulo PAGAR QR ───────────────────────────────────────────────────────────

let _html5QrCode = null;

const _prefillTransfer = (payload) => {
  openTransferModal();
  const input = document.getElementById('cbuDestino');
  if (!input) return;
  input.value = payload.alias || payload.cbu || '';
  input.dispatchEvent(new Event('input'));

  // Prefill monto cuando el paso 2 sea visible (es un paso posterior al de CBU)
  if (payload.monto) {
    const step2 = document.getElementById('transferStep2');
    if (!step2) return;
    const obs = new MutationObserver(() => {
      if (!step2.classList.contains('hidden')) {
        const montoInput = document.getElementById('monto');
        if (montoInput && !montoInput.value) {
          montoInput.value = payload.monto;
          montoInput.dispatchEvent(new Event('input'));
        }
        obs.disconnect();
      }
    });
    obs.observe(step2, { attributes: true, attributeFilter: ['class'] });
    // Desconectar automáticamente si el modal se cierra sin avanzar
    setTimeout(() => obs.disconnect(), 30000);
  }
};

const _showScanResult = (result) => {
  const overlay = document.getElementById('qrScanOverlay');
  if (!overlay) return;

  if (result.ok && result.verified) {
    overlay.hidden = true;
  } else if (result.ok && !result.verified && result.warn) {
    overlay.hidden = false;
    overlay.className = 'qr-scan-overlay qr-scan-warn';
    overlay.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${result.warn}
      <button class="qr-scan-continue" id="qrWarnContinue">Continuar de todos modos</button>`;
  } else if (!result.ok) {
    overlay.hidden = false;
    overlay.className = 'qr-scan-overlay qr-scan-error';
    overlay.innerHTML = `<i class="fas fa-times-circle"></i> ${result.error}
      <button class="qr-scan-continue" id="qrWarnContinue">Cerrar</button>`;
  }
};

const _onQrScanned = async (decodedText) => {
  try { await _html5QrCode?.stop(); } catch {}
  _html5QrCode = null;

  const result = await _parseQrPayload(decodedText);

  if (!result.ok) {
    document.getElementById('qrScannerModal').classList.add('hidden');
    showToast(result.error, 4000, 'error');
    return;
  }

  if (!result.verified && result.warn) {
    // Mostrar warning en modal scanner y esperar confirmación
    const overlay = document.getElementById('qrScanOverlay');
    if (overlay) {
      overlay.hidden = false;
      overlay.className = 'qr-scan-overlay qr-scan-warn';
      overlay.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <span>${result.warn}</span>
        <div class="qr-scan-actions">
          <button class="qr-scan-btn qr-scan-btn-ok" id="qrWarnContinue">Continuar</button>
          <button class="qr-scan-btn qr-scan-btn-cancel" id="qrWarnCancel">Cancelar</button>
        </div>`;
      document.getElementById('qrWarnContinue')?.addEventListener('click', () => {
        document.getElementById('qrScannerModal').classList.add('hidden');
        overlay.hidden = true;
        _prefillTransfer(result.payload);
      });
      document.getElementById('qrWarnCancel')?.addEventListener('click', () => {
        document.getElementById('qrScannerModal').classList.add('hidden');
        overlay.hidden = true;
      });
    }
    return;
  }

  // QR válido verificado (o fallback JSON)
  document.getElementById('qrScannerModal').classList.add('hidden');
  const bankLabel = result.bankName ? ` · ${result.bankName}` : '';
  showToast(`QR verificado${bankLabel}`, 3000, 'success');
  _prefillTransfer(result.payload);
};

window.stopScanner = async () => {
  try { await _html5QrCode?.stop(); } catch {}
  _html5QrCode = null;
  document.getElementById('qrScannerModal').classList.add('hidden');
  const overlay = document.getElementById('qrScanOverlay');
  if (overlay) overlay.hidden = true;
};

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // COBRAR
  document.getElementById('btn-qr-charge')?.addEventListener('click', _openCobrarModal);

  document.getElementById('qrMonedaARS')?.addEventListener('click', () => {
    document.getElementById('qrMonedaARS').classList.add('active');
    document.getElementById('qrMonedaUSD').classList.remove('active');
  });
  document.getElementById('qrMonedaUSD')?.addEventListener('click', () => {
    document.getElementById('qrMonedaUSD').classList.add('active');
    document.getElementById('qrMonedaARS').classList.remove('active');
  });
  document.getElementById('btnGenerarQR')?.addEventListener('click', _generarQR);
  document.getElementById('btnCopiarQR')?.addEventListener('click', _copiarQR);
  document.getElementById('btnCompartirQR')?.addEventListener('click', _compartirQR);
  document.getElementById('btnQrBack')?.addEventListener('click', () => {
    document.getElementById('qrStep1').removeAttribute('hidden');
    document.getElementById('qrStep2').setAttribute('hidden', '');
  });
  document.getElementById('btnCloseQrGenerator')?.addEventListener('click', () =>
    document.getElementById('qrGeneratorModal').classList.add('hidden'));

  // PAGAR QR
  document.getElementById('btn-qr-pay')?.addEventListener('click', async () => {
    if (_html5QrCode) {
      try { await _html5QrCode.stop(); } catch {}
      _html5QrCode = null;
    }
    const overlay = document.getElementById('qrScanOverlay');
    if (overlay) overlay.hidden = true;

    document.getElementById('qrScannerModal').classList.remove('hidden');

    _html5QrCode = new Html5Qrcode('reader');
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    _html5QrCode.start({ facingMode: 'environment' }, config, _onQrScanned)
      .catch(() => showToast('No se pudo acceder a la cámara', 4000, 'error'));
  });
});
