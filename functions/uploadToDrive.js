const { google } = require('googleapis');
const { PassThrough } = require('stream');

exports.handler = async (event) => {
  console.log('Invocando uploadToDrive...');
  try {
    if (event.httpMethod !== 'POST') {
      console.log('Método no permitido');
      return {
        statusCode: 405,
        body: 'Método no permitido, usa POST.'
      };
    }

    const { filename, fileContent } = JSON.parse(event.body || '{}');
    if (!filename || !fileContent) {
      console.log('Faltan parámetros: filename o fileContent');
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Faltan parámetros (filename o fileContent).'
        })
      };
    }

    console.log(`Recibido archivo: ${filename}`);

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive']
    });

    const drive = google.drive({ version: 'v3', auth });

    const buffer = Buffer.from(fileContent, 'base64');
    const pass = new PassThrough();
    pass.end(buffer);

    const requestBody = { name: filename };
    if (process.env.GOOGLE_FOLDER_ID) {
      requestBody.parents = [process.env.GOOGLE_FOLDER_ID];
    }

    const media = {
      mimeType: 'application/pdf',
      body: pass
    };

    console.log('Subiendo archivo a Google Drive...');
    const response = await drive.files.create({
      requestBody,
      media,
      fields: 'id, webViewLink'
    }, {
      params: { uploadType: 'media' }
    });

    console.log('Archivo subido exitosamente.');
    const fileId = response.data.id;
    const webViewLink = response.data.webViewLink;

    console.log('Haciendo público el archivo...');
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    console.log(`Archivo público: ${webViewLink}`);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        fileId,
        viewLink: webViewLink
      })
    };
  } catch (error) {
    console.error('Error detallado en uploadToDrive:', error);
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
