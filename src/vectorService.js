// vectorService.js - For your React/Node.js backend
import MiniVectorDatabase from 'mcp-store-db';

const db = new MiniVectorDatabase({
  location: './vector-data',
  name: 'nexus-knowledge',
  chunkConfiguration: {
    overlap: 0,
    size: 500,
    separators: ['\n\n', '\n', '. ', ' '],
  },
  vectorConfigurations: {   
    searchLimit: 5,
    model: 'Xenova/all-MiniLM-L6-v2',
  },
});

// Initialize and load CSV
await db.init();

// Ingest CSV file directly
const docId = await db.ingest('./data/your-knowledge-base.csv');

// Search from your API
app.post('/api/search', async (req, res) => {
  const results = await db.query(req.body.query);
  res.json(results);
});