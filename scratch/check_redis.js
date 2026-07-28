const https = require('https');

const url = "https://mighty-sturgeon-28585.upstash.io/get/caixa_data_v1";
const token = "AW-pAAIncDFiMzNmNjFkNTNjY2E0MzY5YWIyYTQyYjcyOWZlNzgwYXAxMjg1ODU";

const options = {
  headers: {
    Authorization: `Bearer ${token}`
  }
};

https.get(url, options, (res) => {
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    try {
      if (res.statusCode !== 200) {
        console.error("Erro na resposta do Redis:", res.statusCode, body);
        return;
      }
      
      const data = JSON.parse(body);
      const rawResult = data.result;
      let lotes = [];
      
      if (typeof rawResult === 'string') {
        lotes = JSON.parse(rawResult);
      } else {
        lotes = rawResult;
      }
      
      console.log("Total de lotes no Redis:", lotes.length);
      
      // Buscar em todos os lotes os lançamentos com valor 101.64 ou 183.75
      const matches = [];
      for (const lote of lotes) {
        const lancs = lote.lancamentos || [];
        for (const lan of lancs) {
          const valor = Number(lan.valor || 0);
          if (valor === 101.64 || valor === 183.75 || valor === 389.07 || valor === 7.90 || valor === 205.00 || valor === 848.67) {
            matches.push({
              loteDate: lote.dataReferencia,
              lotePeriodo: lote.periodo,
              loteId: lote.id,
              lancamento: lan
            });
          }
        }
      }
      
      console.log(`\nEncontrou ${matches.length} lançamentos correspondentes no Redis:`);
      console.log(JSON.stringify(matches, null, 2));
      
    } catch (e) {
      console.error("Erro ao analisar JSON:", e.message);
    }
  });
}).on('error', (err) => {
  console.error("Erro na requisição:", err.message);
});
