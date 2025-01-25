// netlify/functions/processDoc.js
// 1) Descarga el PDF desde Drive
// 2) Verifica el tamaño del buffer y lo loguea
// 3) Llama a pdf-parse con el buffer
// 4) Envía el texto a GPT

const { google } = require('googleapis');
const fetch = require('node-fetch');
const pdfParse = require('pdf-parse');

exports.handler = async (event) => {
  try {
    // Aceptar solo POST
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed, use POST.' })
      };
    }

    // 1. Leer el fileId desde el body
    const { fileId } = JSON.parse(event.body || '{}');
    if (!fileId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Falta fileId en el body'
        })
      };
    }
    console.log('[processDoc] Recibido fileId:', fileId);

    // 2. Autenticación con Google
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    const drive = google.drive({ version: 'v3', auth });

    // 3. Descargar el PDF desde Drive
    console.log('[processDoc] Descargando PDF de Drive...');
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    // 4. Convertir a Buffer y loguear su tamaño
    const pdfBuffer = Buffer.from(response.data);
    console.log('[processDoc] pdfBuffer length:', pdfBuffer.length);

    if (pdfBuffer.length < 200) {
      console.log(
        '[processDoc] WARNING: El PDF descargado parece muy pequeño (o vacío). ' +
        'Podría causar error en pdf-parse.'
      );
    }

    // 5. Parsear con pdf-parse
    console.log('[processDoc] Parseando PDF con pdf-parse...');
    const pdfData = await pdfParse(pdfBuffer);

    // Loguea algunas claves del objeto pdfData
    console.log('[processDoc] pdf-parse result keys:', Object.keys(pdfData));

    const text = pdfData.text;
    console.log('[processDoc] Longitud del texto extraído:', text.length);

    // 6. Llamar a OpenAI
    console.log('[processDoc] Llamando a OpenAI...');
    const prompt = `
      Analiza este texto de licitación y devuélveme:
      - Resumen
      - Aspectos clave
      - Documentación necesaria
      - Fechas y montos importantes
      - Lista de tareas a realizar

      Texto:
      ${text}
    `;

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
      throw new Error('OpenAI no devolvió texto');
    }
    const gptText = gptData.choices[0].text.trim();

    console.log('[processDoc] Respuesta de GPT obtenida con éxito.');

    // 7. Retornar el resultado
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        rawGPT: gptText
      })
    };
  } catch (error) {
    console.error('Error en processDoc:', error);
    // Inyectar stacktrace en la respuesta para verlo en consola
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
