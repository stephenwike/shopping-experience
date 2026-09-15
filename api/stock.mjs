import { list, put } from '@vercel/blob';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const STOCK_PATHNAME = 'stock.json';
// Vercel's deployed functions have a read-only filesystem, so only use the local file
// when actually running outside Vercel (e.g. `vite` alone, not `vercel dev`/deployed).
const LOCAL_STOCK_FILE = path.join(process.cwd(), '.local-stock.json');
const useLocalFallback = !process.env.VERCEL;

async function readStock() {
  if (useLocalFallback) {
    try {
      return JSON.parse(await readFile(LOCAL_STOCK_FILE, 'utf8'));
    } catch {
      return {};
    }
  }

  const { blobs } = await list({ prefix: STOCK_PATHNAME, limit: 1 });
  const blob = blobs.find((entry) => entry.pathname === STOCK_PATHNAME);
  if (!blob) return {};

  const response = await fetch(blob.url);
  return response.ok ? response.json() : {};
}

async function writeStock(overrides) {
  if (useLocalFallback) {
    await writeFile(LOCAL_STOCK_FILE, JSON.stringify(overrides));
    return;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('No Blob store is connected to this project yet. Add one in the Vercel dashboard Storage tab.');
  }

  // allowOverwrite keeps the pathname stable so readers don't need to track blob URLs.
  await put(STOCK_PATHNAME, JSON.stringify(overrides), {
    access: 'public',
    contentType: 'application/json',
    allowOverwrite: true,
  });
}

function isValidOverrides(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every((quantity) => Number.isInteger(quantity) && quantity >= 0)
  );
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const overrides = await readStock();
    res.status(200).json({ overrides });
    return;
  }

  if (req.method === 'POST') {
    const overrides = req.body;
    if (!isValidOverrides(overrides)) {
      res.status(400).json({ error: 'Expected an object of item id to non-negative integer quantity.' });
      return;
    }

    try {
      await writeStock(overrides);
    } catch (error) {
      console.error('Failed to save stock', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ overrides });
    return;
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).json({ error: 'Method not allowed' });
}
