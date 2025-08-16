import express from 'express';
import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';

console.log('Server script starting...');

try {
    console.log('Loading environment variables...');
    dotenv.config();
    console.log('.env file loaded.');

    if (!process.env.FTP_HOST || !process.env.FTP_USER || !process.env.FTP_PASSWORD) {
        console.error('Error: Missing one or more required FTP credentials in .env file.');
        process.exit(1);
    }
    console.log('FTP credentials found in environment variables.');

    const app = express();
    const port = 3001;

    const ftpConfig = {
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD,
        secure: 'implicit',
    };
    console.log('FTP config object created.');

    // Endpoint to list files in the specified directory
    app.get('/api/ftp/files', async (req, res) => {
        const client = new ftp.Client();
        try {
            await client.access(ftpConfig);
            await client.cd('/Gamma_Product_Files/Shopify_Files/');
            const files = await client.list();
            const fileNames = files
                .filter(file => file.type === ftp.FileType.File && file.name.toLowerCase().endsWith('.csv'))
                .map(file => file.name);
            res.json(fileNames);
        } catch (err) {
            console.error('FTP Error:', err);
            const message = err instanceof Error ? err.message : 'An unknown FTP error occurred.';
            res.status(500).json({ error: 'Failed to list FTP files.', details: message });
        } finally {
            client.close();
        }
    });

    // Endpoint to get the content of a specific file
    app.get('/api/ftp/file', async (req, res) => {
        const fileName = req.query.name as string;
        if (!fileName) {
            return res.status(400).json({ error: 'File name is required.' });
        }

        const client = new ftp.Client();
        try {
            await client.access(ftpConfig);
            await client.cd('/Gamma_Product_Files/Shopify_Files/');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            await client.downloadTo(res, fileName);

        } catch (err) {
            console.error('FTP Error:', err);
            const message = err instanceof Error ? err.message : 'An unknown FTP error occurred.';
            res.status(500).json({ error: `Failed to download file: ${fileName}`, details: message });
        } finally {
            client.close();
        }
    });

    app.listen(port, () => {
        console.log(`Server listening at http://localhost:${port}`);
    });
    console.log('Express app configured and starting to listen.');

} catch (e) {
    console.error('A critical error occurred during server startup:');
    console.error(e);
    process.exit(1);
}
