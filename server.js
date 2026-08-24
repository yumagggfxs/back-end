/* =========================================================
   BMJ SERVICE
   BACKEND API COMPLET
   NODE.JS + EXPRESS + POSTGRESQL
   RENDER

   VERSION : 6.0.0

   =========================================================
   FONCTIONNALITÉS
   ---------------------------------------------------------
   ✓ Inscription utilisateur
   ✓ Connexion utilisateur
   ✓ Connexion administrateur
   ✓ Vérification administrateur
   ✓ Gestion des apprenants
   ✓ Activation / désactivation Premium
   ✓ Paiements depuis le site
   ✓ Paiements reçus par email
   ✓ Ajout manuel d'un paiement par ADMIN
   ✓ Ajout / modification d'une preuve
   ✓ Recherche rapide des paiements
   ✓ Pagination
   ✓ Validation paiement
   ✓ Refus paiement
   ✓ Activation automatique Premium
   ✓ Transactions PostgreSQL
   ✓ Index PostgreSQL
   ✓ Compatibilité anciens champs frontend
   ✓ Statistiques
   ✓ Health check
   ✓ Gestion propre des erreurs
   ✓ Optimisation connexion PostgreSQL
   ✓ Compatible Render
   =========================================================
*/


/* =========================================================
   1. IMPORTATIONS
========================================================= */

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");


/* =========================================================
   2. APPLICATION EXPRESS
========================================================= */

const app = express();


/* =========================================================
   3. PORT
========================================================= */

const PORT = process.env.PORT || 3000;


/* =========================================================
   4. CONFIGURATION DATABASE
========================================================= */

/*
   IMPORTANT :

   SUR RENDER :

   Environment
   →
   DATABASE_URL

   Exemple de structure :

   postgresql://USER:PASSWORD@HOST/DATABASE

   Ne mets pas ton mot de passe directement dans le code.

   Le serveur utilise automatiquement :

   process.env.DATABASE_URL
*/

const DATABASE_URL =
    process.env.DATABASE_URL || "postgresql://bmj_db_user:5FSX8YeJNzwinKdFOrIeEC43aQsuzf91@dpg-d9sdlt49v7es73emrq8g-a/bmj_db";


/* =========================================================
   5. CONFIGURATION ADMIN
========================================================= */

const ADMIN_EMAIL =
    process.env.ADMIN_EMAIL ||
    "admin@bmjservice.com";

const ADMIN_SECRET =
    process.env.ADMIN_SECRET ||
    "BMJ-ADMIN-2026";


/* =========================================================
   6. POOL POSTGRESQL
========================================================= */

const pool = new Pool({

    connectionString: DATABASE_URL,

    ssl:
        process.env.NODE_ENV === "production"
            ? {
                rejectUnauthorized: false
            }
            : false,

    max: 10,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000,

    statement_timeout: 30000

});


/* =========================================================
   7. SURVEILLANCE POSTGRESQL
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
   9. BODY JSON
========================================================= */

app.use(

    express.json({

        limit: "25mb"

    })

);


/* =========================================================
   10. BODY URL ENCODED
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
   LOG
--------------------------------------------------------- */

function logSection(message) {

    console.log("");

    console.log(
        "========================================"
    );

    console.log(message);

    console.log(
        "========================================"
    );

}


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
        .replace(
            /[\u0300-\u036f]/g,
            ""
        );

}


/* ---------------------------------------------------------
   BOOLEAN
--------------------------------------------------------- */

function convertirBoolean(value) {

    if (
        typeof value === "boolean"
    ) {

        return value;

    }

    return (
        value === true ||
        value === "true" ||
        value === "1" ||
        value === 1 ||
        value === "on"
    );

}


/* ---------------------------------------------------------
   ID PAIEMENT
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
            utilisateur.photo || null,

        date_creation:
            utilisateur.date_creation

    };

}


/* ---------------------------------------------------------
   PAGINATION
--------------------------------------------------------- */

function pagination(req) {

    let page =
        Number(req.query.page);

    let limit =
        Number(req.query.limit);

    if (
        !Number.isInteger(page) ||
        page < 1
    ) {

        page = 1;

    }

    if (
        !Number.isInteger(limit) ||
        limit < 1
    ) {

        limit = 20;

    }

    if (limit > 100) {

        limit = 100;

    }

    const offset =
        (page - 1) * limit;

    return {

        page,
        limit,
        offset

    };

}


/* ---------------------------------------------------------
   EXTRAIRE USER ID
--------------------------------------------------------- */

function extraireUserId(body) {

    return (

        body.utilisateurID ||
        body.utilisateur_id ||
        body.userId ||
        body.user_id ||
        body.userID ||
        null

    );

}


/* ---------------------------------------------------------
   EXTRAIRE ID PAIEMENT
--------------------------------------------------------- */

function extrairePaiementId(body) {

    return (

        body.idPaiement ||
        body.id_paiement ||
        body.paiementID ||
        body.paiement_id ||
        null

    );

}


/* ---------------------------------------------------------
   EXTRAIRE PREUVE
--------------------------------------------------------- */

function extrairePreuve(body) {

    return (

        body.capture ||
        body.preuve ||
        body.proof ||
        body.paymentProof ||
        null

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
            "🗄️ PRÉPARATION BASE BMJ SERVICE"
        );


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

                source
                    VARCHAR(50)
                    DEFAULT 'site',

                reference_transaction
                    VARCHAR(150),

                commentaire_admin
                    TEXT,

                date
                    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                date_modification
                    TIMESTAMP DEFAULT CURRENT_TIMESTAMP

            );

        `);


        /* =====================================================
           MIGRATIONS USERS
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
           MIGRATIONS PAIEMENTS
        ===================================================== */

        await pool.query(`

            ALTER TABLE paiements

            ADD COLUMN IF NOT EXISTS
            source VARCHAR(50)
            DEFAULT 'site';

        `);

        await pool.query(`

            ALTER TABLE paiements

            ADD COLUMN IF NOT EXISTS
            reference_transaction
            VARCHAR(150);

        `);

        await pool.query(`

            ALTER TABLE paiements

            ADD COLUMN IF NOT EXISTS
            commentaire_admin
            TEXT;

        `);

        await pool.query(`

            ALTER TABLE paiements

            ADD COLUMN IF NOT EXISTS
            date_modification
            TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

        `);


        /* =====================================================
           INDEX USERS
        ===================================================== */

        await pool.query(`

            CREATE INDEX IF NOT EXISTS
            idx_users_email_lower

            ON users(LOWER(email));

        `);


        /* =====================================================
           INDEX PAIEMENTS
        ===================================================== */

        await pool.query(`

            CREATE INDEX IF NOT EXISTS
            idx_paiements_email_lower

            ON paiements(LOWER(email));

        `);

        await pool.query(`

            CREATE INDEX IF NOT EXISTS
            idx_paiements_statut

            ON paiements(statut);

        `);

        await pool.query(`

            CREATE INDEX IF NOT EXISTS
            idx_paiements_utilisateur

            ON paiements(utilisateur_id);

        `);

        await pool.query(`

            CREATE INDEX IF NOT EXISTS
            idx_paiements_date

            ON paiements(date DESC);

        `);

        await pool.query(`

            CREATE INDEX IF NOT EXISTS
            idx_paiements_reference

            ON paiements(reference_transaction);

        `);


        /* =====================================================
           ADMIN PAR DÉFAUT
        ===================================================== */

        const adminExiste =
            await pool.query(

                `

                SELECT id

                FROM admins

                WHERE LOWER(email) = $1

                LIMIT 1

                `,

                [
                    normaliserEmail(
                        ADMIN_EMAIL
                    )
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
                    'admin'
                )

                `,

                [

                    "Administrateur BMJ SERVICE",

                    normaliserEmail(
                        ADMIN_EMAIL
                    ),

                    ADMIN_SECRET

                ]

            );

            console.log(
                "✅ COMPTE ADMIN CRÉÉ"
            );

        }

        else {

            console.log(
                "ℹ️ COMPTE ADMIN EXISTANT"
            );

        }


        logSection(
            "✅ BASE BMJ SERVICE PRÊTE"
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
   14. ROUTE PRINCIPALE
========================================================= */

app.get(
    "/",
    (req, res) => {

        res.json({

            success: true,

            message:
                "BMJ SERVICE API fonctionne.",

            version:
                "6.0.0",

            server:
                "Node.js + Express",

            database:
                "PostgreSQL",

            status:
                "online",

            timestamp:
                new Date().toISOString()

        });

    }
);


/* =========================================================
   15. HEALTH CHECK
========================================================= */

app.get(
    "/api/health",
    async (req, res) => {

        try {

            await pool.query(
                "SELECT 1"
            );

            res.json({

                success: true,

                server:
                    "online",

                database:
                    "connected",

                timestamp:
                    new Date().toISOString()

            });

        }

        catch (error) {

            res.status(503).json({

                success: false,

                server:
                    "online",

                database:
                    "offline",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   16. TEST DATABASE
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
   17. INSCRIPTION
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

            } = req.body || {};


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


            const emailFinal =
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
                        emailFinal
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

                        emailFinal,

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
   18. CONNEXION UTILISATEUR
========================================================= */

app.post(
    "/api/connexion",
    async (req, res) => {

        try {

            const {

                identifiant,
                email,
                password

            } = req.body || {};


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


            const loginFinal =
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
                        loginFinal
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
   19. CONNEXION ADMIN
========================================================= */

app.post(
    "/api/admin/connexion",
    async (req, res) => {

        try {

            const {

                email,
                secretKey,
                secret_key

            } = req.body || {};


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


            const emailFinal =
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
                        emailFinal
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
                error.message
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
   20. VÉRIFIER ADMIN
========================================================= */

app.get(
    "/api/admin/verifier",
    async (req, res) => {

        try {

            const email =
                normaliserEmail(
                    req.query.email
                );


            if (!email) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Email administrateur obligatoire."

                });

            }


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
                        email
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
                "❌ ERREUR ADMIN :",
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
   21. TOUS LES APPRENANTS
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
   22. UN APPRENANT
========================================================= */

app.get(
    "/api/apprenants/:id",
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
   23. ACTIVER / DÉSACTIVER PREMIUM
========================================================= */

app.put(
    "/api/apprenants/:id/premium",
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
   24. LISTE DES PAIEMENTS
========================================================= */

app.get(
    "/api/paiements",
    async (req, res) => {

        try {

            const {
                page,
                limit,
                offset
            } =
                pagination(req);


            const statut =
                req.query.statut
                    ? normaliserStatut(
                        req.query.statut
                    )
                    : null;


            let where = "";

            const params = [];


            if (statut) {

                params.push(statut);

                where =
                    `WHERE LOWER(statut) = $1`;

            }


            const countResult =
                await pool.query(

                    `

                    SELECT
                        COUNT(*)::int AS total

                    FROM paiements

                    ${where}

                    `,

                    params

                );


            const total =
                countResult.rows[0].total;


            params.push(limit);

            params.push(offset);


            const result =
                await pool.query(

                    `

                    SELECT
                        id,
                        id_paiement,
                        utilisateur_id,
                        nom,
                        email,
                        offre,
                        montant,
                        devise,
                        methode,
                        statut,
                        source,
                        reference_transaction,
                        commentaire_admin,
                        date,
                        date_modification,

                        CASE
                            WHEN capture IS NOT NULL
                            AND capture <> ''
                            THEN TRUE
                            ELSE FALSE
                        END AS has_capture

                    FROM paiements

                    ${where}

                    ORDER BY id DESC

                    LIMIT $${params.length - 1}

                    OFFSET $${params.length}

                    `,

                    params

                );


            res.json({

                success: true,

                data:
                    result.rows,

                total,

                page,

                limit,

                totalPages:
                    Math.ceil(
                        total / limit
                    )

            });

        }

        catch (error) {

            console.error(
                "❌ ERREUR LISTE PAIEMENTS :",
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
   25. RECHERCHE PAIEMENTS
========================================================= */

app.get(
    "/api/paiements/recherche",
    async (req, res) => {

        try {

            const q =
                String(
                    req.query.q || ""
                ).trim();


            if (!q) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Veuillez fournir une recherche."

                });

            }


            const recherche =
                `%${q.toLowerCase()}%`;


            const result =
                await pool.query(

                    `

                    SELECT
                        id,
                        id_paiement,
                        utilisateur_id,
                        nom,
                        email,
                        offre,
                        montant,
                        devise,
                        methode,
                        statut,
                        source,
                        reference_transaction,
                        commentaire_admin,
                        date,
                        date_modification,

                        CASE
                            WHEN capture IS NOT NULL
                            AND capture <> ''
                            THEN TRUE
                            ELSE FALSE
                        END AS has_capture

                    FROM paiements

                    WHERE

                        LOWER(
                            COALESCE(nom, '')
                        ) LIKE $1

                        OR LOWER(
                            COALESCE(email, '')
                        ) LIKE $1

                        OR LOWER(
                            COALESCE(id_paiement, '')
                        ) LIKE $1

                        OR LOWER(
                            COALESCE(reference_transaction, '')
                        ) LIKE $1

                    ORDER BY id DESC

                    LIMIT 50

                    `,

                    [
                        recherche
                    ]

                );


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
                "❌ ERREUR RECHERCHE :",
                error.message
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur lors de la recherche.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   26. UN PAIEMENT
========================================================= */

app.get(
    "/api/paiements/:id",
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
                    result.rows[0],

                paiement:
                    result.rows[0]

            });

        }

        catch (error) {

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
   27. CRÉER PAIEMENT DEPUIS LE SITE
========================================================= */

app.post(
    "/api/paiements",
    async (req, res) => {

        const startTime =
            Date.now();


        try {

            const body =
                req.body || {};


            const userIdFinal =
                extraireUserId(body);


            const email =
                normaliserEmail(
                    body.email
                );


            const paiementID =
                String(
                    extrairePaiementId(body) ||
                    genererIdPaiement()
                ).trim();


            if (
                !userIdFinal &&
                !email
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "L'identifiant utilisateur ou l'email est obligatoire."

                });

            }


            /* =================================================
               RECHERCHE UTILISATEUR
            ================================================= */

            let utilisateur;


            if (userIdFinal) {

                const id =
                    Number(userIdFinal);


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
                        result.rows.length > 0
                    ) {

                        utilisateur =
                            result.rows[0];

                    }

                }

            }


            if (
                !utilisateur &&
                email
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
                            photo,
                            date_creation

                        FROM users

                        WHERE LOWER(email) = $1

                        LIMIT 1

                        `,

                        [
                            email
                        ]

                    );


                if (
                    result.rows.length > 0
                ) {

                    utilisateur =
                        result.rows[0];

                }

            }


            if (!utilisateur) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable."

                });

            }


            const emailFinal =
                normaliserEmail(
                    utilisateur.email
                );


            /* =================================================
               VÉRIFIER DOUBLON
            ================================================= */

            const paiementExiste =
                await pool.query(

                    `

                    SELECT
                        id,
                        id_paiement,
                        statut

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
               PAIEMENT EN ATTENTE EXISTANT
            ================================================= */

            const paiementAttente =
                await pool.query(

                    `

                    SELECT
                        id,
                        id_paiement,
                        statut,
                        date

                    FROM paiements

                    WHERE
                        LOWER(email) = $1

                        AND LOWER(
                            COALESCE(
                                statut,
                                ''
                            )
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

            let montant =
                body.montant;


            if (
                montant === undefined ||
                montant === null ||
                montant === ""
            ) {

                montant = 15;

            }


            montant =
                Number(
                    String(montant)
                        .replace(",", ".")
                );


            if (
                !Number.isFinite(montant) ||
                montant <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le montant du paiement est invalide."

                });

            }


            /* =================================================
               INFORMATIONS PAIEMENT
            ================================================= */

            const devise =
                String(
                    body.devise || "USD"
                )
                .trim()
                .toUpperCase();


            const methode =
                String(
                    body.methode ||
                    body.method ||
                    "Non spécifiée"
                )
                .trim();


            const offre =
                String(
                    body.offre ||
                    "Premium BMJ SERVICE"
                )
                .trim();


            const capture =
                extrairePreuve(body);


            const reference =
                String(
                    body.reference_transaction ||
                    body.reference ||
                    body.transaction_id ||
                    ""
                ).trim() || null;


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
                        statut,
                        source,
                        reference_transaction,
                        date_modification
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
                        'en_attente',
                        'site',
                        $10,
                        CURRENT_TIMESTAMP
                    )

                    RETURNING *

                    `,

                    [

                        paiementID,

                        String(
                            utilisateur.id
                        ),

                        utilisateur.nom,

                        emailFinal,

                        offre,

                        montant,

                        devise,

                        methode,

                        capture || null,

                        reference

                    ]

                );


            const paiement =
                result.rows[0];


            console.log(
                "✅ Paiement enregistré :",
                paiement.id_paiement,
                "|",
                `${Date.now() - startTime}ms`
            );


            return res.status(201).json({

                success: true,

                message:
                    "Votre demande de paiement a été enregistrée.",

                data:
                    paiement,

                paiement:
                    paiement

            });

        }

        catch (error) {

            console.error(
                "❌ ERREUR PAIEMENT :",
                error.message
            );


            if (
                error.code === "23505"
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Ce paiement existe déjà."

                });

            }


            res.status(500).json({

                success: false,

                message:
                    "Impossible d'enregistrer le paiement.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   28. AJOUT PAIEMENT REÇU PAR EMAIL
========================================================= */

app.post(
    "/api/admin/paiements",
    async (req, res) => {

        try {

            const body =
                req.body || {};


            const {

                nom,
                email,

                utilisateur_id,
                utilisateurID,
                userId,

                offre,
                montant,
                devise,

                methode,
                method,

                capture,
                preuve,

                reference_transaction,
                reference,
                transaction_id,

                commentaire_admin

            } = body;


            const emailFinal =
                normaliserEmail(email);


            if (!emailFinal) {

                return res.status(400).json({

                    success: false,

                    message:
                        "L'email du client est obligatoire."

                });

            }


            /* =================================================
               RECHERCHE UTILISATEUR
            ================================================= */

            let utilisateur = null;


            const idUtilisateur =
                utilisateur_id ||
                utilisateurID ||
                userId;


            if (idUtilisateur) {

                const id =
                    Number(
                        idUtilisateur
                    );


                if (
                    Number.isInteger(id)
                ) {

                    const result =
                        await pool.query(

                            `

                            SELECT *

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


            if (!utilisateur) {

                const result =
                    await pool.query(

                        `

                        SELECT *

                        FROM users

                        WHERE LOWER(email) = $1

                        LIMIT 1

                        `,

                        [
                            emailFinal
                        ]

                    );


                if (
                    result.rows.length > 0
                ) {

                    utilisateur =
                        result.rows[0];

                }

            }


            if (!utilisateur) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Aucun utilisateur ne correspond à cet email."

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

                montantFinal = 15;

            }


            montantFinal =
                Number(
                    String(montantFinal)
                        .replace(",", ".")
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
                        "Montant invalide."

                });

            }


            const deviseFinal =
                String(
                    devise || "USD"
                )
                .trim()
                .toUpperCase();


            const methodeFinal =
                String(
                    methode ||
                    method ||
                    "Paiement reçu par email"
                )
                .trim();


            const offreFinal =
                String(
                    offre ||
                    "Premium BMJ SERVICE"
                ).trim();


            const preuveFinal =
                capture ||
                preuve ||
                null;


            const referenceFinal =
                String(
                    reference_transaction ||
                    reference ||
                    transaction_id ||
                    ""
                ).trim() || null;


            const commentaireFinal =
                String(
                    commentaire_admin ||
                    ""
                ).trim() || null;


            const paiementID =
                genererIdPaiement();


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
                        statut,
                        source,
                        reference_transaction,
                        commentaire_admin,
                        date_modification
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
                        'en_attente',
                        'email',
                        $10,
                        $11,
                        CURRENT_TIMESTAMP
                    )

                    RETURNING *

                    `,

                    [

                        paiementID,

                        String(
                            utilisateur.id
                        ),

                        nom
                            ? String(nom).trim()
                            : utilisateur.nom,

                        emailFinal,

                        offreFinal,

                        montantFinal,

                        deviseFinal,

                        methodeFinal,

                        preuveFinal,

                        referenceFinal,

                        commentaireFinal

                    ]

                );


            const paiement =
                result.rows[0];


            logSection(
                "📧 PAIEMENT REÇU PAR EMAIL AJOUTÉ"
            );


            console.log(
                "ID :",
                paiement.id_paiement
            );

            console.log(
                "Client :",
                paiement.email
            );

            console.log(
                "Source :",
                paiement.source
            );

            console.log(
                "Preuve :",
                paiement.capture
                    ? "OUI"
                    : "NON"
            );


            res.status(201).json({

                success: true,

                message:
                    "Le paiement reçu par email a été ajouté avec succès.",

                data:
                    paiement,

                paiement:
                    paiement

            });

        }

        catch (error) {

            console.error(
                "❌ ERREUR AJOUT PAIEMENT EMAIL :",
                error.message
            );

            res.status(500).json({

                success: false,

                message:
                    "Impossible d'ajouter le paiement reçu par email.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   29. AJOUT / MODIFICATION PREUVE
========================================================= */

app.put(
    "/api/paiements/:id/preuve",
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


            const preuve =
                extrairePreuve(
                    req.body || {}
                );


            if (!preuve) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Aucune preuve de paiement reçue."

                });

            }


            const result =
                await pool.query(

                    `

                    UPDATE paiements

                    SET

                        capture = $1,

                        date_modification =
                            CURRENT_TIMESTAMP

                    WHERE id = $2

                    RETURNING *

                    `,

                    [
                        preuve,
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

                message:
                    "La preuve de paiement a été enregistrée.",

                data:
                    result.rows[0],

                paiement:
                    result.rows[0]

            });

        }

        catch (error) {

            console.error(
                "❌ ERREUR PREUVE :",
                error.message
            );

            res.status(500).json({

                success: false,

                message:
                    "Impossible d'enregistrer la preuve.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   30. VALIDER PAIEMENT
   + ACTIVATION PREMIUM AUTOMATIQUE
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
               VERROUILLER PAIEMENT
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


            const statut =
                normaliserStatut(
                    paiement.statut
                );


            /* =================================================
               SI DÉJÀ VALIDÉ
            ================================================= */

            if (
                statut === "valide" ||
                statut === "approuve" ||
                statut === "active"
            ) {

                await client.query(

                    `

                    UPDATE users

                    SET
                        premium = TRUE,
                        is_premium = TRUE

                    WHERE
                        id::text = $1

                        OR LOWER(email) = $2

                    `,

                    [

                        String(
                            paiement.utilisateur_id || ""
                        ),

                        normaliserEmail(
                            paiement.email
                        )

                    ]

                );


                await client.query(
                    "COMMIT"
                );

                client.release();


                return res.json({

                    success: true,

                    message:
                        "Ce paiement est déjà validé et le Premium est actif.",

                    alreadyValidated:
                        true,

                    premiumActivated:
                        true,

                    premium:
                        true,

                    is_premium:
                        true

                });

            }


            /* =================================================
               RECHERCHER UTILISATEUR
            ================================================= */

            let utilisateurResult =
                null;


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

                        statut = 'valide',

                        date_modification =
                            CURRENT_TIMESTAMP

                    WHERE id = $1

                    RETURNING *

                    `,

                    [
                        id
                    ]

                );


            /* =================================================
               COMMIT
            ================================================= */

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
                "Client :",
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
                    "❌ ROLLBACK :",
                    rollbackError.message
                );

            }


            client.release();


            console.error(
                "❌ ERREUR VALIDATION :",
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
   31. REFUSER PAIEMENT
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


            const commentaire =
                String(
                    req.body?.commentaire ||
                    req.body?.raison ||
                    ""
                ).trim() || null;


            const result =
                await pool.query(

                    `

                    UPDATE paiements

                    SET

                        statut = 'refuse',

                        commentaire_admin =
                            COALESCE(
                                $1,
                                commentaire_admin
                            ),

                        date_modification =
                            CURRENT_TIMESTAMP

                    WHERE id = $2

                    RETURNING *

                    `,

                    [

                        commentaire,
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
                    result.rows[0],

                paiement:
                    result.rows[0]

            });

        }

        catch (error) {

            console.error(
                "❌ ERREUR REFUS :",
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
   32. STATISTIQUES ADMIN
========================================================= */

app.get(
    "/api/admin/statistiques",
    async (req, res) => {

        try {

            const users =
                await pool.query(`

                    SELECT
                        COUNT(*)::int AS total,

                        COUNT(*) FILTER (
                            WHERE premium = TRUE
                        )::int AS premium

                    FROM users

                `);


            const paiements =
                await pool.query(`

                    SELECT

                        COUNT(*)::int AS total,

                        COUNT(*) FILTER (
                            WHERE statut = 'en_attente'
                        )::int AS en_attente,

                        COUNT(*) FILTER (
                            WHERE statut = 'valide'
                        )::int AS valides,

                        COUNT(*) FILTER (
                            WHERE statut = 'refuse'
                        )::int AS refuses

                    FROM paiements

                `);


            const revenus =
                await pool.query(`

                    SELECT

                        COALESCE(
                            SUM(montant)
                            FILTER (
                                WHERE statut = 'valide'
                            ),
                            0
                        ) AS total

                    FROM paiements

                `);


            res.json({

                success: true,

                utilisateurs: {

                    total:
                        users.rows[0].total,

                    premium:
                        users.rows[0].premium

                },

                paiements: {

                    total:
                        paiements.rows[0].total,

                    en_attente:
                        paiements.rows[0].en_attente,

                    valides:
                        paiements.rows[0].valides,

                    refuses:
                        paiements.rows[0].refuses

                },

                revenus:

                    revenus.rows[0].total

            });

        }

        catch (error) {

            console.error(
                "❌ ERREUR STATISTIQUES :",
                error.message
            );

            res.status(500).json({

                success: false,

                message:
                    "Impossible de récupérer les statistiques.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   33. DEBUG ROUTES
========================================================= */

app.get(
    "/api/debug/routes",
    (req, res) => {

        res.json({

            success: true,

            version:
                "6.0.0",

            routes: [

                "GET /",

                "GET /api/health",

                "GET /api/test-db",

                "POST /api/inscription",

                "POST /api/connexion",

                "POST /api/admin/connexion",

                "GET /api/admin/verifier",

                "GET /api/admin/statistiques",

                "GET /api/apprenants",

                "GET /api/apprenants/:id",

                "PUT /api/apprenants/:id/premium",

                "GET /api/paiements",

                "GET /api/paiements/recherche",

                "GET /api/paiements/:id",

                "POST /api/paiements",

                "POST /api/admin/paiements",

                "PUT /api/paiements/:id/preuve",

                "PUT /api/paiements/:id/valider",

                "PUT /api/paiements/:id/refuser",

                "GET /api/debug/routes"

            ]

        });

    }
);


/* =========================================================
   34. ROUTE INEXISTANTE
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
   35. GESTIONNAIRE D'ERREURS
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
            error.message
        );

        console.error(
            "========================================"
        );


        if (
            error instanceof SyntaxError &&
            error.status === 400 &&
            error.type ===
                "entity.parse.failed"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "JSON invalide."

            });

        }


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
   36. DÉMARRAGE
========================================================= */

async function demarrerServeur() {

    try {

        logSection(
            "🚀 DÉMARRAGE BMJ SERVICE API 6.0"
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
           VÉRIFICATION DATABASE_URL
        ===================================================== */

        if (!DATABASE_URL) {

            console.error(
                "❌ DATABASE_URL N'EST PAS CONFIGURÉE."
            );

            console.error(
                "👉 Ajoute DATABASE_URL dans Render > Environment."
            );

        }


        /* =====================================================
           TEST DATABASE
        ===================================================== */

        const connexion =
            await testerDatabase();


        if (!connexion) {

            console.error(
                "⚠️ PostgreSQL non disponible."
            );

            console.error(
                "⚠️ Vérifie DATABASE_URL sur Render."
            );

        }

        else {

            await creerTables();

        }


        /* =====================================================
           DÉMARRAGE EXPRESS
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
                    "🗄️ DATABASE : PostgreSQL"
                );


                console.log(
                    "👤 UTILISATEURS : ACTIF"
                );


                console.log(
                    "🔐 ADMIN : ACTIF"
                );


                console.log(
                    "💳 PAIEMENTS : ACTIF"
                );


                console.log(
                    "📧 PAIEMENTS EMAIL : ACTIF"
                );


                console.log(
                    "📎 PREUVES : ACTIF"
                );


                console.log(
                    "⭐ PREMIUM AUTOMATIQUE : ACTIF"
                );


                console.log(
                    "📊 STATISTIQUES : ACTIF"
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
   37. ARRÊT PROPRE
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


/* =========================================================
   38. SIGINT
========================================================= */

process.on(
    "SIGINT",
    () => {

        arreterServeur(
            "SIGINT"
        );

    }
);


/* =========================================================
   39. SIGTERM
========================================================= */

process.on(
    "SIGTERM",
    () => {

        arreterServeur(
            "SIGTERM"
        );

    }
);


/* =========================================================
   40. UNHANDLED REJECTION
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


/* =========================================================
   41. UNCAUGHT EXCEPTION
========================================================= */

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
   42. START
========================================================= */

demarrerServeur();