import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';

import { Readable, Transform } from 'node:stream';
import { WritableStream, TransformStream} from 'node:stream/web';
import { setTimeout } from 'node:timers/promises'; // ele é async e await
import csvtojson from 'csvtojson';

const PORT = 3000;
createServer((req, res) => {
  // curl -i -X OPTIONS http://localhost:3000 aqui ele vai trazer as informações do OPTIONS
  // curl -N OPTIONS http://localhost:3000 aqui ele só vai executar o OPTIONS
  //CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': '*',
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  let items = 0;
  req.once('close', _  => console.log('Request closed', items)); // quando o cliente fechar a conexão

  Readable.toWeb(createReadStream('./animeflv.csv')) // transforma o stream em um stream web
  // o passo a passo que cada arquivo vai trafegar antes de chegar no cliente
  .pipeThrough(Transform.toWeb(csvtojson())) // transforma o arquivo em json ele vem como NDJSON. Transform.toWeb() transforma o stream em um stream web
  .pipeThrough(new TransformStream({
    transform(chunk, controller) { // chunk é um objeto do arquivo. Controller é usado pra mandar informações pra frente.
      items++;
      const data = JSON.parse(Buffer.from(chunk)); // transforma o chunk em um objeto
      const mappedData = {
        title: data.title,
        description: data.description,
        url_anime: data.url_anime,
      }
      // quebra de linha poque é um arquivo NDJSON
      controller.enqueue(JSON.stringify(mappedData).concat('\n')); // manda o chunk para frente e sempre é boa pratica manter a quebra de linha.
      // voce manda item a cada 1000sec, quando o browser chegar e não conseguir ler o arquivo ele vai esperar e mandar tudo de uma vez.
    }
  }))
  .pipeTo(new WritableStream({
    async write(chunk) { // chunk é um buffer pedaço do arquivo
      await setTimeout(200); // espera 1 segundo para mandar o próximo pedaço do arquivo
      items++;
      res.write(chunk);
    },
    close() {
      res.end(); // fecha a conexão quando terminar de ler o arquivo
    },
    abort(err) {
      console.error(err);
      res.writeHead(500);
      res.end();
    }
  }));

  res.writeHead(200, headers); // deixar para manipulação do CORS depois
}).listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});