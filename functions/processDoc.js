const { google } = require('googleapis');
const fetch = require('node-fetch');
const pdf = require('pdf-parse'); // Librería para procesar PDFs

exports.handler = async (event) => {
  console.log('Invocando processDoc...');
  try {
    if (event.httpMethod !== 'POST') {
      console.log('Método no permitido');
      return {
        statusCode: 405,
        body: 'Método no permitido, usa POST.'
      };
    }

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

    // Descargar el archivo desde Drive
    console.log('Descargando archivo desde Google Drive...');
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' } // Descargar como ArrayBuffer
    );

    console.log('Archivo descargado con éxito.');

    const arrayBuffer = response.data;

    // Procesar el archivo PDF con pdf-parse
    console.log('Procesando el PDF con pdf-parse...');
    const pdfData = await pdf(Buffer.from(arrayBuffer));
    const text = pdfData.text;

    console.log('Texto extraído del PDF:');
    console.log(text);

    // Enviar el texto a OpenAI
    console.log('Enviando el texto extraído a OpenAI...');
    const prompt = `Analiza este texto de licitación y devuélveme:
    - Resumen
    - Aspectos clave
    - Documentación necesaria
    - Fechas y montos importantes
    - Lista de tareas a realizar
    
    Texto:
    ${text}`;

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
    console.error('Error detallado en processDoc:', error.message, error.stack);
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
