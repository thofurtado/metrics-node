"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const payload = [
    { "date": "2026-02-02", "description": "assai", "value": 383.49, "category": "Alimentos Variados" },
    { "date": "2026-02-02", "description": "assai", "value": 499.50, "category": "Alimentos Variados" },
    { "date": "2026-02-02", "description": "multifoods", "value": 1372.24, "category": "Alimentos Variados" },
    { "date": "2026-02-02", "description": "tempero do barão", "value": 252.60, "category": "Alimentos Variados" },
    { "date": "2026-02-03", "description": "Lr congelados", "value": 502.25, "category": "Alimentos Variados" },
    { "date": "2026-02-03", "description": "atilio gardin", "value": 399.00, "category": "Alimentos Variados" },
    { "date": "2026-02-04", "description": "bidfoods", "value": 370.88, "category": "Alimentos Variados" },
    { "date": "2026-02-04", "description": "shopp", "value": 182.74, "category": "Alimentos Variados" },
    { "date": "2026-02-04", "description": "cebola roxa", "value": 25.87, "category": "Alimentos Variados" },
    { "date": "2026-02-04", "description": "lactvit", "value": 1151.56, "category": "Alimentos Variados" },
    { "date": "2026-02-04", "description": "los los", "value": 773.00, "category": "Alimentos Variados" },
    { "date": "2026-02-05", "description": "litoral congelados", "value": 805.63, "category": "Alimentos Variados" },
    { "date": "2026-02-06", "description": "lactvit", "value": 739.13, "category": "Alimentos Variados" },
    { "date": "2026-02-06", "description": "lactvit", "value": 150.00, "category": "Alimentos Variados" },
    { "date": "2026-02-06", "description": "assai", "value": 1173.45, "category": "Alimentos Variados" },
    { "date": "2026-02-06", "description": "mls cafe", "value": 455.00, "category": "Alimentos Variados" },
    { "date": "2026-02-07", "description": "Lr congelados", "value": 502.25, "category": "Alimentos Variados" },
    { "date": "2026-02-07", "description": "Lr congelados", "value": 253.50, "category": "Alimentos Variados" },
    { "date": "2026-02-09", "description": "assai", "value": 1622.14, "category": "Alimentos Variados" },
    { "date": "2026-02-09", "description": "multifoods", "value": 1708.54, "category": "Alimentos Variados" },
    { "date": "2026-02-09", "description": "litoral congelados", "value": 184.40, "category": "Alimentos Variados" },
    { "date": "2026-02-09", "description": "assai", "value": 1777.75, "category": "Alimentos Variados" },
    { "date": "2026-02-10", "description": "lactvit", "value": 1825.10, "category": "Alimentos Variados" },
    { "date": "2026-02-12", "description": "alibec", "value": 501.04, "category": "Alimentos Variados" },
    { "date": "2026-02-12", "description": "brf", "value": 752.61, "category": "Alimentos Variados" },
    { "date": "2026-02-12", "description": "orbis", "value": 238.60, "category": "Alimentos Variados" },
    { "date": "2026-02-12", "description": "litoral congelados", "value": 368.82, "category": "Alimentos Variados" },
    { "date": "2026-02-13", "description": "lactvit", "value": 2008.68, "category": "Alimentos Variados" },
    { "date": "2026-02-13", "description": "assai", "value": 1878.62, "category": "Alimentos Variados" },
    { "date": "2026-02-13", "description": "molheiras", "value": 104.97, "category": "Alimentos Variados" },
    { "date": "2026-02-18", "description": "alibec", "value": 500.04, "category": "Alimentos Variados" },
    { "date": "2026-02-18", "description": "brf", "value": 714.37, "category": "Alimentos Variados" },
    { "date": "2026-02-18", "description": "de marchi", "value": 228.84, "category": "Alimentos Variados" },
    { "date": "2026-02-18", "description": "multifoods", "value": 1779.76, "category": "Alimentos Variados" },
    { "date": "2026-02-18", "description": "japa food", "value": 805.00, "category": "Alimentos Variados" },
    { "date": "2026-02-18", "description": "dolores", "value": 1160.00, "category": "Alimentos Variados" },
    { "date": "2026-02-19", "description": "litoral congelados", "value": 323.82, "category": "Alimentos Variados" },
    { "date": "2026-02-19", "description": "assai", "value": 914.92, "category": "Alimentos Variados" },
    { "date": "2026-02-19", "description": "assai", "value": 610.30, "category": "Alimentos Variados" },
    { "date": "2026-02-19", "description": "lactvit", "value": 1812.40, "category": "Alimentos Variados" },
    { "date": "2026-02-20", "description": "litoral norte", "value": 23.90, "category": "Alimentos Variados" },
    { "date": "2026-02-21", "description": "assai", "value": 969.62, "category": "Alimentos Variados" },
    { "date": "2026-02-23", "description": "multifoods", "value": 1779.76, "category": "Alimentos Variados" },
    { "date": "2026-02-23", "description": "empório", "value": 25.51, "category": "Alimentos Variados" },
    { "date": "2026-02-23", "description": "de marchi", "value": 131.88, "category": "Alimentos Variados" },
    { "date": "2026-02-23", "description": "assai", "value": 1581.81, "category": "Alimentos Variados" },
    { "date": "2026-02-23", "description": "japa food", "value": 1159.03, "category": "Alimentos Variados" },
    { "date": "2026-02-02", "description": "jbs", "value": 621.80, "category": "Proteínas" },
    { "date": "2026-02-02", "description": "jbs", "value": 1142.17, "category": "Proteínas" },
    { "date": "2026-02-03", "description": "minerva", "value": 1277.23, "category": "Proteínas" },
    { "date": "2026-02-03", "description": "premier", "value": 286.00, "category": "Proteínas" },
    { "date": "2026-02-04", "description": "minerva", "value": 557.15, "category": "Proteínas" },
    { "date": "2026-02-04", "description": "F&A", "value": 453.70, "category": "Proteínas" },
    { "date": "2026-02-05", "description": "minerva", "value": 360.71, "category": "Proteínas" },
    { "date": "2026-02-05", "description": "premier", "value": 715.00, "category": "Proteínas" },
    { "date": "2026-02-06", "description": "ostravagante", "value": 570.00, "category": "Proteínas" },
    { "date": "2026-02-09", "description": "jbs", "value": 1141.83, "category": "Proteínas" },
    { "date": "2026-02-10", "description": "mar peixe", "value": 399.00, "category": "Proteínas" },
    { "date": "2026-02-10", "description": "premier", "value": 286.00, "category": "Proteínas" },
    { "date": "2026-02-12", "description": "minerva", "value": 360.83, "category": "Proteínas" },
    { "date": "2026-02-13", "description": "minerva", "value": 557.75, "category": "Proteínas" },
    { "date": "2026-02-13", "description": "minerva", "value": 647.77, "category": "Proteínas" },
    { "date": "2026-02-18", "description": "petrópolis", "value": 155.24, "category": "Proteínas" },
    { "date": "2026-02-18", "description": "jbs", "value": 1055.19, "category": "Proteínas" },
    { "date": "2026-02-18", "description": "minerva", "value": 1029.96, "category": "Proteínas" },
    { "date": "2026-02-18", "description": "premier", "value": 296.00, "category": "Proteínas" },
    { "date": "2026-02-18", "description": "premier", "value": 857.98, "category": "Proteínas" },
    { "date": "2026-02-19", "description": "iglu", "value": 734.40, "category": "Proteínas" },
    { "date": "2026-02-19", "description": "minerva", "value": 633.00, "category": "Proteínas" },
    { "date": "2026-02-19", "description": "moria", "value": 2258.90, "category": "Proteínas" },
    { "date": "2026-02-19", "description": "iglu", "value": 236.40, "category": "Proteínas" },
    { "date": "2026-02-23", "description": "lagosta", "value": 1470.00, "category": "Proteínas" },
    { "date": "2026-02-23", "description": "ostravagante", "value": 198.90, "category": "Proteínas" },
    { "date": "2026-02-23", "description": "premier", "value": 449.00, "category": "Proteínas" },
    { "date": "2026-02-23", "description": "jbs", "value": 1055.51, "category": "Proteínas" },
    { "date": "2026-02-23", "description": "minerva", "value": 1029.96, "category": "Proteínas" },
    { "date": "2026-02-23", "description": "caua metade do valor,peixes", "value": 1000.00, "category": "Proteínas" },
    { "date": "2026-02-03", "description": "mdg", "value": 204.89, "category": "Bebidas" },
    { "date": "2026-02-04", "description": "martino", "value": 855.00, "category": "Bebidas" },
    { "date": "2026-02-04", "description": "spal", "value": 1230.68, "category": "Bebidas" },
    { "date": "2026-02-04", "description": "heineiken", "value": 665.07, "category": "Bebidas" },
    { "date": "2026-02-07", "description": "imarui", "value": 1053.61, "category": "Bebidas" },
    { "date": "2026-02-09", "description": "mdg", "value": 287.02, "category": "Bebidas" },
    { "date": "2026-02-12", "description": "martino", "value": 726.43, "category": "Bebidas" },
    { "date": "2026-02-13", "description": "mdg", "value": 284.34, "category": "Bebidas" },
    { "date": "2026-02-13", "description": "spal", "value": 1220.24, "category": "Bebidas" },
    { "date": "2026-02-15", "description": "imarui", "value": 790.55, "category": "Bebidas" },
    { "date": "2026-02-18", "description": "imarui", "value": 1038.84, "category": "Bebidas" },
    { "date": "2026-02-18", "description": "martino bebidas", "value": 396.00, "category": "Bebidas" },
    { "date": "2026-02-18", "description": "spal", "value": 1123.03, "category": "Bebidas" },
    { "date": "2026-02-19", "description": "heineiken", "value": 914.00, "category": "Bebidas" },
    { "date": "2026-02-19", "description": "heineiken", "value": 301.66, "category": "Bebidas" },
    { "date": "2026-02-19", "description": "mdg", "value": 284.25, "category": "Bebidas" },
    { "date": "2026-02-19", "description": "mdg", "value": 245.69, "category": "Bebidas" },
    { "date": "2026-02-19", "description": "imarui", "value": 1382.76, "category": "Bebidas" },
    { "date": "2026-02-02", "description": "la verduras", "value": 242.50, "category": "HortiFruti" },
    { "date": "2026-02-09", "description": "adriano", "value": 195.00, "category": "HortiFruti" },
    { "date": "2026-02-09", "description": "thamires", "value": 2770.00, "category": "HortiFruti" },
    { "date": "2026-02-13", "description": "luiz e luciana", "value": 139.50, "category": "HortiFruti" },
    { "date": "2026-02-18", "description": "thamires", "value": 2770.00, "category": "HortiFruti" },
    { "date": "2026-02-19", "description": "la verduras", "value": 212.00, "category": "HortiFruti" },
    { "date": "2026-02-07", "description": "renato augusto", "value": 500.00, "category": "Manutenção/Reforma" },
    { "date": "2026-02-10", "description": "leo eletricista", "value": 1300.00, "category": "Manutenção/Reforma" },
    { "date": "2026-02-11", "description": "manutenção", "value": 1000.00, "category": "Manutenção/Reforma" },
    { "date": "2026-02-13", "description": "marcio aurelio", "value": 300.00, "category": "Manutenção/Reforma" },
    { "date": "2026-02-13", "description": "renato augusto", "value": 1500.00, "category": "Manutenção/Reforma" },
    { "date": "2026-02-13", "description": "marcio aurelio", "value": 370.00, "category": "Manutenção/Reforma" },
    { "date": "2026-02-15", "description": "sr antônio", "value": 200.00, "category": "Manutenção/Reforma" },
    { "date": "2026-02-18", "description": "pj dedetizadora", "value": 375.00, "category": "Manutenção/Reforma" },
    { "date": "2026-02-19", "description": "deposito jetuba", "value": 6.00, "category": "Manutenção/Reforma" },
    { "date": "2026-02-23", "description": "mão francesa", "value": 62.98, "category": "Manutenção/Reforma" },
    { "date": "2026-02-02", "description": "jr embalagem", "value": 1626.90, "category": "Embalagens/Limpeza" },
    { "date": "2026-02-03", "description": "jr embalagem", "value": 722.55, "category": "Embalagens/Limpeza" },
    { "date": "2026-02-03", "description": "revati", "value": 605.22, "category": "Embalagens/Limpeza" },
    { "date": "2026-02-04", "description": "albatroz", "value": 132.40, "category": "Embalagens/Limpeza" },
    { "date": "2026-02-04", "description": "wgf", "value": 614.43, "category": "Embalagens/Limpeza" },
    { "date": "2026-02-08", "description": "papelaria eduardo", "value": 144.55, "category": "Embalagens/Limpeza" },
    { "date": "2026-02-08", "description": "inseticida", "value": 110.00, "category": "Embalagens/Limpeza" },
    { "date": "2026-02-09", "description": "lider vale", "value": 473.45, "category": "Embalagens/Limpeza" },
    { "date": "2026-02-10", "description": "revati", "value": 605.22, "category": "Embalagens/Limpeza" },
    { "date": "2026-02-12", "description": "albatroz", "value": 604.02, "category": "Embalagens/Limpeza" },
    { "date": "2026-02-12", "description": "wgf", "value": 179.55, "category": "Embalagens/Limpeza" },
    { "date": "2026-02-13", "description": "fortaleza", "value": 317.70, "category": "Embalagens/Limpeza" },
    { "date": "2026-02-13", "description": "lenha", "value": 760.00, "category": "Embalagens/Limpeza" },
    { "date": "2026-02-18", "description": "jr embalagem", "value": 270.39, "category": "Embalagens/Limpeza" },
    { "date": "2026-02-18", "description": "revati", "value": 605.22, "category": "Embalagens/Limpeza" },
    { "date": "2026-02-19", "description": "castropil", "value": 180.43, "category": "Embalagens/Limpeza" },
    { "date": "2026-02-21", "description": "rolo de perflex", "value": 370.91, "category": "Embalagens/Limpeza" },
    { "date": "2026-02-23", "description": "jr embalagem", "value": 258.26, "category": "Embalagens/Limpeza" },
    { "date": "2026-02-02", "description": "cota societária", "value": 8500.00, "category": "Fixos" },
    { "date": "2026-02-02", "description": "thomas", "value": 240.00, "category": "Fixos" },
    { "date": "2026-02-02", "description": "litoral express", "value": 135.20, "category": "Fixos" },
    { "date": "2026-02-04", "description": "ace", "value": 66.00, "category": "Fixos" },
    { "date": "2026-02-04", "description": "ace", "value": 66.00, "category": "Fixos" },
    { "date": "2026-02-04", "description": "cota societária", "value": 212.00, "category": "Fixos" },
    { "date": "2026-02-04", "description": "band vale", "value": 725.00, "category": "Fixos" },
    { "date": "2026-02-10", "description": "mercado pago", "value": 336.04, "category": "Fixos" },
    { "date": "2026-02-12", "description": "google", "value": 459.14, "category": "Fixos" },
    { "date": "2026-02-13", "description": "claro", "value": 105.04, "category": "Fixos" },
    { "date": "2026-02-13", "description": "vivo", "value": 82.61, "category": "Fixos" },
    { "date": "2026-02-13", "description": "vivo", "value": 60.65, "category": "Fixos" },
    { "date": "2026-02-13", "description": "vivo", "value": 154.23, "category": "Fixos" },
    { "date": "2026-02-15", "description": "g+", "value": 79.11, "category": "Fixos" },
    { "date": "2026-02-15", "description": "thomas", "value": 700.00, "category": "Fixos" },
    { "date": "2026-02-15", "description": "mercado pago", "value": 297.49, "category": "Fixos" },
    { "date": "2026-02-15", "description": "litoral express", "value": 90.20, "category": "Fixos" },
    { "date": "2026-02-18", "description": "leo eletricista", "value": 1300.00, "category": "Fixos" },
    { "date": "2026-02-18", "description": "luis calhas", "value": 875.00, "category": "Fixos" },
    { "date": "2026-02-18", "description": "cota societária", "value": 8500.00, "category": "Fixos" },
    { "date": "2026-02-19", "description": "cota societária", "value": 100.00, "category": "Fixos" },
    { "date": "2026-02-19", "description": "consórcio", "value": 2494.20, "category": "Fixos" },
    { "date": "2026-02-20", "description": "iran edp", "value": 50.00, "category": "Fixos" },
    { "date": "2026-02-20", "description": "edp", "value": 3118.41, "category": "Fixos" },
    { "date": "2026-02-20", "description": "aluguel marujo", "value": 5165.70, "category": "Fixos" },
    { "date": "2026-02-20", "description": "consigaz", "value": 2188.41, "category": "Fixos" },
    { "date": "2026-02-20", "description": "thomas", "value": 350.00, "category": "Fixos" },
    { "date": "2026-02-22", "description": "marketing", "value": 18.20, "category": "Fixos" },
    { "date": "2026-02-23", "description": "litoral express", "value": 9.90, "category": "Fixos" },
    { "date": "2026-02-23", "description": "mario segurança", "value": 150.00, "category": "Fixos" },
    { "date": "2026-02-02", "description": "fogão boca pizza", "value": 252.99, "category": "Aquisições" },
    { "date": "2026-02-03", "description": "ezequiel luz solar", "value": 1500.00, "category": "Aquisições" },
    { "date": "2026-02-04", "description": "tampa multiprocessador", "value": 62.96, "category": "Aquisições" },
    { "date": "2026-02-06", "description": "cardapios", "value": 300.00, "category": "Aquisições" },
    { "date": "2026-02-06", "description": "ezequiel luz solar", "value": 1482.53, "category": "Aquisições" },
    { "date": "2026-02-10", "description": "kasqueiro", "value": 264.99, "category": "Aquisições" },
    { "date": "2026-02-11", "description": "placa toro", "value": 100.00, "category": "Aquisições" },
    { "date": "2026-02-15", "description": "2 mouses", "value": 100.38, "category": "Aquisições" },
    { "date": "2026-02-17", "description": "toldo mercado pago", "value": 396.27, "category": "Aquisições" },
    { "date": "2026-02-18", "description": "avelino condensadora", "value": 1000.00, "category": "Aquisições" },
    { "date": "2026-02-18", "description": "ezequiel luz solar", "value": 2000.00, "category": "Aquisições" },
    { "date": "2026-02-21", "description": "tapete bar", "value": 34.80, "category": "Aquisições" },
    { "date": "2026-02-21", "description": "taças de cristal", "value": 165.99, "category": "Aquisições" },
    { "date": "2026-02-23", "description": "compras shoppe", "value": 2536.04, "category": "Aquisições" },
    { "date": "2026-02-23", "description": "20 baldes", "value": 119.90, "category": "Aquisições" },
    { "date": "2026-02-02", "description": "robson", "value": 200.00, "category": "Músicos" },
    { "date": "2026-02-03", "description": "danilo resto do dinheiro", "value": 50.00, "category": "Músicos" },
    { "date": "2026-02-07", "description": "danilo", "value": 350.00, "category": "Músicos" },
    { "date": "2026-02-09", "description": "robson", "value": 500.00, "category": "Músicos" },
    { "date": "2026-02-13", "description": "robson", "value": 200.00, "category": "Músicos" },
    { "date": "2026-02-13", "description": "lucas santana", "value": 500.00, "category": "Músicos" },
    { "date": "2026-02-15", "description": "robson", "value": 400.00, "category": "Músicos" },
    { "date": "2026-02-15", "description": "robson", "value": 400.00, "category": "Músicos" },
    { "date": "2026-02-17", "description": "robson", "value": 400.00, "category": "Músicos" },
    { "date": "2026-02-18", "description": "lucas santana", "value": 150.00, "category": "Músicos" },
    { "date": "2026-02-19", "description": "robson musico", "value": 200.00, "category": "Músicos" },
    { "date": "2026-02-23", "description": "robson musico", "value": 500.00, "category": "Músicos" },
    { "date": "2026-02-02", "description": "karla", "value": 2500.00, "category": "Dívidas" },
    { "date": "2026-02-03", "description": "consórcio", "value": 1679.07, "category": "Dívidas" },
    { "date": "2026-02-08", "description": "karla", "value": 2500.00, "category": "Dívidas" },
    { "date": "2026-02-10", "description": "cristiano", "value": 3000.00, "category": "Dívidas" },
    { "date": "2026-02-10", "description": "fernanda", "value": 6000.00, "category": "Dívidas" },
    { "date": "2026-02-13", "description": "edson", "value": 3500.00, "category": "Dívidas" },
    { "date": "2026-02-13", "description": "karla", "value": 1000.00, "category": "Dívidas" },
    { "date": "2026-02-19", "description": "cartorio de protesto custas", "value": 694.30, "category": "Dívidas" },
    { "date": "2026-02-22", "description": "edson", "value": 2400.00, "category": "Dívidas" },
    { "date": "2026-02-22", "description": "lucas juros", "value": 2400.00, "category": "Dívidas" },
    { "date": "2026-02-23", "description": "cristiano", "value": 1000.00, "category": "Dívidas" },
    { "date": "2026-02-02", "description": "reembolso priscilla alface 0", "value": 16.47, "category": "Funcionários" },
    { "date": "2026-02-13", "description": "motoboy", "value": 60.00, "category": "Funcionários" },
    { "date": "2026-02-01", "description": "auto posto", "value": 306.69, "category": "Pessoal" },
    { "date": "2026-02-02", "description": "pai", "value": 600.00, "category": "Pessoal" },
    { "date": "2026-02-02", "description": "julia", "value": 20.00, "category": "Pessoal" },
    { "date": "2026-02-02", "description": "filhos aniversario", "value": 485.87, "category": "Pessoal" },
    { "date": "2026-02-02", "description": "material julia", "value": 269.75, "category": "Pessoal" },
    { "date": "2026-02-02", "description": "material murilo", "value": 277.25, "category": "Pessoal" },
    { "date": "2026-02-02", "description": "escola murilo", "value": 1197.08, "category": "Pessoal" },
    { "date": "2026-02-02", "description": "escola julia", "value": 1105.00, "category": "Pessoal" },
    { "date": "2026-02-02", "description": "carro", "value": 5000.00, "category": "Pessoal" },
    { "date": "2026-02-02", "description": "carro", "value": 10000.00, "category": "Pessoal" },
    { "date": "2026-02-02", "description": "lanche", "value": 167.00, "category": "Pessoal" },
    { "date": "2026-02-03", "description": "padaria", "value": 113.03, "category": "Pessoal" },
    { "date": "2026-02-03", "description": "farmacia", "value": 151.64, "category": "Pessoal" },
    { "date": "2026-02-03", "description": "bermudas", "value": 193.99, "category": "Pessoal" },
    { "date": "2026-02-03", "description": "cafe da manha", "value": 52.90, "category": "Pessoal" },
    { "date": "2026-02-04", "description": "unimed", "value": 975.23, "category": "Pessoal" },
    { "date": "2026-02-04", "description": "clinica", "value": 900.00, "category": "Pessoal" },
    { "date": "2026-02-06", "description": "faxineira", "value": 200.00, "category": "Pessoal" },
    { "date": "2026-02-07", "description": "celular", "value": 213.54, "category": "Pessoal" },
    { "date": "2026-02-09", "description": "pai", "value": 1000.00, "category": "Pessoal" },
    { "date": "2026-02-13", "description": "comida japonesa", "value": 530.75, "category": "Pessoal" },
    { "date": "2026-02-16", "description": "shoppe", "value": 118.99, "category": "Pessoal" },
    { "date": "2026-02-16", "description": "shoppe", "value": 77.98, "category": "Pessoal" },
    { "date": "2026-02-16", "description": "shoppe", "value": 281.60, "category": "Pessoal" },
    { "date": "2026-02-16", "description": "la verdura", "value": 211.50, "category": "Pessoal" },
    { "date": "2026-02-17", "description": "compressor carro", "value": 56.90, "category": "Pessoal" },
    { "date": "2026-02-17", "description": "coelba caravelas", "value": 529.40, "category": "Pessoal" },
    { "date": "2026-02-17", "description": "embasa agua caravelas", "value": 136.47, "category": "Pessoal" },
    { "date": "2026-02-19", "description": "clinica nutricionista", "value": 1500.00, "category": "Pessoal" },
    { "date": "2026-02-19", "description": "olivio", "value": 1000.00, "category": "Pessoal" },
    { "date": "2026-02-19", "description": "pai samir", "value": 650.00, "category": "Pessoal" },
    { "date": "2026-02-20", "description": "edileia", "value": 350.00, "category": "Pessoal" },
    { "date": "2026-02-21", "description": "pasta de dente", "value": 69.80, "category": "Pessoal" },
    { "date": "2026-02-21", "description": "whey proten", "value": 129.90, "category": "Pessoal" },
    { "date": "2026-02-21", "description": "mercado pago", "value": 61.90, "category": "Pessoal" },
    { "date": "2026-02-22", "description": "shoppe", "value": 266.93, "category": "Pessoal" },
    { "date": "2026-02-23", "description": "pai cartao de credito", "value": 1600.00, "category": "Pessoal" },
    { "date": "2026-02-23", "description": "transferencia", "value": 3700.00, "category": "Pessoal" },
    { "date": "2026-02-23", "description": "murilo", "value": 200.00, "category": "Pessoal" },
    { "date": "2026-02-24", "description": "vale do amanhecer", "value": 510.00, "category": "Pessoal" }
];
async function main() {
    console.log('Iniciando script de seed financeiro de Fevereiro 2026...');
    // Pegamos ou criamos uma conta padrão para vincular essas transações.
    let defaultAccount = await prisma.account.findFirst({
        where: { name: 'Conta Principal' }
    });
    if (!defaultAccount) {
        // Caso não exista, procuramos qualquer conta
        defaultAccount = await prisma.account.findFirst();
        if (!defaultAccount) {
            defaultAccount = await prisma.account.create({
                data: {
                    name: 'Conta Principal',
                    balance: 0,
                    description: 'Conta criada automaticamente pelo script de seed'
                }
            });
            console.log(`[+] Conta bancária criada: ${defaultAccount.name}`);
        }
    }
    console.log(`[=] Usando conta: ${defaultAccount.name} (${defaultAccount.id})`);
    let insertedCount = 0;
    for (const item of payload) {
        const categoryName = item.category.trim();
        // Encontrar ou criar o Setor (Categoria de transação)
        let sector = await prisma.sector.findFirst({
            where: { name: categoryName, type: 'out' }
        });
        if (!sector) {
            sector = await prisma.sector.create({
                data: {
                    name: categoryName,
                    type: 'out'
                }
            });
            console.log(`[+] Categoria/Setor (Despesa) criado: ${sector.name}`);
        }
        // Criar a data, forçando a meia-noite ou hora específica para evitar fuso.
        // Usamos o append de T12:00:00.000Z para evitar problemas com timezone jogando pra D-1
        const transactionDate = new Date(`${item.date}T12:00:00.000Z`);
        // Verifica se a transação com valor e data e doc id idênticos já existe para evitar duplex.
        // Usamos uma heurística para não duplicar caso o script seja rodado duas vezes.
        const existingTransaction = await prisma.transaction.findFirst({
            where: {
                amount: item.value,
                description: item.description,
                sector_id: sector.id,
                operation: 'out',
                // Compara com base no início do dia e fim do dia para achar se existe
            }
        });
        // Na nossa verificação simples, apenas pulamos se os campos exatos (data no mesmo dia, valor, desc, setor) baterem.
        // Para simplificar, vou criar a transação sempre ou filtrar apenas se o description+amount+date baterem
        const startOfDay = new Date(`${item.date}T00:00:00.000Z`);
        const endOfDay = new Date(`${item.date}T23:59:59.999Z`);
        const exactExistingTransaction = await prisma.transaction.findFirst({
            where: {
                amount: item.value,
                description: item.description,
                sector_id: sector.id,
                operation: 'out',
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        });
        if (!exactExistingTransaction) {
            await prisma.transaction.create({
                data: {
                    operation: 'out',
                    amount: item.value,
                    date: transactionDate,
                    description: item.description,
                    account_id: defaultAccount.id,
                    sector_id: sector.id,
                    confirmed: true
                }
            });
            insertedCount++;
            console.log(`   └─ [Inserido] ${item.date} - ${item.description} - R$ ${item.value.toFixed(2)} (${sector.name})`);
        }
        else {
            console.log(`   └─ [Pulado] ${item.date} - ${item.description} já existe.`);
        }
    }
    console.log(`\n✅ Seed financeiro finalizado com sucesso! ${insertedCount} transações inseridas.`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
