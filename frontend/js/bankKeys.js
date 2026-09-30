// Registro local de claves públicas JWK para verificación ES256 de QR interbancario.
// Cada banco comparte su bankCode + kid + publicKeyJwk (curva P-256).
// El campo "iss" del JWT firmado debe coincidir con una clave aquí para que
// el origen figure como "Verificado". Sin match → advertencia amarilla.
//
// Cómo agregar un banco:
//   1. El otro banco ejecuta GET /api/qr/public-key en su app y comparte la respuesta.
//   2. Agregá una entrada con su bankCode como clave:
//
//      <bankCode>: {
//        bankName: "<nombre visible>",
//        kid: "<kid del header JWT>",
//        publicKeyJwk: { kty: "EC", crv: "P-256", x: "<base64url>", y: "<base64url>" }
//      }

const KNOWN_BANKS = {

  // ── NODO (Banco 17) ──────────────────────────────────────────────────────────
  17: {
    bankName: "Banco_Nodo",
    kid: "nodo-1",
    publicKeyJwk: {
      kty: "EC",
      crv: "P-256",
      x: "gB_5OGAqG8htsnp0OcFrDQdIA41VApEfczSmLIv-VXM",
      y: "YTFpo2gHUTiFQ-bgBElgmD5bCpgloDsTz1IruCfot2c",
    },
  },

  // ── Agregar bancos del curso aquí ─────────────────────────────────────────────
  //
  // Ejemplo (reemplazar con los datos reales de cada banco):
  //
  // 1: {
  //   bankName: "Banco Ejemplo",
  //   kid: "ejemplo-key-1",
  //   publicKeyJwk: {
  //     kty: "EC",
  //     crv: "P-256",
  //     x: "...",   // ← de GET /api/qr/public-key del otro banco
  //     y: "...",
  //   },
  // },

};
