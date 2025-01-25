// netlify/functions/processDoc.js
// =================================

const { google } = require('googleapis');
const pdfParse = require('pdf-parse'); // Asegúrate de tener "pdf-parse": "^1.1.1" en tu package.json

exports.handler = async (event, context) => {
  try {
    // 1. Obtener el fileId de la querystring (por ej: ?fileId=abcdefg)
    const fileId = event.queryStringParameters.fileId;
    if (!fileId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'No se recibió "fileId" en la URL',
        }),
      };
    }

    // 2. Cargar credenciales de la variable de entorno
    //    (GOOGLE_SERVICE_ACCOUNT_JSON debe contener el JSON de tu Service Account)
    const serviceAccountJSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJSON) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: 'Falta la variable de entorno GOOGLE_SERVICE_ACCOUNT_JSON en Netlify.',
        }),
      };
    }

    let credentials;
    try {
      credentials = JSON.parse(serviceAccountJSON);
    } catch (parseErr) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: 'No se pudo parsear GOOGLE_SERVICE_ACCOUNT_JSON. Revisar comillas o formato.',
          details: parseErr.message,
        }),
      };
    }

    // 3. Autenticar con Google Drive usando googleapis
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const drive = google.drive({ version: 'v3', auth });

    // 4. Descargar el contenido del PDF (alt: 'media')
    let fileData;
    try {
      const response = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' } // Importante para obtener datos binarios
      );
      fileData = response.data;
    } catch (downloadErr) {
      // Podría ser un 403 (Forbidden) si no hay permisos, o 404 si no existe el fileId
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: 'Error al descargar el PDF desde Drive.',
          details: downloadErr.message,
        }),
      };
    }

    // 5. Convertir el arraybuffer a Buffer
    const buffer = Buffer.from(fileData);

    // 6. Log para ver el tamaño del PDF en bytes
    console.log('>> processDoc.js: buffer.length =', buffer.length);

    // Opcional: si quieres mandar ese valor en la respuesta
    if (buffer.length === 0) {
      // Indica que no llegó contenido
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          error: 'El archivo descargado está vacío (0 bytes). Revisa permisos o fileId.',
        }),
      };
    }

    // 7. Parsear el PDF con pdf-parse
    let parsedPDF;
    try {
      parsedPDF = await pdfParse(buffer);
    } catch (parseErr) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: 'pdf-parse arrojó un error (posible PDF corrupto o no estándar).',
          details: parseErr.message,
        }),
      };
    }

    // 8. Extraemos algo de información del PDF
    const extractedText = parsedPDF.text || '';
    const textLength = extractedText.length;

    // (Opcional) Aquí podrías llamar a GPT con extractedText si ya tienes la lógica
    // const gptResponse = await callGPT_API({ prompt: extractedText });
    // ...

    // 9. Retornar un JSON con info útil
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        bufferLength: buffer.length,
        textLength: textLength,
        // excerpt: un recorte de texto, si gustas
        excerpt: extractedText.slice(0, 200), // Por ejemplo, los primeros 200 chars
        // rawGPT: gptResponse,
      }),
    };
  } catch (err) {
    // Cualquier otro error no controlado cae aquí
    console.error('>> processDoc.js: catch global error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Error inesperado en processDoc.js',
        details: err.message,
      }),
    };
  }
};
