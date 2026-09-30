const { createPrivateKey, createSign } = require('crypto');

// Convert Node.js DER-encoded ECDSA signature to IEEE P1363 (raw r||s) base64url
// — JWT ES256 requires P1363 format, not DER
function _derToJose(der) {
  let i = 0;
  if (der[i++] !== 0x30) throw new Error('Bad DER SEQUENCE');
  let seqLen = der[i++];
  if (seqLen & 0x80) i += (seqLen & 0x7f); // skip long-form length bytes

  // r integer
  if (der[i++] !== 0x02) throw new Error('Bad DER r INTEGER');
  let rLen = der[i++];
  let r = der.slice(i, i + rLen); i += rLen;

  // s integer
  if (der[i++] !== 0x02) throw new Error('Bad DER s INTEGER');
  let sLen = der[i++];
  let s = der.slice(i, i + sLen);

  // Strip leading 0x00 padding bytes (used by DER to indicate positive integer)
  while (r.length > 32 && r[0] === 0) r = r.slice(1);
  while (s.length > 32 && s[0] === 0) s = s.slice(1);

  const rb = Buffer.alloc(32); r.copy(rb, 32 - r.length);
  const sb = Buffer.alloc(32); s.copy(sb, 32 - s.length);

  return Buffer.concat([rb, sb]).toString('base64url');
}

const _b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

const firmarQR = async (req, res) => {
  const rawPriv = process.env.QR_PRIVATE_KEY_JWK;
  const bankCode = Number(process.env.NODO_BANK_CODE);
  const kid = process.env.NODO_QR_KID || 'nodo-1';

  if (!rawPriv || !bankCode) {
    return res.status(503).json({
      message: 'QR signing no configurado. Agregá QR_PRIVATE_KEY_JWK y NODO_BANK_CODE en las variables de entorno.'
    });
  }

  const { cbu, alias, monto, moneda } = req.body;
  if (!cbu || !moneda) {
    return res.status(400).json({ message: 'cbu y moneda son obligatorios' });
  }
  if (!['ARS', 'USD'].includes(moneda)) {
    return res.status(400).json({ message: 'moneda debe ser ARS o USD' });
  }

  try {
    const privateKeyJwk = JSON.parse(rawPriv);
    const privKey = createPrivateKey({ key: privateKeyJwk, format: 'jwk' });

    const header  = _b64url({ alg: 'ES256', typ: 'JWT', kid });
    const iat     = Math.floor(Date.now() / 1000);
    const claims  = { iss: bankCode, cbu, moneda, iat, exp: iat + 600 };
    if (alias) claims.alias = alias;
    if (monto !== undefined && monto !== null && monto !== '') {
      claims.monto = Number(monto);
    }
    const payload   = _b64url(claims);
    const sigInput  = `${header}.${payload}`;

    const signer = createSign('SHA256');
    signer.update(sigInput);
    const derSig = signer.sign(privKey);
    const sig    = _derToJose(derSig);

    return res.json({ jwt: `${sigInput}.${sig}` });
  } catch (err) {
    return res.status(500).json({ message: 'Error al firmar el QR', error: err.message });
  }
};

// GET /api/qr/public-key — expone la clave pública para que otros bancos puedan verificar
const publicKey = (_req, res) => {
  const rawPub  = process.env.QR_PUBLIC_KEY_JWK;
  const bankCode = Number(process.env.NODO_BANK_CODE);
  const kid     = process.env.NODO_QR_KID || 'nodo-1';

  if (!rawPub || !bankCode) {
    return res.status(503).json({ message: 'QR signing no configurado.' });
  }

  try {
    const pubJwk = JSON.parse(rawPub);
    return res.json({ bankCode, kid, publicKeyJwk: pubJwk });
  } catch {
    return res.status(500).json({ message: 'Error al leer la clave pública.' });
  }
};

module.exports = { firmarQR, publicKey };
