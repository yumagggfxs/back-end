/* =========================================================
   BMJ SERVICE
   BACKEND API COMPLET
   NODE.JS + EXPRESS + POSTGRESQL
   RENDER

   VERSION : 4.0.0

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
   1. IMPORTATIONS
========================================================= */

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");


/* =========================================================
   2. APPLICATION
========================================================= */

const app = express();


/* =========================================================
   3. PORT
========================================================= */

const PORT =
    process.env.PORT || 3000;


/* =========================================================
   4. DATABASE POSTGRESQL
========================================================= */

/*
   POUR LE MOMENT :

   Mets ici ton URL PostgreSQL Render.

   Exemple :

   const DATABASE_URL =
       "postgresql://utilisateur:motdepasse@serveur/base";

   ⚠️ Après les tests, il est préférable de mettre
   cette valeur dans les variables d'environnement Render.
*/

const DATABASE_URL =
    "postgresql://bmj_db_user:5FSX8YeJNzwinKdFOrIeEC43aQsuzf91@dpg-d9sdlt49v7es73emrq8g-a/bmj_db";


/* =========================================================
   5. ADMIN
========================================================= */

const ADMIN_EMAIL =
    "admin@bmjservice.com";

const ADMIN_SECRET =
    "BMJ-ADMIN-2026";


/* =========================================================
   6. POOL POSTGRESQL
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
            15000

    });


/* =========================================================
   7. SURVEILLANCE POOL
========================================================= */

pool.on(
    "error",
    (error) => {

        console.error(
            "========================================"
        );

        console.error(
            "❌ ERREUR POOL POSTGRESQL"
        );

        console.error(
            error.message
        );

        console.error(
            "========================================"
        );

    }
);


/* =========================================================
   8. CORS
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
   9. JSON
========================================================= */

/*
   25 MB permet notamment de recevoir une image
   convertie en Base64.

   Exemple :

   data:image/jpeg;base64,/9j/4AAQ...
*/

app.use(

    express.json({

        limit: "25mb"

    })

);


/* =========================================================
   10. URL ENCODED
========================================================= */

app.use(

    express.urlencoded({

        extended: true,

        limit: "25mb"

    })

);


/* =========================================================
   11. OUTILS
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

    return String(statut || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

}


/* ---------------------------------------------------------
   CONVERTIR BOOLEAN
--------------------------------------------------------- */

function convertirBoolean(value) {

    if (typeof value === "boolean") {

        return value;

    }

    if (
        value === true ||
        value === "true" ||
        value === "1" ||
        value === 1 ||
        value === "on"
    ) {

        return true;

    }

    return false;

}


/* ---------------------------------------------------------
   UTILISATEUR PUBLIC
--------------------------------------------------------- */

function utilisateurPublic(utilisateur) {

    if (!utilisateur) {

        return null;

    }


    const premium =
        utilisateur.premium === true ||
        utilisateur.is_premium === true;


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
            premium,

        is_premium:
            premium,

        isPremium:
            premium,

        photo:
            utilisateur.photo,

        date_creation:
            utilisateur.date_creation

    };

}


/* ---------------------------------------------------------
   GENERER ID PAIEMENT
--------------------------------------------------------- */

function genererIdPaiement() {

    return (

        "BMJ-" +

        Date.now() +

        "-" +

        Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase()

    );

}


/* ---------------------------------------------------------
   LOGGER
--------------------------------------------------------- */

function logSection(titre) {

    console.log("");
    console.log(
        "========================================"
    );

    console.log(titre);

    console.log(
        "========================================"
    );

}


/* =========================================================
   12. TEST DATABASE
========================================================= */

async function testerDatabase() {

    try {

        const result =
            await pool.query(
                "SELECT NOW() AS heure"
            );


        logSection(
            "✅ POSTGRESQL CONNECTÉ"
        );


        console.log(
            "🕐 Heure PostgreSQL :",
            result.rows[0].heure
        );


        return true;

    }

    catch (error) {

        logSection(
            "❌ ERREUR POSTGRESQL"
        );


        console.error(
            "Code :",
            error.code
        );

        console.error(
            "Message :",
            error.message
        );

        console.error(
            "Detail :",
            error.detail || "Aucun"
        );


        return false;

    }

}


/* =========================================================
   13. CRÉATION DES TABLES
========================================================= */

async function creerTables() {

    try {

        logSection(
            "🗄️ VÉRIFICATION DES TABLES"
        );


        /* =====================================================
           USERS
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
           ADMINS
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
           PAIEMENTS
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
           COLONNES USERS
        ===================================================== */

        await pool.query(`

            ALTER TABLE users

            ADD COLUMN IF NOT EXISTS
            premium BOOLEAN DEFAULT FALSE;

        `);


        await pool.query(`

            ALTER TABLE users

            ADD COLUMN IF NOT EXISTS
            is_premium BOOLEAN DEFAULT FALSE;

        `);


        await pool.query(`

            ALTER TABLE users

            ADD COLUMN IF NOT EXISTS
            photo TEXT;

        `);


        /* =====================================================
           INDEX USERS
        ===================================================== */

        await pool.query(`

            CREATE INDEX IF NOT EXISTS
            idx_users_email

            ON users(email);

        `);


        /* =====================================================
           INDEX PAIEMENTS EMAIL
        ===================================================== */

        await pool.query(`

            CREATE INDEX IF NOT EXISTS
            idx_paiements_email

            ON paiements(email);

        `);


        /* =====================================================
           INDEX PAIEMENTS STATUT
        ===================================================== */

        await pool.query(`

            CREATE INDEX IF NOT EXISTS
            idx_paiements_statut

            ON paiements(statut);

        `);


        /* =====================================================
           ADMIN PAR DÉFAUT
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

        }

        else {

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
            "✅ TABLES BMJ SERVICE PRÊTES"
        );


        return true;

    }

    catch (error) {

        console.error(
            "❌ ERREUR CRÉATION TABLES"
        );

        console.error(
            "Code :",
            error.code
        );

        console.error(
            "Message :",
            error.message
        );

        console.error(
            "Detail :",
            error.detail || "Aucun"
        );


        return false;

    }

}


/* =========================================================
   14. PAGE PRINCIPALE
========================================================= */

app.get(
    "/",
    (req, res) => {

        res.json({

            success: true,

            message:
                "BMJ SERVICE API fonctionne.",

            version:
                "4.0.0",

            server:
                "Node.js + Express",

            database:
                "PostgreSQL",

            status:
                "online",

            routes: {

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
                    "/api/paiements",

                debug:
                    "/api/debug/routes"

            }

        });

    }
);


/* =========================================================
   15. TEST DATABASE
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

        }

        catch (error) {

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
   16. INSCRIPTION
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

                    WHERE LOWER(email) = $1

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

                        telephone
                            ? String(
                                telephone
                              ).trim()
                            : null,

                        String(password),

                        domaine
                            ? String(
                                domaine
                              ).trim()
                            : null,

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

        }

        catch (error) {

            console.error(
                "❌ ERREUR INSCRIPTION :",
                error
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
   17. CONNEXION UTILISATEUR
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
                identifiant || email;


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

                    WHERE LOWER(email) = $1

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
                        "Email ou mot de passe incorrect."

                });

            }


            const utilisateur =
                result.rows[0];


            if (
                utilisateur.password !==
                String(password)
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

        }

        catch (error) {

            console.error(
                "❌ ERREUR CONNEXION :",
                error
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
   18. CONNEXION ADMIN
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
                secretKey || secret_key;


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

                    WHERE LOWER(email) = $1

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
                String(secret)
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

        }

        catch (error) {

            console.error(
                "❌ ERREUR ADMIN :",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Erreur serveur administrateur.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   19. VÉRIFIER ADMIN
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

                    WHERE LOWER(email) = $1

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

        }

        catch (error) {

            console.error(
                "❌ ERREUR ADMIN VERIFICATION :",
                error
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
   20. TOUS LES APPRENANTS
========================================================= */

app.get(
    "/api/apprenants",
    async (req, res) => {

        try {

            const result =
                await pool.query(`

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

                `);


            res.json({

                success: true,

                data:
                    result.rows.map(
                        utilisateurPublic
                    ),

                total:
                    result.rows.length

            });

        }

        catch (error) {

            console.error(
                "❌ ERREUR APPRENANTS :",
                error
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
   21. UN APPRENANT
========================================================= */

app.get(
    "/api/apprenants/:id",
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);


            if (
                !Number.isInteger(id)
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
                    utilisateurPublic(
                        result.rows[0]
                    )

            });

        }

        catch (error) {

            console.error(
                "❌ ERREUR UTILISATEUR :",
                error
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
   22. ACTIVER / DÉSACTIVER PREMIUM
========================================================= */

app.put(
    "/api/apprenants/:id/premium",
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);


            if (
                !Number.isInteger(id)
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
                req.body.value !== undefined
            ) {

                valeur =
                    convertirBoolean(
                        req.body.value
                    );

            }

            else {

                return res.status(400).json({

                    success: false,

                    message:
                        "La valeur Premium doit être true ou false."

                });

            }


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
                utilisateurPublic(
                    result.rows[0]
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
                    user,

                user:
                    user,

                utilisateur:
                    user

            });

        }

        catch (error) {

            console.error(
                "❌ ERREUR PREMIUM :",
                error
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
   23. TOUS LES PAIEMENTS
========================================================= */

app.get(
    "/api/paiements",
    async (req, res) => {

        try {

            const result =
                await pool.query(`

                    SELECT *

                    FROM paiements

                    ORDER BY id DESC

                `);


            res.json({

                success: true,

                data:
                    result.rows,

                total:
                    result.rows.length

            });

        }

        catch (error) {

            console.error(
                "❌ ERREUR PAIEMENTS :",
                error
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
   24. UN PAIEMENT
========================================================= */

app.get(
    "/api/paiements/:id",
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);


            if (
                !Number.isInteger(id)
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

        }

        catch (error) {

            console.error(
                "❌ ERREUR PAIEMENT :",
                error
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
   25. ENREGISTRER PAIEMENT
========================================================= */

app.post(
    "/api/paiements",
    async (req, res) => {

        logSection(
            "📥 NOUVELLE DEMANDE DE PAIEMENT"
        );


        try {

            const body =
                req.body || {};


            console.log(
                "Content-Type :",
                req.headers["content-type"]
            );


            console.log(
                "Champs reçus :",
                Object.keys(body)
            );


            console.log(
                "BODY :",
                JSON.stringify(
                    body,
                    null,
                    2
                )
            );


            /* =================================================
               RÉCUPÉRATION
            ================================================= */

            const {

                idPaiement,
                id_paiement,

                utilisateurID,
                utilisateur_id,

                userId,
                user_id,

                nom,
                email,

                offre,

                montant,

                devise,

                methode,
                method,

                capture,
                preuve

            } = body;


            /* =================================================
               ID PAIEMENT
            ================================================= */

            let paiementID =
                idPaiement ||
                id_paiement;


            if (!paiementID) {

                paiementID =
                    genererIdPaiement();

            }


            paiementID =
                String(
                    paiementID
                ).trim();


            /* =================================================
               IDENTIFIANT UTILISATEUR
            ================================================= */

            const userIdFinal =
                utilisateurID ||
                utilisateur_id ||
                userId ||
                user_id;


            let utilisateur =
                null;


            /* =================================================
               RECHERCHE PAR ID
            ================================================= */

            if (userIdFinal) {

                const id =
                    Number(
                        userIdFinal
                    );


                if (
                    Number.isInteger(id)
                ) {

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
                                photo

                            FROM users

                            WHERE id = $1

                            LIMIT 1

                            `,

                            [
                                id
                            ]

                        );


                    if (
                        result.rows.length > 0
                    ) {

                        utilisateur =
                            result.rows[0];

                    }

                }

            }


            /* =================================================
               RECHERCHE PAR EMAIL
            ================================================= */

            if (
                !utilisateur &&
                email
            ) {

                const emailNormalise =
                    normaliserEmail(
                        email
                    );


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
                            photo

                        FROM users

                        WHERE LOWER(email) = $1

                        LIMIT 1

                        `,

                        [
                            emailNormalise
                        ]

                    );


                if (
                    result.rows.length > 0
                ) {

                    utilisateur =
                        result.rows[0];

                }

            }


            /* =================================================
               UTILISATEUR INTROUVABLE
            ================================================= */

            if (!utilisateur) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable.",

                    debug: {

                        utilisateur_id:
                            userIdFinal || null,

                        email:
                            email || null

                    }

                });

            }


            /* =================================================
               EMAIL FINAL
            ================================================= */

            const emailFinal =
                normaliserEmail(
                    utilisateur.email
                );


            /* =================================================
               VÉRIFIER ID PAIEMENT
            ================================================= */

            const paiementExiste =
                await pool.query(

                    `

                    SELECT *

                    FROM paiements

                    WHERE id_paiement = $1

                    LIMIT 1

                    `,

                    [
                        paiementID
                    ]

                );


            if (
                paiementExiste.rows.length > 0
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Ce paiement existe déjà.",

                    data:
                        paiementExiste.rows[0]

                });

            }


            /* =================================================
               PAIEMENT DÉJÀ EN ATTENTE
            ================================================= */

            const paiementAttente =
                await pool.query(

                    `

                    SELECT *

                    FROM paiements

                    WHERE

                        LOWER(email) = $1

                        AND LOWER(
                            COALESCE(statut, '')
                        ) = 'en_attente'

                    ORDER BY id DESC

                    LIMIT 1

                    `,

                    [
                        emailFinal
                    ]

                );


            if (
                paiementAttente.rows.length > 0
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Une demande de paiement est déjà en attente pour cet utilisateur.",

                    data:
                        paiementAttente.rows[0]

                });

            }


            /* =================================================
               MONTANT
            ================================================= */

            let montantFinal =
                montant;


            if (
                montantFinal === undefined ||
                montantFinal === null ||
                montantFinal === ""
            ) {

                montantFinal =
                    15;

            }


            montantFinal =
                Number(
                    String(
                        montantFinal
                    ).replace(
                        ",",
                        "."
                    )
                );


            if (
                !Number.isFinite(
                    montantFinal
                ) ||
                montantFinal <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le montant du paiement est invalide."

                });

            }


            /* =================================================
               DEVISE
            ================================================= */

            const deviseFinal =
                String(
                    devise || "USD"
                )
                .trim()
                .toUpperCase();


            /* =================================================
               MÉTHODE
            ================================================= */

            const methodeFinal =
                String(
                    methode ||
                    method ||
                    "Non spécifiée"
                ).trim();


            /* =================================================
               CAPTURE / PREUVE
            ================================================= */

            const captureFinal =
                capture ||
                preuve ||
                null;


            /* =================================================
               OFFRE
            ================================================= */

            const offreFinal =
                String(
                    offre ||
                    "Premium BMJ SERVICE"
                ).trim();


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
                        'en_attente'
                    )

                    RETURNING *

                    `,

                    [

                        paiementID,

                        String(
                            utilisateur.id
                        ),

                        nom
                            ? String(
                                nom
                              ).trim()
                            : utilisateur.nom,

                        emailFinal,

                        offreFinal,

                        montantFinal,

                        deviseFinal,

                        methodeFinal,

                        captureFinal

                    ]

                );


            const paiement =
                result.rows[0];


            /* =================================================
               LOG SUCCÈS
            ================================================= */

            logSection(
                "✅ PAIEMENT ENREGISTRÉ"
            );


            console.log(
                "ID paiement :",
                paiement.id_paiement
            );


            console.log(
                "Utilisateur :",
                utilisateur.id
            );


            console.log(
                "Email :",
                utilisateur.email
            );


            console.log(
                "Montant :",
                montantFinal,
                deviseFinal
            );


            console.log(
                "Méthode :",
                methodeFinal
            );


            console.log(
                "Capture :",
                captureFinal
                    ? "OUI"
                    : "NON"
            );


            console.log(
                "Statut :",
                paiement.statut
            );


            /* =================================================
               RÉPONSE
            ================================================= */

            return res.status(201).json({

                success: true,

                message:
                    "Votre demande de paiement a été envoyée avec succès.",

                data:
                    paiement,

                paiement:
                    paiement

            });

        }

        catch (error) {

            logSection(
                "❌ ERREUR ENREGISTREMENT PAIEMENT"
            );


            console.error(
                "Code :",
                error.code
            );


            console.error(
                "Message :",
                error.message
            );


            console.error(
                "Detail :",
                error.detail || "Aucun"
            );


            console.error(
                "Hint :",
                error.hint || "Aucun"
            );


            /* =================================================
               DUPLICATION
            ================================================= */

            if (
                error.code === "23505"
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Ce paiement existe déjà.",

                    error:
                        error.detail ||
                        error.message

                });

            }


            /* =================================================
               MAUVAIS TYPE
            ================================================= */

            if (
                error.code === "22P02"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Une donnée envoyée au serveur possède un format incorrect.",

                    error:
                        error.message

                });

            }


            /* =================================================
               CONTRAINTE
            ================================================= */

            if (
                error.code === "23503"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "L'utilisateur associé au paiement est invalide.",

                    error:
                        error.message

                });

            }


            /* =================================================
               AUTRE ERREUR
            ================================================= */

            return res.status(500).json({

                success: false,

                message:
                    "Impossible d'envoyer la demande de paiement sur le serveur.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   26. VALIDER PAIEMENT
========================================================= */

app.put(
    "/api/paiements/:id/valider",
    async (req, res) => {

        const client =
            await pool.connect();


        try {

            const id =
                Number(
                    req.params.id
                );


            if (
                !Number.isInteger(id)
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
               PAIEMENT
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
               STATUT
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
               UTILISATEUR
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


            const user =
                utilisateurPublic(
                    userUpdate.rows[0]
                );


            logSection(
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


            res.json({

                success: true,

                message:
                    "Paiement confirmé. Le compte Premium a été activé automatiquement.",

                premiumActivated:
                    true,

                premium:
                    true,

                is_premium:
                    true,

                user:
                    user,

                utilisateur:
                    user,

                paiement:
                    paiementUpdate.rows[0]

            });

        }

        catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            }

            catch (rollbackError) {

                console.error(
                    "ROLLBACK :",
                    rollbackError.message
                );

            }


            client.release();


            console.error(
                "❌ ERREUR VALIDATION PAIEMENT :",
                error
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
   27. REFUSER PAIEMENT
========================================================= */

app.put(
    "/api/paiements/:id/refuser",
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (
                !Number.isInteger(id)
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

        }

        catch (error) {

            console.error(
                "❌ ERREUR REFUS PAIEMENT :",
                error
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
   28. DEBUG ROUTES
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
   29. ROUTE INEXISTANTE
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
   30. GESTIONNAIRE D'ERREURS
========================================================= */

app.use(
    (error, req, res, next) => {

        console.error(
            "========================================"
        );

        console.error(
            "❌ ERREUR SERVEUR"
        );

        console.error(
            error
        );

        console.error(
            "========================================"
        );


        /* =====================================================
           JSON INVALIDE
        ===================================================== */

        if (
            error instanceof SyntaxError &&
            error.status === 400 &&
            error.type === "entity.parse.failed"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "JSON invalide."

            });

        }


        /* =====================================================
           PAYLOAD TROP GRAND
        ===================================================== */

        if (
            error.type ===
            "entity.too.large"
        ) {

            return res.status(413).json({

                success: false,

                message:
                    "Les données envoyées sont trop volumineuses."

            });

        }


        /* =====================================================
           ERREUR GÉNÉRALE
        ===================================================== */

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
   31. DÉMARRAGE SERVEUR
========================================================= */

async function demarrerServeur() {

    try {

        logSection(
            "🚀 DÉMARRAGE BMJ SERVICE"
        );


        console.log(
            "🌐 PORT :",
            PORT
        );


        console.log(
            "📡 MODE :",
            process.env.NODE_ENV ||
            "development"
        );


        console.log(
            "🗄️ DATABASE : PostgreSQL"
        );


        /* =====================================================
           TEST DATABASE
        ===================================================== */

        const connexion =
            await testerDatabase();


        if (!connexion) {

            console.error(
                "⚠️ PostgreSQL non connecté."
            );

            console.error(
                "⚠️ Vérifie DATABASE_URL."
            );

        }

        else {

            await creerTables();

        }


        /* =====================================================
           LANCEMENT EXPRESS
        ===================================================== */

        app.listen(
            PORT,
            () => {

                logSection(
                    "🚀 BMJ SERVICE API EN LIGNE"
                );


                console.log(
                    `🌐 PORT : ${PORT}`
                );


                console.log(
                    `📡 API : http://localhost:${PORT}`
                );


                console.log(
                    "🗄️ DATABASE : PostgreSQL"
                );


                console.log(
                    "❤️ BMJ SERVICE READY"
                );

            }
        );

    }

    catch (error) {

        console.error(
            "❌ IMPOSSIBLE DE DÉMARRER LE SERVEUR"
        );


        console.error(
            error
        );


        process.exit(1);

    }

}


/* =========================================================
   32. ARRÊT PROPRE
========================================================= */

async function arreterServeur(signal) {

    console.log("");
    console.log(
        `🛑 Signal ${signal} reçu.`
    );


    try {

        await pool.end();


        console.log(
            "✅ Connexion PostgreSQL fermée."
        );


        process.exit(0);

    }

    catch (error) {

        console.error(
            "❌ ERREUR FERMETURE :",
            error.message
        );


        process.exit(1);

    }

}


process.on(
    "SIGINT",
    () => {

        arreterServeur(
            "SIGINT"
        );

    }
);


process.on(
    "SIGTERM",
    () => {

        arreterServeur(
            "SIGTERM"
        );

    }
);


/* =========================================================
   33. ERREURS NON GÉRÉES
========================================================= */

process.on(
    "unhandledRejection",
    (reason) => {

        console.error(
            "❌ UNHANDLED REJECTION :",
            reason
        );

    }
);


process.on(
    "uncaughtException",
    (error) => {

        console.error(
            "❌ UNCAUGHT EXCEPTION :",
            error
        );

    }
);


/* =========================================================
   34. START
========================================================= */

demarrerServeur();