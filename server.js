/* =========================================================
   BMJ SERVICE
   BACKEND API COMPLET
   NODE.JS + EXPRESS + POSTGRESQL
   RENDER

   VERSION : 5.0.0

   OBJECTIF PRINCIPAL
   ---------------------------------------------------------
   UTILISATEUR
        ↓
   POST /api/paiements
        ↓
   SERVEUR RENDER
        ↓
   POSTGRESQL
        ↓
   GET /api/paiements
        ↓
   ADMIN
        ↓
   VALIDER / REFUSER

   =========================================================
   ROUTES PUBLIQUES
   ---------------------------------------------------------
   GET     /
   GET     /api/test-db
   GET     /api/debug/routes

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
   ROUTES DEMANDES / PAIEMENTS
   ---------------------------------------------------------
   POST    /api/paiements
   GET     /api/paiements
   GET     /api/paiements/:id

   GET     /api/demandes
   GET     /api/demandes/:id

   PUT     /api/paiements/:id/valider
   PUT     /api/paiements/:id/refuser

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
   4. CONFIGURATION DATABASE
========================================================= */

/*
   IMPORTANT :

   SUR RENDER :

   Environment
   ↓
   DATABASE_URL

   Exemple :

   postgresql://user:password@host/database

   Ne mets PAS directement ton mot de passe dans le code.

   Le serveur récupère automatiquement :

   process.env.DATABASE_URL
*/

const DATABASE_URL =
    process.env.DATABASE_URL;


/* =========================================================
   5. ADMIN
========================================================= */

/*
   Ces valeurs peuvent également être placées
   dans les variables d'environnement Render.

   ADMIN_EMAIL
   ADMIN_SECRET
*/

const ADMIN_EMAIL =
    process.env.ADMIN_EMAIL ||
    "admin@bmjservice.com";

const ADMIN_SECRET =
    process.env.ADMIN_SECRET ||
    "BMJ-ADMIN-2026";


/* =========================================================
   6. VÉRIFICATION CONFIGURATION
========================================================= */

if (!DATABASE_URL) {

    console.error("");
    console.error(
        "================================================="
    );

    console.error(
        "❌ DATABASE_URL MANQUANTE"
    );

    console.error(
        "================================================="
    );

    console.error(
        "postgresql://bmj_db_user:5FSX8YeJNzwinKdFOrIeEC43aQsuzf91@dpg-d9sdlt49v7es73emrq8g-a/bmj_db"
    );

    console.error(
        "Le serveur ne pourra pas utiliser PostgreSQL."
    );

    console.error(
        "================================================="
    );

}


/* =========================================================
   7. POOL POSTGRESQL
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
   8. SURVEILLANCE POSTGRESQL
========================================================= */

pool.on(
    "error",
    (error) => {

        console.error("");

        console.error(
            "================================================="
        );

        console.error(
            "❌ ERREUR POOL POSTGRESQL"
        );

        console.error(
            "================================================="
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
            "================================================="
        );

    }
);


/* =========================================================
   9. CORS
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
   10. JSON
========================================================= */

app.use(

    express.json({

        limit: "25mb"

    })

);


/* =========================================================
   11. URL ENCODED
========================================================= */

app.use(

    express.urlencoded({

        extended: true,

        limit: "25mb"

    })

);


/* =========================================================
   12. LOGGER DES REQUÊTES
========================================================= */

/*
   TRÈS IMPORTANT POUR LE DEBUG.

   Chaque demande reçue par Render sera affichée
   dans les logs Render.

   Exemple :

   POST /api/paiements
*/

app.use(
    (req, res, next) => {

        const maintenant =
            new Date().toISOString();

        console.log(
            `📡 ${maintenant} | ${req.method} ${req.originalUrl}`
        );

        next();

    }
);


/* =========================================================
   13. OUTILS
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
   BOOLEAN
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
   GÉNÉRER ID PAIEMENT
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
   LOG SECTION
--------------------------------------------------------- */

function logSection(titre) {

    console.log("");

    console.log(
        "================================================="
    );

    console.log(
        titre
    );

    console.log(
        "================================================="
    );

}


/* =========================================================
   14. CRÉATION DES TABLES
========================================================= */

async function creerTables() {

    logSection(
        "🗄️ VÉRIFICATION DES TABLES"
    );


    try {

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
           PAIEMENTS / DEMANDES
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
           AJOUT COLONNES USERS SI ABSENTES
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
           INDEX
        ===================================================== */

        await pool.query(`

            CREATE INDEX IF NOT EXISTS
            idx_users_email

            ON users(email);

        `);


        await pool.query(`

            CREATE INDEX IF NOT EXISTS
            idx_paiements_email

            ON paiements(email);

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
                    $4
                )

                `,

                [

                    "Administrateur BMJ SERVICE",

                    normaliserEmail(
                        ADMIN_EMAIL
                    ),

                    ADMIN_SECRET,

                    "admin"

                ]

            );


            console.log(
                "✅ ADMIN CRÉÉ"
            );

        }

        else {

            await pool.query(

                `

                UPDATE admins

                SET

                    secret_key = $1,

                    role = 'admin'

                WHERE LOWER(email) = $2

                `,

                [

                    ADMIN_SECRET,

                    normaliserEmail(
                        ADMIN_EMAIL
                    )

                ]

            );


            console.log(
                "✅ ADMIN EXISTANT"
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
   15. PAGE PRINCIPALE
========================================================= */

app.get(
    "/",
    async (req, res) => {

        let database =
            "inconnue";


        try {

            await pool.query(
                "SELECT 1"
            );

            database =
                "connected";

        }

        catch (error) {

            database =
                "disconnected";

        }


        res.json({

            success: true,

            message:
                "BMJ SERVICE API fonctionne.",

            version:
                "5.0.0",

            server:
                "Node.js + Express",

            database:
                "PostgreSQL",

            databaseStatus:
                database,

            status:
                "online",

            timestamp:
                new Date().toISOString(),

            routes: {

                inscription:
                    "POST /api/inscription",

                connexion:
                    "POST /api/connexion",

                paiements:
                    "POST /api/paiements",

                demandes:
                    "GET /api/demandes",

                admin:
                    "POST /api/admin/connexion",

                validation:
                    "PUT /api/paiements/:id/valider",

                refus:
                    "PUT /api/paiements/:id/refuser"

            }

        });

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
                    "connected",

                heure:
                    result.rows[0].heure

            });

        }

        catch (error) {

            console.error(
                "❌ TEST DB",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "PostgreSQL ne fonctionne pas.",

                database:
                    "disconnected",

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

        logSection(
            "📝 NOUVELLE INSCRIPTION"
        );


        try {

            const {

                nom,
                email,
                telephone,
                password,
                domaine,
                photo

            } = req.body || {};


            console.log(
                "Email reçu :",
                email
            );


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
                normaliserEmail(
                    email
                );


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


            console.log(
                "✅ UTILISATEUR CRÉÉ :",
                user.id,
                user.email
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
                "❌ ERREUR INSCRIPTION",
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
                normaliserEmail(
                    login
                );


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
                "❌ ERREUR CONNEXION",
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
   19. CONNEXION ADMIN
========================================================= */

app.post(
    "/api/admin/connexion",
    async (req, res) => {

        logSection(
            "🔐 CONNEXION ADMIN"
        );


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


            console.log(
                "✅ ADMIN CONNECTÉ :",
                admin.email
            );


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
                "❌ ERREUR ADMIN",
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
   20. VÉRIFICATION ADMIN
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
                        normaliserEmail(
                            email
                        )
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
                "❌ ERREUR VÉRIFICATION ADMIN",
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
                "❌ ERREUR APPRENANTS",
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
                "❌ ERREUR UTILISATEUR",
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
                "❌ ERREUR PREMIUM",
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
   24. ENVOYER UNE DEMANDE DE PAIEMENT
========================================================= */

/*
   C'EST LA ROUTE PRINCIPALE DU PROBLÈME.

   POST

   /api/paiements

   Le serveur :

   1. reçoit la demande
   2. vérifie l'utilisateur
   3. génère un ID
   4. enregistre la demande
   5. statut = en_attente
   6. retourne la demande créée

   L'ADMIN pourra ensuite la récupérer avec :

   GET /api/paiements

   ou :

   GET /api/demandes
*/

app.post(
    "/api/paiements",
    async (req, res) => {

        logSection(
            "📥 NOUVELLE DEMANDE REÇUE"
        );


        try {

            const body =
                req.body || {};


            console.log(
                "📡 CONTENT-TYPE :",
                req.headers["content-type"]
            );


            console.log(
                "📦 CHAMPS REÇUS :",
                Object.keys(body)
            );


            console.log(
                "👤 NOM :",
                body.nom || "(non fourni)"
            );


            console.log(
                "📧 EMAIL :",
                body.email || "(non fourni)"
            );


            console.log(
                "🆔 USER ID :",
                body.userId ||
                body.user_id ||
                body.utilisateurID ||
                body.utilisateur_id ||
                "(non fourni)"
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


            console.log(
                "🆔 ID DEMANDE :",
                paiementID
            );


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
               RECHERCHE UTILISATEUR PAR ID
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


            /* =================================================
               RECHERCHE UTILISATEUR PAR EMAIL
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

                        SELECT *

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

                console.error(
                    "❌ UTILISATEUR INTROUVABLE"
                );


                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable. La demande n'a pas été enregistrée.",

                    debug: {

                        userId:
                            userIdFinal || null,

                        email:
                            email || null

                    }

                });

            }


            console.log(
                "✅ UTILISATEUR TROUVÉ :",
                utilisateur.id,
                utilisateur.email
            );


            /* =================================================
               EMAIL FINAL
            ================================================= */

            const emailFinal =
                normaliserEmail(
                    utilisateur.email
                );


            /* =================================================
               VÉRIFIER ID DUPLIQUÉ
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
                        "Cette demande existe déjà.",

                    data:
                        paiementExiste.rows[0]

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
                )
                .trim();


            /* =================================================
               OFFRE
            ================================================= */

            const offreFinal =
                String(
                    offre ||
                    "Premium BMJ SERVICE"
                )
                .trim();


            /* =================================================
               PREUVE / CAPTURE
            ================================================= */

            const captureFinal =
                capture ||
                preuve ||
                null;


            /* =================================================
               INSERTION DATABASE
            ================================================= */

            console.log(
                "💾 INSERTION DE LA DEMANDE..."
            );


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
               VÉRIFICATION
            ================================================= */

            if (!paiement) {

                throw new Error(
                    "PostgreSQL n'a retourné aucune demande après insertion."
                );

            }


            /* =================================================
               SUCCÈS
            ================================================= */

            logSection(
                "✅ DEMANDE ENREGISTRÉE DANS POSTGRESQL"
            );


            console.log(
                "ID DB :",
                paiement.id
            );


            console.log(
                "ID paiement :",
                paiement.id_paiement
            );


            console.log(
                "Utilisateur :",
                paiement.utilisateur_id
            );


            console.log(
                "Email :",
                paiement.email
            );


            console.log(
                "Montant :",
                paiement.montant,
                paiement.devise
            );


            console.log(
                "Statut :",
                paiement.statut
            );


            return res.status(201).json({

                success: true,

                message:
                    "Votre demande a été envoyée avec succès et enregistrée.",

                data:
                    paiement,

                paiement:
                    paiement

            });

        }

        catch (error) {

            logSection(
                "❌ ERREUR DEMANDE"
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


            if (
                error.code === "23505"
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Cette demande existe déjà.",

                    error:
                        error.detail ||
                        error.message

                });

            }


            if (
                error.code === "22P02"
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Une donnée envoyée possède un format incorrect.",

                    error:
                        error.message

                });

            }


            return res.status(500).json({

                success: false,

                message:
                    "Impossible d'enregistrer la demande sur le serveur.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   25. RÉCUPÉRER TOUTES LES DEMANDES
========================================================= */

/*
   ROUTE PRINCIPALE POUR L'ADMIN :

   GET /api/demandes

   Elle retourne toutes les demandes.

   IMPORTANT :

   Cette route lit directement PostgreSQL.

   Donc si une demande a bien été enregistrée,
   elle apparaîtra ici.
*/

app.get(
    "/api/demandes",
    async (req, res) => {

        logSection(
            "📋 RÉCUPÉRATION DES DEMANDES"
        );


        try {

            const result =
                await pool.query(`

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
                        capture,
                        statut,
                        date

                    FROM paiements

                    ORDER BY id DESC

                `);


            console.log(
                "📊 NOMBRE DE DEMANDES :",
                result.rows.length
            );


            res.json({

                success: true,

                data:
                    result.rows,

                demandes:
                    result.rows,

                total:
                    result.rows.length

            });

        }

        catch (error) {

            console.error(
                "❌ ERREUR RÉCUPÉRATION DEMANDES",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Impossible de récupérer les demandes.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   26. RÉCUPÉRER TOUTES LES DEMANDES / PAIEMENTS
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


            console.log(
                "📋 PAIEMENTS ENVOYÉS À L'ADMIN :",
                result.rows.length
            );


            res.json({

                success: true,

                data:
                    result.rows,

                paiements:
                    result.rows,

                demandes:
                    result.rows,

                total:
                    result.rows.length

            });

        }

        catch (error) {

            console.error(
                "❌ ERREUR PAIEMENTS",
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
   27. UNE DEMANDE
========================================================= */

app.get(
    "/api/demandes/:id",
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
                        "ID demande invalide."

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
                        "Demande introuvable."

                });

            }


            res.json({

                success: true,

                data:
                    result.rows[0],

                demande:
                    result.rows[0]

            });

        }

        catch (error) {

            console.error(
                "❌ ERREUR DEMANDE",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Erreur récupération demande.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   28. UN PAIEMENT
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
                    result.rows[0]

            });

        }

        catch (error) {

            console.error(
                "❌ ERREUR PAIEMENT",
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
   29. VALIDER UNE DEMANDE
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


            logSection(
                `✅ VALIDATION PAIEMENT #${id}`
            );


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
               UTILISATEUR
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


            console.log(
                "✅ PAIEMENT VALIDÉ"
            );


            console.log(
                "⭐ PREMIUM ACTIVÉ POUR :",
                user.email
            );


            res.json({

                success: true,

                message:
                    "Paiement validé et compte Premium activé.",

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
                "❌ ERREUR VALIDATION",
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
   30. REFUSER UNE DEMANDE
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
                    result.rows[0],

                paiement:
                    result.rows[0]

            });

        }

        catch (error) {

            console.error(
                "❌ ERREUR REFUS",
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
   31. DEBUG DES DEMANDES
========================================================= */

/*
   CETTE ROUTE EST TRÈS IMPORTANTE.

   Elle permet de savoir immédiatement si PostgreSQL
   contient réellement les demandes.

   GET /api/debug/demandes
*/

app.get(
    "/api/debug/demandes",
    async (req, res) => {

        try {

            const result =
                await pool.query(`

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
                        date

                    FROM paiements

                    ORDER BY id DESC

                    LIMIT 50

                `);


            res.json({

                success: true,

                message:
                    "Diagnostic des demandes.",

                total:
                    result.rows.length,

                data:
                    result.rows

            });

        }

        catch (error) {

            res.status(500).json({

                success: false,

                message:
                    "Erreur diagnostic demandes.",

                error:
                    error.message

            });

        }

    }
);


/* =========================================================
   32. DEBUG ROUTES
========================================================= */

app.get(
    "/api/debug/routes",
    (req, res) => {

        res.json({

            success: true,

            version:
                "5.0.0",

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

                "POST /api/paiements",

                "GET /api/paiements",

                "GET /api/paiements/:id",

                "GET /api/demandes",

                "GET /api/demandes/:id",

                "PUT /api/paiements/:id/valider",

                "PUT /api/paiements/:id/refuser",

                "GET /api/debug/demandes",

                "GET /api/debug/routes"

            ]

        });

    }
);


/* =========================================================
   33. ROUTE INEXISTANTE
========================================================= */

app.use(
    (req, res) => {

        console.log(
            "❌ ROUTE INEXISTANTE :",
            req.method,
            req.originalUrl
        );


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
   34. GESTIONNAIRE ERREURS
========================================================= */

app.use(
    (error, req, res, next) => {

        console.error("");

        console.error(
            "================================================="
        );

        console.error(
            "❌ ERREUR SERVEUR"
        );

        console.error(
            "================================================="
        );

        console.error(
            error
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
   35. DÉMARRAGE SERVEUR
========================================================= */

async function demarrerServeur() {

    logSection(
        "🚀 DÉMARRAGE BMJ SERVICE API 5.0"
    );


    console.log(
        "🌐 PORT :",
        PORT
    );


    console.log(
        "📡 NODE_ENV :",
        process.env.NODE_ENV ||
        "development"
    );


    console.log(
        "🗄️ DATABASE : PostgreSQL"
    );


    console.log(
        "🔐 ADMIN EMAIL :",
        ADMIN_EMAIL
    );


    /* =====================================================
       VÉRIFIER DATABASE_URL
    ===================================================== */

    if (!DATABASE_URL) {

        console.error("");

        console.error(
            "❌ DATABASE_URL N'EST PAS CONFIGURÉE."
        );

        console.error(
            "Le serveur ne peut pas fonctionner correctement."
        );

        console.error("");

        process.exit(1);

    }


    /* =====================================================
       TEST DATABASE
    ===================================================== */

    try {

        const result =
            await pool.query(
                "SELECT NOW() AS heure"
            );


        console.log(
            "✅ POSTGRESQL CONNECTÉ"
        );


        console.log(
            "🕐 Heure PostgreSQL :",
            result.rows[0].heure
        );

    }

    catch (error) {

        console.error("");

        console.error(
            "❌ POSTGRESQL NON CONNECTÉ"
        );

        console.error(
            "Code :",
            error.code
        );

        console.error(
            "Message :",
            error.message
        );

        console.error("");

        process.exit(1);

    }


    /* =====================================================
       CRÉER TABLES
    ===================================================== */

    const tables =
        await creerTables();


    if (!tables) {

        console.error(
            "❌ Impossible de préparer la base de données."
        );

        process.exit(1);

    }


    /* =====================================================
       LANCER EXPRESS
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
                `📡 SERVER : http://localhost:${PORT}`
            );


            console.log(
                "🗄️ DATABASE : PostgreSQL CONNECTÉ"
            );


            console.log(
                "📥 DEMANDES : POST /api/paiements"
            );


            console.log(
                "📋 ADMIN : GET /api/demandes"
            );


            console.log(
                "🔍 DEBUG : GET /api/debug/demandes"
            );


            console.log(
                "❤️ BMJ SERVICE READY"
            );

        }
    );

}


/* =========================================================
   36. ARRÊT PROPRE
========================================================= */

async function arreterServeur(signal) {

    console.log("");

    console.log(
        `🛑 SIGNAL ${signal} REÇU`
    );


    try {

        await pool.end();


        console.log(
            "✅ PostgreSQL fermé proprement."
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
   37. ERREURS NON GÉRÉES
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
   38. START
========================================================= */

demarrerServeur();