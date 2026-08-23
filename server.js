/* =========================================================
   BMJ SERVICE
   BACKEND API
   NODE.JS + EXPRESS + POSTGRESQL
   RENDER

   ROUTES :

   GET  /
   GET  /api/test-db

   POST /api/inscription
   POST /api/connexion

   POST /api/admin/connexion
   GET  /api/admin/verifier

   GET  /api/apprenants

   GET  /api/paiements
   POST /api/paiements
========================================================= */


const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 3000;


/* =========================================================
   CONFIGURATION POSTGRESQL
========================================================= */

/*
   IMPORTANT

   Pour l'instant, le serveur utilise DATABASE_URL
   si elle existe dans Render.

   Sinon, mets ton URL PostgreSQL ici.

   Exemple :

   const DATABASE_URL =
       "postgresql://USER:PASSWORD@HOST/DATABASE";
*/

const DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://bmj_db_user:5FSX8YeJNzwinKdFOrIeEC43aQsuzf91@dpg-d9sdlt49v7es73emrq8g-a/bmj_db";


/* =========================================================
   POOL POSTGRESQL
========================================================= */

const pool = new Pool({

    connectionString: DATABASE_URL,

    ssl: {
        rejectUnauthorized: false
    }

});


/* =========================================================
   CORS
========================================================= */

app.use(
    cors({

        origin: "*",

        methods: [
            "GET",
            "POST",
            "PUT",
            "DELETE",
            "PATCH",
            "OPTIONS"
        ],

        allowedHeaders: [
            "Content-Type",
            "Authorization"
        ]

    })
);


/* =========================================================
   JSON
========================================================= */

app.use(
    express.json({
        limit: "15mb"
    })
);


app.use(
    express.urlencoded({
        extended: true,
        limit: "15mb"
    })
);


/* =========================================================
   TEST POSTGRESQL
========================================================= */

async function testerDatabase() {

    try {

        const result = await pool.query(
            "SELECT NOW() AS heure"
        );

        console.log(
            "================================="
        );

        console.log(
            "✅ POSTGRESQL CONNECTÉ"
        );

        console.log(
            "🕐 Heure :",
            result.rows[0].heure
        );

        console.log(
            "================================="
        );

        return true;

    } catch (error) {

        console.error(
            "================================="
        );

        console.error(
            "❌ ERREUR POSTGRESQL"
        );

        console.error(
            error.message
        );

        console.error(
            "================================="
        );

        return false;
    }
}


/* =========================================================
   CRÉATION DES TABLES
========================================================= */

async function creerTables() {

    try {


        /* =====================================================
           TABLE USERS
        ===================================================== */

        await pool.query(`

            CREATE TABLE IF NOT EXISTS users (

                id SERIAL PRIMARY KEY,

                nom VARCHAR(150) NOT NULL,

                email VARCHAR(255) UNIQUE NOT NULL,

                telephone VARCHAR(50),

                password TEXT NOT NULL,

                domaine VARCHAR(150),

                premium BOOLEAN DEFAULT FALSE,

                is_premium BOOLEAN DEFAULT FALSE,

                photo TEXT,

                date_creation
                    TIMESTAMP DEFAULT CURRENT_TIMESTAMP

            );

        `);


        /* =====================================================
           TABLE ADMINS
        ===================================================== */

        await pool.query(`

            CREATE TABLE IF NOT EXISTS admins (

                id SERIAL PRIMARY KEY,

                nom VARCHAR(150) NOT NULL,

                email VARCHAR(255) UNIQUE NOT NULL,

                secret_key TEXT NOT NULL,

                role VARCHAR(50)
                    DEFAULT 'admin',

                date_creation
                    TIMESTAMP DEFAULT CURRENT_TIMESTAMP

            );

        `);


        /* =====================================================
           TABLE PAIEMENTS
        ===================================================== */

        await pool.query(`

            CREATE TABLE IF NOT EXISTS paiements (

                id SERIAL PRIMARY KEY,

                id_paiement
                    VARCHAR(150) UNIQUE NOT NULL,

                utilisateur_id
                    VARCHAR(150),

                nom
                    VARCHAR(150),

                email
                    VARCHAR(255),

                offre
                    VARCHAR(150),

                montant
                    NUMERIC(12,2),

                devise
                    VARCHAR(10),

                methode
                    VARCHAR(100),

                capture
                    TEXT,

                statut
                    VARCHAR(50)
                    DEFAULT 'en_attente',

                date
                    TIMESTAMP DEFAULT CURRENT_TIMESTAMP

            );

        `);


        /* =====================================================
           CRÉER LE COMPTE ADMIN PAR DÉFAUT
        ===================================================== */

        const adminEmail =
            "admin@bmjservice.com";

        const adminSecret =
            "BMJ-ADMIN-2026";


        const adminExiste =
            await pool.query(

                `

                SELECT id

                FROM admins

                WHERE email = $1

                LIMIT 1

                `,

                [
                    adminEmail
                ]

            );


        if (
            adminExiste.rows.length === 0
        ) {

            await pool.query(

                `

                INSERT INTO admins
                (
                    nom,
                    email,
                    secret_key,
                    role
                )

                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4
                )

                `,

                [
                    "Administrateur BMJ SERVICE",
                    adminEmail,
                    adminSecret,
                    "admin"
                ]

            );

            console.log(
                "✅ COMPTE ADMIN CRÉÉ"
            );

        } else {

            console.log(
                "ℹ️ COMPTE ADMIN DÉJÀ EXISTANT"
            );

        }


        console.log(
            "✅ TABLES VÉRIFIÉES"
        );


    } catch (error) {

        console.error(
            "❌ ERREUR CRÉATION TABLES :",
            error.message
        );

    }

}


/* =========================================================
   PAGE PRINCIPALE
========================================================= */

app.get(
    "/",
    (req, res) => {

        res.json({

            success: true,

            message:
                "BMJ SERVICE API fonctionne.",

            api: {

                testDB:
                    "/api/test-db",

                inscription:
                    "/api/inscription",

                connexion:
                    "/api/connexion",

                adminConnexion:
                    "/api/admin/connexion",

                adminVerification:
                    "/api/admin/verifier",

                apprenants:
                    "/api/apprenants",

                paiements:
                    "/api/paiements"

            }

        });

    }
);


/* =========================================================
   TEST DATABASE
========================================================= */

app.get(
    "/api/test-db",
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    "SELECT NOW() AS heure"
                );


            res.json({

                success: true,

                message:
                    "PostgreSQL fonctionne.",

                database:
                    result.rows[0].heure

            });


        } catch (error) {

            console.error(
                "❌ TEST DB :",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Erreur connexion PostgreSQL.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   INSCRIPTION UTILISATEUR
========================================================= */

app.post(
    "/api/inscription",
    async (req, res) => {

        try {

            const {

                nom,
                email,
                telephone,
                password,
                domaine,
                photo

            } = req.body;


            /* ----------------------------------------------
               VALIDATION
            ---------------------------------------------- */

            if (
                !nom ||
                !email ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Nom, email et mot de passe obligatoires."

                });

            }


            const emailNormalise =
                String(email)
                    .trim()
                    .toLowerCase();


            /* ----------------------------------------------
               VÉRIFIER EMAIL
            ---------------------------------------------- */

            const existe =
                await pool.query(

                    `

                    SELECT id

                    FROM users

                    WHERE email = $1

                    LIMIT 1

                    `,

                    [
                        emailNormalise
                    ]

                );


            if (
                existe.rows.length > 0
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Cette adresse email est déjà utilisée."

                });

            }


            /* ----------------------------------------------
               CRÉER UTILISATEUR
            ---------------------------------------------- */

            const result =
                await pool.query(

                    `

                    INSERT INTO users
                    (
                        nom,
                        email,
                        telephone,
                        password,
                        domaine,
                        premium,
                        is_premium,
                        photo
                    )

                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        FALSE,
                        FALSE,
                        $6
                    )

                    RETURNING
                        id,
                        nom,
                        email,
                        telephone,
                        domaine,
                        premium,
                        is_premium,
                        photo,
                        date_creation

                    `,

                    [

                        nom.trim(),

                        emailNormalise,

                        telephone || null,

                        password,

                        domaine || null,

                        photo || null

                    ]

                );


            res.status(201).json({

                success: true,

                message:
                    "Inscription réussie.",

                data:
                    result.rows[0],

                user:
                    result.rows[0],

                utilisateur:
                    result.rows[0]

            });


        } catch (error) {

            console.error(
                "❌ ERREUR INSCRIPTION :",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Erreur serveur lors de l'inscription.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   CONNEXION UTILISATEUR
========================================================= */

app.post(
    "/api/connexion",
    async (req, res) => {

        try {

            const {

                identifiant,
                email,
                password

            } = req.body;


            /*
               Ton ancien frontend utilise :

               identifiant

               On accepte également :

               email
            */

            const login =
                identifiant ||
                email;


            if (
                !login ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Email et mot de passe obligatoires."

                });

            }


            const loginNormalise =
                String(login)
                    .trim()
                    .toLowerCase();


            /* ----------------------------------------------
               RECHERCHE
            ---------------------------------------------- */

            const result =
                await pool.query(

                    `

                    SELECT

                        id,
                        nom,
                        email,
                        telephone,
                        password,
                        domaine,
                        premium,
                        is_premium,
                        photo,
                        date_creation

                    FROM users

                    WHERE email = $1

                    LIMIT 1

                    `,

                    [
                        loginNormalise
                    ]

                );


            if (
                result.rows.length === 0
            ) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Email ou mot de passe incorrect.",

                    error:
                        "Email ou mot de passe incorrect."

                });

            }


            const utilisateur =
                result.rows[0];


            /* ----------------------------------------------
               MOT DE PASSE
            ---------------------------------------------- */

            if (
                utilisateur.password !==
                password
            ) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Email ou mot de passe incorrect.",

                    error:
                        "Email ou mot de passe incorrect."

                });

            }


            /* ----------------------------------------------
               NE PAS ENVOYER PASSWORD
            ---------------------------------------------- */

            delete utilisateur.password;


            res.json({

                success: true,

                message:
                    "Connexion réussie.",

                data:
                    utilisateur,

                user:
                    utilisateur,

                utilisateur:
                    utilisateur

            });


        } catch (error) {

            console.error(
                "❌ ERREUR CONNEXION :",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Erreur serveur lors de la connexion.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   CONNEXION ADMIN
========================================================= */

app.post(
    "/api/admin/connexion",
    async (req, res) => {

        try {

            const {

                email,
                secretKey

            } = req.body;


            /* ----------------------------------------------
               VALIDATION
            ---------------------------------------------- */

            if (
                !email ||
                !secretKey
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Email et code secret obligatoires.",

                    error:
                        "Email et code secret obligatoires."

                });

            }


            const emailNormalise =
                String(email)
                    .trim()
                    .toLowerCase();


            /* ----------------------------------------------
               RECHERCHE ADMIN
            ---------------------------------------------- */

            const result =
                await pool.query(

                    `

                    SELECT

                        id,
                        nom,
                        email,
                        secret_key,
                        role,
                        date_creation

                    FROM admins

                    WHERE email = $1

                    LIMIT 1

                    `,

                    [
                        emailNormalise
                    ]

                );


            /* ----------------------------------------------
               ADMIN INTROUVABLE
            ---------------------------------------------- */

            if (
                result.rows.length === 0
            ) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Administrateur introuvable.",

                    error:
                        "Email ou code secret incorrect."

                });

            }


            const admin =
                result.rows[0];


            /* ----------------------------------------------
               VÉRIFICATION CODE SECRET
            ---------------------------------------------- */

            if (
                admin.secret_key !==
                secretKey
            ) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Code secret incorrect.",

                    error:
                        "Email ou code secret incorrect."

                });

            }


            /* ----------------------------------------------
               NE PAS RETOURNER SECRET
            ---------------------------------------------- */

            delete admin.secret_key;


            /* ----------------------------------------------
               RETOUR
            ---------------------------------------------- */

            res.json({

                success: true,

                message:
                    "Authentification administrateur réussie.",

                data: {

                    ...admin,

                    isAdmin: true,

                    admin: true

                }

            });


        } catch (error) {

            console.error(
                "❌ ERREUR CONNEXION ADMIN :",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Erreur serveur lors de la connexion administrateur.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   VÉRIFIER UN ADMIN
========================================================= */

app.get(
    "/api/admin/verifier",
    async (req, res) => {

        try {

            const email =
                req.query.email;


            if (!email) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Email administrateur obligatoire."

                });

            }


            const emailNormalise =
                String(email)
                    .trim()
                    .toLowerCase();


            const result =
                await pool.query(

                    `

                    SELECT

                        id,
                        nom,
                        email,
                        role,
                        date_creation

                    FROM admins

                    WHERE email = $1

                    LIMIT 1

                    `,

                    [
                        emailNormalise
                    ]

                );


            if (
                result.rows.length === 0
            ) {

                return res.json({

                    success: true,

                    isAdmin: false,

                    data: null

                });

            }


            res.json({

                success: true,

                isAdmin: true,

                data:
                    result.rows[0]

            });


        } catch (error) {

            console.error(
                "❌ ERREUR VÉRIFICATION ADMIN :",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Erreur lors de la vérification administrateur.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   RÉCUPÉRER LES APPRENANTS
========================================================= */

app.get(
    "/api/apprenants",
    async (req, res) => {

        try {

            const result =
                await pool.query(

                    `

                    SELECT

                        id,
                        nom,
                        email,
                        telephone,
                        domaine,
                        premium,
                        is_premium,
                        photo,
                        date_creation

                    FROM users

                    ORDER BY id DESC

                    `

                );


            res.json({

                success: true,

                data:
                    result.rows,

                total:
                    result.rows.length

            });


        } catch (error) {

            console.error(
                "❌ ERREUR APPRENANTS :",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Impossible de récupérer les apprenants.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   RÉCUPÉRER LES PAIEMENTS
========================================================= */

app.get(
    "/api/paiements",
    async (req, res) => {

        try {

            const result =
                await pool.query(

                    `

                    SELECT *

                    FROM paiements

                    ORDER BY id DESC

                    `

                );


            res.json({

                success: true,

                data:
                    result.rows,

                total:
                    result.rows.length

            });


        } catch (error) {

            console.error(
                "❌ ERREUR PAIEMENTS :",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Impossible de récupérer les paiements.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   ENREGISTRER UN PAIEMENT
========================================================= */

app.post(
    "/api/paiements",
    async (req, res) => {

        try {

            const {

                idPaiement,
                utilisateurID,
                nom,
                email,
                offre,
                montant,
                devise,
                methode,
                capture,
                statut

            } = req.body;


            if (
                !idPaiement ||
                !email
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "ID paiement et email obligatoires."

                });

            }


            const emailNormalise =
                String(email)
                    .trim()
                    .toLowerCase();


            /* ----------------------------------------------
               DOUBLON
            ---------------------------------------------- */

            const existe =
                await pool.query(

                    `

                    SELECT id

                    FROM paiements

                    WHERE id_paiement = $1

                    LIMIT 1

                    `,

                    [
                        idPaiement
                    ]

                );


            if (
                existe.rows.length > 0
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Ce paiement existe déjà."

                });

            }


            /* ----------------------------------------------
               INSERTION
            ---------------------------------------------- */

            const result =
                await pool.query(

                    `

                    INSERT INTO paiements
                    (
                        id_paiement,
                        utilisateur_id,
                        nom,
                        email,
                        offre,
                        montant,
                        devise,
                        methode,
                        capture,
                        statut
                    )

                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8,
                        $9,
                        $10
                    )

                    RETURNING *

                    `,

                    [

                        idPaiement,

                        utilisateurID ||
                            null,

                        nom ||
                            null,

                        emailNormalise,

                        offre ||
                            null,

                        montant ||
                            0,

                        devise ||
                            "USD",

                        methode ||
                            null,

                        capture ||
                            null,

                        statut ||
                            "en_attente"

                    ]

                );


            res.status(201).json({

                success: true,

                message:
                    "Paiement enregistré.",

                data:
                    result.rows[0]

            });


        } catch (error) {

            console.error(
                "❌ ERREUR PAIEMENT :",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Erreur lors de l'enregistrement du paiement.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   ROUTE INEXISTANTE
========================================================= */

app.use(
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                "Route introuvable.",

            route:
                req.originalUrl

        });

    }
);


/* =========================================================
   DÉMARRAGE SERVEUR
========================================================= */

app.listen(
    PORT,
    async () => {

        console.log("");

        console.log(
            "========================================"
        );

        console.log(
            "🚀 BMJ SERVICE BACKEND"
        );

        console.log(
            "========================================"
        );

        console.log(
            "🌐 Port :",
            PORT
        );

        console.log(
            "========================================"
        );


        const connexion =
            await testerDatabase();


        if (connexion) {

            await creerTables();

        }

    }
);