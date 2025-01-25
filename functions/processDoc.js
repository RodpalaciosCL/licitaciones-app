// functions/processDoc.js

const { google } = require('googleapis');
const fetch = require('node-fetch'); // usamos node-fetch para llamadas HTTP

exports.handler = async (event) => {
  try {
    // Aceptamos solo POST
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: 'Método no permitido, usa POST'
      };
    }

    // Recibimos { fileId }
    const { fileId } = JSON.parse(event.body || '{}');
    if (!fileId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Falta fileId'
        })
      };
    }

    // 1) Autenticar con Drive
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    const drive = google.drive({ version: 'v3', auth });

    // 2) Exportar el PDF a texto
    //    Esto SÓLO funciona bien si el PDF es "nativo" (no escaneado).
    //    https://developers.google.com/drive/api/v3/reference/files/export
    const res = await drive.files.export(
      { fileId, mimeType: 'text/plain' },
      { responseType: 'arraybuffer' }
    );
    const arrayBuffer = res.data;
    // Convertimos el ArrayBuffer a string (texto)
    const text = Buffer.from(arrayBuffer).toString('utf-8');

    // 3) Llamar a la API de OpenAI
    //    Usamos process.env.OPENAI_API_KEY
    //    Modelo: text-davinci-003 (puedes cambiar a gpt-3.5-turbo con otro endpoint)
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

    // 4) Devolver la respuesta de GPT
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        rawGPT: gptText
      })
    };
  } catch (error) {
    console.error('Error en processDoc:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
