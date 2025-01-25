const { google } = require('googleapis');
const pdfParse = require('pdf-parse'); // Asegúrate de tener "pdf-parse": "^1.1.1" en tu package.json

exports.handler = async (event, context) => {
  try {
    // 1. Obtener el fileId de la querystring (por ej: ?fileId=xxxxxx)
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

    // 2. Log para verificar el fileId recibido
    console.log('>> processDoc.js: fileId recibido:', fileId);

    // 3. Cargar credenciales de la variable de entorno
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

    // 4. Autenticar con Google Drive usando googleapis
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const drive = google.drive({ version: 'v3', auth });

    // 5. Descargar el contenido del PDF (alt: 'media')
    let fileData;
    try {
      const response = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' } // Importante para obtener datos binarios
      );
      fileData = response.data;
    } catch (downloadErr) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          error: 'Error al descargar el PDF desde Drive.',
          details: downloadErr.message,
        }),
      };
    }

    // 6. Convertir el arraybuffer a Buffer
    const buffer = Buffer.from(fileData);

    // 7. Log para ver el tamaño del PDF en bytes
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

    // 8. Parsear el PDF con pdf-parse
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

    // 9. Extraemos algo de información del PDF
    const extractedText = parsedPDF.text || '';
    const textLength = extractedText.length;

    // 10. Retornar un JSON con info útil
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        bufferLength: buffer.length,
        textLength: textLength,
        excerpt: extractedText.slice(0, 200), // Los primeros 200 caracteres del texto extraído
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
