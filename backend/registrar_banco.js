require('dotenv').config();
const { registrarBanco } = require('./src/services/bancoCentralService');

// CONFIGURACIÓN: Cambia estos valores con lo que te dio el profe
const TEACHER_TOKEN = '59wWNmrhz0pEs8gKln4SLvudTMoALbDcBDmmdm7R2rw';
const NOMBRE_BANCO = 'Banco_Nodo'; // Cambia esto por algo único como 'Banco_Nodo_TuNombre'

async function ejecutar() {
  try {
    console.log(`Registrando banco "${NOMBRE_BANCO}"...`);
    const data = await registrarBanco({ name: NOMBRE_BANCO, teacherToken: TEACHER_TOKEN });
    
    console.log('\n✅ ¡Banco registrado con éxito!');
    console.log('-----------------------------------');
    console.log(`ID del Banco: ${data.bankId}`);
    console.log(`API KEY: ${data.apiKey}`);
    console.log('-----------------------------------');
    console.log('Copia estos valores en tu archivo .env y reinicia el servidor.');
  } catch (error) {
    console.error('\n❌ Error al registrar:', error.message, error.details || '');
  }
}

ejecutar();