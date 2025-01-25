// processDoc.js

const { google } = require('googleapis');
const fetch = require('node-fetch');
const pdf = require('pdf-parse');

exports.handler = async (event) => {
  console.log('Invocando processDoc...');
  try {
    // Solo aceptar peticiones POST
    if (event.httpMethod !== 'POST') {
      console.log('Método no permitido');
      return {
        statusCode: 405,
        body: 'Método no permitido, usa POST.'
      };
    }

    // Obtener el fileId desde el cuerpo de la petición
    const { fileId } = JSON.parse(event.body || '{}');
    if (!fileId) {
      console.log('Faltan parámetros: fileId');
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Falta fileId'
        })
      };
    }

    console.log(`Recibido fileId: ${fileId}`);

    // Autenticación con Google Drive
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive']
    });

    const drive = google.drive({ version: 'v3', auth });

    console.log('Descargando archivo desde Google Drive...');
    // Descargar el PDF como arraybuffer
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    console.log('Archivo descargado con éxito.');
    const arrayBuffer = response.data;

    console.log('Procesando el PDF...');
    // Parsear PDF desde buffer
    const pdfData = await pdf(Buffer.from(arrayBuffer));
    const text = pdfData.text;
    console.log('Texto extraído del PDF:');
    console.log(text);

    console.log('Llamando a OpenAI...');
    // Crear el prompt para GPT
    const prompt = `Analiza este texto de licitación y devuélveme:
    - Resumen
    - Aspectos clave
    - Documentación necesaria
    - Fechas y montos importantes
    - Lista de tareas a realizar
    
    Texto:
    ${text}`;

    // Llamar a OpenAI con fetch
    const gptResponse = await fetch('https://api.openai.com/v1/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'text-davinci-003',
        prompt,
        max_tokens: 800,
        temperature: 0.7
      })
    });

    const gptData = await gptResponse.json();

    if (!gptData.choices || !gptData.choices.length) {
      throw new Error('GPT no devolvió texto');
    }
    const gptText = gptData.choices[0].text.trim();

    console.log('Respuesta de GPT recibida.');
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        rawGPT: gptText
      })
    };
  } catch (error) {
    console.error('Error en processDoc:', error.message, error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    };
  }
};
