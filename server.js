/*=========================================================
        BMJ SERVICE
        BACKEND NODE.JS
        EXPRESS + POSTGRESQL
=========================================================*/

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");


/*=========================================================
        1. APPLICATION
=========================================================*/

const app = express();


/*=========================================================
        2. PORT
=========================================================*/

const PORT =
    process.env.PORT || 3000;


/*=========================================================
        3. MIDDLEWARE
=========================================================*/

app.use(
    cors({
        origin: "*",
        methods: [
            "GET",
            "POST",
            "PATCH",
            "PUT",
            "DELETE",
            "OPTIONS"
        ],
        allowedHeaders: [
            "Content-Type",
            "Authorization"
        ]
    })
);


app.use(
    express.json({
        limit: "10mb"
    })
);


app.use(
    express.urlencoded({
        extended: true
    })
);


/*=========================================================
        4. CONNEXION POSTGRESQL
=========================================================*/

if (!process.env.DATABASE_URL) {

    console.error(
        "❌ DATABASE_URL n'est pas configurée."
    );

} else {

    console.log(
        "DATABASE_URL détectée."
    );

}


const pool = new Pool({

    connectionString:
        process.env.DATABASE_URL,

    ssl:
        process.env.NODE_ENV === "production"
            ? {
                rejectUnauthorized: false
            }
            : false

});


/*=========================================================
        5. TEST CONNEXION DATABASE
=========================================================*/

async function testerDatabase() {

    try {

        const resultat =
            await pool.query(
                "SELECT NOW() AS date"
            );


        console.log(
            "========================================"
        );

        console.log(
            "✅ PostgreSQL connecté"
        );

        console.log(
            "Date serveur DB :",
            resultat.rows[0].date
        );

        console.log(
            "========================================"
        );


    } catch (erreur) {

        console.error(
            "❌ Impossible de se connecter à PostgreSQL."
        );

        console.error(
            erreur.message
        );

    }

}


/*=========================================================
        6. CREATION TABLE APPRENANTS
=========================================================*/

async function creerTableApprenants() {

    const sql = `

        CREATE TABLE IF NOT EXISTS apprenants (

            id SERIAL PRIMARY KEY,

            nom VARCHAR(150),

            sexe VARCHAR(50),

            pays VARCHAR(100),

            telephone VARCHAR(50),

            ville VARCHAR(100),

            email VARCHAR(255) UNIQUE NOT NULL,

            domaine VARCHAR(150),

            niveau VARCHAR(100),

            password TEXT,

            photo TEXT,

            premium BOOLEAN DEFAULT FALSE,

            bloque BOOLEAN DEFAULT FALSE,

            "isProfessional" BOOLEAN DEFAULT FALSE,

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

        );

    `;


    try {

        await pool.query(sql);


        console.log(
            "✅ Table apprenants prête."
        );


    } catch (erreur) {

        console.error(
            "❌ Erreur création table apprenants :"
        );

        console.error(
            erreur.message
        );

    }

}


/*=========================================================
        7. ROUTE PRINCIPALE
=========================================================*/

app.get(
    "/",
    function (req, res) {

        res.json({

            success: true,

            message:
                "BMJ SERVICE API fonctionne.",

            api:
                "/api/apprenants"

        });

    }
);


/*=========================================================
        8. TEST DATABASE
=========================================================*/

app.get(
    "/api/test-db",
    async function (req, res) {

        try {

            const resultat =
                await pool.query(
                    "SELECT NOW() AS date"
                );


            res.json({

                success: true,

                message:
                    "Connexion PostgreSQL réussie.",

                date:
                    resultat.rows[0].date

            });


        } catch (erreur) {

            console.error(
                erreur
            );


            res.status(500).json({

                success: false,

                message:
                    "Erreur connexion PostgreSQL.",

                error:
                    erreur.message

            });

        }

    }
);


/*=========================================================
        9. GET TOUS LES APPRENANTS
=========================================================*/

app.get(
    "/api/apprenants",
    async function (req, res) {

        try {

            console.log(
                "GET /api/apprenants"
            );


            const resultat =
                await pool.query(`

                    SELECT

                        id,
                        nom,
                        sexe,
                        pays,
                        telephone,
                        ville,
                        email,
                        domaine,
                        niveau,
                        password,
                        photo,
                        premium,
                        bloque,
                        "isProfessional",
                        created_at,
                        updated_at

                    FROM apprenants

                    ORDER BY
                        created_at DESC

                `);


            console.log(
                "Nombre utilisateurs :",
                resultat.rows.length
            );


            res.status(200).json({

                success: true,

                count:
                    resultat.rows.length,

                data:
                    resultat.rows

            });


        } catch (erreur) {

            console.error(
                "GET /api/apprenants ERROR :",
                erreur
            );


            res.status(500).json({

                success: false,

                message:
                    "Impossible de récupérer les apprenants.",

                error:
                    erreur.message

            });

        }

    }
);


/*=========================================================
        10. GET UN APPRENANT PAR ID
=========================================================*/

app.get(
    "/api/apprenants/:id",
    async function (req, res) {

        try {

            const id =
                Number(req.params.id);


            if (
                !Number.isInteger(id)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "ID invalide."

                });

            }


            const resultat =
                await pool.query(

                    `

                    SELECT

                        id,
                        nom,
                        sexe,
                        pays,
                        telephone,
                        ville,
                        email,
                        domaine,
                        niveau,
                        password,
                        photo,
                        premium,
                        bloque,
                        "isProfessional",
                        created_at,
                        updated_at

                    FROM apprenants

                    WHERE id = $1

                    `,

                    [id]

                );


            if (
                resultat.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable."

                });

            }


            res.json({

                success: true,

                data:
                    resultat.rows[0]

            });


        } catch (erreur) {

            console.error(
                erreur
            );


            res.status(500).json({

                success: false,

                message:
                    "Erreur serveur.",

                error:
                    erreur.message

            });

        }

    }
);


/*=========================================================
        11. POST CREER APPRENANT
=========================================================*/

app.post(
    "/api/apprenants",
    async function (req, res) {

        try {

            console.log(
                "========================================"
            );

            console.log(
                "POST /api/apprenants"
            );

            console.log(
                "Données reçues :",
                req.body
            );


            const {

                nom,
                sexe,
                pays,
                telephone,
                ville,
                email,
                domaine,
                niveau,
                password,
                photo,
                premium,
                bloque,
                isProfessional

            } = req.body;


            /*-----------------------------------------
                VALIDATION EMAIL
            -----------------------------------------*/

            if (!email) {

                return res.status(400).json({

                    success: false,

                    message:
                        "L'adresse email est obligatoire."

                });

            }


            const emailNormalise =
                String(email)
                    .trim()
                    .toLowerCase();


            /*-----------------------------------------
                VERIFIER DOUBLON
            -----------------------------------------*/

            const existant =
                await pool.query(

                    `

                    SELECT id
                    FROM apprenants
                    WHERE LOWER(email) = $1

                    `,

                    [emailNormalise]

                );


            if (
                existant.rows.length > 0
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Un utilisateur avec cet email existe déjà.",

                    userId:
                        existant.rows[0].id

                });

            }


            /*-----------------------------------------
                INSERTION
            -----------------------------------------*/

            const resultat =
                await pool.query(

                    `

                    INSERT INTO apprenants (

                        nom,
                        sexe,
                        pays,
                        telephone,
                        ville,
                        email,
                        domaine,
                        niveau,
                        password,
                        photo,
                        premium,
                        bloque,
                        "isProfessional"

                    )

                    VALUES (

                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8,
                        $9,
                        $10,
                        $11,
                        $12,
                        $13

                    )

                    RETURNING *

                    `,

                    [

                        nom || null,

                        sexe || null,

                        pays || null,

                        telephone || null,

                        ville || null,

                        emailNormalise,

                        domaine || null,

                        niveau || null,

                        password || null,

                        photo || null,

                        Boolean(premium),

                        Boolean(bloque),

                        Boolean(isProfessional)

                    ]

                );


            console.log(
                "Utilisateur créé :",
                resultat.rows[0]
            );


            res.status(201).json({

                success: true,

                message:
                    "Utilisateur enregistré avec succès.",

                data:
                    resultat.rows[0]

            });


        } catch (erreur) {

            console.error(
                "POST /api/apprenants ERROR :",
                erreur
            );


            res.status(500).json({

                success: false,

                message:
                    "Impossible d'enregistrer l'utilisateur.",

                error:
                    erreur.message

            });

        }

    }
);


/*=========================================================
        12. PATCH MODIFIER APPRENANT
=========================================================*/

app.patch(
    "/api/apprenants/:id",
    async function (req, res) {

        try {

            const id =
                Number(req.params.id);


            if (
                !Number.isInteger(id)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "ID invalide."

                });

            }


            const champsAutorises = [

                "nom",
                "sexe",
                "pays",
                "telephone",
                "ville",
                "email",
                "domaine",
                "niveau",
                "password",
                "photo",
                "premium",
                "bloque",
                "isProfessional"

            ];


            const modifications = [];


            const valeurs = [];


            let compteur = 1;


            for (
                const champ
                of champsAutorises
            ) {

                if (
                    Object.prototype.hasOwnProperty.call(
                        req.body,
                        champ
                    )
                ) {

                    modifications.push(
                        `"${champ}" = $${compteur}`
                    );


                    let valeur =
                        req.body[champ];


                    if (
                        [
                            "premium",
                            "bloque",
                            "isProfessional"
                        ].includes(champ)
                    ) {

                        valeur =
                            Boolean(valeur);

                    }


                    if (
                        champ === "email"
                    ) {

                        valeur =
                            String(valeur)
                                .trim()
                                .toLowerCase();

                    }


                    valeurs.push(
                        valeur
                    );


                    compteur++;

                }

            }


            if (
                modifications.length === 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Aucune donnée à modifier."

                });

            }


            modifications.push(
                `updated_at = CURRENT_TIMESTAMP`
            );


            valeurs.push(id);


            const sql = `

                UPDATE apprenants

                SET

                    ${modifications.join(", ")}

                WHERE id = $${compteur}

                RETURNING *

            `;


            const resultat =
                await pool.query(
                    sql,
                    valeurs
                );


            if (
                resultat.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable."

                });

            }


            res.json({

                success: true,

                message:
                    "Utilisateur modifié avec succès.",

                data:
                    resultat.rows[0]

            });


        } catch (erreur) {

            console.error(
                "PATCH ERROR :",
                erreur
            );


            res.status(500).json({

                success: false,

                message:
                    "Erreur lors de la modification.",

                error:
                    erreur.message

            });

        }

    }
);


/*=========================================================
        13. ROUTE 404
=========================================================*/

app.use(
    function (req, res) {

        res.status(404).json({

            success: false,

            message:
                "Route introuvable.",

            method:
                req.method,

            route:
                req.originalUrl

        });

    }
);


/*=========================================================
        14. ERREUR GLOBALE
=========================================================*/

app.use(
    function (
        erreur,
        req,
        res,
        next
    ) {

        console.error(
            "ERREUR GLOBALE :",
            erreur
        );


        res.status(500).json({

            success: false,

            message:
                "Erreur interne du serveur.",

            error:
                erreur.message

        });

    }
);


/*=========================================================
        15. DEMARRAGE
=========================================================*/

async function demarrerServeur() {

    await testerDatabase();

    await creerTableApprenants();


    app.listen(
        PORT,
        function () {

            console.log(
                "========================================"
            );

            console.log(
                "🚀 BMJ SERVICE BACKEND"
            );

            console.log(
                `Port : ${PORT}`
            );

            console.log(
                `API : http://localhost:${PORT}/api/apprenants`
            );

            console.log(
                "========================================"
            );

        }
    );

}


demarrerServeur();