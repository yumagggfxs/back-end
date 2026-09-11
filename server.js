/* ============================================================
   BMJ SERVICE - BACKEND COMPLET
   Node.js + Express + PostgreSQL
============================================================ */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();

/* ============================================================
   CONFIGURATION
============================================================ */

const PORT = process.env.PORT || 10000;

const DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://name_bmj_db_user:TjgoLRbYV0LizRgBFD1nepGqSqErgBgD@dpg-dagn0e15efls73b8rjh0-a/name_bmj_db";

/* ============================================================
   IDENTIFIANTS ADMIN DIRECTEMENT DANS LE SERVEUR
   ============================================================ */

const ADMIN_EMAIL = "admin@bmjservice.com";
const ADMIN_PASSWORD = "admin123";

const ADMIN_SECRET = "BMJ_ADMIN_SECRET_2026";


/* ============================================================
   CONNEXION POSTGRESQL
   ============================================================ */

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});


/* ============================================================
   MIDDLEWARE
   ============================================================ */

app.use(cors({
    origin: true,
    credentials: false,

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
        "Authorization",
        "X-Admin-Token"
    ]
}));


/*
 * Répondre correctement aux requêtes OPTIONS
 * envoyées par le navigateur avant les requêtes protégées.
 */
app.options("*", cors());


/*
 * JSON
 */
app.use(express.json({
    limit: "10mb"
}));


/*
 * Formulaires classiques
 */
app.use(express.urlencoded({
    extended: true,
    limit: "10mb"
}));


/* ============================================================
   OUTILS
   ============================================================ */


/*
 * Hash du mot de passe utilisateur.
 */
function hashPassword(password) {

    return crypto
        .createHash("sha256")
        .update(String(password))
        .digest("hex");
}


/*
 * Création d'un token admin aléatoire.
 */
function createToken() {

    return crypto
        .randomBytes(48)
        .toString("hex");
}


/*
 * Hash du token avant stockage.
 *
 * Le token réel n'est jamais stocké directement
 * dans la Map.
 */
function tokenHash(token) {

    return crypto
        .createHash("sha256")
        .update(String(token))
        .digest("hex");
}


/*
 * Récupérer le token admin depuis la requête.
 *
 * Priorité :
 * 1. Authorization: Bearer TOKEN
 * 2. X-Admin-Token
 * 3. ?token=TOKEN
 */
function getAdminToken(req) {

    const authorization =
        String(
            req.headers.authorization || ""
        ).trim();


    /*
     * Authorization: Bearer TOKEN
     */
    if (
        authorization &&
        authorization
            .toLowerCase()
            .startsWith("bearer ")
    ) {

        const token =
            authorization
                .substring(7)
                .trim();

        if (token) {
            return token;
        }
    }


    /*
     * X-Admin-Token
     */
    const headerToken =
        req.headers["x-admin-token"];

    if (headerToken) {

        const token =
            String(headerToken).trim();

        if (token) {
            return token;
        }
    }


    /*
     * Compatibilité query string
     */
    if (req.query && req.query.token) {

        const token =
            String(req.query.token).trim();

        if (token) {
            return token;
        }
    }


    return null;
}


/*
 * Requête PostgreSQL centralisée.
 */
async function query(text, params = []) {

    return pool.query(
        text,
        params
    );
}


/*
 * Test de connexion PostgreSQL.
 */
async function testDatabase() {

    const result =
        await query(
            "SELECT NOW() AS now"
        );

    return result.rows[0];
}


/* ============================================================
   JOURNAL ADMIN
   ============================================================ */

async function addActivity(
    adminEmail,
    action,
    userId = null,
    details = ""
) {

    try {

        await query(`
            INSERT INTO admin_activity
            (
                admin_email,
                action,
                user_id,
                details
            )
            VALUES
            ($1, $2, $3, $4)
        `, [

            adminEmail,
            action,
            userId,
            details
        ]);

    } catch (e) {

        /*
         * Une erreur de journal ne doit jamais
         * faire échouer l'action principale.
         */

        console.error(
            "Erreur journal admin :",
            e.message
        );
    }
}


/* ============================================================
   TOKENS ADMIN EN MEMOIRE UNIQUEMENT
   ============================================================ */

/*
 * IMPORTANT :
 *
 * Aucun token admin n'est enregistré :
 *
 * - dans localStorage
 * - dans sessionStorage
 * - dans PostgreSQL
 * - dans un cookie
 *
 * Les tokens disparaissent automatiquement
 * lorsque le serveur redémarre.
 */

const adminTokens = new Map();


/* ============================================================
   NETTOYAGE DES TOKENS ADMIN
   ============================================================ */

const ADMIN_TOKEN_DURATION =
    12 * 60 * 60 * 1000;


/*
 * Nettoyage automatique des anciens tokens.
 */
setInterval(() => {

    const now = Date.now();

    for (
        const [
            hashedToken,
            adminData
        ] of adminTokens.entries()
    ) {

        if (
            !adminData ||
            !adminData.createdAt ||
            now - adminData.createdAt >
            ADMIN_TOKEN_DURATION
        ) {

            adminTokens.delete(
                hashedToken
            );
        }
    }

}, 10 * 60 * 1000);


/* ============================================================
   AUTHENTIFICATION ADMIN
   ============================================================ */

function adminAuth(
    req,
    res,
    next
) {

    try {

        const token =
            getAdminToken(req);


        /*
         * Aucun token
         */
        if (!token) {

            return res.status(401).json({
                success: false,
                authenticated: false,
                code: "ADMIN_TOKEN_MISSING",
                message:
                    "Token administrateur manquant"
            });
        }


        /*
         * Recherche du token hashé
         */
        const hashedToken =
            tokenHash(token);


        const saved =
            adminTokens.get(
                hashedToken
            );


        /*
         * Token inexistant
         */
        if (!saved) {

            return res.status(401).json({
                success: false,
                authenticated: false,
                code: "ADMIN_TOKEN_INVALID",
                message:
                    "Token administrateur invalide ou expiré"
            });
        }


        /*
         * Vérification de l'expiration.
         */
        if (
            !saved.createdAt ||
            Date.now() - saved.createdAt >
            ADMIN_TOKEN_DURATION
        ) {

            adminTokens.delete(
                hashedToken
            );

            return res.status(401).json({
                success: false,
                authenticated: false,
                code: "ADMIN_TOKEN_EXPIRED",
                message:
                    "Session administrateur expirée"
            });
        }


        /*
         * Informations admin disponibles
         * dans les routes protégées.
         */
        req.admin = {
            email: saved.email,
            createdAt: saved.createdAt
        };


        next();

    } catch (e) {

        console.error(
            "Erreur authentification admin :",
            e
        );

        return res.status(500).json({
            success: false,
            message:
                "Erreur interne d'authentification administrateur"
        });
    }
}


/* ============================================================
   CREATION DES TABLES
   ============================================================ */

async function initDatabase() {

    /*
     * USERS
     */
    await query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,

            nom VARCHAR(150),

            email VARCHAR(255)
                UNIQUE NOT NULL,

            telephone VARCHAR(50),

            domaine VARCHAR(150),

            password TEXT,

            photo TEXT,

            premium BOOLEAN
                DEFAULT FALSE,

            is_premium BOOLEAN
                DEFAULT FALSE,

            premium_until TIMESTAMP NULL,

            blocked BOOLEAN
                DEFAULT FALSE,

            is_blocked BOOLEAN
                DEFAULT FALSE,

            certificats INTEGER
                DEFAULT 0,

            created_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP,

            updated_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP
        )
    `);


    /*
     * PAIEMENTS
     */
    await query(`
        CREATE TABLE IF NOT EXISTS paiements (
            id SERIAL PRIMARY KEY,

            user_id INTEGER,

            montant NUMERIC(12,2)
                DEFAULT 0,

            methode VARCHAR(100),

            reference VARCHAR(255),

            statut VARCHAR(50)
                DEFAULT 'pending',

            reason TEXT,

            created_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP,

            updated_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP
        )
    `);


    /*
     * DEMANDES DE PAIEMENT
     */
    await query(`
        CREATE TABLE IF NOT EXISTS demandes_paiement (
            id SERIAL PRIMARY KEY,

            user_id INTEGER,

            telephone_paiement VARCHAR(100),

            reference_paiement VARCHAR(255),

            montant NUMERIC(12,2)
                DEFAULT 0,

            methode VARCHAR(100),

            statut VARCHAR(50)
                DEFAULT 'pending',

            reason TEXT,

            created_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP,

            updated_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP
        )
    `);


    /*
     * PROGRESSION DES COURS
     */
    await query(`
        CREATE TABLE IF NOT EXISTS course_progress (
            id SERIAL PRIMARY KEY,

            user_id INTEGER NOT NULL,

            domaine VARCHAR(150),

            progression INTEGER
                DEFAULT 0,

            lessons_completed INTEGER
                DEFAULT 0,

            total_lessons INTEGER
                DEFAULT 0,

            last_lesson TEXT,

            title TEXT,

            completed BOOLEAN
                DEFAULT FALSE,

            updated_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP,

            UNIQUE(user_id, domaine)
        )
    `);


    /*
     * MESSAGES
     */
    await query(`
        CREATE TABLE IF NOT EXISTS messages (
            id SERIAL PRIMARY KEY,

            user_id INTEGER,

            sender_type VARCHAR(50)
                DEFAULT 'admin',

            sender_id INTEGER,

            content TEXT NOT NULL,

            priority VARCHAR(30)
                DEFAULT 'normal',

            read BOOLEAN
                DEFAULT FALSE,

            reply_to INTEGER NULL,

            created_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP
        )
    `);


    /*
     * ACTIVITES ADMIN
     */
    await query(`
        CREATE TABLE IF NOT EXISTS admin_activity (
            id SERIAL PRIMARY KEY,

            admin_email VARCHAR(255),

            action VARCHAR(150),

            user_id INTEGER NULL,

            details TEXT,

            created_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP
        )
    `);


    /*
     * Colonnes supplémentaires pour les anciennes bases.
     */
    const columns = [

        `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS premium
        BOOLEAN DEFAULT FALSE
        `,

        `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_premium
        BOOLEAN DEFAULT FALSE
        `,

        `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS premium_until
        TIMESTAMP NULL
        `,

        `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS blocked
        BOOLEAN DEFAULT FALSE
        `,

        `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_blocked
        BOOLEAN DEFAULT FALSE
        `,

        `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS certificats
        INTEGER DEFAULT 0
        `,

        `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS photo
        TEXT
        `,

        `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS telephone
        VARCHAR(50)
        `,

        `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS domaine
        VARCHAR(150)
        `,

        `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS created_at
        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `,

        `
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS updated_at
        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `
    ];


    for (
        const colQuery of columns
    ) {

        try {

            await query(
                colQuery
            );

        } catch (e) {

            console.error(
                "Migration ignorée :",
                e.message
            );
        }
    }


    /*
     * Synchronisation des anciens champs
     * premium / blocked.
     */
    try {

        await query(`
            UPDATE users
            SET
                premium =
                    CASE
                        WHEN is_premium = TRUE
                        THEN TRUE
                        ELSE premium
                    END,

                is_premium =
                    CASE
                        WHEN premium = TRUE
                        THEN TRUE
                        ELSE is_premium
                    END
        `);

    } catch (e) {

        console.error(
            "Erreur synchronisation Premium :",
            e.message
        );
    }


    try {

        await query(`
            UPDATE users
            SET
                blocked =
                    CASE
                        WHEN is_blocked = TRUE
                        THEN TRUE
                        ELSE blocked
                    END,

                is_blocked =
                    CASE
                        WHEN blocked = TRUE
                        THEN TRUE
                        ELSE is_blocked
                    END
        `);

    } catch (e) {

        console.error(
            "Erreur synchronisation blocage :",
            e.message
        );
    }


    /*
     * Création des utilisateurs démo.
     *
     * La fonction garantit au minimum
     * 33 utilisateurs dans PostgreSQL.
     */
    await seedDemoUsers();


    console.log(
        "Base de données initialisée avec succès."
    );
}


/* ============================================================
   UTILISATEURS DEMO
   GARANTIT AU MOINS 33 UTILISATEURS
   ============================================================ */

async function seedDemoUsers() {

    try {

        const countResult =
            await query(`
                SELECT COUNT(*)::INTEGER AS total
                FROM users
            `);


        let currentCount =
            Number(
                countResult.rows[0]?.total || 0
            );


        /*
         * Si la base contient déjà 33 utilisateurs
         * ou plus, on ne touche à rien.
         */
        if (currentCount >= 33) {

            console.log(
                `Utilisateurs actuels : ${currentCount}`
            );

            return;
        }


        /*
         * On complète jusqu'à 33.
         *
         * Les vrais utilisateurs existants
         * sont conservés.
         */
        for (
            let i = 1;
            currentCount < 33 && i <= 100;
            i++
        ) {

            const email =
                `demo${String(i).padStart(2, "0")}@bmjservice.com`;


            /*
             * Vérifier si cet email existe déjà.
             */
            const existing =
                await query(`
                    SELECT id
                    FROM users
                    WHERE LOWER(email) =
                          LOWER($1)
                    LIMIT 1
                `, [
                    email
                ]);


            if (
                existing.rows.length > 0
            ) {
                continue;
            }


            const premium =
                i % 4 === 0;


            const blocked =
                i % 17 === 0;


            await query(`
                INSERT INTO users
                (
                    nom,
                    email,
                    telephone,
                    domaine,
                    password,
                    photo,
                    premium,
                    is_premium,
                    blocked,
                    is_blocked,
                    certificats
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
                    $7,
                    $8,
                    $8,
                    $9
                )
                ON CONFLICT (email)
                DO NOTHING
            `, [

                `Utilisateur Démo ${i}`,

                email,

                `+243900000${String(i).padStart(2, "0")}`,

                [
                    "Informatique",
                    "Marketing",
                    "Finance",
                    "Entrepreneuriat",
                    "Leadership",
                    "IA",
                    "Agriculture",
                    "Beauté"
                ][i % 8],

                hashPassword(
                    "123456"
                ),

                "",

                premium,

                blocked,

                i % 5
            ]);


            currentCount++;
        }


        console.log(
            `Seed utilisateurs terminé : ${currentCount} utilisateurs.`
        );

    } catch (e) {

        console.error(
            "Erreur seedDemoUsers :",
            e.message
        );
    }
}


/* ============================================================
   ROUTES GENERALES
   ============================================================ */

app.get(
    "/",
    (req, res) => {

        res.json({
            success: true,
            message:
                "API BMJ SERVICE en ligne"
        });
    }
);


app.get(
    "/api",
    (req, res) => {

        res.json({
            success: true,
            version: "1.0.0",
            service:
                "BMJ SERVICE API"
        });
    }
);


/* ============================================================
   HEALTH
   ============================================================ */

app.get(
    "/api/health",
    async (req, res) => {

        try {

            const dbTime =
                await testDatabase();


            res.json({
                success: true,

                message:
                    "Serveur et base de données opérationnels",

                database: {
                    connected: true,
                    time: dbTime.now
                }
            });

        } catch (e) {

            console.error(
                "Health check DB :",
                e.message
            );

            res.status(500).json({

                success: false,

                message:
                    "Base de données indisponible",

                database: {
                    connected: false
                },

                error:
                    e.message
            });
        }
    }
);


/* ============================================================
   TEST DATABASE
   ============================================================ */

app.get(
    "/api/test-db",
    async (req, res) => {

        try {

            const dbTime =
                await testDatabase();


            res.json({
                success: true,
                time: dbTime
            });

        } catch (e) {

            res.status(500).json({

                success: false,

                error:
                    e.message
            });
        }
    }
);


/* ============================================================
   INSCRIPTION
   ============================================================ */

async function registerUser(
    req,
    res
) {

    try {

        const {
            nom,
            email,
            telephone,
            domaine,
            password,
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
                    "Nom, email et mot de passe obligatoires"
            });
        }


        const cleanEmail =
            String(email)
                .trim()
                .toLowerCase();


        const exists =
            await query(`
                SELECT id
                FROM users
                WHERE LOWER(email) =
                      LOWER($1)
                LIMIT 1
            `, [
                cleanEmail
            ]);


        if (
            exists.rows.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Cette adresse email existe déjà"
            });
        }


        const result =
            await query(`
                INSERT INTO users
                (
                    nom,
                    email,
                    telephone,
                    domaine,
                    password,
                    photo
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6
                )
                RETURNING
                    id,
                    nom,
                    email,
                    telephone,
                    domaine,
                    photo,
                    premium,
                    is_premium,
                    premium_until,
                    blocked,
                    is_blocked,
                    certificats,
                    created_at
            `, [

                String(nom).trim(),

                cleanEmail,

                telephone || "",

                domaine || "",

                hashPassword(
                    password
                ),

                photo || ""
            ]);


        const user =
            result.rows[0];


        res.status(201).json({

            success: true,

            message:
                "Inscription réussie",

            user,

            utilisateur: user
        });


    } catch (e) {

        console.error(
            "Erreur inscription :",
            e
        );

        res.status(500).json({

            success: false,

            message:
                "Erreur lors de l'inscription",

            error:
                e.message
        });
    }
}


/*
 * Route principale utilisée par ton ancien
 * formulaire.
 */
app.post(
    "/api/register",
    registerUser
);


/*
 * Route utilisée par ton formulaire actuel
 * BMJ SERVICE.
 */
app.post(
    "/api/inscription",
    registerUser
);


/* ============================================================
   CONNEXION UTILISATEUR
   ============================================================ */

app.post(
    "/api/login",
    async (req, res) => {

        try {

            const {
                email,
                password
            } = req.body || {};


            if (
                !email ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Email et mot de passe obligatoires"
                });
            }


            const cleanEmail =
                String(email)
                    .trim()
                    .toLowerCase();


            const result =
                await query(`
                    SELECT *
                    FROM users
                    WHERE LOWER(email) =
                          LOWER($1)
                    LIMIT 1
                `, [
                    cleanEmail
                ]);


            if (
                result.rows.length === 0
            ) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Email ou mot de passe incorrect"
                });
            }


            const user =
                result.rows[0];


            if (
                hashPassword(password) !==
                user.password
            ) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Email ou mot de passe incorrect"
                });
            }


            if (
                user.blocked === true ||
                user.is_blocked === true
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Ce compte est bloqué"
                });
            }


            /*
             * Ne jamais envoyer le hash du mot de passe.
             */
            delete user.password;


            res.json({

                success: true,

                message:
                    "Connexion réussie",

                user,

                utilisateur: user
            });


        } catch (e) {

            console.error(
                "Erreur connexion utilisateur :",
                e
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur lors de la connexion",

                error:
                    e.message
            });
        }
    }
);


/* ============================================================
   CONNEXION ADMIN
   ============================================================ */

app.post(
    "/api/admin/login",
    (req, res) => {

        try {

            const body =
                req.body || {};


            const email =
                String(
                    body.email || ""
                )
                .trim()
                .toLowerCase();


            const password =
                String(
                    body.password || ""
                );


            /*
             * Vérification des champs.
             */
            if (
                !email ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    authenticated: false,

                    message:
                        "Email et mot de passe obligatoires"
                });
            }


            /*
             * Vérification de l'email.
             */
            if (
                email !==
                ADMIN_EMAIL.toLowerCase()
            ) {

                console.log(
                    "Tentative admin refusée - email :",
                    email
                );


                return res.status(401).json({

                    success: false,

                    authenticated: false,

                    message:
                        "Email administrateur incorrect"
                });
            }


            /*
             * Vérification du mot de passe.
             */
            if (
                password !==
                ADMIN_PASSWORD
            ) {

                console.log(
                    "Tentative admin refusée - mauvais mot de passe"
                );


                return res.status(401).json({

                    success: false,

                    authenticated: false,

                    message:
                        "Mot de passe administrateur incorrect"
                });
            }


            /*
             * Création du token.
             */
            const token =
                createToken();


            /*
             * Stockage uniquement du hash.
             */
            adminTokens.set(

                tokenHash(token),

                {
                    email:
                        ADMIN_EMAIL,

                    createdAt:
                        Date.now()
                }
            );


            console.log(
                "================================================"
            );

            console.log(
                "CONNEXION ADMINISTRATEUR REUSSIE"
            );

            console.log(
                "Email :",
                ADMIN_EMAIL
            );

            console.log(
                "Tokens actifs :",
                adminTokens.size
            );

            console.log(
                "================================================"
            );


            /*
             * Réponse EXACTE attendue par le frontend.
             */
            return res.status(200).json({

                success: true,

                authenticated: true,

                message:
                    "Connexion administrateur réussie",

                token,

                email:
                    ADMIN_EMAIL
            });


        } catch (e) {

            console.error(
                "ERREUR /api/admin/login :",
                e
            );


            return res.status(500).json({

                success: false,

                authenticated: false,

                message:
                    "Erreur de connexion administrateur",

                error:
                    e.message
            });
        }
    }
);


/* ============================================================
   TEST ADMIN
   IMPORTANT :
   cette route ne doit PAS être appelée avant login.
   ============================================================ */

app.get(
    "/api/admin/session",
    adminAuth,
    (req, res) => {

        return res.json({

            success: true,

            authenticated: true,

            admin: req.admin
        });
    }
);


/* ============================================================
   DECONNEXION ADMIN
   ============================================================ */

app.delete(
    "/api/admin/login",
    adminAuth,
    async (req, res) => {

        try {

            const token =
                getAdminToken(req);


            if (token) {

                adminTokens.delete(
                    tokenHash(token)
                );
            }


            await addActivity(

                req.admin.email,

                "Déconnexion administrateur"
            );


            return res.json({

                success: true,

                message:
                    "Déconnexion réussie"
            });


        } catch (e) {

            console.error(
                "Erreur déconnexion admin :",
                e
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de la déconnexion"
            });
        }
    }
);


/* ============================================================
   UTILISATEURS ADMIN
   ============================================================ */

async function getAdminUsers(
    req,
    res
) {

    try {

        const result =
            await query(`
                SELECT
                    id,
                    nom,
                    email,
                    telephone,
                    domaine,
                    photo,
                    premium,
                    is_premium,
                    premium_until,
                    blocked,
                    is_blocked,
                    certificats,
                    created_at,
                    updated_at
                FROM users
                ORDER BY id DESC
            `);


        return res.json({

            success: true,

            users:
                result.rows,

            utilisateurs:
                result.rows,

            total:
                result.rows.length
        });


    } catch (e) {

        console.error(
            "Erreur récupération utilisateurs admin :",
            e
        );


        return res.status(500).json({

            success: false,

            message:
                "Impossible de récupérer les utilisateurs",

            error:
                e.message
        });
    }
}


/*
 * Route principale.
 */
app.get(
    "/api/admin/users",
    adminAuth,
    getAdminUsers
);


/*
 * Route de compatibilité.
 */
app.get(
    "/api/admin/utilisateurs",
    adminAuth,
    getAdminUsers
);


/* ============================================================
   APPRENANTS
   ============================================================ */

app.get(
    "/api/apprenants",
    async (req, res) => {

        try {

            const result =
                await query(`
                    SELECT
                        id,
                        nom,
                        email,
                        telephone,
                        domaine,
                        photo,
                        premium,
                        is_premium,
                        premium_until,
                        blocked,
                        is_blocked,
                        certificats,
                        created_at,
                        updated_at
                    FROM users
                    ORDER BY id DESC
                `);


            return res.json({

                success: true,

                apprenants:
                    result.rows,

                utilisateurs:
                    result.rows,

                users:
                    result.rows,

                total:
                    result.rows.length
            });


        } catch (e) {

            return res.status(500).json({

                success: false,

                message:
                    "Impossible de récupérer les apprenants",

                error:
                    e.message
            });
        }
    }
);


/* ============================================================
   UTILISATEUR PAR ID
   ============================================================ */

app.get(
    "/api/utilisateurs/:id",
    async (req, res) => {

        try {

            const result =
                await query(`
                    SELECT
                        id,
                        nom,
                        email,
                        telephone,
                        domaine,
                        photo,
                        premium,
                        is_premium,
                        premium_until,
                        blocked,
                        is_blocked,
                        certificats,
                        created_at,
                        updated_at
                    FROM users
                    WHERE id = $1
                    LIMIT 1
                `, [
                    req.params.id
                ]);


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"
                });
            }


            const user =
                result.rows[0];


            return res.json({

                success: true,

                utilisateur: user,

                user: user
            });


        } catch (e) {

            return res.status(500).json({

                success: false,

                message:
                    "Erreur récupération utilisateur",

                error:
                    e.message
            });
        }
    }
);


/* ============================================================
   BLOQUER
   ============================================================ */

app.patch(
    "/api/admin/users/:id/block",
    adminAuth,
    async (req, res) => {

        try {

            const result =
                await query(`
                    UPDATE users
                    SET
                        blocked = TRUE,
                        is_blocked = TRUE,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING
                        id,
                        nom,
                        email,
                        blocked,
                        is_blocked
                `, [
                    req.params.id
                ]);


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"
                });
            }


            await addActivity(

                req.admin.email,

                "Blocage utilisateur",

                req.params.id,

                "Utilisateur bloqué"
            );


            return res.json({

                success: true,

                message:
                    "Utilisateur bloqué",

                user:
                    result.rows[0],

                utilisateur:
                    result.rows[0]
            });


        } catch (e) {

            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors du blocage",

                error:
                    e.message
            });
        }
    }
);


/* ============================================================
   DEBLOQUER
   ============================================================ */

app.patch(
    "/api/admin/users/:id/unblock",
    adminAuth,
    async (req, res) => {

        try {

            const result =
                await query(`
                    UPDATE users
                    SET
                        blocked = FALSE,
                        is_blocked = FALSE,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING
                        id,
                        nom,
                        email,
                        blocked,
                        is_blocked
                `, [
                    req.params.id
                ]);


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"
                });
            }


            await addActivity(

                req.admin.email,

                "Déblocage utilisateur",

                req.params.id,

                "Utilisateur débloqué"
            );


            return res.json({

                success: true,

                message:
                    "Utilisateur débloqué",

                user:
                    result.rows[0],

                utilisateur:
                    result.rows[0]
            });


        } catch (e) {

            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors du déblocage",

                error:
                    e.message
            });
        }
    }
);


/* ============================================================
   PREMIUM
   ============================================================ */

app.patch(
    "/api/admin/users/:id/premium",
    adminAuth,
    async (req, res) => {

        try {

            const result =
                await query(`
                    UPDATE users
                    SET
                        premium = TRUE,
                        is_premium = TRUE,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING
                        id,
                        nom,
                        email,
                        premium,
                        is_premium,
                        premium_until
                `, [
                    req.params.id
                ]);


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"
                });
            }


            await addActivity(

                req.admin.email,

                "Activation Premium",

                req.params.id,

                "Utilisateur passé Premium"
            );


            return res.json({

                success: true,

                message:
                    "Utilisateur passé en Premium",

                user:
                    result.rows[0],

                utilisateur:
                    result.rows[0]
            });


        } catch (e) {

            return res.status(500).json({

                success: false,

                message:
                    "Erreur activation Premium",

                error:
                    e.message
            });
        }
    }
);


/* ============================================================
   STANDARD
   ============================================================ */

app.patch(
    "/api/admin/users/:id/standard",
    adminAuth,
    async (req, res) => {

        try {

            const result =
                await query(`
                    UPDATE users
                    SET
                        premium = FALSE,
                        is_premium = FALSE,
                        premium_until = NULL,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING
                        id,
                        nom,
                        email,
                        premium,
                        is_premium,
                        premium_until
                `, [
                    req.params.id
                ]);


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"
                });
            }


            await addActivity(

                req.admin.email,

                "Désactivation Premium",

                req.params.id,

                "Utilisateur passé Standard"
            );


            return res.json({

                success: true,

                message:
                    "Utilisateur passé en Standard",

                user:
                    result.rows[0],

                utilisateur:
                    result.rows[0]
            });


        } catch (e) {

            return res.status(500).json({

                success: false,

                message:
                    "Erreur désactivation Premium",

                error:
                    e.message
            });
        }
    }
);

/* ============================================================
   CERTIFICAT
============================================================ */

app.patch(
    "/api/admin/users/:id/certificate",
    adminAuth,
    async (req, res) => {

        try {

            await query(`
                UPDATE users
                SET
                    certificats =
                        COALESCE(certificats, 0) + 1,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $1
            `, [
                req.params.id
            ]);

            await addActivity(
                req.admin.email,
                "Certificat accordé",
                req.params.id,
                "Certificat accordé"
            );

            res.json({
                success: true,
                message:
                    "Certificat accordé"
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

/* ============================================================
   PAIEMENTS
============================================================ */

app.get(
    "/api/paiements",
    async (req, res) => {

        try {

            const result =
                await query(`
                    SELECT *
                    FROM paiements
                    ORDER BY id DESC
                `);

            res.json({
                success: true,
                paiements: result.rows,
                total: result.rows.length
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

app.post(
    "/api/paiements",
    async (req, res) => {

        try {

            const {
                user_id,
                montant,
                methode,
                reference
            } = req.body;

            const result =
                await query(`
                    INSERT INTO paiements
                    (
                        user_id,
                        montant,
                        methode,
                        reference,
                        statut
                    )
                    VALUES
                    ($1,$2,$3,$4,'pending')
                    RETURNING *
                `, [
                    user_id,
                    montant || 0,
                    methode || "",
                    reference || ""
                ]);

            res.status(201).json({
                success: true,
                paiement:
                    result.rows[0]
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

/* ============================================================
   DEMANDES PAIEMENT
============================================================ */

app.get(
    "/api/demandes-paiement",
    async (req, res) => {

        try {

            const result =
                await query(`
                    SELECT
                        d.*,
                        u.nom
                            AS utilisateur_nom,
                        u.email
                            AS utilisateur_email
                    FROM demandes_paiement d
                    LEFT JOIN users u
                        ON u.id = d.user_id
                    ORDER BY d.id DESC
                `);

            res.json({
                success: true,
                demandes:
                    result.rows,
                demandes_paiement:
                    result.rows,
                total:
                    result.rows.length
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

app.post(
    "/api/demandes-paiement",
    async (req, res) => {

        try {

            const {
                user_id,
                telephone_paiement,
                reference_paiement,
                montant,
                methode
            } = req.body;

            const result =
                await query(`
                    INSERT INTO demandes_paiement
                    (
                        user_id,
                        telephone_paiement,
                        reference_paiement,
                        montant,
                        methode,
                        statut
                    )
                    VALUES
                    ($1,$2,$3,$4,$5,'pending')
                    RETURNING *
                `, [
                    user_id,
                    telephone_paiement || "",
                    reference_paiement || "",
                    montant || 0,
                    methode || ""
                ]);

            res.status(201).json({
                success: true,
                demande:
                    result.rows[0]
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

/* ============================================================
   VALIDER PAIEMENT
============================================================ */

app.patch(
    "/api/demandes-paiement/:id/valider",
    adminAuth,
    async (req, res) => {

        try {

            const demande =
                await query(`
                    SELECT *
                    FROM demandes_paiement
                    WHERE id = $1
                `, [
                    req.params.id
                ]);

            if (
                demande.rows.length === 0
            ) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Demande de paiement introuvable"
                });
            }

            const data =
                demande.rows[0];

            await query(`
                UPDATE demandes_paiement
                SET
                    statut = 'valide',
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $1
            `, [
                req.params.id
            ]);

            if (data.user_id) {

                await query(`
                    UPDATE users
                    SET
                        premium = TRUE,
                        is_premium = TRUE,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = $1
                `, [
                    data.user_id
                ]);
            }

            await addActivity(
                req.admin.email,
                "Paiement validé",
                data.user_id,
                "Paiement validé et Premium activé"
            );

            res.json({
                success: true,
                message:
                    "Paiement validé et Premium activé"
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

/* ============================================================
   REFUSER PAIEMENT
============================================================ */

app.patch(
    "/api/demandes-paiement/:id/refuser",
    adminAuth,
    async (req, res) => {

        try {

            const demande =
                await query(`
                    SELECT *
                    FROM demandes_paiement
                    WHERE id = $1
                `, [
                    req.params.id
                ]);

            if (
                demande.rows.length === 0
            ) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Demande de paiement introuvable"
                });
            }

            await query(`
                UPDATE demandes_paiement
                SET
                    statut = 'refuse',
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $1
            `, [
                req.params.id
            ]);

            await addActivity(
                req.admin.email,
                "Paiement refusé",
                demande.rows[0].user_id,
                "Demande de paiement refusée"
            );

            res.json({
                success: true,
                message:
                    "Demande refusée"
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

/* ============================================================
   STATISTIQUES
============================================================ */

app.get(
    "/api/admin/statistiques",
    adminAuth,
    async (req, res) => {

        try {

            const users =
                await query(`
                    SELECT COUNT(*)::INTEGER
                    AS total
                    FROM users
                `);

            const premium =
                await query(`
                    SELECT COUNT(*)::INTEGER
                    AS total
                    FROM users
                    WHERE premium = TRUE
                       OR is_premium = TRUE
                `);

            const blocked =
                await query(`
                    SELECT COUNT(*)::INTEGER
                    AS total
                    FROM users
                    WHERE blocked = TRUE
                       OR is_blocked = TRUE
                `);

            const payments =
                await query(`
                    SELECT COUNT(*)::INTEGER
                    AS total
                    FROM paiements
                    WHERE LOWER(statut) = 'valide'
                `);

            const pending =
                await query(`
                    SELECT COUNT(*)::INTEGER
                    AS total
                    FROM demandes_paiement
                    WHERE LOWER(statut) = 'pending'
                `);

            const certificates =
                await query(`
                    SELECT
                        COALESCE(
                            SUM(certificats),
                            0
                        )::INTEGER AS total
                    FROM users
                `);

            res.json({
                success: true,
                stats: {
                    users:
                        users.rows[0].total,
                    utilisateurs:
                        users.rows[0].total,
                    premium:
                        premium.rows[0].total,
                    blocked:
                        blocked.rows[0].total,
                    payments:
                        payments.rows[0].total,
                    pendingPayments:
                        pending.rows[0].total,
                    demandes:
                        pending.rows[0].total,
                    certificates:
                        certificates.rows[0].total
                }
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                message:
                    "Impossible de récupérer les statistiques",
                error: e.message
            });
        }
    }
);

/* ============================================================
   ACTIVITES ADMIN
============================================================ */

app.get(
    "/api/admin/activites",
    adminAuth,
    async (req, res) => {

        try {

            const result =
                await query(`
                    SELECT *
                    FROM admin_activity
                    ORDER BY id DESC
                    LIMIT 50
                `);

            res.json({
                success: true,
                activites:
                    result.rows,
                activities:
                    result.rows
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

/* ============================================================
   MESSAGES
============================================================ */

app.get(
    "/api/messages",
    async (req, res) => {

        try {

            const result =
                await query(`
                    SELECT *
                    FROM messages
                    ORDER BY id DESC
                `);

            res.json({
                success: true,
                messages:
                    result.rows
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

app.post(
    "/api/admin/messages/reply",
    adminAuth,
    async (req, res) => {

        try {

            const {
                userId,
                message
            } = req.body;

            if (
                !message ||
                !String(message).trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Le message est obligatoire"
                });
            }

            const result =
                await query(`
                    INSERT INTO messages
                    (
                        user_id,
                        sender_type,
                        sender_id,
                        content
                    )
                    VALUES
                    ($1,'admin',NULL,$2)
                    RETURNING *
                `, [
                    userId || null,
                    String(message).trim()
                ]);

            await addActivity(
                req.admin.email,
                "Message envoyé",
                userId || null,
                "Réponse administrateur envoyée"
            );

            res.json({
                success: true,
                message:
                    result.rows[0]
            });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });
        }
    }
);

/* ============================================================
   LISTE DES ROUTES
============================================================ */

app.get(
    "/api/routes",
    async (req, res) => {

        res.json({
            success: true,
            routes: [
                "GET /",
                "GET /api",
                "GET /api/health",
                "GET /api/test-db",
                "POST /api/register",
                "POST /api/login",
                "POST /api/admin/login",
                "GET /api/admin/session",
                "DELETE /api/admin/login",
                "GET /api/admin/users",
                "GET /api/admin/utilisateurs",
                "GET /api/apprenants",
                "GET /api/utilisateurs/:id",
                "PATCH /api/admin/users/:id/block",
                "PATCH /api/admin/users/:id/unblock",
                "PATCH /api/admin/users/:id/premium",
                "PATCH /api/admin/users/:id/standard",
                "PATCH /api/admin/users/:id/certificate",
                "GET /api/paiements",
                "POST /api/paiements",
                "GET /api/demandes-paiement",
                "POST /api/demandes-paiement",
                "PATCH /api/demandes-paiement/:id/valider",
                "PATCH /api/demandes-paiement/:id/refuser",
                "GET /api/admin/statistiques",
                "GET /api/admin/activites",
                "GET /api/messages",
                "POST /api/admin/messages/reply"
            ]
        });
    }
);

/* ============================================================
   ROUTE 404
============================================================ */

app.use((req, res) => {

    res.status(404).json({
        success: false,
        message:
            "Route introuvable",
        path: req.originalUrl
    });
});

/* ============================================================
   LANCEMENT DU SERVEUR
============================================================ */

initDatabase()
    .then(() => {

        app.listen(
            PORT,
            () => {

                console.log(
                    `Serveur BMJ SERVICE démarré sur le port ${PORT}`
                );

                console.log(
                    `Email administrateur : ${ADMIN_EMAIL}`
                );

                console.log(
                    "Authentification administrateur configurée."
                );
            }
        );

    })
    .catch((err) => {

        console.error(
            "Erreur critique au démarrage :",
            err
        );

        process.exit(1);
    });