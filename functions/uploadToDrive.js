const { google } = require('googleapis');
const { PassThrough } = require('stream');

exports.handler = async (event) => {
  try {
    // Solo aceptamos método POST
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: 'Método no permitido (usa POST).'
      };
    }

    // Parseamos el body JSON
    const { filename, fileContent } = JSON.parse(event.body || '{}');
    if (!filename || !fileContent) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Faltan parámetros'
        })
      };
    }

    // Autenticarnos con la Service Account
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    const drive = google.drive({ version: 'v3', auth });

    // Convertir la cadena base64 en un buffer
    const buffer = Buffer.from(fileContent, 'base64');

    // Creamos un Stream a partir del buffer
    const pass = new PassThrough();
    pass.end(buffer);

    // Armamos la metadata (requestBody)
    const requestBody = {
      name: filename
    };
    // Si definimos carpeta en variable de entorno, la usamos
    if (process.env.GOOGLE_FOLDER_ID) {
      requestBody.parents = [process.env.GOOGLE_FOLDER_ID];
    }

    // Creamos el objeto 'media' con mimeType y el stream
    const media = {
      mimeType: 'application/pdf',
      body: pass
    };

    // Hacemos la llamada a drive.files.create con un segundo argumento “params”
    // forzando uploadType: 'media' para evitar multipart
    const response = await drive.files.create(
      {
        requestBody,
        media,
        fields: 'id, webViewLink'
      },
      {
        params: {
          uploadType: 'media'
        }
      }
    );

    // Obtenemos ID y link
    const fileId = response.data.id;
    const webViewLink = response.data.webViewLink || '';

    // Devolvemos éxito
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        fileId,
        viewLink: webViewLink
      })
    };
  } catch (error) {
    console.error('Error subiendo archivo:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
