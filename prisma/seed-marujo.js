"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const payload = [
    {
        "category": "Bebidas Não Alcoólicas",
        "products": [
            { "name": "Green Limonade", "price": 29.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Blue Limonade", "price": 29.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Água com gás", "price": 7.50, "description": "", "measureUnit": "UNITARY" },
            { "name": "Pink Lemonade", "price": 29.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Água sem gás", "price": 7.50, "description": "", "measureUnit": "UNITARY" },
            { "name": "Refrigerante", "price": 8.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Energético Red Bull", "price": 18.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Água Tônica", "price": 8.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Schweppes Citrus", "price": 9.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Del Valle", "price": 9.90, "description": "", "measureUnit": "UNITARY" }
        ]
    },
    {
        "category": "Café",
        "products": [
            { "name": "Café Expresso", "price": 7.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Café com Leite Pequeno", "price": 8.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Café com Leite Médio", "price": 10.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Capuccino Médio", "price": 16.90, "description": "", "measureUnit": "UNITARY" }
        ]
    },
    {
        "category": "Sucos",
        "products": [
            { "name": "Suco de Laranja", "price": 19.90, "description": "Natural", "measureUnit": "UNITARY" },
            { "name": "Suco de Limão", "price": 17.90, "description": "Natural", "measureUnit": "UNITARY" },
            { "name": "Limonada Suíça", "price": 22.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Suco de Abacaxi com Hortelã", "price": 19.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Suco de Maracujá", "price": 19.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Suco de Acerola", "price": 19.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Suco de Morango", "price": 19.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Suco de Frutas Vermelhas", "price": 21.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Suco de Manga", "price": 19.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Suco de Pitaya", "price": 19.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Suco de Abacaxi", "price": 19.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Suco de Amora", "price": 19.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Jarra de Suco 1,3L", "price": 76.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Adicional de frutas", "price": 6.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Adicional de leite", "price": 6.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Adicional de Leite Condensado", "price": 6.00, "description": "", "measureUnit": "UNITARY" }
        ]
    },
    {
        "category": "Cervejas e Chopp",
        "products": [
            { "name": "Petra 600ml", "price": 16.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Serramalte 600ml", "price": 22.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Stella Artois", "price": 14.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Budweiser", "price": 13.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Corona 600ml", "price": 24.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Corona Long Neck", "price": 14.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Heineken 600ml", "price": 24.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Heineken Long Neck", "price": 14.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Original", "price": 21.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Amstel", "price": 17.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Therezópolis 600ml", "price": 17.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Chopp Pilsen 300ml", "price": 15.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Chopp Pilsen 600ml", "price": 24.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Chopp Artesanal IPA Dortmund 300ml", "price": 21.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Chopp Artesanal IPA Dortmund 600ml", "price": 34.90, "description": "", "measureUnit": "UNITARY" }
        ]
    },
    {
        "category": "Cervejas Artesanais",
        "products": [
            { "name": "Pils", "price": 32.90, "description": "Pilsen", "measureUnit": "UNITARY" },
            { "name": "Linderhof", "price": 38.90, "description": "Weissbier", "measureUnit": "UNITARY" },
            { "name": "Schloss", "price": 37.00, "description": "Weissbier", "measureUnit": "UNITARY" },
            { "name": "Nostradamus", "price": 37.00, "description": "Stout", "measureUnit": "UNITARY" },
            { "name": "Red rose", "price": 37.00, "description": "Red ale", "measureUnit": "UNITARY" },
            { "name": "Old ship", "price": 41.90, "description": "Ipa", "measureUnit": "UNITARY" },
            { "name": "Old plane", "price": 43.90, "description": "American ipa", "measureUnit": "UNITARY" },
            { "name": "Hopfen", "price": 46.90, "description": "Imperial ipa", "measureUnit": "UNITARY" },
            { "name": "Session", "price": 44.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "The White", "price": 44.90, "description": "Witebier", "measureUnit": "UNITARY" }
        ]
    },
    {
        "category": "Drinks, Doses & Coquetéis",
        "products": [
            { "name": "Caipirinha", "price": 31.90, "description": "Vários sabores", "measureUnit": "UNITARY" },
            { "name": "Saquê SOFT", "price": 31.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Saquê dourado", "price": 33.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Cachaça especial", "price": 38.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Vodka nacional", "price": 34.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Vodka importada", "price": 48.90, "description": "Ciroc ou Grey Goose", "measureUnit": "UNITARY" },
            { "name": "Green Label", "price": 75.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Gold Label", "price": 52.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Blue Label", "price": 189.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Licor 43", "price": 28.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Red Label", "price": 22.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Black Label", "price": 29.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Cosmopolitan", "price": 38.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Fitzgerald", "price": 34.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Mestre dos mares", "price": 35.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Gin tropical com espuma de gengibre", "price": 36.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Aperol", "price": 42.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Gin tônica nacional", "price": 34.90, "description": "Gin, água tônica e sabor", "measureUnit": "UNITARY" },
            { "name": "Gin tônica importado", "price": 38.90, "description": "Gin importado, água tônica e sabor", "measureUnit": "UNITARY" },
            { "name": "Negroni", "price": 38.00, "description": "Campari, Martini Rojo e rodela de laranja", "measureUnit": "UNITARY" },
            { "name": "Sex on the beach", "price": 38.00, "description": "Vodca, licor de pêssego, suco de laranja e groselha", "measureUnit": "UNITARY" },
            { "name": "Mojito", "price": 32.90, "description": "Rum branco, açúcar, suco de limão, hortelã e água com gás", "measureUnit": "UNITARY" },
            { "name": "Cuba libre", "price": 31.90, "description": "Rum ouro, limão taiti e coca cola", "measureUnit": "UNITARY" },
            { "name": "Marujo Drink", "price": 39.00, "description": "Sorvete de creme, Leite condensado, rum ouro, Amarula", "measureUnit": "UNITARY" },
            { "name": "Pinã colada", "price": 35.00, "description": "Rum branco, leite condensado, leite de coco e coco ralado", "measureUnit": "UNITARY" },
            { "name": "Espanhola", "price": 32.90, "description": "Abacaxi ou morango, vinho tinto, calda e leite condensado", "measureUnit": "UNITARY" },
            { "name": "Margarita", "price": 37.90, "description": "Tequila, limão, licor de pêssego e sal", "measureUnit": "UNITARY" },
            { "name": "Moscow mule", "price": 39.00, "description": "Vodka, infusão de limão e espuma de gengibre", "measureUnit": "UNITARY" }
        ]
    },
    {
        "category": "Entradas e Saladas",
        "products": [
            { "name": "Couvert", "price": 44.00, "description": "Cesta de pães e 3 patês", "measureUnit": "UNITARY" },
            { "name": "Casquinha de Siri", "price": 54.00, "description": "Carne de siri gratinada com parmesão", "measureUnit": "UNITARY" },
            { "name": "Ostras (8 un)", "price": 74.00, "description": "Ostravagante", "measureUnit": "UNITARY" },
            { "name": "Ceviche", "price": 92.00, "description": "Salmão ou peixe branco 250g", "measureUnit": "UNITARY" },
            { "name": "Coquetel de Camarão", "price": 134.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Salada de Palmito", "price": 74.00, "description": "Palmito palmeira real", "measureUnit": "UNITARY" },
            { "name": "Salada Simples", "price": 48.00, "description": "Alface, tomate, cebola e pepino", "measureUnit": "UNITARY" },
            { "name": "Salada Mista", "price": 59.90, "description": "Alface, tomate, cebola, pepino, rúcula, agrião, palmito, ervilha e azeitona", "measureUnit": "UNITARY" },
            { "name": "Salada Completa", "price": 78.00, "description": "Alface, tomate, cebola, pepino, rúcula, agrião, palmito, ervilha, azeitona, chuchu, ovo e cenoura", "measureUnit": "UNITARY" },
            { "name": "Salada Caesar", "price": 76.00, "description": "Alface, frango desfiado, parmesão, croutons e molho", "measureUnit": "UNITARY" },
            { "name": "Maionese de legumes", "price": 64.00, "description": "Batata, cenoura, vagem, ovo e maionese", "measureUnit": "UNITARY" },
            { "name": "Maionese de camarão sete barbas", "price": 99.00, "description": "Batata, cenoura, vagem, ovo, camarão e maionese", "measureUnit": "UNITARY" }
        ]
    },
    {
        "category": "Porções",
        "products": [
            { "name": "Bolinho de bacalhau (8 un)", "price": 74.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Marisco a vinagrete", "price": 99.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Lombo de cação à dorê", "price": 98.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Camarão a dorê", "price": 99.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Camarão rosa alho e azeite", "price": 144.00, "description": "Acompanha pão", "measureUnit": "UNITARY" },
            { "name": "Isca de peixe", "price": 94.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Lula a dorê", "price": 110.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Lula à provençal", "price": 119.00, "description": "Acompanha pão", "measureUnit": "UNITARY" },
            { "name": "Polvo à provençal", "price": 169.00, "description": "Acompanha pão", "measureUnit": "UNITARY" },
            { "name": "Porção de Pastel", "price": 58.00, "description": "Bauru, queijo e catupiry", "measureUnit": "UNITARY" },
            { "name": "Porção de pastel especial", "price": 84.00, "description": "Camarão e carne de siri", "measureUnit": "UNITARY" },
            { "name": "Isca de filé de frango na panko", "price": 89.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Isca de filé de frango gratinada", "price": 99.00, "description": "Com catupiry e parmesão", "measureUnit": "UNITARY" },
            { "name": "Batata frita (simplot extra crunch)", "price": 58.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Batata cheddar e bacon", "price": 94.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Batata rustica canoa premium", "price": 69.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Mandioca frita", "price": 64.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Tábua picanha com catupiry", "price": 269.00, "description": "300g picanha, 300g linguiça toscana, 300g frango", "measureUnit": "UNITARY" },
            { "name": "Tábua ancho", "price": 188.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Tábua chorizo", "price": 179.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Tábua picanha", "price": 199.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Tábua chorizo com catupiry", "price": 219.00, "description": "300g chorizo, 300g linguiça toscana, 300g frango", "measureUnit": "UNITARY" }
        ]
    },
    {
        "category": "Combos",
        "products": [
            { "name": "Lombo de cação e fritas", "price": 138.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Camarão sete barbas e fritas", "price": 144.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Isca de peixe e fritas", "price": 139.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Camarão sete barbas e lula", "price": 210.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Camarão sete barbas, lula e fritas", "price": 238.00, "description": "", "measureUnit": "UNITARY" }
        ]
    },
    {
        "category": "Aves, Carnes e Massas",
        "products": [
            { "name": "Frango ao catupiry", "price": 189.00, "description": "File de frango grelhado gratinado", "measureUnit": "UNITARY" },
            { "name": "Frango com salada", "price": 108.00, "description": "Filé de frango grelhado", "measureUnit": "UNITARY" },
            { "name": "Frango a brasileira", "price": 139.00, "description": "Filé de frango grelhado, arroz, farofa", "measureUnit": "UNITARY" },
            { "name": "Strogonoff de frango", "price": 148.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Frango com palmito", "price": 149.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Frango parmegiana", "price": 188.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Risoto a moda do Chef", "price": 229.00, "description": "Palmito com 4 tipos de ervas, acompanha steak", "measureUnit": "UNITARY" },
            { "name": "Risoto de legumes", "price": 118.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Risoto italiano", "price": 124.00, "description": "Palmito, rúcula e tomate seco", "measureUnit": "UNITARY" },
            { "name": "Risoto de camarão", "price": 299.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Risoto ao marujo", "price": 329.00, "description": "Isca de peixe, camarão, lula, polvo, mexilhão", "measureUnit": "UNITARY" },
            { "name": "Mignon com salada", "price": 199.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Mignon a brasileira", "price": 239.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Strogonoff de filé mignon", "price": 218.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Bife ancho da casa", "price": 249.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Bife chorizo ao marujo", "price": 246.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Mignon com palmito", "price": 276.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Mignon parmegiana", "price": 259.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Mignon medalhão", "price": 269.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Mignon ao catupiry", "price": 274.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Picanha a brasileira", "price": 283.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Espaguete ao pomodoro", "price": 98.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Espaguete ao molho branco", "price": 109.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Espaguete ao molho de camarão", "price": 289.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Espaguete ao marujo", "price": 299.00, "description": "Isca de peixe, camarão, lula, polvo, mexilhão", "measureUnit": "UNITARY" }
        ]
    },
    {
        "category": "Peixes, Frutos do Mar e Premiados",
        "products": [
            { "name": "Pescada a dorê com salada", "price": 129.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Pescada a milanesa com salada", "price": 134.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Pescada a dorê", "price": 144.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Pescada a milanesa", "price": 154.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Pescada ao molho de camarão", "price": 208.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Pescada a parmegiana", "price": 184.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Cambucu a moda da casa", "price": 308.00, "description": "Recheado com palmito e catupiry", "measureUnit": "UNITARY" },
            { "name": "Cambucu com palmito", "price": 268.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Cambucu com frutos do mar", "price": 338.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Cambucu com camarão e catupiry", "price": 349.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Caçarola a caiçara", "price": 359.00, "description": "Cambucu recheado com banana da terra", "measureUnit": "UNITARY" },
            { "name": "Cambucu com salada", "price": 188.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Cambucu verão", "price": 208.00, "description": "Legumes salteados", "measureUnit": "UNITARY" },
            { "name": "Cambucu ao molho branco", "price": 235.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Cambucu a belle meuniere", "price": 249.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Cambucu ao capitão", "price": 308.00, "description": "Recheado com camarão e catupiry", "measureUnit": "UNITARY" },
            { "name": "Cambucu ao marujo", "price": 298.00, "description": "Com camarões rosa", "measureUnit": "UNITARY" },
            { "name": "Salmão do capitão", "price": 318.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Salmão verão", "price": 238.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Salmão belle meuniere", "price": 268.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Palmito a caiçara", "price": 299.00, "description": "Camarão rosa e polvo grelhado no char broiler", "measureUnit": "UNITARY" },
            { "name": "Sororoca a mediterrâneo", "price": 289.00, "description": "Filé de sororoca com crosta de castanha", "measureUnit": "UNITARY" },
            { "name": "Capitain’s lasagna", "price": 298.00, "description": "Lasanha de pescada branca", "measureUnit": "UNITARY" },
            { "name": "Caldeirada de Frutos do mar (inteira)", "price": 498.00, "description": "Serve de 3 a 4 pessoas", "measureUnit": "UNITARY" },
            { "name": "Caldeirada de Frutos do mar (meia)", "price": 368.00, "description": "Serve de 2 a 3 pessoas", "measureUnit": "UNITARY" },
            { "name": "Paella de Lagosta", "price": 590.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Paella de Frutos do Mar", "price": 460.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Paella Vegana", "price": 110.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Moqueca Vegana", "price": 179.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Moqueca de Cambucu", "price": 269.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Moqueca do Marujo", "price": 398.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Moqueca especial de lagosta", "price": 549.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Moqueca Mista", "price": 310.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Moqueca Camarão rosa", "price": 370.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Lagosta a provençal", "price": 498.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Lagosta ao thermidor", "price": 499.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Robalo ao marujo", "price": 334.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Robalo ao capitão", "price": 318.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Robalo da casa", "price": 258.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Abadejo a moda da casa", "price": 368.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Abadejo a Belle Munière", "price": 338.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Abadejo ao marujo", "price": 349.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Abadejo ao capitão", "price": 368.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Abadejo com palmito", "price": 319.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Abadejo com camarão e catupiry", "price": 349.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Abadejo com legumes", "price": 309.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Abadejo Grelhado de frutos do mar", "price": 364.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Bacalhau ao marujo", "price": 374.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Bacalhau à portuguesa", "price": 384.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Camarão cremoso", "price": 348.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Camarão a parmegiana", "price": 319.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Camarão a grega", "price": 329.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Strogonoff de camarão", "price": 348.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Camarão ao marujo", "price": 356.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Camarão ao capitão", "price": 329.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Bobó de camarão", "price": 348.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Chiclete de camarão", "price": 361.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Camarão na Moranga", "price": 390.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Camarão Misto", "price": 442.00, "description": "Serve até 3 pessoas", "measureUnit": "UNITARY" }
        ]
    },
    {
        "category": "Guarnições, Kids, Lanches e Sobremesas",
        "products": [
            { "name": "Batata corada", "price": 55.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Farofa de banana", "price": 25.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Arroz com brócolis", "price": 34.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Arroz branco", "price": 29.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Arroz a grega", "price": 38.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Feijão", "price": 19.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Pirão", "price": 25.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Legumes", "price": 42.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Palmito na manteiga", "price": 74.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Farofa", "price": 15.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Purê de batatas", "price": 42.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Molho de camarão", "price": 68.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Vinagrete", "price": 15.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Espaguetinho com filé mignon", "price": 59.90, "description": "Kids", "measureUnit": "UNITARY" },
            { "name": "Filezinho de peixe", "price": 48.00, "description": "Kids", "measureUnit": "UNITARY" },
            { "name": "Espaguetinho ao sugo", "price": 37.00, "description": "Kids", "measureUnit": "UNITARY" },
            { "name": "Nuggets", "price": 39.90, "description": "Kids", "measureUnit": "UNITARY" },
            { "name": "Filezinho de frango", "price": 38.90, "description": "Kids", "measureUnit": "UNITARY" },
            { "name": "Filezinho mignon", "price": 59.00, "description": "Kids", "measureUnit": "UNITARY" },
            { "name": "X-Chicken", "price": 49.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "X-Siri", "price": 79.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "X-burguer", "price": 59.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "X-salada", "price": 63.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "X-bacon", "price": 74.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "X-marujo", "price": 98.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Pudim de leite condensado", "price": 22.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Manjar de coco", "price": 26.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Sorvete taça 1 bola", "price": 21.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Sorvete taça 2 bolas", "price": 29.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Petit gateau", "price": 39.00, "description": "", "measureUnit": "UNITARY" },
            { "name": "Brownie", "price": 34.90, "description": "", "measureUnit": "UNITARY" },
            { "name": "Creme de papaya com licor de Cassis", "price": 49.00, "description": "", "measureUnit": "UNITARY" }
        ]
    },
    {
        "category": "Pizzas Tradicionais",
        "products": [
            { "name": "Pizza Napole (Broto)", "price": 60.90, "description": "Molho de tomate fresco, mozzarela premium, parmesão e tomate", "measureUnit": "UNITARY" },
            { "name": "Pizza Napole (Inteira)", "price": 86.90, "description": "Molho de tomate fresco, mozzarela premium, parmesão e tomate", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Calabresa com Mozzarela (Broto)", "price": 62.90, "description": "Molho de tomate, fatias de calabresa, mozzarela", "measureUnit": "UNITARY" },
            { "name": "Pizza Calabresa com Mozzarela (Inteira)", "price": 89.90, "description": "Molho de tomate, fatias de calabresa, mozzarela", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Alho (Broto)", "price": 48.90, "description": "Molho de tomate, mozzarella e alho frito", "measureUnit": "UNITARY" },
            { "name": "Pizza Alho (Inteira)", "price": 69.90, "description": "Molho de tomate, mozzarella e alho frito", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Mineira (Broto)", "price": 54.90, "description": "Molho de tomate, mozzarella, abobrinha e parmesão", "measureUnit": "UNITARY" },
            { "name": "Pizza Mineira (Inteira)", "price": 78.00, "description": "Molho de tomate, mozzarella, abobrinha e parmesão", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Milho (Broto)", "price": 48.90, "description": "Molho de tomate fresco, orégano, azeitona, tomate cereja, mozzarela e milho", "measureUnit": "UNITARY" },
            { "name": "Pizza Milho (Inteira)", "price": 69.90, "description": "Molho de tomate fresco, orégano, azeitona, tomate cereja, mozzarela e milho", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Bacon (Broto)", "price": 58.90, "description": "molho de tomate, mozzarella e bacon", "measureUnit": "UNITARY" },
            { "name": "Pizza Bacon (Inteira)", "price": 84.00, "description": "molho de tomate, mozzarella e bacon", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Croata (Broto)", "price": 65.90, "description": "Molho de tomate, mozzarella, calabresa, frango, lombo, bacon, cebola e creme de leite", "measureUnit": "UNITARY" },
            { "name": "Pizza Croata (Inteira)", "price": 94.00, "description": "Molho de tomate, mozzarella, calabresa, frango, lombo, bacon, cebola e creme de leite", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Calabresa (Broto)", "price": 59.90, "description": "Molho de tomate, fatias de calabresa e cebola", "measureUnit": "UNITARY" },
            { "name": "Pizza Calabresa (Inteira)", "price": 84.90, "description": "Molho de tomate, fatias de calabresa e cebola", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Mozzarella (Broto)", "price": 53.90, "description": "Molho de tomate e mozzarella", "measureUnit": "UNITARY" },
            { "name": "Pizza Mozzarella (Inteira)", "price": 76.90, "description": "Molho de tomate e mozzarella", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Toscana (Broto)", "price": 61.90, "description": "Molho de tomate, mozzarella, calabresa, cebola e tomate seco", "measureUnit": "UNITARY" },
            { "name": "Pizza Toscana (Inteira)", "price": 87.90, "description": "Molho de tomate, mozzarella, calabresa, cebola e tomate seco", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Margherita (Broto)", "price": 60.90, "description": "Molho de tomate, mozzarella, fatias de tomate, parmesão e manjericão fresco", "measureUnit": "UNITARY" },
            { "name": "Pizza Margherita (Inteira)", "price": 85.90, "description": "Molho de tomate, mozzarella, fatias de tomate, parmesão e manjericão fresco", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Baiana (Broto)", "price": 65.90, "description": "Molho de tomate, calabresa, ovo, cebola, mozzarella e pimenta", "measureUnit": "UNITARY" },
            { "name": "Pizza Baiana (Inteira)", "price": 92.90, "description": "Molho de tomate, calabresa, ovo, cebola, mozzarella e pimenta", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Atum (Broto)", "price": 67.90, "description": "Molho de tomate, atum ralado e cebola", "measureUnit": "UNITARY" },
            { "name": "Pizza Atum (Inteira)", "price": 96.00, "description": "Molho de tomate, atum ralado e cebola", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Escarola (Broto)", "price": 66.90, "description": "Molho de tomate, escarola, bacon e mozzarella", "measureUnit": "UNITARY" },
            { "name": "Pizza Escarola (Inteira)", "price": 94.90, "description": "Molho de tomate, escarola, bacon e mozzarella", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Frango com Catupiry (Broto)", "price": 74.90, "description": "Molho de tomate, peito de frango desfiado e catupiry", "measureUnit": "UNITARY" },
            { "name": "Pizza Frango com Catupiry (Inteira)", "price": 106.00, "description": "Molho de tomate, peito de frango desfiado e catupiry", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Palmito (Broto)", "price": 68.90, "description": "Molho de tomate, palmito Palmeira Real e mozzarella", "measureUnit": "UNITARY" },
            { "name": "Pizza Palmito (Inteira)", "price": 98.00, "description": "Molho de tomate, palmito Palmeira Real e mozzarella", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Champignon Especial (Broto)", "price": 83.00, "description": "Molho de tomate, champignon, catupiry, bacon e salsa", "measureUnit": "UNITARY" },
            { "name": "Pizza Champignon Especial (Inteira)", "price": 107.00, "description": "Molho de tomate, champignon, catupiry, bacon e salsa", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Aliche (Broto)", "price": 72.90, "description": "Molho de tomate, mozzarella, tomate e aliche", "measureUnit": "UNITARY" },
            { "name": "Pizza Aliche (Inteira)", "price": 104.00, "description": "Molho de tomate, mozzarella, tomate e aliche", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Bauru (Broto)", "price": 64.90, "description": "Molho de tomate, mozzarella, presunto e tomate", "measureUnit": "UNITARY" },
            { "name": "Pizza Bauru (Inteira)", "price": 92.00, "description": "Molho de tomate, mozzarella, presunto e tomate", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Brócolis (Broto)", "price": 68.90, "description": "Molho de tomate, brócolis, bacon e mozzarella", "measureUnit": "UNITARY" },
            { "name": "Pizza Brócolis (Inteira)", "price": 98.00, "description": "Molho de tomate, brócolis, bacon e mozzarella", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Pepperoni (Broto)", "price": 65.90, "description": "Molho de tomate, mozzarella e pepperoni", "measureUnit": "UNITARY" },
            { "name": "Pizza Pepperoni (Inteira)", "price": 92.90, "description": "Molho de tomate, mozzarella e pepperoni", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Portuguesa (Broto)", "price": 77.00, "description": "Molho de tomate, presunto, palmito, ovo, cebola, ervilha e mozzarella", "measureUnit": "UNITARY" },
            { "name": "Pizza Portuguesa (Inteira)", "price": 110.00, "description": "Molho de tomate, presunto, palmito, ovo, cebola, ervilha e mozzarella", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Rúcula (Broto)", "price": 66.90, "description": "Molho de tomate, mozzarella de búfala, tomate seco e rúcula", "measureUnit": "UNITARY" },
            { "name": "Pizza Rúcula (Inteira)", "price": 94.90, "description": "Molho de tomate, mozzarella de búfala, tomate seco e rúcula", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Italianinha (Broto)", "price": 61.90, "description": "Molho de tomate, mozzarella, alho e manjericão", "measureUnit": "UNITARY" },
            { "name": "Pizza Italianinha (Inteira)", "price": 86.90, "description": "Molho de tomate, mozzarella, alho e manjericão", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Quatro queijos (Broto)", "price": 67.90, "description": "Molho de tomate, provolone, catupiry, mozzarella e parmesão", "measureUnit": "UNITARY" },
            { "name": "Pizza Quatro queijos (Inteira)", "price": 96.00, "description": "Molho de tomate, provolone, catupiry, mozzarella e parmesão", "measureUnit": "FRACTIONAL" }
        ]
    },
    {
        "category": "Pizzas Especiais",
        "products": [
            { "name": "Pizza Rucula especial (Broto)", "price": 92.90, "description": "Molho de tomate, mozzarela de búfala, presunto parma, rúcula, fios de mel", "measureUnit": "UNITARY" },
            { "name": "Pizza Rucula especial (Inteira)", "price": 129.90, "description": "Molho de tomate, mozzarela de búfala, presunto parma, rúcula, fios de mel", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Búzios e vitória (Broto)", "price": 104.90, "description": "Peito de peru, mozzarela de búfala, damasco, pêssego e cream cheese", "measureUnit": "UNITARY" },
            { "name": "Pizza Búzios e vitória (Inteira)", "price": 149.90, "description": "Peito de peru, mozzarela de búfala, damasco, pêssego e cream cheese", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Sereníssima", "price": 169.90, "description": "Mussarela de búfala, presunto parma, alcachofra, burrata, pesto genovese", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Champignon especial (Broto)", "price": 91.90, "description": "Molho de tomate, champignon, catupiry, bacon, salsa fresca", "measureUnit": "UNITARY" },
            { "name": "Pizza Champignon especial (Inteira)", "price": 128.90, "description": "Molho de tomate, champignon, catupiry, bacon, salsa fresca", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Sete Mares (Broto)", "price": 139.90, "description": "Molho de tomate, polvo, lula, camarão, marisco, pimentão e cream cheese", "measureUnit": "UNITARY" },
            { "name": "Pizza Sete Mares (Inteira)", "price": 199.90, "description": "Molho de tomate, polvo, lula, camarão, marisco, pimentão e cream cheese", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Cocanha (Broto)", "price": 127.90, "description": "Molho de tomate, catupiry, cebola, mozzarella, camarão e manjericão", "measureUnit": "UNITARY" },
            { "name": "Pizza Cocanha (Inteira)", "price": 181.90, "description": "Molho de tomate, catupiry, cebola, mozzarella, camarão e manjericão", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Atum Especial (Broto)", "price": 87.90, "description": "Molho de tomate, atum temperado em pedaço, cebola", "measureUnit": "UNITARY" },
            { "name": "Pizza Atum Especial (Inteira)", "price": 124.90, "description": "Molho de tomate, atum temperado em pedaço, cebola", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Japonesa (Broto)", "price": 115.00, "description": "Salmão fresco, mozzarella, geleia de damasco, tarê - borda recheada", "measureUnit": "UNITARY" },
            { "name": "Pizza Japonesa (Inteira)", "price": 169.90, "description": "Salmão fresco, mozzarella, geleia de damasco, tarê - borda recheada", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Camarão do Marujo (Broto)", "price": 130.00, "description": "Molho de tomate, camarão flambado, catupiry e parmesão", "measureUnit": "UNITARY" },
            { "name": "Pizza Camarão do Marujo (Inteira)", "price": 190.00, "description": "Molho de tomate, camarão flambado, catupiry e parmesão", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Picanha Especial (Broto)", "price": 118.00, "description": "Molho de tomate, mozzarella e picanha argentina assada", "measureUnit": "UNITARY" },
            { "name": "Pizza Picanha Especial (Inteira)", "price": 180.00, "description": "Molho de tomate, mozzarella e picanha argentina assada", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Gratinada (Broto)", "price": 99.90, "description": "Molho de tomate, catupiry, mozzarella, parmesão, provolone, gorgonzola", "measureUnit": "UNITARY" },
            { "name": "Pizza Gratinada (Inteira)", "price": 141.90, "description": "Molho de tomate, catupiry, mozzarella, parmesão, provolone, gorgonzola", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Levíssima (Broto)", "price": 93.90, "description": "Molho de tomate, mozzarella de búfala, tomate seco e manjericão", "measureUnit": "UNITARY" },
            { "name": "Pizza Levíssima (Inteira)", "price": 131.90, "description": "Molho de tomate, mozzarella de búfala, tomate seco e manjericão", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Lombo especial (Broto)", "price": 104.90, "description": "Molho de tomate, cream cheese, cebola, lombo canadense, parmesão e manjericão", "measureUnit": "UNITARY" },
            { "name": "Pizza Lombo especial (Inteira)", "price": 148.90, "description": "Molho de tomate, cream cheese, cebola, lombo canadense, parmesão e manjericão", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Palmanello (Broto)", "price": 102.90, "description": "Molho de tomate, palmito palmeira real, champignon, bacon e catupiry", "measureUnit": "UNITARY" },
            { "name": "Pizza Palmanello (Inteira)", "price": 147.90, "description": "Molho de tomate, palmito palmeira real, champignon, bacon e catupiry", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Massaguaçu (Broto)", "price": 107.90, "description": "Molho de tomate, peito de peru, champignon, catupiry, cebola e mozzarella", "measureUnit": "UNITARY" },
            { "name": "Pizza Massaguaçu (Inteira)", "price": 152.90, "description": "Molho de tomate, peito de peru, champignon, catupiry, cebola e mozzarella", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Do cheff (Broto)", "price": 104.90, "description": "Molho de tomate, catupiry, alho frito, mozzarella, calabresa, tomate e bacon", "measureUnit": "UNITARY" },
            { "name": "Pizza Do cheff (Inteira)", "price": 149.90, "description": "Molho de tomate, catupiry, alho frito, mozzarella, calabresa, tomate e bacon", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Frango Especial (Broto)", "price": 111.90, "description": "Molho de tomate, frango desfiado, milho, champignon, creme de leite, catupiry e batata palha", "measureUnit": "UNITARY" },
            { "name": "Pizza Frango Especial (Inteira)", "price": 159.90, "description": "Molho de tomate, frango desfiado, milho, champignon, creme de leite, catupiry e batata palha", "measureUnit": "FRACTIONAL" }
        ]
    },
    {
        "category": "Pizzas Doces",
        "products": [
            { "name": "Pizza Brigadeiro de amendoim (Broto)", "price": 75.00, "description": "Brigadeiro de amendoim e canela", "measureUnit": "UNITARY" },
            { "name": "Pizza Brigadeiro de amendoim (Inteira)", "price": 110.00, "description": "Brigadeiro de amendoim e canela", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Romeu e Julieta (Broto)", "price": 65.90, "description": "Mozzarela premium e goiabada cascão", "measureUnit": "UNITARY" },
            { "name": "Pizza Romeu e Julieta (Inteira)", "price": 94.00, "description": "Mozzarela premium e goiabada cascão", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Banana (Broto)", "price": 67.90, "description": "Banana ao rum com canela e leite condensado", "measureUnit": "UNITARY" },
            { "name": "Pizza Banana (Inteira)", "price": 96.00, "description": "Banana ao rum com canela e leite condensado", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Chocolate (Broto)", "price": 72.90, "description": "Granulado ou coco ralado", "measureUnit": "UNITARY" },
            { "name": "Pizza Chocolate (Inteira)", "price": 104.00, "description": "Granulado ou coco ralado", "measureUnit": "FRACTIONAL" },
            { "name": "Pizza Beijinho (Broto)", "price": 68.90, "description": "Mozzarella, coco ralado e leite condensado", "measureUnit": "UNITARY" },
            { "name": "Pizza Beijinho (Inteira)", "price": 98.00, "description": "Mozzarella, coco ralado e leite condensado", "measureUnit": "FRACTIONAL" }
        ]
    }
];
async function main() {
    console.log('Iniciando script de seed do cardápio do Marujo...');
    // Obter o display_id máximo atual para evitar colisões
    const maxProduct = await prisma.product.aggregate({
        _max: {
            display_id: true
        }
    });
    // Vamos começar de um ID alto como fallback (ex: 200000) caso não tenha nenhum
    let currentDisplayId = (maxProduct._max.display_id || 200000) + 1;
    for (const item of payload) {
        // 1. Encontra ou cria a categoria
        console.log(`\nProcessando categoria: ${item.category}`);
        const categoryName = item.category.trim();
        let category = await prisma.category.findUnique({
            where: { name: categoryName }
        });
        if (!category) {
            category = await prisma.category.create({
                data: { name: categoryName }
            });
            console.log(`[+] Categoria criada: ${category.name}`);
        }
        else {
            console.log(`[=] Categoria já existente: ${category.name}`);
        }
        // 2. Cria os produtos vinculados à categoria
        for (const prodData of item.products) {
            // Verifica se o produto já existe no database para não clonar
            const existingProduct = await prisma.product.findFirst({
                where: {
                    name: prodData.name,
                    category_id: category.id
                }
            });
            // REGRA DE NEGÓCIO: Se for Pizza Inteira, a unidade de medida é fracionada. Se não, é unitária.
            const productMeasureUnit = prodData.name.includes('(Inteira)')
                ? client_1.MeasureUnit.FRACTIONAL
                : client_1.MeasureUnit.UNITARY;
            if (!existingProduct) {
                await prisma.product.create({
                    data: {
                        name: prodData.name,
                        description: prodData.description || null,
                        price: prodData.price,
                        active: true,
                        display_id: currentDisplayId++,
                        category_id: category.id,
                        cost: 0,
                        stock: 0,
                        min_stock: 0,
                        is_composite: false,
                        measureUnit: productMeasureUnit // <-- CAMPO ADICIONADO AQUI
                    }
                });
                console.log(`   └─ [Criado] ${prodData.name} - R$ ${prodData.price.toFixed(2)} - [${productMeasureUnit}]`);
            }
            else {
                console.log(`   └─ [Pulado] ${prodData.name} já existe.`);
            }
        }
    }
    console.log('\n✅ Seed finalizado com sucesso!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
