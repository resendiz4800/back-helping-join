import useConnection from "../../../database";

const generateRecomendations = async (req, res) => {
  const response = {
    success: false,
    message: "",
    data: [],
  };

  const { voluntarioId } = req.query;

  try {
    const connection = await useConnection();

    const queryCategorias = `SELECT id_categoria FROM voluntario_categoria WHERE id_voluntario = ${voluntarioId};`;

    const resultCategorias = await connection.query(queryCategorias);

    const categorias = resultCategorias[0].map((c) => c.id_categoria);

    const cats = Array(18).fill(0);

    categorias.forEach((categoria) => {
      cats[categoria - 1] = 1;
    });

    const findEventos = `SELECT COUNT(*) AS total FROM evento WHERE fecha_fin > ${Date.now()};`;
    const eventos = await connection.query(findEventos);

    const N = eventos[0][0].total;

    const aprioriProbability = 1 / N;

    const getNormalization = `
    SELECT normalizacion.matriz, normalizacion.id_evento FROM normalizacion INNER JOIN evento ON evento.id_evento = normalizacion.id_evento WHERE fecha_fin > ${Date.now()};`;
    const normalizacionesResult = await connection.query(getNormalization);

    let normalizaciones = normalizacionesResult[0];

    for (let i = 0; i < normalizaciones.length; i++) {
      normalizaciones[i].matriz = JSON.parse(normalizaciones[i].matriz);
      let total = 1;
      for (let j = 0; j < cats.length; j++) {
        total *= normalizaciones[i].matriz[cats[j]][j];
      }

      total *= aprioriProbability;
      normalizaciones[i].total = total;
    }

    normalizaciones = normalizaciones
      .map(({ total, id_evento }) => ({ total: (total *= 10000), id_evento }))
      .sort((a, b) => {
        return b.total - a.total;
      })
      .slice(0, 10);

    const insertNormalizacion = `
    UPDATE recomendacion
    SET recomendacion = '${JSON.stringify(normalizaciones)}'
    WHERE id_voluntario = '${voluntarioId}';`;

    const resultNormalizacion = await connection.query(insertNormalizacion);

    if (resultNormalizacion[0].affectedRows !== 1) {
      await connection.end();
      throw new Error("No se pudo actualizar la normalizacion");
    }

    response.success = true;
    response.message = "Recomendaciones generadas";
    response.data = null;

    await connection.end();
    res.status(200).json(response);
  } catch (error) {
    console.error(error);
    response.success = false;
    response.message = error.message;
    res.status(500).json(response);
  }
};

export default generateRecomendations;
