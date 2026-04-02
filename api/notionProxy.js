export default async function handler(req, res) {
  // Configurações de CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Notion-Version, Authorization'
  );

  // Responde imediatamente a requisições OPTIONS (Preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // URL format in vercel will give us req.url like /api/notion/databases/... or req.query for the rewrite
    // It's safer to extract the Notion path by replacing /api/notion
    const path = req.url.replace(/^\/api\/notion/, '');
    
    const targetUrl = `https://api.notion.com/v1${path}`;

    console.log(`Proxying request to: ${targetUrl}`);

    const options = {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${process.env.VITE_NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
    };

    // Repassa o corpo da requisição se existir
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      // O Vercel já faz o parse do JSON do body para rotas API se o Content-Type for application/json
      options.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const notionResponse = await fetch(targetUrl, options);
    
    // Ler a resposta
    const data = await notionResponse.text(); // lê como texto pra tratar JSON
    
    let parsedData;
    try {
      parsedData = JSON.parse(data);
    } catch(e) {
      parsedData = data;
    }

    res.status(notionResponse.status).json(parsedData);
  } catch (error) {
    console.error('Error in proxy:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
