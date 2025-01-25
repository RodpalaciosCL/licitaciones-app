const { google } = require('googleapis');
const { PassThrough } = require('stream');

exports.handler = async (event, context) => {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: 'Método no permitido (usa POST).'
      };
    }

    const { filename, fileContent } = JSON.parse(event.body || '{}');
    if (!filename || !fileContent) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Faltan parámetros' })
      };
    }

    // Autenticar con Service Account
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    const drive = google.drive({ version: 'v3', auth });

    // Convertir base64 a Buffer
    const buffer = Buffer.from(fileContent, 'base64');

    // Crear un Stream a partir del buffer
    const pass = new PassThrough();
    pass.end(buffer);

    // Configurar metadata
    const requestBody = { name: filename };
    if (process.env.GOOGLE_FOLDER_ID) {
      requestBody.parents = [process.env.GOOGLE_FOLDER_ID];
    }

    // Definir media con body = nuestro stream
    const media = {
      mimeType: 'application/pdf',
      body: pass
    };

    // Subir a Drive
    const response = await drive.files.create({
      requestBody,
      media,
      fields: 'id, webViewLink'
    });

    const fileId = response.data.id;
    const webViewLink = response.data.webViewLink;

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
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
