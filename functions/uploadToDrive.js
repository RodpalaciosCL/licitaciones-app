const { google } = require('googleapis');

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

    // Autenticarnos con Drive usando Service Account
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    const drive = google.drive({ version: 'v3', auth });

    // Convertir base64 a buffer
    const buffer = Buffer.from(fileContent, 'base64');

    // Metadata del archivo
    const fileMetadata = { name: filename };
    // Si definimos un "GOOGLE_FOLDER_ID" en Netlify, lo utilizamos:
    if (process.env.GOOGLE_FOLDER_ID) {
      fileMetadata.parents = [process.env.GOOGLE_FOLDER_ID];
    }

    // Asumimos que es PDF
    const media = {
      mimeType: 'application/pdf',
      body: buffer
    };

    // Subir el archivo a Drive
    const response = await drive.files.create({
      resource: fileMetadata,
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
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
