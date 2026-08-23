/* =========================================================
   BMJ SERVICE
   BACKEND API COMPLET
   NODE.JS + EXPRESS + POSTGRESQL
   RENDER

   =========================================================

   ROUTES UTILISATEURS
   ---------------------------------------------------------
   GET     /
   GET     /api/test-db

   POST    /api/inscription
   POST    /api/connexion

   =========================================================

   ROUTES ADMIN
   ---------------------------------------------------------
   POST    /api/admin/connexion
   GET     /api/admin/verifier

   =========================================================

   ROUTES APPRENANTS
   ---------------------------------------------------------
   GET     /api/apprenants
   GET     /api/apprenants/:id
   PUT     /api/apprenants/:id/premium

   =========================================================

   ROUTES PAIEMENTS
   ---------------------------------------------------------
   GET     /api/paiements
   GET     /api/paiements/:id
   POST    /api/paiements

   PUT     /api/paiements/:id/valider
   PUT     /api/paiements/:id/refuser

   =========================================================

   DEBUG
   ---------------------------------------------------------
   GET     /api/debug/routes

   =========================================================
*/


/* =========================================================
   IMPORTATIONS
========================================================= */

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");


/* =========================================================
   APPLICATION
========================================================= */

const app = express();


/* =========================================================
   PORT
========================================================= */

const PORT =
    process.env.PORT || 3000;


/* =========================================================
   CONFIGURATION DATABASE
========================================================= */

/*
   IMPORTANT

   Les informations sont directement placées ici
   comme demandé.

   ⚠️ Pour la sécurité, change le mot de passe PostgreSQL
   après les tests puisque ces identifiants ont été exposés.
*/

const DATABASE_URL =
    "postgresql://bmj_db_user:5FSX8YeJNzwinKdFOrIeEC43aQsuzf91@dpg-d9sdlt49v7es73emrq8g-a/bmj_db";


/* =========================================================
   CONFIGURATION ADMIN
========================================================= */

const ADMIN_EMAIL =
    "admin@bmjservice.com";

const ADMIN_SECRET =
    "BMJ-ADMIN-2026";


/* =========================================================
   POOL POSTGRESQL
========================================================= */

const pool =
    new Pool({

        connectionString:
            DATABASE_URL,

        ssl: {
            rejectUnauthorized: false
        },

        max: 10,

        idleTimeoutMillis:
            30000,

        connectionTimeoutMillis:
            10000

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
            "PATCH",
            "DELETE",
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

        limit: "20mb"

    })

);


/* =========================================================
   URLENCODED
========================================================= */

app.use(

    express.urlencoded({

        extended: true,

        limit: "20mb"

    })

);


/* =========================================================
   OUTILS
========================================================= */


/* ---------------------------------------------------------
   NORMALISER EMAIL
--------------------------------------------------------- */

function normaliserEmail(email) {

    return String(email || "")
        .trim()
        .toLowerCase();

}


/* ---------------------------------------------------------
   NORMALISER STATUT
--------------------------------------------------------- */

function normaliserStatut(statut) {

    if (!statut) {

        return "";

    }

    return String(statut)
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

}


/* ---------------------------------------------------------
   TRANSFORMER USER
--------------------------------------------------------- */

function utilisateurPublic(utilisateur) {

    if (!utilisateur) {

        return null;

    }

    return {

        id:
            utilisateur.id,

        nom:
            utilisateur.nom,

        email:
            utilisateur.email,

        telephone:
            utilisateur.telephone,

        domaine:
            utilisateur.domaine,

        premium:
            utilisateur.premium === true,

        is_premium:
            utilisateur.is_premium === true,

        isPremium:
            utilisateur.is_premium === true,

        photo:
            utilisateur.photo,

        date_creation:
            utilisateur.date_creation

    };

}


/* =========================================================
   TEST DATABASE
========================================================= */

async function testerDatabase() {

    try {

        const result =
            await pool.query(
                "SELECT NOW() AS heure"
            );


        console.log(
            "========================================"
        );

        console.log(
            "✅ POSTGRESQL CONNECTÉ"
        );

        console.log(
            "🕐 Heure :",
            result.rows[0].heure
        );

        console.log(
            "========================================"
        );


        return true;


    } catch (error) {

        console.error(
            "========================================"
        );

        console.error(
            "❌ ERREUR POSTGRESQL"
        );

        console.error(
            error.message
        );

        console.error(
            "========================================"
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
           COMPATIBILITÉ ANCIENNES TABLES
        ===================================================== */

        await pool.query(`

            ALTER TABLE users

            ADD COLUMN IF NOT EXISTS premium
            BOOLEAN DEFAULT FALSE;

        `);


        await pool.query(`

            ALTER TABLE users

            ADD COLUMN IF NOT EXISTS is_premium
            BOOLEAN DEFAULT FALSE;

        `);


        await pool.query(`

            ALTER TABLE users

            ADD COLUMN IF NOT EXISTS photo
            TEXT;

        `);


        /* =====================================================
           CRÉATION ADMIN
        ===================================================== */

        const adminExiste =
            await pool.query(

                `

                SELECT id

                FROM admins

                WHERE email = $1

                LIMIT 1

                `,

                [
                    ADMIN_EMAIL
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

                    ADMIN_EMAIL,

                    ADMIN_SECRET,

                    "admin"

                ]

            );


            console.log(
                "✅ COMPTE ADMIN CRÉÉ"
            );


        } else {

            /*
               On synchronise aussi le secret
               avec celui défini dans le serveur.
            */

            await pool.query(

                `

                UPDATE admins

                SET
                    secret_key = $1,
                    role = 'admin'

                WHERE email = $2

                `,

                [
                    ADMIN_SECRET,
                    ADMIN_EMAIL
                ]

            );


            console.log(
                "ℹ️ COMPTE ADMIN EXISTANT"
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

            version:
                "2.0.0",

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

                apprenant:
                    "/api/apprenants/:id",

                premium:
                    "/api/apprenants/:id/premium",

                paiements:
                    "/api/paiements",

                paiement:
                    "/api/paiements/:id",

                validerPaiement:
                    "/api/paiements/:id/valider",

                refuserPaiement:
                    "/api/paiements/:id/refuser",

                debugRoutes:
                    "/api/debug/routes"

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
   INSCRIPTION
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
                normaliserEmail(email);


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

                        String(nom).trim(),

                        emailNormalise,

                        telephone || null,

                        password,

                        domaine || null,

                        photo || null

                    ]

                );


            const user =
                utilisateurPublic(
                    result.rows[0]
                );


            res.status(201).json({

                success: true,

                message:
                    "Inscription réussie.",

                data:
                    user,

                user:
                    user,

                utilisateur:
                    user

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
                normaliserEmail(login);


            const result =
                await pool.query(

                    `

                    SELECT *

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


            if (
                utilisateur.password !==
                password
            ) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Email ou mot de passe incorrect."

                });

            }


            const user =
                utilisateurPublic(
                    utilisateur
                );


            res.json({

                success: true,

                message:
                    "Connexion réussie.",

                data:
                    user,

                user:
                    user,

                utilisateur:
                    user

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
                secretKey,
                secret_key

            } = req.body;


            const secret =
                secretKey ||
                secret_key;


            if (
                !email ||
                !secret
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Email et code secret obligatoires."

                });

            }


            const emailNormalise =
                normaliserEmail(email);


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


            if (
                result.rows.length === 0
            ) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Administrateur introuvable."

                });

            }


            const admin =
                result.rows[0];


            if (
                admin.secret_key !==
                secret
            ) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Code secret incorrect."

                });

            }


            delete admin.secret_key;


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
                "❌ ERREUR ADMIN :",
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
   VÉRIFIER ADMIN
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
                normaliserEmail(email);


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
                "❌ ERREUR VERIFICATION ADMIN :",
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
   RÉCUPÉRER TOUS LES APPRENANTS
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
   RÉCUPÉRER UN APPRENANT
========================================================= */

app.get(
    "/api/apprenants/:id",
    async (req, res) => {

        try {

            const id =
                parseInt(
                    req.params.id,
                    10
                );


            if (
                Number.isNaN(id)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "ID utilisateur invalide."

                });

            }


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

                    WHERE id = $1

                    LIMIT 1

                    `,

                    [
                        id
                    ]

                );


            if (
                result.rows.length === 0
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
                    result.rows[0]

            });


        } catch (error) {

            console.error(
                "❌ ERREUR UTILISATEUR :",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Erreur récupération utilisateur.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   MODIFIER LE PREMIUM D'UN UTILISATEUR
=========================================================

   ROUTE :

   PUT /api/apprenants/:id/premium

   Body accepté :

   {
       "premium": true
   }

   ou :

   {
       "is_premium": true
   }

   ou :

   {
       "premium": false
   }

========================================================= */

app.put(
    "/api/apprenants/:id/premium",
    async (req, res) => {

        try {

            const id =
                parseInt(
                    req.params.id,
                    10
                );


            if (
                Number.isNaN(id)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "ID utilisateur invalide."

                });

            }


            let valeur;


            if (
                typeof req.body.premium ===
                "boolean"
            ) {

                valeur =
                    req.body.premium;

            }

            else if (
                typeof req.body.is_premium ===
                "boolean"
            ) {

                valeur =
                    req.body.is_premium;

            }

            else if (
                typeof req.body.value ===
                "boolean"
            ) {

                valeur =
                    req.body.value;

            }

            else {

                return res.status(400).json({

                    success: false,

                    message:
                        "La valeur Premium doit être true ou false."

                });

            }


            /* =================================================
               MODIFICATION
            ================================================= */

            const result =
                await pool.query(

                    `

                    UPDATE users

                    SET

                        premium = $1,

                        is_premium = $1

                    WHERE id = $2

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
                        valeur,
                        id
                    ]

                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable."

                });

            }


            const user =
                result.rows[0];


            console.log(
                "========================================"
            );

            console.log(
                "⭐ PREMIUM MODIFIÉ"
            );

            console.log(
                "Utilisateur :",
                user.email
            );

            console.log(
                "Premium :",
                valeur
            );

            console.log(
                "========================================"
            );


            res.json({

                success: true,

                message:
                    valeur
                        ? "Premium activé avec succès."
                        : "Premium désactivé avec succès.",

                premium:
                    valeur,

                is_premium:
                    valeur,

                data:
                    user

            });


        } catch (error) {

            console.error(
                "❌ ERREUR MODIFICATION PREMIUM :",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Impossible de modifier le Premium.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   RÉCUPÉRER TOUS LES PAIEMENTS
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
   RÉCUPÉRER UN PAIEMENT
========================================================= */

app.get(
    "/api/paiements/:id",
    async (req, res) => {

        try {

            const id =
                parseInt(
                    req.params.id,
                    10
                );


            if (
                Number.isNaN(id)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "ID paiement invalide."

                });

            }


            const result =
                await pool.query(

                    `

                    SELECT *

                    FROM paiements

                    WHERE id = $1

                    LIMIT 1

                    `,

                    [
                        id
                    ]

                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Paiement introuvable."

                });

            }


            res.json({

                success: true,

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
                    "Erreur récupération paiement.",

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
                id_paiement,

                utilisateurID,
                utilisateur_id,

                nom,
                email,

                offre,
                montant,
                devise,
                methode,
                capture,
                statut

            } = req.body;


            const paiementID =
                idPaiement ||
                id_paiement;


            const utilisateurIDFinal =
                utilisateurID ||
                utilisateur_id;


            if (
                !paiementID ||
                !email
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "ID paiement et email obligatoires."

                });

            }


            const emailNormalise =
                normaliserEmail(email);


            /* =================================================
               VÉRIFIER UTILISATEUR
            ================================================= */

            const utilisateur =
                await pool.query(

                    `

                    SELECT

                        id,
                        nom,
                        email,
                        premium,
                        is_premium

                    FROM users

                    WHERE email = $1

                    LIMIT 1

                    `,

                    [
                        emailNormalise
                    ]

                );


            if (
                utilisateur.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Aucun utilisateur correspondant à cet email."

                });

            }


            /* =================================================
               VÉRIFIER DOUBLON
            ================================================= */

            const existe =
                await pool.query(

                    `

                    SELECT id

                    FROM paiements

                    WHERE id_paiement = $1

                    LIMIT 1

                    `,

                    [
                        paiementID
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


            /* =================================================
               VÉRIFIER PAIEMENT EN ATTENTE
            ================================================= */

            const paiementAttente =
                await pool.query(

                    `

                    SELECT id

                    FROM paiements

                    WHERE

                        LOWER(email) = $1

                        AND statut = 'en_attente'

                    LIMIT 1

                    `,

                    [
                        emailNormalise
                    ]

                );


            if (
                paiementAttente.rows.length > 0
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Une demande de paiement est déjà en attente pour cet utilisateur."

                });

            }


            /* =================================================
               INSERTION
            ================================================= */

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

                        paiementID,

                        utilisateurIDFinal ||
                            String(
                                utilisateur.rows[0].id
                            ),

                        nom ||
                            utilisateur.rows[0].nom,

                        emailNormalise,

                        offre ||
                            "Premium BMJ SERVICE",

                        montant ||
                            15,

                        devise ||
                            "USD",

                        methode ||
                            null,

                        capture ||
                            null,

                        "en_attente"

                    ]

                );


            console.log(
                "========================================"
            );

            console.log(
                "💰 NOUVELLE DEMANDE DE PAIEMENT"
            );

            console.log(
                "ID :",
                paiementID
            );

            console.log(
                "Email :",
                emailNormalise
            );

            console.log(
                "Statut : en_attente"
            );

            console.log(
                "========================================"
            );


            res.status(201).json({

                success: true,

                message:
                    "Paiement enregistré et envoyé à l'administration.",

                data:
                    result.rows[0]

            });


        } catch (error) {

            console.error(
                "❌ ERREUR ENREGISTREMENT PAIEMENT :",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Impossible d'enregistrer votre demande de paiement sur le serveur.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   VALIDER UN PAIEMENT
=========================================================

   C'EST CETTE ROUTE QUI ACTIVE AUTOMATIQUEMENT :

   users.premium = TRUE
   users.is_premium = TRUE

   après confirmation du paiement.

   PUT /api/paiements/:id/valider

========================================================= */

app.put(
    "/api/paiements/:id/valider",
    async (req, res) => {

        const client =
            await pool.connect();


        try {

            const id =
                parseInt(
                    req.params.id,
                    10
                );


            if (
                Number.isNaN(id)
            ) {

                client.release();

                return res.status(400).json({

                    success: false,

                    message:
                        "ID paiement invalide."

                });

            }


            await client.query(
                "BEGIN"
            );


            /* =================================================
               RÉCUPÉRER PAIEMENT
            ================================================= */

            const paiementResult =
                await client.query(

                    `

                    SELECT *

                    FROM paiements

                    WHERE id = $1

                    FOR UPDATE

                    `,

                    [
                        id
                    ]

                );


            if (
                paiementResult.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );

                client.release();

                return res.status(404).json({

                    success: false,

                    message:
                        "Paiement introuvable."

                });

            }


            const paiement =
                paiementResult.rows[0];


            /* =================================================
               VÉRIFIER STATUT
            ================================================= */

            const statut =
                normaliserStatut(
                    paiement.statut
                );


            if (
                statut === "valide" ||
                statut === "approuve" ||
                statut === "active"
            ) {

                await client.query(
                    "ROLLBACK"
                );

                client.release();

                return res.json({

                    success: true,

                    message:
                        "Ce paiement est déjà validé.",

                    alreadyValidated:
                        true

                });

            }


            /* =================================================
               TROUVER UTILISATEUR
            ================================================= */

            let utilisateurResult;


            if (
                paiement.utilisateur_id
            ) {

                utilisateurResult =
                    await client.query(

                        `

                        SELECT *

                        FROM users

                        WHERE id::text = $1

                        LIMIT 1

                        `,

                        [
                            String(
                                paiement.utilisateur_id
                            )
                        ]

                    );

            }


            if (
                !utilisateurResult ||
                utilisateurResult.rows.length === 0
            ) {

                utilisateurResult =
                    await client.query(

                        `

                        SELECT *

                        FROM users

                        WHERE LOWER(email) = $1

                        LIMIT 1

                        `,

                        [
                            normaliserEmail(
                                paiement.email
                            )
                        ]

                    );

            }


            if (
                utilisateurResult.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );

                client.release();

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur associé au paiement introuvable."

                });

            }


            const utilisateur =
                utilisateurResult.rows[0];


            /* =================================================
               ACTIVER PREMIUM
            ================================================= */

            const userUpdate =
                await client.query(

                    `

                    UPDATE users

                    SET

                        premium = TRUE,

                        is_premium = TRUE

                    WHERE id = $1

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
                        utilisateur.id
                    ]

                );


            /* =================================================
               VALIDER PAIEMENT
            ================================================= */

            const paiementUpdate =
                await client.query(

                    `

                    UPDATE paiements

                    SET

                        statut = 'valide'

                    WHERE id = $1

                    RETURNING *

                    `,

                    [
                        id
                    ]

                );


            await client.query(
                "COMMIT"
            );


            client.release();


            console.log(
                "========================================"
            );

            console.log(
                "✅ PAIEMENT VALIDÉ"
            );

            console.log(
                "Paiement :",
                paiement.id_paiement
            );

            console.log(
                "Utilisateur :",
                utilisateur.email
            );

            console.log(
                "⭐ PREMIUM ACTIVÉ"
            );

            console.log(
                "========================================"
            );


            res.json({

                success: true,

                message:
                    "Paiement confirmé. Le compte Premium a été activé automatiquement.",

                premiumActivated:
                    true,

                user:
                    userUpdate.rows[0],

                utilisateur:
                    userUpdate.rows[0],

                paiement:
                    paiementUpdate.rows[0]

            });


        } catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (rollbackError) {

                console.error(
                    "Erreur rollback :",
                    rollbackError.message
                );

            }


            client.release();


            console.error(
                "❌ ERREUR VALIDATION PAIEMENT :",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Impossible de valider le paiement.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   REFUSER UN PAIEMENT
=========================================================

   PUT /api/paiements/:id/refuser

========================================================= */

app.put(
    "/api/paiements/:id/refuser",
    async (req, res) => {

        try {

            const id =
                parseInt(
                    req.params.id,
                    10
                );


            if (
                Number.isNaN(id)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "ID paiement invalide."

                });

            }


            const result =
                await pool.query(

                    `

                    UPDATE paiements

                    SET

                        statut = 'refuse'

                    WHERE id = $1

                    RETURNING *

                    `,

                    [
                        id
                    ]

                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Paiement introuvable."

                });

            }


            console.log(
                "❌ PAIEMENT REFUSÉ :",
                result.rows[0].id_paiement
            );


            res.json({

                success: true,

                message:
                    "Paiement refusé.",

                data:
                    result.rows[0]

            });


        } catch (error) {

            console.error(
                "❌ ERREUR REFUS PAIEMENT :",
                error.message
            );


            res.status(500).json({

                success: false,

                message:
                    "Impossible de refuser le paiement.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   DEBUG — LISTE DES ROUTES
========================================================= */

app.get(
    "/api/debug/routes",
    (req, res) => {

        res.json({

            success: true,

            message:
                "Routes BMJ SERVICE disponibles.",

            routes: [

                "GET /",

                "GET /api/test-db",

                "POST /api/inscription",

                "POST /api/connexion",

                "POST /api/admin/connexion",

                "GET /api/admin/verifier",

                "GET /api/apprenants",

                "GET /api/apprenants/:id",

                "PUT /api/apprenants/:id/premium",

                "GET /api/paiements",

                "GET /api/paiements/:id",

                "POST /api/paiements",

                "PUT /api/paiements/:id/valider",

                "PUT /api/paiements/:id/refuser",

                "GET /api/debug/routes"

            ]

        });

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
                req.originalUrl,

            method:
                req.method

        });

    }
);


/* =========================================================
   GESTION ERREUR JSON
========================================================= */

app.use(
    (error, req, res, next) => {

        console.error(
            "❌ ERREUR SERVEUR :",
            error.message
        );


        if (
            error instanceof
            SyntaxError
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "JSON invalide."

            });

        }


        res.status(500).json({

            success: false,

            message:
                "Erreur interne du serveur.",

            error:
                error.message

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
            "🌐 PORT :",
            PORT
        );

        console.log(
            "📡 API :",
            `http://localhost:${PORT}`
        );

        console.log(
            "========================================"
        );


        const connexion =
            await testerDatabase();


        if (connexion) {

            await creerTables();

        }

        else {

            console.error(
                "⚠️ Le serveur fonctionne mais PostgreSQL n'est pas connecté."
            );

        }

    }

);