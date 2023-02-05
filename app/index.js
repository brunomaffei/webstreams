const API_URL = 'http://localhost:3000';
let counter = 0;
let currentPosition = 0; // posição do arquivo que o cliente está lendo

async function consumeAPI(signal, position) {
  const response = await fetch(API_URL, {
    signal
  });
  const reader = response.body
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(parseNDJSON())

  return reader;
}

function appendToHTML(element) {
    return new WritableStream({
      write({ title, description, url_anime}) {
        const card = `
        <article>
          <div class="text">
            <h3>[${++counter}] ${title}</h3>
            <p>${description.slice(0, 100)}</p>
            <a href="${url_anime}"> Here's why</a>
          </div>
        </article>
        `
        element.innerHTML += card
      },
      abort(reason) {
        console.log('aborted**', reason)
      }
    })
  }

// Essa função vai se certificar caso 2 chunks chegue em uma unica transmição converta corretamente para um JSON.
// dado: {}\n{}
// deve
//      {}
//      {}

function parseNDJSON() {
    let ndjsonBuffer = ''
    return new TransformStream({
      transform(chunk, controller) { // chunk é um objeto do arquivo. Controller é usado pra mandar informações pra frente.
        ndjsonBuffer += chunk //agrupado os dados que corresponde ao mesmo item;
        const items = ndjsonBuffer.split('\n') // quebra de linha poque é um arquivo NDJSON
        items.slice(0, -1) // pega o ultimo item do array e remove ele do array
          .forEach(item => controller.enqueue(JSON.parse(item))) // manda o chunk para frente e sempre é boa pratica manter a quebra de linha.
        ndjsonBuffer = items[items.length -1] // pega o ultimo item do array e remove ele do array
      },
      flush(controller)  { // quando o stream terminar de ler o arquivo
        if(!ndjsonBuffer) return; // se não tiver nada no buffer ele não faz nada
        controller.enqueue(JSON.parse(ndjsonBuffer)) // se tiver algo no buffer ele manda o ultimo item
      }
    })
  }

const [
    start,
    stop,
    cards
  ] = ['start', 'stop', 'cards'].map(item => document.getElementById(item))


  let abortController = new AbortController()
  start.addEventListener('click', async () => {
    try {
      const readable = await consumeAPI(abortController.signal, currentPosition)
      // add signal and await to handle the abortError exception after abortion
      await readable.pipeTo(appendToHTML(cards), { signal: abortController.signal })
    } catch (error) {
      if (!error.message.includes('abort')) throw error
    }
  })
  
  stop.addEventListener('click', () => {
      abortController.abort()
      console.log('aborting...')
    abortController = new AbortController() // aqui ele reseta o abortController
    currentPosition = counter;
  })