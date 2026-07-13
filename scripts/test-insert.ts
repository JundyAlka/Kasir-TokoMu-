import pg from 'pg';
const { Client } = pg;

const localUrl = 'postgres://postgres:postgres@localhost:5439/warungos';

async function checkEncoding() {
  const client = new Client({ connectionString: localUrl });
  try {
    await client.connect();
    
    const dbRes = await client.query("SELECT datname, pg_encoding_to_char(encoding) as encoding FROM pg_database WHERE datname = 'warungos'");
    console.log("Database encoding:", dbRes.rows[0]);
    
    const clientRes = await client.query("SHOW client_encoding");
    console.log("Client encoding:", clientRes.rows[0]);
    
    const serverRes = await client.query("SHOW server_encoding");
    console.log("Server encoding:", serverRes.rows[0]);
    
    await client.end();
  } catch (err) {
    console.error(err);
  }
}

checkEncoding();
