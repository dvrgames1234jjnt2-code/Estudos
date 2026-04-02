/**
 * Vercel Serverless Function: Notion API Proxy
 * Proxies all requests from /api/notion/* to https://api.notion.com/v1/*
 * This is required because Vercel's free tier doesn't support external URL rewrites.
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Notion-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Build the target Notion URL
  const pathSegments = req.query.path || [];
  const notionPath = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments;
  const notionUrl = `https://api.notion.com/v1/${notionPath}`;

  const headers = {
    'Authorization': `Bearer ${process.env.VITE_NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  const fetchOptions = {
    method: req.method,
    headers,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    fetchOptions.body = JSON.stringify(req.body);
  }

  try {
    const response = await fetch(notionUrl, fetchOptions);
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Notion proxy error:', error);
    return res.status(500).json({ error: error.message });
  }
}
