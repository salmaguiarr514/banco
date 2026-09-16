const PALABRAS = [
  'SOL','PAN','MAR','LUZ','SAL','FLOR','REY','PAZ','LUNA','ORO',
  'DIA','MESA','GATO','CASA','RIO','OJO','PERRO','AGUA','NUBE','CAFE',
  'MANO','CAJA','PALA','TAZA','BOCA','PATO','OSO','ROCA','VINO','MOTO',
  'NIDO','VAPOR','PIN','FARO','PIE','PINO','LAGO','MITO','PAPA','SILLA',
  'TORO','ROPA','BOLA','MANZANA','MAMA','LECHE','PISO','SOPA','TREN','BICI',
  'BOTA','COPA','NAVE','FOCO','KILO','RATA','POZO','RAMA','TIZA','COLA',
  'ISLA','LANA','PEZ','MANI','PAPEL','MASA','NENE','HOJA','POLLO','LIMA',
  'CERO','MATE','RUTA',
];

const pick = () => PALABRAS[Math.floor(Math.random() * PALABRAS.length)];

const generarAlias = () =>
  `${pick()}.${pick()}.${pick()}`.toLowerCase();

module.exports = { generarAlias };
