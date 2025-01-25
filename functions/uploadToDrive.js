const { google } = require('googleapis');

exports.handler = async (event) => {
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
        body: JSON.stringify({
          success: false,
          error: 'Faltan parámetros'
        })
      };
    }

    // Autenticar con la Service Account
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    const drive = google.drive({ version: 'v3', auth });

    // Convertir base64 a Buffer
    const buffer = Buffer.from(fileContent, 'base64');

    // Crear metadata del archivo
    const requestBody = { name: filename };
    if (process.env.GOOGLE_FOLDER_ID) {
      requestBody.parents = [process.env.GOOGLE_FOLDER_ID];
    }

    const media = {
      mimeType: 'application/pdf',
      body: buffer
    };

    // Subir el archivo a Drive
    const response = await drive.files.create({
      requestBody,
      media,
      fields: 'id, webViewLink'
    });

    const fileId = response.data.id;
    const webViewLink = response.data.webViewLink;

    // HACER EL ARCHIVO PÚBLICO
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',  // Permitir solo lectura
        type: 'anyone'   // Hacerlo accesible a cualquiera con el link
      }
    });

    // Opcional: Compartir con un correo específico
    // await drive.permissions.create({
    //   fileId,
    //   requestBody: {
    //     role: 'reader',        // Solo lectura
    //     type: 'user',          // Usuario específico
    //     emailAddress: 'white.and.white@gmail.com' // Cambia este correo si lo necesitas
    //   }
    // });

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
