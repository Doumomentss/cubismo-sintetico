/**
 * questions.js - Banco de preguntas y desafíos sobre Cubismo Sintético
 * Adaptado para la actividad escolar de 6to año - Las Vanguardias
 */

const GAME_DATA = {
  vanguardia: "Cubismo Sintético",
  periodo: "1912 - 1914 (hasta ~1919)",
  cuna: "París, Francia",
  referentes: ["Juan Gris", "Pablo Picasso", "Georges Braque"],
  
  // AVATARES CUBISTAS PARA LOS GRUPOS
  avatars: [
    { id: "gris", name: "Los Juan Gris", icon: "G", color: "#2B5B84", quote: "El maestro del orden geométrico" },
    { id: "picasso", name: "Los Picassianos", icon: "P", color: "#C2593F", quote: "Pioneros del collage" },
    { id: "braque", name: "Papier Collé (Braque)", icon: "B", color: "#D99B26", quote: "Creador del papel pegado" },
    { id: "guitarra", name: "Guitarras Sintéticas", icon: "S", color: "#5A7D5E", quote: "El objeto más retratado" },
    { id: "diario", name: "Recortes de Prensa", icon: "D", color: "#7B6D8D", quote: "Textura de la realidad" },
    { id: "bodegon", name: "Naturaleza Muerta", icon: "M", color: "#A84343", quote: "Símbolo de la vida cotidiana" }
  ],

  // RONDA 1: PREGUNTADOS DE VANGUARDIA (Trivia Eliminatoria)
  ronda1: [
    {
      id: 1,
      tema: "Origen y Contexto",
      pregunta: "¿Dónde y en qué período surge el Cubismo Sintético como evolución del Analítico?",
      opciones: [
        "En París (Francia), aproximadamente entre 1912 y 1914",
        "En Berlín (Alemania), durante la Segunda Guerra Mundial (1939)",
        "En Madrid (España), a finales del siglo XIX (1880)",
        "En Nueva York (EE.UU.), en la década de 1950"
      ],
      correcta: 0,
      explicacion: "El Cubismo Sintético nació en París entre 1912 y 1914, como una superación de la etapa analítica de Picasso y Braque."
    },
    {
      id: 2,
      tema: "Problema Estético",
      pregunta: "¿Cuál era el principal límite o 'problema' del Cubismo Analítico que motivó el nacimiento del Cubismo Sintético?",
      opciones: [
        "Los artistas no tenían suficiente pintura al óleo en Europa",
        "La iglesia prohibió el uso de figuras humanas en los cuadros",
        "Las obras se volvieron casi abstractas, monótonas y difíciles de interpretar",
        "Las obras analíticas eran demasiado coloridas y realistas"
      ],
      correcta: 2,
      explicacion: "El Cubismo Analítico fragmentaba tanto el objeto y usaba tonos tan apagados (grises y ocres) que bordeaba la abstracción total, perdiendo contacto con el objeto real."
    },
    {
      id: 3,
      tema: "Técnica Revolucionaria",
      pregunta: "¿Qué técnica innovadora introdujo esta etapa al incorporar recortes de periódicos, papeles pintados y partituras?",
      opciones: [
        "El aerógrafo digital y la acuarela japonesa",
        "El Collage y el Papier Collé (papel pegado)",
        "El fresco renacentista sobre yeso húmedo",
        "El puntillismo con cera de abeja"
      ],
      correcta: 1,
      explicacion: "Braque y Picasso inventaron el 'papier collé' y el collage, pegando trozos de diarios reales, hule y partituras directamente en el lienzo."
    },
    {
      id: 4,
      tema: "Uso del Color",
      pregunta: "A diferencia del Cubismo Analítico (monocromático en grises y marrones), ¿cómo es el color en el Cubismo Sintético?",
      opciones: [
        "Totalmente en blanco y negro sin ninguna sombra",
        "Únicamente tonos dorados y plateados religiosos",
        "Pastel transparente similar al impresionismo",
        "Mucho más vivo, con planos de color más amplios y contrastados"
      ],
      correcta: 3,
      explicacion: "El Cubismo Sintético devolvió la alegría cromática con colores más luminosos, planos amplios y saturados."
    },
    {
      id: 5,
      tema: "Artistas Clave",
      pregunta: "¿Qué pintor español fue una de las máximas figuras del Cubismo Sintético, célebre por obras como 'El Desayuno' (1914)?",
      opciones: [
        "Diego Velázquez",
        "Juan Gris",
        "Salvador Dalí",
        "Francisco de Goya"
      ],
      correcta: 1,
      explicacion: "Juan Gris aportó un rigor matemático y geométrico inconfundible, consolidándose como uno de los líderes indiscutidos del cubismo sintético."
    },
    {
      id: 6,
      tema: "Significado de 'Sintético'",
      pregunta: "¿Por qué se llama 'Sintético' a esta fase del cubismo?",
      opciones: [
        "Porque 'sintetiza' y reconstruye el objeto con sus rasgos más representativos y reconocibles",
        "Porque utilizaban pinturas de plástico y materiales artificiales de laboratorio",
        "Porque duró muy poco tiempo y fue una etapa sintética o breve",
        "Porque fue creada exclusivamente por sintetizadores musicales de la época"
      ],
      correcta: 0,
      explicacion: "En lugar de romper el objeto en mil pedazos (analizarlo), el artista 'sintetiza': toma las partes más reconocibles y compone un nuevo objeto figurativo."
    },
    {
      id: 7,
      tema: "Obra Histórica",
      pregunta: "¿Qué célebre obra de Picasso de 1912, que incorpora un pedazo de hule con estampado de mimbre y una cuerda, marca el inicio del collage cubista?",
      opciones: [
        "'Las señoritas de Avignon'",
        "'El Guernica'",
        "'Naturaleza muerta con silla de rejilla'",
        "'La persistencia de la memoria'"
      ],
      correcta: 2,
      explicacion: "'Naturaleza muerta con silla de rejilla' (1912) es la obra fundacional donde Picasso pegó un hule industrial enmarcado con una soga real."
    },
    {
      id: 8,
      tema: "Objetos Cotidianos",
      pregunta: "¿Cuáles eran los objetos predilectos que los cubistas sintéticos representaban en sus bodegones?",
      opciones: [
        "Naves espaciales, máquinas de vapor y rascacielos futuristas",
        "Retratos de reyes medievales y santos con aureolas",
        "Paisajes campestres con montañas y puestas de sol",
        "Guitarras, botellas de licor, pipas, vasos, periódicos y cartas"
      ],
      correcta: 3,
      explicacion: "Eran objetos de la vida bohemia de los cafés de París: instrumentos musicales (guitarras, violines), copas de absenta, botellas de vino y prensa diaria."
    }
  ],

  // RONDA 2: EL GRAN DESAFÍO VISUAL "¿SINTÉTICO O ENGAÑO?" (Ronda Rápida de Fotos/Conceptos)
  ronda2: [
    {
      id: 201,
      titulo: "¿Verdadero o Falso?",
      afirmacion: "En el Cubismo Sintético se busca que el espectador pueda volver a reconocer los objetos en la obra.",
      esVerdadero: true,
      explicacion: "¡Verdadero! Tras la casi total abstracción del cubismo analítico, el sintético buscó recuperar la legibilidad del objeto."
    },
    {
      id: 202,
      titulo: "¿Sintético o Analítico?",
      afirmacion: "Una obra que usa grises opacos, marrones terrosos y rompe un violín en 100 facetas irreconocibles corresponde a:",
      opciones: ["Cubismo Analítico", "Cubismo Sintético"],
      correcta: 0,
      explicacion: "Es Analítico. El analítico deconstruye y apaga los colores; el sintético unifica con texturas y colores definidos."
    },
    {
      id: 203,
      titulo: "¿Verdadero o Falso?",
      afirmacion: "El Cubismo Sintético se caracterizó por prohibir totalmente el color y los recortes de papel, volviendo al dibujo clásico renacentista.",
      esVerdadero: false,
      explicacion: "¡Falso! Al contrario: introdujo colores luminosos, formas simplificadas y el uso pionero de recortes de periódicos y papeles pegados (collage y papier collé)."
    },
    {
      id: 204,
      titulo: "Técnica y Geometría",
      afirmacion: "¿Es cierto que Juan Gris aplicaba cálculos y proporciones matemáticas precisas para ubicar cada elemento en sus naturalezas muertas?",
      esVerdadero: true,
      explicacion: "¡Verdadero! Juan Gris era conocido como el cubista más intelectual y metódico en su orden geométrico."
    },
    {
      id: 205,
      titulo: "Desafío Histórico",
      afirmacion: "El auge del cubismo sintético en París se vio interrumpido en 1914 principalmente debido al estallido de la Primera Guerra Mundial.",
      esVerdadero: true,
      explicacion: "¡Verdadero! En 1914, con el inicio de la Gran Guerra, artistas como Braque y Derain fueron movilizados al frente bélico."
    }
  ]
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GAME_DATA;
}
