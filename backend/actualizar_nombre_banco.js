require('dotenv').config();
const { actualizarBanco } = require('./src/services/bancoCentralService');

// Define aquí el nuevo nombre que quieres para tu banco
const NUEVO_NOMBRE = 'NODO BANK PRO'; 

async function ejecutar() {
  try {
    console.log(`🚀 Iniciando actualización de nombre en el Banco Central (Ambiente: ${process.env.BANCO_ENV || 'test'})...`);
    console.log(`📝 Nuevo nombre solicitado: "${NUEVO_NOMBRE}"`);
    
    await actualizarBanco({ name: NUEVO_NOMBRE });
    
    console.log('\n✅ ¡Nombre actualizado con éxito!');
    console.log('---------------------------------------------------');
    console.log(`Tu banco ahora se llama oficialmente: ${NUEVO_NOMBRE}`);
  } catch (error) {
    console.error('\n❌ Error al actualizar el nombre:');
    console.error(`Mensaje: ${error.message}`);
    
    if (error.status === 401) {
      console.error('💡 Tip: Tu API Key es inválida o no está configurada correctamente en el archivo .env');
    } else if (error.status === 409) {
      console.error('💡 Tip: El nombre "' + NUEVO_NOMBRE + '" ya está siendo usado por otro banco.');
    }
    
    if (error.details) {
      console.log('Detalles técnicos:', JSON.stringify(error.details, null, 2));
    }
  }
}

ejecutar();