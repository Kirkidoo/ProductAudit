import express from 'express';
import * as ftp from 'basic-ftp';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 3001; // Using a different port than the frontend dev server

const ftpConfig = {
    host: process.env.FTP_HOST,
    user: process.env.FTP_USER,
    password: process.env.FTP_PASSWORD,
    secure: true, // Use 'implicit' or true for FTPS
};

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
