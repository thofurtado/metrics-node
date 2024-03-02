console.log('teste')
async function teste(loop: number) {
    const tabela = []
    for(let i=0; i< loop-1; i++) {
        tabela.push({
            name: `name${i}`,
            number: '1',
            letter: 'a'
        })

    }


    const resultado = await tabela.filter((tabela) => tabela.letter === 'a').slice(1,3)
    console.log(resultado)
}

teste(20)
