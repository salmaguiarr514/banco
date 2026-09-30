// Tabla local de claves públicas de bancos participantes del curso.
// No hay autodiscovery — cada equipo manda su bankCode + kid + publicKeyJwk (JWK) a mano.
// Agregar aquí las claves de los bancos que quieran interoperar con NODO.
//
// Formato de cada entrada:
//   [bankCode]: { bankCode, bankName, kid, publicKeyJwk }
//
// La clave pública de NODO (bankCode 17) está incluida para auto-verificación.

const KNOWN_BANKS = {
  17: {
    bankCode: 17,
    bankName: 'Banco_Nodo',
    kid: 'nodo-1',
    publicKeyJwk: {
      kty: 'EC',
      crv: 'P-256',
      x: 'gB_5OGAqG8htsnp0OcFrDQdIA41VApEfczSmLIv-VXM',
      y: 'YTFpo2gHUTiFQ-bgBElgmD5bCpgloDsTz1IruCfot2c',
    },
  },

  // ── Agregar aquí las claves de otros bancos del curso ──
  // Ejemplo:
  // 2: {
  //   bankCode: 2,
  //   bankName: 'Monix',
  //   kid: 'monix-1',
  //   publicKeyJwk: { kty: 'EC', crv: 'P-256', x: '...', y: '...' },
  // },
};
