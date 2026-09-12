/* ============================================================
   BMJ SERVICE
   SERVEUR COMPLET
   PostgreSQL + Express
============================================================ */

"use strict";


/* ============================================================
   IMPORTATIONS
============================================================ */

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { Pool } = require("pg");


/* ============================================================
   APPLICATION
============================================================ */

const app = express();


/* ============================================================
   CONFIGURATION
============================================================ */

const PORT =
    process.env.PORT || 10000;


/*
 * IMPORTANT :
 * Sur Render, DATABASE_URL doit être configurée
 * dans les variables d'environnement.
 *
 * Le fallback ci-dessous est conservé pour
 * compatibilité avec ton serveur actuel.
 */

const DATABASE_URL =
    process.env.DATABASE_URL ||
    "";


/* ============================================================
   ADMINISTRATEUR
============================================================ */

const ADMIN_EMAIL =
    process.env.ADMIN_EMAIL ||
    "admin@bmjservice.com";

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD ||
    "admin123";


/* ============================================================
   POSTGRESQL
============================================================ */

const pool = new Pool({

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


/* ============================================================
   CORS
============================================================ */

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
            "Authorization",
            "X-Admin-Token"
        ],

        credentials: false

    })
);


/* ============================================================
   BODY PARSER
============================================================ */

app.use(
    express.json({
        limit: "10mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "10mb"
    })
);


/* ============================================================
   JOURNALISATION DES REQUÊTES
============================================================ */

app.use(
    (req, res, next) => {

        console.log(
            `[${new Date().toISOString()}] ${req.method} ${req.url}`
        );

        next();

    }
);


/* ============================================================
   OUTILS
============================================================ */

function clean(value) {

    if (
        value === undefined ||
        value === null
    ) {

        return "";

    }

    return String(value).trim();
}


function hashPassword(password) {

    return crypto
        .createHash("sha256")
        .update(String(password))
        .digest("hex");

}


function createToken() {

    return crypto
        .randomBytes(48)
        .toString("hex");

}


function tokenHash(token) {

    return crypto
        .createHash("sha256")
        .update(String(token))
        .digest("hex");

}


function safeNumber(
    value,
    fallback = 0
) {

    const n =
        Number(value);

    if (
        !Number.isFinite(n)
    ) {

        return fallback;

    }

    return n;

}


function clampProgress(value) {

    let progress =
        safeNumber(
            value,
            0
        );

    if (progress < 0) {
        progress = 0;
    }

    if (progress > 100) {
        progress = 100;
    }

    return Math.round(progress);

}


function booleanValue(value) {

    if (
        value === true ||
        value === "true" ||
        value === 1 ||
        value === "1"
    ) {

        return true;

    }

    return false;

}


function isValidEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);

}


function publicUser(user) {

    if (!user) {
        return null;
    }

    const result = {
        ...user
    };

    delete result.password;

    return result;

}


/* ============================================================
   AUTHENTIFICATION ADMIN
============================================================ */

/*
 * IMPORTANT :
 * Les tokens admin sont conservés UNIQUEMENT
 * dans la mémoire du serveur.
 *
 * Aucun localStorage.
 * Aucun sessionStorage.
 * Aucun token admin en base.
 */

const adminTokens =
    new Map();


function getAdminToken(req) {

    const authorization =
        req.headers.authorization || "";


    if (
        authorization &&
        authorization.startsWith("Bearer ")
    ) {

        return authorization
            .substring(7)
            .trim();

    }


    if (
        req.headers["x-admin-token"]
    ) {

        return String(
            req.headers["x-admin-token"]
        ).trim();

    }


    if (
        req.query.token
    ) {

        return String(
            req.query.token
        ).trim();

    }


    return null;

}


function adminAuth(
    req,
    res,
    next
) {

    const token =
        getAdminToken(req);


    if (!token) {

        return res.status(401).json({

            success: false,

            message:
                "Token administrateur manquant"

        });

    }


    const saved =
        adminTokens.get(
            tokenHash(token)
        );


    if (!saved) {

        return res.status(401).json({

            success: false,

            message:
                "Token administrateur invalide ou expiré"

        });

    }


    req.admin =
        saved;

    req.adminToken =
        token;

    next();

}


/* ============================================================
   JOURNAL ADMIN
============================================================ */

async function logAdminAction(
    action,
    details = ""
) {

    try {

        await pool.query(
            `
            INSERT INTO admin_activity
            (
                action,
                admin_email,
                details
            )
            VALUES
            (
                $1,
                $2,
                $3
            )
            `,
            [
                action,
                ADMIN_EMAIL,
                details
            ]
        );

    } catch (error) {

        console.error(
            "Erreur journal admin :",
            error.message
        );

    }

}


/* ============================================================
   INITIALISATION / MIGRATION BASE
============================================================ */

async function initDatabase() {

    let client;

    try {

        client =
            await pool.connect();


        console.log(
            "Connexion PostgreSQL réussie."
        );


        /* ====================================================
           TABLE USERS
        ==================================================== */

        await client.query(`
            CREATE TABLE IF NOT EXISTS users (

                id SERIAL PRIMARY KEY,

                nom VARCHAR(255),

                email VARCHAR(255)
                    UNIQUE NOT NULL,

                password TEXT NOT NULL,

                is_premium BOOLEAN
                    DEFAULT FALSE,

                is_blocked BOOLEAN
                    DEFAULT FALSE,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP

            )
        `);


        /* ====================================================
           COLONNES UTILISATEURS
        ==================================================== */

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS telephone VARCHAR(50)
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS domaine VARCHAR(255)
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS photo TEXT
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS progression INTEGER DEFAULT 0
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS certificat_autorise BOOLEAN DEFAULT FALSE
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS certificat_obtenu BOOLEAN DEFAULT FALSE
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS premium_until TIMESTAMP NULL
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS last_login TIMESTAMP NULL
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS notes_admin TEXT DEFAULT ''
        `);

        /*
         * Champs utilisés par la page d'inscription
         */

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS sexe VARCHAR(50)
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS pays VARCHAR(100)
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS ville VARCHAR(150)
        `);

        await client.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS niveau VARCHAR(100)
        `);


        /* ====================================================
           DEMANDES PAIEMENT
        ==================================================== */

        await client.query(`
            CREATE TABLE IF NOT EXISTS demandes_paiement (

                id SERIAL PRIMARY KEY,

                user_id INTEGER
                    REFERENCES users(id)
                    ON DELETE CASCADE,

                telephone_paiement VARCHAR(50),

                montant NUMERIC(10,2)
                    NOT NULL,

                methode VARCHAR(100)
                    NOT NULL,

                statut VARCHAR(50)
                    DEFAULT 'pending',

                reference_paiement VARCHAR(255),

                preuve_paiement TEXT,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP

            )
        `);


        await client.query(`
            ALTER TABLE demandes_paiement
            ADD COLUMN IF NOT EXISTS reference_paiement VARCHAR(255)
        `);

        await client.query(`
            ALTER TABLE demandes_paiement
            ADD COLUMN IF NOT EXISTS preuve_paiement TEXT
        `);

        await client.query(`
            ALTER TABLE demandes_paiement
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        `);

        await client.query(`
            ALTER TABLE demandes_paiement
            ADD COLUMN IF NOT EXISTS admin_note TEXT DEFAULT ''
        `);


        /* ====================================================
           ADMIN ACTIVITY
        ==================================================== */

        await client.query(`
            CREATE TABLE IF NOT EXISTS admin_activity (

                id SERIAL PRIMARY KEY,

                action TEXT NOT NULL,

                admin_email VARCHAR(255),

                details TEXT DEFAULT '',

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP

            )
        `);


        await client.query(`
            ALTER TABLE admin_activity
            ADD COLUMN IF NOT EXISTS details TEXT DEFAULT ''
        `);


        /* ====================================================
           MESSAGES
        ==================================================== */

        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (

                id SERIAL PRIMARY KEY,

                sender_type VARCHAR(30)
                    DEFAULT 'admin',

                sender_id INTEGER NULL,

                recipient_type VARCHAR(30)
                    DEFAULT 'individual',

                recipient_user_id INTEGER NULL
                    REFERENCES users(id)
                    ON DELETE CASCADE,

                audience VARCHAR(30)
                    DEFAULT 'individual',

                subject VARCHAR(255),

                message TEXT NOT NULL,

                priority VARCHAR(30)
                    DEFAULT 'normal',

                is_read BOOLEAN
                    DEFAULT FALSE,

                is_archived BOOLEAN
                    DEFAULT FALSE,

                parent_id INTEGER NULL,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP

            )
        `);


        await client.query(`
            ALTER TABLE messages
            ADD COLUMN IF NOT EXISTS sender_type VARCHAR(30)
            DEFAULT 'admin'
        `);

        await client.query(`
            ALTER TABLE messages
            ADD COLUMN IF NOT EXISTS sender_id INTEGER NULL
        `);

        await client.query(`
            ALTER TABLE messages
            ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(30)
            DEFAULT 'individual'
        `);

        await client.query(`
            ALTER TABLE messages
            ADD COLUMN IF NOT EXISTS recipient_user_id INTEGER NULL
        `);

        await client.query(`
            ALTER TABLE messages
            ADD COLUMN IF NOT EXISTS audience VARCHAR(30)
            DEFAULT 'individual'
        `);

        await client.query(`
            ALTER TABLE messages
            ADD COLUMN IF NOT EXISTS subject VARCHAR(255)
        `);

        await client.query(`
            ALTER TABLE messages
            ADD COLUMN IF NOT EXISTS priority VARCHAR(30)
            DEFAULT 'normal'
        `);

        await client.query(`
            ALTER TABLE messages
            ADD COLUMN IF NOT EXISTS is_read BOOLEAN
            DEFAULT FALSE
        `);

        await client.query(`
            ALTER TABLE messages
            ADD COLUMN IF NOT EXISTS is_archived BOOLEAN
            DEFAULT FALSE
        `);

        await client.query(`
            ALTER TABLE messages
            ADD COLUMN IF NOT EXISTS parent_id INTEGER NULL
        `);

        await client.query(`
            ALTER TABLE messages
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP
            DEFAULT CURRENT_TIMESTAMP
        `);


        /* ====================================================
           NOTIFICATIONS
        ==================================================== */

        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications (

                id SERIAL PRIMARY KEY,

                user_id INTEGER
                    REFERENCES users(id)
                    ON DELETE CASCADE,

                title VARCHAR(255),

                message TEXT NOT NULL,

                type VARCHAR(50)
                    DEFAULT 'info',

                is_read BOOLEAN
                    DEFAULT FALSE,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP

            )
        `);


        /* ====================================================
           CERTIFICATS
        ==================================================== */

        await client.query(`
            CREATE TABLE IF NOT EXISTS certificates (

                id SERIAL PRIMARY KEY,

                user_id INTEGER
                    REFERENCES users(id)
                    ON DELETE CASCADE,

                domaine VARCHAR(255),

                titre VARCHAR(255),

                certificat_url TEXT,

                certificate_code VARCHAR(255),

                is_authorized BOOLEAN
                    DEFAULT FALSE,

                downloaded BOOLEAN
                    DEFAULT FALSE,

                downloaded_at TIMESTAMP NULL,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP

            )
        `);


        /* ====================================================
           PROGRESSION DES COURS
        ==================================================== */

        await client.query(`
            CREATE TABLE IF NOT EXISTS user_progress (

                id SERIAL PRIMARY KEY,

                user_id INTEGER
                    REFERENCES users(id)
                    ON DELETE CASCADE,

                domaine VARCHAR(255)
                    NOT NULL,

                progression INTEGER
                    DEFAULT 0,

                chapitre_actuel INTEGER
                    DEFAULT 0,

                chapitre_total INTEGER
                    DEFAULT 0,

                statut VARCHAR(50)
                    DEFAULT 'en_cours',

                updated_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP,

                UNIQUE(user_id, domaine)

            )
        `);


        /* ====================================================
           JOURNAL UTILISATEURS
        ==================================================== */

        await client.query(`
            CREATE TABLE IF NOT EXISTS user_activity (

                id SERIAL PRIMARY KEY,

                user_id INTEGER
                    REFERENCES users(id)
                    ON DELETE CASCADE,

                action VARCHAR(255),

                details TEXT DEFAULT '',

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP

            )
        `);


        /* ====================================================
           INDEX
        ==================================================== */

        await client.query(`
            CREATE INDEX IF NOT EXISTS
            idx_users_email
            ON users(email)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS
            idx_users_created_at
            ON users(created_at)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS
            idx_messages_recipient
            ON messages(recipient_user_id)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS
            idx_messages_created
            ON messages(created_at)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS
            idx_notifications_user
            ON notifications(user_id)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS
            idx_progress_user
            ON user_progress(user_id)
        `);


        console.log(
            "Base BMJ SERVICE vérifiée et mise à niveau."
        );

        console.log(
            "Aucune donnée existante n'a été supprimée."
        );


    } catch (error) {

        console.error(
            "ERREUR INITIALISATION BASE :",
            error
        );

    } finally {

        if (client) {

            client.release();

        }

    }

}


/* ============================================================
   ROUTES DE SANTÉ
============================================================ */

app.get(
    "/",
    (req, res) => {

        res.json({

            success: true,

            message:
                "BMJ SERVICE API opérationnelle",

            version:
                "21.0.0",

            database:
                "PostgreSQL",

            features: [

                "users",
                "registration",
                "login",
                "profiles",
                "premium",
                "blocking",
                "progression",
                "certificates",
                "messages",
                "payments",
                "notifications",
                "admin"

            ]

        });

    }
);


app.get(
    "/api/health",
    async (req, res) => {

        try {

            await pool.query(
                "SELECT 1"
            );

            res.json({

                success: true,

                status: "online",

                database:
                    "connected",

                timestamp:
                    new Date().toISOString()

            });

        } catch (error) {

            res.status(500).json({

                success: false,

                status: "online",

                database:
                    "error",

                message:
                    error.message

            });

        }

    }
);


app.get(
    "/api/test-db",
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    "SELECT NOW() AS now"
                );

            res.json({

                success: true,

                database: true,

                time:
                    result.rows[0].now

            });

        } catch (error) {

            res.status(500).json({

                success: false,

                database: false,

                message:
                    error.message

            });

        }

    }
);


/* ============================================================
   ADMIN LOGIN
============================================================ */

app.post(
    "/api/admin/login",
    async (req, res) => {

        try {

            const email =
                clean(req.body.email);

            const password =
                String(
                    req.body.password || ""
                );


            if (
                email !== ADMIN_EMAIL ||
                password !== ADMIN_PASSWORD
            ) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Email ou mot de passe administrateur incorrect"

                });

            }


            const token =
                createToken();


            adminTokens.set(
                tokenHash(token),
                {

                    email:
                        ADMIN_EMAIL,

                    loginAt:
                        new Date()

                }
            );


            await logAdminAction(
                "CONNEXION_ADMIN",
                "Connexion administrateur réussie"
            );


            res.json({

                success: true,

                token,

                admin: {

                    email:
                        ADMIN_EMAIL

                },

                message:
                    "Connexion administrateur réussie"

            });

        } catch (error) {

            console.error(
                "Erreur login admin :",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur interne du serveur"

            });

        }

    }
);


/* ============================================================
   ADMIN SESSION
============================================================ */

app.get(
    "/api/admin/session",
    adminAuth,
    (req, res) => {

        res.json({

            success: true,

            admin:
                req.admin

        });

    }
);


/* ============================================================
   ADMIN LOGOUT
============================================================ */

app.delete(
    "/api/admin/login",
    adminAuth,
    async (req, res) => {

        const token =
            getAdminToken(req);


        if (token) {

            adminTokens.delete(
                tokenHash(token)
            );

        }


        await logAdminAction(
            "DECONNEXION_ADMIN",
            "Déconnexion administrateur"
        );


        res.json({

            success: true,

            message:
                "Déconnexion réussie"

        });

    }
);


/* ============================================================
   LISTE UTILISATEURS ADMIN
============================================================ */

app.get(
    "/api/admin/users",
    adminAuth,
    async (req, res) => {

        try {

            const search =
                clean(req.query.search);


            let result;


            if (search) {

                result =
                    await pool.query(
                        `
                        SELECT
                            id,
                            nom,
                            sexe,
                            email,
                            telephone,
                            domaine,
                            pays,
                            ville,
                            niveau,
                            photo,
                            progression,
                            is_premium,
                            is_blocked,
                            certificat_autorise,
                            certificat_obtenu,
                            premium_until,
                            created_at,
                            updated_at,
                            last_login
                        FROM users
                        WHERE
                            LOWER(nom)
                                LIKE LOWER($1)
                            OR
                            LOWER(email)
                                LIKE LOWER($1)
                            OR
                            LOWER(COALESCE(telephone, ''))
                                LIKE LOWER($1)
                        ORDER BY id DESC
                        `,
                        [
                            `%${search}%`
                        ]
                    );

            } else {

                result =
                    await pool.query(
                        `
                        SELECT
                            id,
                            nom,
                            sexe,
                            email,
                            telephone,
                            domaine,
                            pays,
                            ville,
                            niveau,
                            photo,
                            progression,
                            is_premium,
                            is_blocked,
                            certificat_autorise,
                            certificat_obtenu,
                            premium_until,
                            created_at,
                            updated_at,
                            last_login
                        FROM users
                        ORDER BY id DESC
                        `
                    );

            }


            res.json({

                success: true,

                count:
                    result.rows.length,

                users:
                    result.rows

            });

        } catch (error) {

            console.error(
                "Erreur users :",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur base de données"

            });

        }

    }
);


/* ============================================================
   PROFIL COMPLET ADMIN
============================================================ */

app.get(
    "/api/admin/users/:id",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const userResult =
                await pool.query(
                    `
                    SELECT
                        id,
                        nom,
                        sexe,
                        email,
                        telephone,
                        domaine,
                        pays,
                        ville,
                        niveau,
                        photo,
                        progression,
                        is_premium,
                        is_blocked,
                        certificat_autorise,
                        certificat_obtenu,
                        premium_until,
                        notes_admin,
                        created_at,
                        updated_at,
                        last_login
                    FROM users
                    WHERE id = $1
                    `,
                    [id]
                );


            if (
                userResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"

                });

            }


            const user =
                userResult.rows[0];


            const payments =
                await pool.query(
                    `
                    SELECT *
                    FROM demandes_paiement
                    WHERE user_id = $1
                    ORDER BY id DESC
                    `,
                    [id]
                );


            const messages =
                await pool.query(
                    `
                    SELECT *
                    FROM messages
                    WHERE recipient_user_id = $1
                    ORDER BY id DESC
                    `,
                    [id]
                );


            const progress =
                await pool.query(
                    `
                    SELECT *
                    FROM user_progress
                    WHERE user_id = $1
                    ORDER BY domaine ASC
                    `,
                    [id]
                );


            const certificates =
                await pool.query(
                    `
                    SELECT *
                    FROM certificates
                    WHERE user_id = $1
                    ORDER BY id DESC
                    `,
                    [id]
                );


            const activities =
                await pool.query(
                    `
                    SELECT *
                    FROM user_activity
                    WHERE user_id = $1
                    ORDER BY id DESC
                    LIMIT 100
                    `,
                    [id]
                );


            res.json({

                success: true,

                user,

                payments:
                    payments.rows,

                messages:
                    messages.rows,

                progress:
                    progress.rows,

                certificates:
                    certificates.rows,

                activities:
                    activities.rows

            });

        } catch (error) {

            console.error(
                "Erreur profil :",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur récupération profil"

            });

        }

    }
);


/* ============================================================
   MODIFIER UTILISATEUR
============================================================ */

app.patch(
    "/api/admin/users/:id",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const {
                nom,
                sexe,
                email,
                telephone,
                domaine,
                pays,
                ville,
                niveau,
                photo,
                notes_admin
            } = req.body;


            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        nom =
                            COALESCE($1, nom),

                        sexe =
                            COALESCE($2, sexe),

                        email =
                            COALESCE($3, email),

                        telephone =
                            COALESCE($4, telephone),

                        domaine =
                            COALESCE($5, domaine),

                        pays =
                            COALESCE($6, pays),

                        ville =
                            COALESCE($7, ville),

                        niveau =
                            COALESCE($8, niveau),

                        photo =
                            COALESCE($9, photo),

                        notes_admin =
                            COALESCE($10, notes_admin),

                        updated_at =
                            CURRENT_TIMESTAMP

                    WHERE id = $11

                    RETURNING
                        id,
                        nom,
                        sexe,
                        email,
                        telephone,
                        domaine,
                        pays,
                        ville,
                        niveau,
                        photo,
                        notes_admin,
                        progression,
                        is_premium,
                        is_blocked,
                        certificat_autorise,
                        certificat_obtenu,
                        premium_until
                    `,
                    [
                        nom !== undefined
                            ? clean(nom)
                            : null,

                        sexe !== undefined
                            ? clean(sexe)
                            : null,

                        email !== undefined
                            ? clean(email)
                            : null,

                        telephone !== undefined
                            ? clean(telephone)
                            : null,

                        domaine !== undefined
                            ? clean(domaine)
                            : null,

                        pays !== undefined
                            ? clean(pays)
                            : null,

                        ville !== undefined
                            ? clean(ville)
                            : null,

                        niveau !== undefined
                            ? clean(niveau)
                            : null,

                        photo !== undefined
                            ? clean(photo)
                            : null,

                        notes_admin !== undefined
                            ? String(notes_admin)
                            : null,

                        id
                    ]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"

                });

            }


            await pool.query(
                `
                INSERT INTO user_activity
                (
                    user_id,
                    action,
                    details
                )
                VALUES
                ($1, $2, $3)
                `,
                [
                    id,
                    "MODIFICATION_PROFIL",
                    "Profil modifié par l'administration"
                ]
            );


            await logAdminAction(
                "MODIFICATION_UTILISATEUR",
                `Utilisateur ID ${id}`
            );


            res.json({

                success: true,

                user:
                    result.rows[0],

                message:
                    "Utilisateur modifié avec succès"

            });

        } catch (error) {

            console.error(
                "Erreur modification :",
                error
            );


            if (
                error.code === "23505"
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Cette adresse email est déjà utilisée"

                });

            }


            res.status(500).json({

                success: false,

                message:
                    "Impossible de modifier l'utilisateur"

            });

        }

    }
);


/* ============================================================
   MODIFIER MOT DE PASSE UTILISATEUR
============================================================ */

app.patch(
    "/api/admin/users/:id/password",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );

            const password =
                String(
                    req.body.password || ""
                );


            if (
                password.length < 6
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le mot de passe doit contenir au moins 6 caractères"

                });

            }


            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        password = $1,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = $2
                    RETURNING id
                    `,
                    [
                        hashPassword(password),
                        id
                    ]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"

                });

            }


            await logAdminAction(
                "MODIFICATION_MOT_DE_PASSE",
                `Utilisateur ID ${id}`
            );


            res.json({

                success: true,

                message:
                    "Mot de passe modifié avec succès"

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur modification mot de passe"

            });

        }

    }
);


/* ============================================================
   BLOQUER UTILISATEUR
============================================================ */

app.patch(
    "/api/admin/users/:id/block",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        is_blocked = TRUE,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING
                        id,
                        nom,
                        email,
                        is_blocked
                    `,
                    [id]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"

                });

            }


            await pool.query(
                `
                INSERT INTO user_activity
                (
                    user_id,
                    action,
                    details
                )
                VALUES
                ($1, $2, $3)
                `,
                [
                    id,
                    "COMPTE_BLOQUE",
                    "Compte bloqué par l'administration"
                ]
            );


            await logAdminAction(
                "BLOCAGE_UTILISATEUR",
                `Utilisateur ID ${id}`
            );


            res.json({

                success: true,

                user:
                    result.rows[0],

                message:
                    "Utilisateur bloqué avec succès"

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur blocage utilisateur"

            });

        }

    }
);

/* ============================================================
   STATISTIQUES ADMINISTRATEUR
============================================================ */

app.get(
    "/api/admin/statistiques",
    adminAuth,
    async (req, res) => {

        try {

            /* ====================================================
               UTILISATEURS
            ==================================================== */

            const usersResult =
                await pool.query(`
                    SELECT
                        COUNT(*)::INTEGER AS total,
                        COUNT(*) FILTER (
                            WHERE is_premium = TRUE
                        )::INTEGER AS premium,
                        COUNT(*) FILTER (
                            WHERE COALESCE(is_premium, FALSE) = FALSE
                        )::INTEGER AS standard,
                        COUNT(*) FILTER (
                            WHERE is_blocked = TRUE
                        )::INTEGER AS blocked,
                        COUNT(*) FILTER (
                            WHERE created_at >= CURRENT_DATE
                        )::INTEGER AS today
                    FROM users
                `);


            const usersStats =
                usersResult.rows[0] || {};


            /* ====================================================
               PAIEMENTS
            ==================================================== */

            const paymentsResult =
                await pool.query(`
                    SELECT

                        COUNT(*)::INTEGER AS total,

                        COUNT(*) FILTER (
                            WHERE LOWER(
                                COALESCE(statut, '')
                            ) IN (
                                'pending',
                                'en_attente',
                                'en attente',
                                'pending_payment'
                            )
                        )::INTEGER AS pending,

                        COUNT(*) FILTER (
                            WHERE LOWER(
                                COALESCE(statut, '')
                            ) IN (
                                'validated',
                                'valide',
                                'validé',
                                'approved',
                                'accepte',
                                'accepté',
                                'success'
                            )
                        )::INTEGER AS validated,

                        COUNT(*) FILTER (
                            WHERE LOWER(
                                COALESCE(statut, '')
                            ) IN (
                                'refused',
                                'refuse',
                                'refusé',
                                'rejected',
                                'annule',
                                'annulé'
                            )
                        )::INTEGER AS refused,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN LOWER(
                                        COALESCE(statut, '')
                                    ) IN (
                                        'validated',
                                        'valide',
                                        'validé',
                                        'approved',
                                        'accepte',
                                        'accepté',
                                        'success'
                                    )
                                    THEN COALESCE(montant, 0)
                                    ELSE 0
                                END
                            ),
                            0
                        )::NUMERIC(12,2) AS revenue

                    FROM demandes_paiement
                `);


            const paymentStats =
                paymentsResult.rows[0] || {};


            /* ====================================================
               MESSAGES
            ==================================================== */

            const messagesResult =
                await pool.query(`
                    SELECT
                        COUNT(*)::INTEGER AS total
                    FROM messages
                `);


            const messageStats =
                messagesResult.rows[0] || {};


            /* ====================================================
               CERTIFICATS
            ==================================================== */

            const certificatesResult =
                await pool.query(`
                    SELECT

                        COUNT(*)::INTEGER AS total,

                        COUNT(*) FILTER (
                            WHERE is_authorized = TRUE
                        )::INTEGER AS authorized

                    FROM certificates
                `);


            const certificateStats =
                certificatesResult.rows[0] || {};


            /* ====================================================
               CERTIFICATS AUTORISÉS DANS USERS
               Compatibilité avec l'ancien système
            ==================================================== */

            const usersCertificatesResult =
                await pool.query(`
                    SELECT
                        COUNT(*) FILTER (
                            WHERE certificat_autorise = TRUE
                        )::INTEGER AS authorized
                    FROM users
                `);


            const usersCertificateStats =
                usersCertificatesResult.rows[0] || {};


            /* ====================================================
               CALCUL CERTIFICATS AUTORISÉS
            ==================================================== */

            const certificatesAuthorized =
                Math.max(
                    Number(
                        certificateStats.authorized || 0
                    ),
                    Number(
                        usersCertificateStats.authorized || 0
                    )
                );


            /* ====================================================
               RÉSULTAT FINAL
            ==================================================== */

            const stats = {

                /* Utilisateurs */

                users:
                    Number(
                        usersStats.total || 0
                    ),

                premium:
                    Number(
                        usersStats.premium || 0
                    ),

                standard:
                    Number(
                        usersStats.standard || 0
                    ),

                blocked:
                    Number(
                        usersStats.blocked || 0
                    ),

                today:
                    Number(
                        usersStats.today || 0
                    ),


                /* Paiements */

                payments:
                    Number(
                        paymentStats.total || 0
                    ),

                pending:
                    Number(
                        paymentStats.pending || 0
                    ),

                validated:
                    Number(
                        paymentStats.validated || 0
                    ),

                refused:
                    Number(
                        paymentStats.refused || 0
                    ),

                revenue:
                    Number(
                        paymentStats.revenue || 0
                    ),


                /* Messages */

                messages:
                    Number(
                        messageStats.total || 0
                    ),


                /* Certificats */

                certificates:
                    Number(
                        certificateStats.total || 0
                    ),

                certificates_authorized:
                    certificatesAuthorized

            };


            /* ====================================================
               JOURNAL ADMIN
            ==================================================== */

            await logAdminAction(
                "CONSULTATION_STATISTIQUES",
                "Consultation des statistiques du tableau de bord"
            );


            /* ====================================================
               RÉPONSE
            ==================================================== */

            res.json({

                success: true,

                stats

            });


        } catch (error) {

            console.error(
                "Erreur statistiques admin :",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Impossible de récupérer les statistiques",

                error:
                    process.env.NODE_ENV === "production"
                        ? undefined
                        : error.message

            });

        }

    }
);

/* ============================================================
   DÉBLOQUER UTILISATEUR
============================================================ */

app.patch(
    "/api/admin/users/:id/unblock",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        is_blocked = FALSE,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING
                        id,
                        nom,
                        email,
                        is_blocked
                    `,
                    [id]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"

                });

            }


            await pool.query(
                `
                INSERT INTO user_activity
                (
                    user_id,
                    action,
                    details
                )
                VALUES
                ($1, $2, $3)
                `,
                [
                    id,
                    "COMPTE_DEBLOQUE",
                    "Compte débloqué par l'administration"
                ]
            );


            await logAdminAction(
                "DEBLOCAGE_UTILISATEUR",
                `Utilisateur ID ${id}`
            );


            res.json({

                success: true,

                user:
                    result.rows[0],

                message:
                    "Utilisateur débloqué avec succès"

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur déblocage utilisateur"

            });

        }

    }
);


/* ============================================================
   ACTIVER PREMIUM
============================================================ */

app.patch(
    "/api/admin/users/:id/premium",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );

            const premiumUntil =
                req.body.premium_until ||
                null;


            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        is_premium = TRUE,
                        premium_until = $1,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = $2
                    RETURNING
                        id,
                        nom,
                        email,
                        is_premium,
                        premium_until
                    `,
                    [
                        premiumUntil,
                        id
                    ]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"

                });

            }


            await pool.query(
                `
                INSERT INTO user_activity
                (
                    user_id,
                    action,
                    details
                )
                VALUES
                ($1, $2, $3)
                `,
                [
                    id,
                    "PREMIUM_ACTIVE",
                    "Premium activé par l'administration"
                ]
            );


            await pool.query(
                `
                INSERT INTO notifications
                (
                    user_id,
                    title,
                    message,
                    type
                )
                VALUES
                (
                    $1,
                    'Premium activé',
                    'Votre compte BMJ SERVICE est maintenant Premium.',
                    'premium'
                )
                `,
                [id]
            );


            await logAdminAction(
                "ACTIVATION_PREMIUM",
                `Utilisateur ID ${id}`
            );


            res.json({

                success: true,

                user:
                    result.rows[0],

                message:
                    "Premium activé avec succès"

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur activation Premium"

            });

        }

    }
);


/* ============================================================
   DÉSACTIVER PREMIUM
============================================================ */

app.patch(
    "/api/admin/users/:id/premium/remove",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        is_premium = FALSE,
                        premium_until = NULL,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING
                        id,
                        nom,
                        email,
                        is_premium,
                        premium_until
                    `,
                    [id]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"

                });

            }


            await pool.query(
                `
                INSERT INTO user_activity
                (
                    user_id,
                    action,
                    details
                )
                VALUES
                ($1, $2, $3)
                `,
                [
                    id,
                    "PREMIUM_DESACTIVE",
                    "Premium désactivé par l'administration"
                ]
            );


            await pool.query(
                `
                INSERT INTO notifications
                (
                    user_id,
                    title,
                    message,
                    type
                )
                VALUES
                (
                    $1,
                    'Premium désactivé',
                    'Votre accès Premium a été désactivé par l’administration.',
                    'premium'
                )
                `,
                [id]
            );


            await logAdminAction(
                "DESACTIVATION_PREMIUM",
                `Utilisateur ID ${id}`
            );


            res.json({

                success: true,

                user:
                    result.rows[0],

                message:
                    "Premium désactivé avec succès"

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur désactivation Premium"

            });

        }

    }
);


/* ============================================================
   PROGRESSION GLOBALE
============================================================ */

app.patch(
    "/api/admin/users/:id/progression",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const progression =
                clampProgress(
                    req.body.progression
                );


            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        progression = $1,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = $2
                    RETURNING
                        id,
                        nom,
                        progression
                    `,
                    [
                        progression,
                        id
                    ]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"

                });

            }


            await pool.query(
                `
                INSERT INTO user_activity
                (
                    user_id,
                    action,
                    details
                )
                VALUES
                ($1, $2, $3)
                `,
                [
                    id,
                    "PROGRESSION_MODIFIEE",
                    `Progression : ${progression}%`
                ]
            );


            await logAdminAction(
                "MODIFICATION_PROGRESSION",
                `Utilisateur ${id} : ${progression}%`
            );


            res.json({

                success: true,

                user:
                    result.rows[0],

                message:
                    "Progression mise à jour"

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur progression"

            });

        }

    }
);


/* ============================================================
   PROGRESSION PAR DOMAINE
============================================================ */

app.patch(
    "/api/admin/users/:id/progression/domaine",
    adminAuth,
    async (req, res) => {

        try {

            const userId =
                Number(
                    req.params.id
                );

            const domaine =
                clean(
                    req.body.domaine
                );

            const progression =
                clampProgress(
                    req.body.progression
                );

            const chapitreActuel =
                Math.max(
                    0,
                    safeNumber(
                        req.body.chapitre_actuel,
                        0
                    )
                );

            const chapitreTotal =
                Math.max(
                    0,
                    safeNumber(
                        req.body.chapitre_total,
                        0
                    )
                );


            if (!domaine) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le domaine est requis"

                });

            }


            const result =
                await pool.query(
                    `
                    INSERT INTO user_progress
                    (
                        user_id,
                        domaine,
                        progression,
                        chapitre_actuel,
                        chapitre_total,
                        statut,
                        updated_at
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        CURRENT_TIMESTAMP
                    )

                    ON CONFLICT
                    (
                        user_id,
                        domaine
                    )

                    DO UPDATE SET

                        progression =
                            EXCLUDED.progression,

                        chapitre_actuel =
                            EXCLUDED.chapitre_actuel,

                        chapitre_total =
                            EXCLUDED.chapitre_total,

                        statut =
                            EXCLUDED.statut,

                        updated_at =
                            CURRENT_TIMESTAMP

                    RETURNING *
                    `,
                    [
                        userId,
                        domaine,
                        progression,
                        chapitreActuel,
                        chapitreTotal,
                        progression >= 100
                            ? "termine"
                            : "en_cours"
                    ]
                );


            await logAdminAction(
                "PROGRESSION_DOMAINE",
                `Utilisateur ${userId} - ${domaine}`
            );


            res.json({

                success: true,

                progress:
                    result.rows[0]

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur progression domaine"

            });

        }

    }
);


/* ============================================================
   AUTORISATION CERTIFICAT
============================================================ */

app.patch(
    "/api/admin/users/:id/certificat",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );

            const autorise =
                booleanValue(
                    req.body.autorise
                );


            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        certificat_autorise = $1,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = $2
                    RETURNING
                        id,
                        nom,
                        email,
                        certificat_autorise,
                        certificat_obtenu
                    `,
                    [
                        autorise,
                        id
                    ]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"

                });

            }


            await logAdminAction(
                autorise
                    ? "CERTIFICAT_AUTORISE"
                    : "CERTIFICAT_RETIRE",
                `Utilisateur ID ${id}`
            );


            res.json({

                success: true,

                user:
                    result.rows[0],

                message:
                    autorise
                        ? "Téléchargement du certificat autorisé"
                        : "Autorisation de certificat retirée"

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur autorisation certificat"

            });

        }

    }
);


/* ============================================================
   MARQUER CERTIFICAT OBTENU
============================================================ */

app.patch(
    "/api/admin/users/:id/certificat-obtenu",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        certificat_obtenu = TRUE,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING
                        id,
                        certificat_autorise,
                        certificat_obtenu
                    `,
                    [id]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"

                });

            }


            await logAdminAction(
                "CERTIFICAT_OBTENU",
                `Utilisateur ID ${id}`
            );


            res.json({

                success: true,

                user:
                    result.rows[0]

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur certificat"

            });

        }

    }
);


/* ============================================================
   CRÉER CERTIFICAT
============================================================ */

app.post(
    "/api/admin/certificates",
    adminAuth,
    async (req, res) => {

        try {

            const {
                user_id,
                domaine,
                titre,
                certificat_url
            } = req.body;


            const userId =
                Number(user_id);


            if (
                !userId ||
                !domaine
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "user_id et domaine sont requis"

                });

            }


            const code =
                "BMJ-CERT-" +
                crypto
                    .randomBytes(6)
                    .toString("hex")
                    .toUpperCase();


            const result =
                await pool.query(
                    `
                    INSERT INTO certificates
                    (
                        user_id,
                        domaine,
                        titre,
                        certificat_url,
                        certificate_code,
                        is_authorized
                    )
                    VALUES
                    ($1, $2, $3, $4, $5, TRUE)
                    RETURNING *
                    `,
                    [
                        userId,
                        domaine,
                        titre ||
                            "Certificat BMJ SERVICE",
                        certificat_url ||
                            "",
                        code
                    ]
                );


            await pool.query(
                `
                UPDATE users
                SET
                    certificat_autorise = TRUE,
                    certificat_obtenu = TRUE,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $1
                `,
                [userId]
            );


            await logAdminAction(
                "CERTIFICAT_CREE",
                `Utilisateur ${userId} - ${domaine}`
            );


            res.json({

                success: true,

                certificate:
                    result.rows[0],

                message:
                    "Certificat créé avec succès"

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur création certificat"

            });

        }

    }
);


/* ============================================================
   LISTE CERTIFICATS ADMIN
============================================================ */

app.get(
    "/api/admin/users/:id/certificates",
    adminAuth,
    async (req, res) => {

        try {

            const userId =
                Number(
                    req.params.id
                );


            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM certificates
                    WHERE user_id = $1
                    ORDER BY id DESC
                    `,
                    [userId]
                );


            res.json({

                success: true,

                certificates:
                    result.rows

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur certificats"

            });

        }

    }
);

/* ============================================================
   SYSTÈME COMPLET DE MESSAGES ADMIN
   BMJ SERVICE
============================================================ */


/* ============================================================
   OUTILS MESSAGES
============================================================ */

function normalizeMessagePriority(priority) {

    const allowedPriorities = [
        "normal",
        "important",
        "urgent"
    ];

    const value =
        String(priority || "")
            .trim()
            .toLowerCase();

    if (allowedPriorities.includes(value)) {
        return value;
    }

    return "normal";
}


/* ============================================================
   NETTOYER LE SUJET
============================================================ */

function normalizeMessageSubject(subject) {

    const value =
        String(subject || "")
            .trim();

    if (!value) {
        return "Message BMJ SERVICE";
    }

    return value.substring(0, 200);
}


/* ============================================================
   NETTOYER LE CONTENU
============================================================ */

function normalizeMessageContent(message) {

    return String(message || "")
        .trim();

}


/* ============================================================
   ENVOYER MESSAGE À UN UTILISATEUR
============================================================ */

app.post(
    "/api/admin/messages/user",
    adminAuth,
    async (req, res) => {

        const client =
            await pool.connect();

        try {

            const {
                user_id,
                subject,
                message,
                priority
            } = req.body || {};


            const userId =
                Number(user_id);


            const cleanSubject =
                normalizeMessageSubject(
                    subject
                );


            const cleanMessage =
                normalizeMessageContent(
                    message
                );


            const cleanPriority =
                normalizeMessagePriority(
                    priority
                );


            /* ----------------------------------------------------
               VALIDATION
            ---------------------------------------------------- */

            if (
                !Number.isInteger(userId) ||
                userId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Utilisateur invalide"

                });

            }


            if (!cleanMessage) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le message est requis"

                });

            }


            /* ----------------------------------------------------
               VÉRIFIER L'UTILISATEUR
            ---------------------------------------------------- */

            const userResult =
                await client.query(
                    `
                    SELECT
                        id,
                        nom,
                        email,
                        is_premium,
                        is_blocked
                    FROM users
                    WHERE id = $1
                    LIMIT 1
                    `,
                    [userId]
                );


            if (
                userResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"

                });

            }


            const user =
                userResult.rows[0];


            /* ----------------------------------------------------
               UTILISATEUR BLOQUÉ
            ---------------------------------------------------- */

            if (
                user.is_blocked === true
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Impossible d'envoyer un message à un utilisateur bloqué"

                });

            }


            /* ----------------------------------------------------
               TRANSACTION
            ---------------------------------------------------- */

            await client.query(
                "BEGIN"
            );


            /* ----------------------------------------------------
               ENREGISTRER MESSAGE
            ---------------------------------------------------- */

            const messageResult =
                await client.query(
                    `
                    INSERT INTO messages
                    (
                        sender_type,
                        sender_id,
                        recipient_type,
                        recipient_user_id,
                        audience,
                        subject,
                        message,
                        priority
                    )
                    VALUES
                    (
                        'admin',
                        NULL,
                        'user',
                        $1,
                        'individual',
                        $2,
                        $3,
                        $4
                    )
                    RETURNING *
                    `,
                    [
                        userId,
                        cleanSubject,
                        cleanMessage,
                        cleanPriority
                    ]
                );


            /* ----------------------------------------------------
               CRÉER NOTIFICATION
            ---------------------------------------------------- */

            await client.query(
                `
                INSERT INTO notifications
                (
                    user_id,
                    title,
                    message,
                    type
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
                    userId,
                    cleanSubject,
                    cleanMessage,
                    cleanPriority
                ]
            );


            /* ----------------------------------------------------
               VALIDER
            ---------------------------------------------------- */

            await client.query(
                "COMMIT"
            );


            /* ----------------------------------------------------
               JOURNAL ADMIN
            ---------------------------------------------------- */

            try {

                await logAdminAction(
                    "MESSAGE_UTILISATEUR",
                    `Message envoyé à l'utilisateur ${userId}`
                );

            } catch (logError) {

                console.error(
                    "Erreur journal admin :",
                    logError
                );

            }


            /* ----------------------------------------------------
               RÉPONSE
            ---------------------------------------------------- */

            return res.status(201).json({

                success: true,

                messageData:
                    messageResult.rows[0],

                message:
                    "Message envoyé avec succès"

            });


        } catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (rollbackError) {

                console.error(
                    "Erreur rollback :",
                    rollbackError
                );

            }


            console.error(
                "Erreur message utilisateur :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de l'envoi du message"

            });


        } finally {

            client.release();

        }

    }
);


/* ============================================================
   ENVOYER MESSAGE À TOUS
============================================================ */

app.post(
    "/api/admin/messages/all",
    adminAuth,
    async (req, res) => {

        const client =
            await pool.connect();

        try {

            const {
                subject,
                message,
                priority
            } = req.body || {};


            const cleanSubject =
                normalizeMessageSubject(
                    subject
                );


            const cleanMessage =
                normalizeMessageContent(
                    message
                );


            const cleanPriority =
                normalizeMessagePriority(
                    priority
                );


            /* ----------------------------------------------------
               VALIDATION
            ---------------------------------------------------- */

            if (!cleanMessage) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le message est requis"

                });

            }


            /* ----------------------------------------------------
               RÉCUPÉRER UTILISATEURS
            ---------------------------------------------------- */

            const users =
                await client.query(
                    `
                    SELECT
                        id
                    FROM users
                    WHERE
                        COALESCE(is_blocked, FALSE) = FALSE
                    ORDER BY id ASC
                    `
                );


            if (
                users.rows.length === 0
            ) {

                return res.json({

                    success: true,

                    count: 0,

                    message:
                        "Aucun utilisateur disponible"

                });

            }


            /* ----------------------------------------------------
               TRANSACTION
            ---------------------------------------------------- */

            await client.query(
                "BEGIN"
            );


            let count = 0;


            /* ----------------------------------------------------
               ENVOYER À CHAQUE UTILISATEUR
            ---------------------------------------------------- */

            for (
                const user
                of users.rows
            ) {

                await client.query(
                    `
                    INSERT INTO messages
                    (
                        sender_type,
                        sender_id,
                        recipient_type,
                        recipient_user_id,
                        audience,
                        subject,
                        message,
                        priority
                    )
                    VALUES
                    (
                        'admin',
                        NULL,
                        'user',
                        $1,
                        'all',
                        $2,
                        $3,
                        $4
                    )
                    `,
                    [
                        user.id,
                        cleanSubject,
                        cleanMessage,
                        cleanPriority
                    ]
                );


                /* ------------------------------------------------
                   NOTIFICATION
                ------------------------------------------------ */

                await client.query(
                    `
                    INSERT INTO notifications
                    (
                        user_id,
                        title,
                        message,
                        type
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
                        user.id,
                        cleanSubject,
                        cleanMessage,
                        cleanPriority
                    ]
                );


                count++;

            }


            /* ----------------------------------------------------
               COMMIT
            ---------------------------------------------------- */

            await client.query(
                "COMMIT"
            );


            /* ----------------------------------------------------
               JOURNAL
            ---------------------------------------------------- */

            try {

                await logAdminAction(
                    "MESSAGE_GLOBAL",
                    `Message envoyé à ${count} utilisateurs`
                );

            } catch (logError) {

                console.error(
                    "Erreur journal admin :",
                    logError
                );

            }


            return res.status(201).json({

                success: true,

                count,

                message:
                    `Message envoyé à ${count} utilisateurs`

            });


        } catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (rollbackError) {

                console.error(
                    "Erreur rollback :",
                    rollbackError
                );

            }


            console.error(
                "Erreur message global :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de l'envoi global"

            });


        } finally {

            client.release();

        }

    }
);


/* ============================================================
   MESSAGE PREMIUM
============================================================ */

app.post(
    "/api/admin/messages/premium",
    adminAuth,
    async (req, res) => {

        const client =
            await pool.connect();

        try {

            const {
                subject,
                message,
                priority
            } = req.body || {};


            const cleanSubject =
                normalizeMessageSubject(
                    subject ||
                    "Message Premium"
                );


            const cleanMessage =
                normalizeMessageContent(
                    message
                );


            const cleanPriority =
                normalizeMessagePriority(
                    priority
                );


            /* ----------------------------------------------------
               VALIDATION
            ---------------------------------------------------- */

            if (!cleanMessage) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le message est requis"

                });

            }


            /* ----------------------------------------------------
               UTILISATEURS PREMIUM
            ---------------------------------------------------- */

            const users =
                await client.query(
                    `
                    SELECT
                        id
                    FROM users
                    WHERE
                        COALESCE(is_premium, FALSE) = TRUE
                        AND COALESCE(is_blocked, FALSE) = FALSE
                    ORDER BY id ASC
                    `
                );


            if (
                users.rows.length === 0
            ) {

                return res.json({

                    success: true,

                    count: 0,

                    message:
                        "Aucun utilisateur Premium disponible"

                });

            }


            await client.query(
                "BEGIN"
            );


            let count = 0;


            /* ----------------------------------------------------
               ENVOYER
            ---------------------------------------------------- */

            for (
                const user
                of users.rows
            ) {

                await client.query(
                    `
                    INSERT INTO messages
                    (
                        sender_type,
                        sender_id,
                        recipient_type,
                        recipient_user_id,
                        audience,
                        subject,
                        message,
                        priority
                    )
                    VALUES
                    (
                        'admin',
                        NULL,
                        'user',
                        $1,
                        'premium',
                        $2,
                        $3,
                        $4
                    )
                    `,
                    [
                        user.id,
                        cleanSubject,
                        cleanMessage,
                        cleanPriority
                    ]
                );


                /* ------------------------------------------------
                   NOTIFICATION PREMIUM
                ------------------------------------------------ */

                await client.query(
                    `
                    INSERT INTO notifications
                    (
                        user_id,
                        title,
                        message,
                        type
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
                        user.id,
                        cleanSubject,
                        cleanMessage,
                        cleanPriority
                    ]
                );


                count++;

            }


            await client.query(
                "COMMIT"
            );


            /* ----------------------------------------------------
               JOURNAL
            ---------------------------------------------------- */

            try {

                await logAdminAction(
                    "MESSAGE_PREMIUM",
                    `${count} utilisateurs Premium`
                );

            } catch (logError) {

                console.error(
                    "Erreur journal admin :",
                    logError
                );

            }


            return res.status(201).json({

                success: true,

                count,

                message:
                    `Message envoyé à ${count} Premium`

            });


        } catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (rollbackError) {

                console.error(
                    "Erreur rollback :",
                    rollbackError
                );

            }


            console.error(
                "Erreur message Premium :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de l'envoi du message Premium"

            });


        } finally {

            client.release();

        }

    }
);


/* ============================================================
   MESSAGE STANDARD
============================================================ */

app.post(
    "/api/admin/messages/standard",
    adminAuth,
    async (req, res) => {

        const client =
            await pool.connect();

        try {

            const {
                subject,
                message,
                priority
            } = req.body || {};


            const cleanSubject =
                normalizeMessageSubject(
                    subject
                );


            const cleanMessage =
                normalizeMessageContent(
                    message
                );


            const cleanPriority =
                normalizeMessagePriority(
                    priority
                );


            /* ----------------------------------------------------
               VALIDATION
            ---------------------------------------------------- */

            if (!cleanMessage) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le message est requis"

                });

            }


            /* ----------------------------------------------------
               UTILISATEURS STANDARD
            ---------------------------------------------------- */

            const users =
                await client.query(
                    `
                    SELECT
                        id
                    FROM users
                    WHERE
                        COALESCE(is_premium, FALSE) = FALSE
                        AND COALESCE(is_blocked, FALSE) = FALSE
                    ORDER BY id ASC
                    `
                );


            if (
                users.rows.length === 0
            ) {

                return res.json({

                    success: true,

                    count: 0,

                    message:
                        "Aucun utilisateur Standard disponible"

                });

            }


            await client.query(
                "BEGIN"
            );


            let count = 0;


            /* ----------------------------------------------------
               ENVOYER
            ---------------------------------------------------- */

            for (
                const user
                of users.rows
            ) {

                await client.query(
                    `
                    INSERT INTO messages
                    (
                        sender_type,
                        sender_id,
                        recipient_type,
                        recipient_user_id,
                        audience,
                        subject,
                        message,
                        priority
                    )
                    VALUES
                    (
                        'admin',
                        NULL,
                        'user',
                        $1,
                        'standard',
                        $2,
                        $3,
                        $4
                    )
                    `,
                    [
                        user.id,
                        cleanSubject,
                        cleanMessage,
                        cleanPriority
                    ]
                );


                /* ------------------------------------------------
                   NOTIFICATION
                ------------------------------------------------ */

                await client.query(
                    `
                    INSERT INTO notifications
                    (
                        user_id,
                        title,
                        message,
                        type
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
                        user.id,
                        cleanSubject,
                        cleanMessage,
                        cleanPriority
                    ]
                );


                count++;

            }


            await client.query(
                "COMMIT"
            );


            /* ----------------------------------------------------
               JOURNAL
            ---------------------------------------------------- */

            try {

                await logAdminAction(
                    "MESSAGE_STANDARD",
                    `${count} utilisateurs Standard`
                );

            } catch (logError) {

                console.error(
                    "Erreur journal admin :",
                    logError
                );

            }


            return res.status(201).json({

                success: true,

                count,

                message:
                    `Message envoyé à ${count} Standard`

            });


        } catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (rollbackError) {

                console.error(
                    "Erreur rollback :",
                    rollbackError
                );

            }


            console.error(
                "Erreur message Standard :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de l'envoi du message Standard"

            });


        } finally {

            client.release();

        }

    }
);


/* ============================================================
   RÉCUPÉRER LES MESSAGES D'UN UTILISATEUR
   ADMIN
============================================================ */

app.get(
    "/api/admin/users/:id/messages",
    adminAuth,
    async (req, res) => {

        try {

            const userId =
                Number(
                    req.params.id
                );


            /* ----------------------------------------------------
               VALIDATION
            ---------------------------------------------------- */

            if (
                !Number.isInteger(userId) ||
                userId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant utilisateur invalide"

                });

            }


            /* ----------------------------------------------------
               VÉRIFIER UTILISATEUR
            ---------------------------------------------------- */

            const userResult =
                await pool.query(
                    `
                    SELECT
                        id,
                        nom,
                        email,
                        is_premium,
                        is_blocked
                    FROM users
                    WHERE id = $1
                    LIMIT 1
                    `,
                    [userId]
                );


            if (
                userResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"

                });

            }


            /* ----------------------------------------------------
               RÉCUPÉRER LA CONVERSATION
            ---------------------------------------------------- */

            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM messages
                    WHERE
                        recipient_user_id = $1
                        OR (
                            sender_type = 'user'
                            AND sender_id = $1
                        )
                    ORDER BY
                        id ASC
                    `,
                    [userId]
                );


            /* ----------------------------------------------------
               RÉPONSE
            ---------------------------------------------------- */

            return res.json({

                success: true,

                user_id:
                    userId,

                user:
                    userResult.rows[0],

                count:
                    result.rows.length,

                messages:
                    result.rows

            });


        } catch (error) {

            console.error(
                "Erreur récupération messages :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de la récupération des messages"

            });

        }

    }
);


/* ============================================================
   RÉPONDRE À UN MESSAGE
============================================================ */

app.post(
    "/api/admin/messages/:id/reply",
    adminAuth,
    async (req, res) => {

        const client =
            await pool.connect();

        try {

            const messageId =
                Number(
                    req.params.id
                );


            const cleanMessage =
                normalizeMessageContent(
                    req.body?.message
                );


            /* ----------------------------------------------------
               VALIDATION ID
            ---------------------------------------------------- */

            if (
                !Number.isInteger(messageId) ||
                messageId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant du message invalide"

                });

            }


            /* ----------------------------------------------------
               VALIDATION MESSAGE
            ---------------------------------------------------- */

            if (!cleanMessage) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Réponse vide"

                });

            }


            /* ----------------------------------------------------
               RÉCUPÉRER MESSAGE ORIGINAL
            ---------------------------------------------------- */

            const originalResult =
                await client.query(
                    `
                    SELECT *
                    FROM messages
                    WHERE id = $1
                    LIMIT 1
                    `,
                    [messageId]
                );


            if (
                originalResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Message introuvable"

                });

            }


            const originalMessage =
                originalResult.rows[0];


                        /* ----------------------------------------------------
               TROUVER L'UTILISATEUR
            ---------------------------------------------------- */

            let userId = null;


            /*
             * CAS 1 :
             * Le message original vient de l'utilisateur
             *
             * Dans ce cas :
             * sender_id = ID de l'utilisateur
             */

            if (
                originalMessage.sender_type === "user" &&
                originalMessage.sender_id
            ) {

                userId =
                    Number(
                        originalMessage.sender_id
                    );

            }


            /*
             * CAS 2 :
             * Le message original vient de l'administration
             *
             * Dans ce cas :
             * recipient_user_id = ID de l'utilisateur
             */

            if (
                !userId &&
                originalMessage.recipient_user_id
            ) {

                userId =
                    Number(
                        originalMessage.recipient_user_id
                    );

            }


            /* ----------------------------------------------------
               VÉRIFICATION DE L'UTILISATEUR
            ---------------------------------------------------- */

            if (
                !Number.isInteger(userId) ||
                userId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Impossible de déterminer l'utilisateur de cette conversation"

                });

            }


            /* ----------------------------------------------------
               RÉCUPÉRER L'UTILISATEUR
            ---------------------------------------------------- */

            const userResult =
                await client.query(
                    `
                    SELECT
                        id,
                        nom,
                        email,
                        is_premium,
                        is_blocked
                    FROM users
                    WHERE id = $1
                    LIMIT 1
                    `,
                    [userId]
                );


            /* ----------------------------------------------------
               UTILISATEUR INTROUVABLE
            ---------------------------------------------------- */

            if (
                userResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"

                });

            }


            const user =
                userResult.rows[0];


            /* ----------------------------------------------------
               VÉRIFIER SI L'UTILISATEUR EST BLOQUÉ
            ---------------------------------------------------- */

            if (
                user.is_blocked === true
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Impossible de répondre à un utilisateur bloqué"

                });

            }


            /* ----------------------------------------------------
               COMMENCER LA TRANSACTION
            ---------------------------------------------------- */

            await client.query(
                "BEGIN"
            );


            /* ----------------------------------------------------
               SUJET DE LA RÉPONSE
            ---------------------------------------------------- */

            const replySubject =
                normalizeMessageSubject(
                    originalMessage.subject ||
                    "Réponse BMJ SERVICE"
                );


            /* ----------------------------------------------------
               ENREGISTRER LA RÉPONSE
            ---------------------------------------------------- */

            const replyResult =
                await client.query(
                    `
                    INSERT INTO messages
                    (
                        sender_type,
                        sender_id,
                        recipient_type,
                        recipient_user_id,
                        audience,
                        subject,
                        message,
                        priority,
                        parent_id
                    )
                    VALUES
                    (
                        'admin',
                        NULL,
                        'user',
                        $1,
                        'individual',
                        $2,
                        $3,
                        'normal',
                        $4
                    )
                    RETURNING *
                    `,
                    [
                        userId,
                        replySubject,
                        cleanMessage,
                        messageId
                    ]
                );


            /* ----------------------------------------------------
               CRÉER LA NOTIFICATION
            ---------------------------------------------------- */

            await client.query(
                `
                INSERT INTO notifications
                (
                    user_id,
                    title,
                    message,
                    type
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
                    userId,
                    replySubject,
                    cleanMessage,
                    "normal"
                ]
            );


            /* ----------------------------------------------------
               VALIDER LA TRANSACTION
            ---------------------------------------------------- */

            await client.query(
                "COMMIT"
            );


            /* ----------------------------------------------------
               JOURNAL ADMIN
            ---------------------------------------------------- */

            try {

                await logAdminAction(
                    "REPONSE_MESSAGE",
                    `Réponse au message ${messageId} envoyée à l'utilisateur ${userId}`
                );

            } catch (logError) {

                console.error(
                    "Erreur journal admin :",
                    logError
                );

            }


            /* ----------------------------------------------------
               RÉPONSE AU FRONTEND
            ---------------------------------------------------- */

            return res.status(201).json({

                success: true,

                messageData:
                    replyResult.rows[0],

                message:
                    "Réponse envoyée avec succès"

            });


        } catch (error) {


            /* ----------------------------------------------------
               ANNULER LA TRANSACTION EN CAS D'ERREUR
            ---------------------------------------------------- */

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (rollbackError) {

                console.error(
                    "Erreur rollback :",
                    rollbackError
                );

            }


            console.error(
                "Erreur réponse message :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de l'envoi de la réponse"

            });


        } finally {


            /* ----------------------------------------------------
               LIBÉRER LA CONNEXION
            ---------------------------------------------------- */

            client.release();

        }

    }
);


/* ============================================================
   FIN — SYSTÈME DE MESSAGES ADMIN
============================================================ */
/* ============================================================
   NOTIFICATIONS UTILISATEUR - ADMIN
============================================================ */

app.get(
    "/api/admin/users/:id/notifications",
    adminAuth,
    async (req, res) => {

        try {

            const userId =
                Number(
                    req.params.id
                );


            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM notifications
                    WHERE user_id = $1
                    ORDER BY id DESC
                    `,
                    [userId]
                );


            res.json({

                success: true,

                notifications:
                    result.rows

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur notifications"

            });

        }

    }
);


/* ============================================================
   DEMANDES PAIEMENT ADMIN
============================================================ */

app.get(
    "/api/admin/demandes-paiement",
    adminAuth,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        d.*,

                        u.nom,
                        u.email,
                        u.telephone,

                        u.is_premium,
                        u.is_blocked

                    FROM demandes_paiement d

                    LEFT JOIN users u
                        ON u.id = d.user_id

                    ORDER BY d.id DESC
                    `
                );


            res.json({

                success: true,

                demandes:
                    result.rows

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur récupération paiements"

            });

        }

    }
);


/* ============================================================
   DEMANDES PAIEMENT - COMPATIBILITÉ
============================================================ */

app.get(
    "/api/demandes-paiement",
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM demandes_paiement
                    ORDER BY id DESC
                    `
                );


            res.json({

                success: true,

                demandes:
                    result.rows

            });

        } catch (error) {

            console.error(error);

            res.json({

                success: true,

                demandes: []

            });

        }

    }
);


/* ============================================================
   CRÉER DEMANDE PAIEMENT
============================================================ */

app.post(
    "/api/demandes-paiement",
    async (req, res) => {

        try {

            const {
                user_id,
                telephone_paiement,
                montant,
                methode,
                reference_paiement,
                preuve_paiement
            } = req.body;


            const userId =
                Number(user_id);


            if (
                !userId ||
                !montant ||
                !methode
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Informations de paiement incomplètes"

                });

            }


            const user =
                await pool.query(
                    `
                    SELECT id
                    FROM users
                    WHERE id = $1
                    `,
                    [userId]
                );


            if (
                user.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"

                });

            }


            const result =
                await pool.query(
                    `
                    INSERT INTO demandes_paiement
                    (
                        user_id,
                        telephone_paiement,
                        montant,
                        methode,
                        reference_paiement,
                        preuve_paiement,
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
                        'pending'
                    )
                    RETURNING *
                    `,
                    [
                        userId,
                        telephone_paiement || "",
                        montant,
                        methode,
                        reference_paiement || "",
                        preuve_paiement || ""
                    ]
                );


            await pool.query(
                `
                INSERT INTO user_activity
                (
                    user_id,
                    action,
                    details
                )
                VALUES
                ($1, $2, $3)
                `,
                [
                    userId,
                    "DEMANDE_PAIEMENT",
                    `Demande de ${montant}$ - ${methode}`
                ]
            );


            res.json({

                success: true,

                demande:
                    result.rows[0],

                message:
                    "Demande de paiement enregistrée"

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur création demande paiement"

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

        const client =
            await pool.connect();


        try {

            const id =
                Number(
                    req.params.id
                );


            await client.query(
                "BEGIN"
            );


            const updateRes =
                await client.query(
                    `
                    UPDATE demandes_paiement

                    SET
                        statut = 'valide',
                        updated_at =
                            CURRENT_TIMESTAMP

                    WHERE id = $1

                    RETURNING
                        user_id,
                        montant
                    `,
                    [id]
                );


            if (
                updateRes.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res.status(404).json({

                    success: false,

                    message:
                        "Demande de paiement introuvable"

                });

            }


            const userId =
                updateRes.rows[0]
                    .user_id;


            await client.query(
                `
                UPDATE users
                SET
                    is_premium = TRUE,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $1
                `,
                [userId]
            );


            await client.query(
                `
                INSERT INTO notifications
                (
                    user_id,
                    title,
                    message,
                    type
                )
                VALUES
                (
                    $1,
                    'Compte Premium activé',
                    'Votre paiement a été validé. Votre compte est maintenant Premium.',
                    'premium'
                )
                `,
                [userId]
            );


            await client.query(
                `
                INSERT INTO user_activity
                (
                    user_id,
                    action,
                    details
                )
                VALUES
                (
                    $1,
                    'PAIEMENT_VALIDE',
                    'Paiement validé par administration'
                )
                `,
                [userId]
            );


            await client.query(
                "COMMIT"
            );


            await logAdminAction(
                "VALIDATION_PAIEMENT",
                `Demande ${id} - utilisateur ${userId}`
            );


            res.json({

                success: true,

                message:
                    "Demande validée et utilisateur passé en Premium"

            });

        } catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (_) {}


            console.error(
                "Erreur validation paiement :",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Erreur serveur"

            });

        } finally {

            client.release();

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

            const id =
                Number(
                    req.params.id
                );

            const note =
                clean(
                    req.body.note
                );


            const result =
                await pool.query(
                    `
                    UPDATE demandes_paiement
                    SET
                        statut = 'refuse',
                        admin_note = $1,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE id = $2
                    RETURNING user_id
                    `,
                    [
                        note,
                        id
                    ]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Demande introuvable"

                });

            }


            await logAdminAction(
                "PAIEMENT_REFUSE",
                `Demande ${id}`
            );


            res.json({

                success: true,

                message:
                    "Paiement refusé"

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur refus paiement"

            });

        }

    }
);


/* ============================================================
   STATISTIQUES ADMIN
============================================================ */

app.get(
    "/api/admin/statistiques",
    adminAuth,
    async (req, res) => {

        try {

            const users =
                await pool.query(
                    `
                    SELECT

                        COUNT(*) AS total,

                        COUNT(*) FILTER (
                            WHERE is_premium = TRUE
                        ) AS premium,

                        COUNT(*) FILTER (
                            WHERE is_blocked = TRUE
                        ) AS blocked,

                        COUNT(*) FILTER (
                            WHERE is_premium = FALSE
                        ) AS standard,

                        COUNT(*) FILTER (
                            WHERE created_at >= CURRENT_DATE
                        ) AS today

                    FROM users
                    `
                );


            const payments =
                await pool.query(
                    `
                    SELECT

                        COUNT(*) AS total,

                        COUNT(*) FILTER (
                            WHERE statut = 'pending'
                        ) AS pending,

                        COUNT(*) FILTER (
                            WHERE statut = 'valide'
                        ) AS validated,

                        COUNT(*) FILTER (
                            WHERE statut = 'refuse'
                        ) AS refused,

                        COALESCE(
                            SUM(montant)
                            FILTER (
                                WHERE statut = 'valide'
                            ),
                            0
                        ) AS revenue

                    FROM demandes_paiement
                    `
                );


            const messages =
                await pool.query(
                    `
                    SELECT COUNT(*) AS total
                    FROM messages
                    `
                );


            const certificates =
                await pool.query(
                    `
                    SELECT

                        COUNT(*) AS total,

                        COUNT(*) FILTER (
                            WHERE is_authorized = TRUE
                        ) AS authorized

                    FROM certificates
                    `
                );


            const u =
                users.rows[0];

            const p =
                payments.rows[0];

            const m =
                messages.rows[0];

            const c =
                certificates.rows[0];


            res.json({

                success: true,

                stats: {

                    users:
                        Number(
                            u.total || 0
                        ),

                    premium:
                        Number(
                            u.premium || 0
                        ),

                    standard:
                        Number(
                            u.standard || 0
                        ),

                    blocked:
                        Number(
                            u.blocked || 0
                        ),

                    today:
                        Number(
                            u.today || 0
                        ),

                    payments:
                        Number(
                            p.total || 0
                        ),

                    pending:
                        Number(
                            p.pending || 0
                        ),

                    validated:
                        Number(
                            p.validated || 0
                        ),

                    refused:
                        Number(
                            p.refused || 0
                        ),

                    revenue:
                        Number(
                            p.revenue || 0
                        ),

                    messages:
                        Number(
                            m.total || 0
                        ),

                    certificates:
                        Number(
                            c.total || 0
                        ),

                    certificates_authorized:
                        Number(
                            c.authorized || 0
                        )

                }

            });

        } catch (error) {

            console.error(
                "Erreur statistiques :",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Erreur récupération statistiques"

            });

        }

    }
);


/* ============================================================
   ACTIVITÉS ADMIN
============================================================ */

app.get(
    "/api/admin/activities",
    adminAuth,
    async (req, res) => {

        try {

            const limit =
                Math.min(
                    500,
                    Math.max(
                        1,
                        safeNumber(
                            req.query.limit,
                            100
                        )
                    )
                );


            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM admin_activity
                    ORDER BY id DESC
                    LIMIT $1
                    `,
                    [limit]
                );


            res.json({

                success: true,

                activities:
                    result.rows

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur activités admin"

            });

        }

    }
);


/* ============================================================
   ACTIVITÉS UTILISATEUR
============================================================ */

app.get(
    "/api/admin/users/:id/activity",
    adminAuth,
    async (req, res) => {

        try {

            const userId =
                Number(
                    req.params.id
                );


            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM user_activity
                    WHERE user_id = $1
                    ORDER BY id DESC
                    LIMIT 200
                    `,
                    [userId]
                );


            res.json({

                success: true,

                activities:
                    result.rows

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur activité utilisateur"

            });

        }

    }
);


/* ============================================================
   SUPPRESSION UTILISATEUR
============================================================ */

app.delete(
    "/api/admin/users/:id",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const result =
                await pool.query(
                    `
                    DELETE FROM users
                    WHERE id = $1
                    RETURNING
                        id,
                        email
                    `,
                    [id]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"

                });

            }


            await logAdminAction(
                "SUPPRESSION_UTILISATEUR",
                `Utilisateur ID ${id}`
            );


            res.json({

                success: true,

                message:
                    "Utilisateur supprimé définitivement"

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur suppression utilisateur"

            });

        }

    }
);


/* ============================================================
   INSCRIPTION UTILISATEUR
   ROUTE PRINCIPALE DE LA PAGE D'INSCRIPTION
============================================================ */

app.post(
    "/api/inscription",
    async (req, res) => {

        try {

            const nom =
                clean(
                    req.body.nom
                );

            const sexe =
                clean(
                    req.body.sexe
                );

            const email =
                clean(
                    req.body.email
                ).toLowerCase();

            const telephone =
                clean(
                    req.body.telephone
                );

            const domaine =
                clean(
                    req.body.domaine
                );

            const pays =
                clean(
                    req.body.pays
                );

            const ville =
                clean(
                    req.body.ville
                );

            const niveau =
                clean(
                    req.body.niveau
                );

            const password =
                String(
                    req.body.password || ""
                );

            const photo =
                clean(
                    req.body.photo
                );


            /* =================================================
               VALIDATIONS
            ================================================= */

            if (!nom) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le nom est requis"

                });

            }


            if (!email) {

                return res.status(400).json({

                    success: false,

                    message:
                        "L'adresse email est requise"

                });

            }


            if (!isValidEmail(email)) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Adresse email invalide"

                });

            }


            if (!password) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le mot de passe est requis"

                });

            }


            if (
                password.length < 6
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le mot de passe doit contenir au moins 6 caractères"

                });

            }


            /* =================================================
               VÉRIFICATION EMAIL
            ================================================= */

            const existingUser =
                await pool.query(
                    `
                    SELECT id
                    FROM users
                    WHERE LOWER(email) = $1
                    LIMIT 1
                    `,
                    [email]
                );


            if (
                existingUser.rows.length > 0
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Cette adresse email est déjà utilisée"

                });

            }


            /* =================================================
               INSERTION
            ================================================= */

            const result =
                await pool.query(
                    `
                    INSERT INTO users
                    (
                        nom,
                        sexe,
                        email,
                        telephone,
                        domaine,
                        pays,
                        ville,
                        niveau,
                        password,
                        photo,
                        progression,
                        is_premium,
                        is_blocked,
                        certificat_autorise,
                        certificat_obtenu,
                        created_at,
                        updated_at
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
                        $10,
                        0,
                        FALSE,
                        FALSE,
                        FALSE,
                        FALSE,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )
                    RETURNING
                        id,
                        nom,
                        sexe,
                        email,
                        telephone,
                        domaine,
                        pays,
                        ville,
                        niveau,
                        photo,
                        progression,
                        is_premium,
                        is_blocked,
                        certificat_autorise,
                        certificat_obtenu,
                        premium_until,
                        created_at,
                        updated_at,
                        last_login
                    `,
                    [
                        nom,
                        sexe,
                        email,
                        telephone,
                        domaine,
                        pays,
                        ville,
                        niveau,
                        hashPassword(password),
                        photo
                    ]
                );


            const user =
                result.rows[0];


            /* =================================================
               JOURNAL
            ================================================= */

            await pool.query(
                `
                INSERT INTO user_activity
                (
                    user_id,
                    action,
                    details
                )
                VALUES
                (
                    $1,
                    $2,
                    $3
                )
                `,
                [
                    user.id,
                    "INSCRIPTION",
                    "Création du compte depuis la page d'inscription"
                ]
            );


            res.status(201).json({

                success: true,

                message:
                    "Inscription réussie",

                user

            });

        } catch (error) {

            console.error(
                "Erreur inscription :",
                error
            );


            if (
                error.code === "23505"
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Cette adresse email est déjà utilisée"

                });

            }


            res.status(500).json({

                success: false,

                message:
                    "Erreur lors de l'inscription"

            });

        }

    }
);


/* ============================================================
   COMPATIBILITÉ ANCIENNE INSCRIPTION
   /api/register
============================================================ */

app.post(
    "/api/register",
    async (req, res) => {

        try {

            const nom =
                clean(req.body.nom);

            const sexe =
                clean(req.body.sexe);

            const email =
                clean(req.body.email)
                    .toLowerCase();

            const telephone =
                clean(req.body.telephone);

            const domaine =
                clean(req.body.domaine);

            const pays =
                clean(req.body.pays);

            const ville =
                clean(req.body.ville);

            const niveau =
                clean(req.body.niveau);

            const password =
                String(
                    req.body.password || ""
                );

            const photo =
                clean(req.body.photo);


            if (
                !email ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Email et mot de passe requis"

                });

            }


            if (
                !isValidEmail(email)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Adresse email invalide"

                });

            }


            if (
                password.length < 6
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le mot de passe doit contenir au moins 6 caractères"

                });

            }


            const result =
                await pool.query(
                    `
                    INSERT INTO users
                    (
                        nom,
                        sexe,
                        email,
                        telephone,
                        domaine,
                        pays,
                        ville,
                        niveau,
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
                        $6,
                        $7,
                        $8,
                        $9,
                        $10
                    )
                    RETURNING
                        id,
                        nom,
                        sexe,
                        email,
                        telephone,
                        domaine,
                        pays,
                        ville,
                        niveau,
                        photo,
                        progression,
                        is_premium,
                        is_blocked,
                        certificat_autorise,
                        certificat_obtenu,
                        premium_until,
                        created_at
                    `,
                    [
                        nom ||
                            "Client",

                        sexe,

                        email,

                        telephone,

                        domaine,

                        pays,

                        ville,

                        niveau,

                        hashPassword(
                            password
                        ),

                        photo
                    ]
                );


            const user =
                result.rows[0];


            await pool.query(
                `
                INSERT INTO user_activity
                (
                    user_id,
                    action,
                    details
                )
                VALUES
                (
                    $1,
                    'INSCRIPTION',
                    'Création du compte'
                )
                `,
                [user.id]
            );


            res.status(201).json({

                success: true,

                message:
                    "Inscription réussie",

                user

            });

        } catch (error) {

            console.error(
                "Erreur register :",
                error
            );


            if (
                error.code === "23505"
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Cette adresse email est déjà utilisée"

                });

            }


            res.status(500).json({

                success: false,

                message:
                    "Erreur lors de l'inscription"

            });

        }

    }
);


/* ============================================================
   CONNEXION UTILISATEUR
   ROUTE PRINCIPALE DE LA PAGE DE CONNEXION
============================================================ */

app.post(
    "/api/connexion",
    async (req, res) => {

        try {

            const email =
                clean(
                    req.body.email
                ).toLowerCase();

            const password =
                String(
                    req.body.password || ""
                );


            if (!email) {

                return res.status(400).json({

                    success: false,

                    message:
                        "L'adresse email est requise"

                });

            }


            if (
                !isValidEmail(email)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Adresse email invalide"

                });

            }


            if (!password) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le mot de passe est requis"

                });

            }


            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        nom,
                        sexe,
                        email,
                        telephone,
                        domaine,
                        pays,
                        ville,
                        niveau,
                        photo,
                        password,
                        progression,
                        is_premium,
                        is_blocked,
                        certificat_autorise,
                        certificat_obtenu,
                        premium_until,
                        created_at,
                        updated_at,
                        last_login
                    FROM users
                    WHERE LOWER(email) = $1
                    LIMIT 1
                    `,
                    [email]
                );


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
                user.password !==
                hashPassword(password)
            ) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Email ou mot de passe incorrect"

                });

            }


            if (
                user.is_blocked === true
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Ce compte a été bloqué par l'administration"

                });

            }


            await pool.query(
                `
                UPDATE users
                SET
                    last_login =
                        CURRENT_TIMESTAMP,

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = $1
                `,
                [user.id]
            );


            await pool.query(
                `
                INSERT INTO user_activity
                (
                    user_id,
                    action,
                    details
                )
                VALUES
                (
                    $1,
                    'CONNEXION',
                    'Connexion utilisateur'
                )
                `,
                [user.id]
            );


            delete user.password;


            res.json({

                success: true,

                message:
                    "Connexion réussie",

                user

            });

        } catch (error) {

            console.error(
                "Erreur connexion :",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Erreur serveur"

            });

        }

    }
);


/* ============================================================
   COMPATIBILITÉ ANCIENNE CONNEXION
   /api/login
============================================================ */

app.post(
    "/api/login",
    async (req, res) => {

        try {

            const email =
                clean(
                    req.body.email
                ).toLowerCase();

            const password =
                String(
                    req.body.password || ""
                );


            if (
                !email ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Email et mot de passe requis"

                });

            }


            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        nom,
                        sexe,
                        email,
                        telephone,
                        domaine,
                        pays,
                        ville,
                        niveau,
                        photo,
                        password,
                        progression,
                        is_premium,
                        is_blocked,
                        certificat_autorise,
                        certificat_obtenu,
                        premium_until,
                        created_at,
                        updated_at,
                        last_login
                    FROM users
                    WHERE LOWER(email) = $1
                    LIMIT 1
                    `,
                    [email]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Identifiants utilisateur incorrects"

                });

            }


            const user =
                result.rows[0];


            if (
                user.password !==
                hashPassword(password)
            ) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Identifiants utilisateur incorrects"

                });

            }


            if (
                user.is_blocked
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Ce compte a été bloqué par l'administration"

                });

            }


            await pool.query(
                `
                UPDATE users
                SET
                    last_login =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = $1
                `,
                [user.id]
            );


            await pool.query(
                `
                INSERT INTO user_activity
                (
                    user_id,
                    action,
                    details
                )
                VALUES
                (
                    $1,
                    'CONNEXION',
                    'Connexion utilisateur'
                )
                `,
                [user.id]
            );


            delete user.password;


            res.json({

                success: true,

                message:
                    "Connexion réussie",

                user

            });

        } catch (error) {

            console.error(
                "Erreur login :",
                error
            );


            res.status(500).json({

                success: false,

                message:
                    "Erreur serveur"

            });

        }

    }
);


/* ============================================================
   PROFIL UTILISATEUR
============================================================ */

app.get(
    "/api/users/:id",
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        nom,
                        sexe,
                        email,
                        telephone,
                        domaine,
                        pays,
                        ville,
                        niveau,
                        photo,
                        progression,
                        is_premium,
                        is_blocked,
                        certificat_autorise,
                        certificat_obtenu,
                        premium_until,
                        created_at,
                        updated_at,
                        last_login
                    FROM users
                    WHERE id = $1
                    `,
                    [id]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"

                });

            }


            res.json({

                success: true,

                user:
                    result.rows[0]

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur serveur"

            });

        }

    }
);


/* ============================================================
   PROGRESSION PUBLIQUE UTILISATEUR
============================================================ */

app.get(
    "/api/users/:id/progression",
    async (req, res) => {

        try {

            const userId =
                Number(
                    req.params.id
                );


            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM user_progress
                    WHERE user_id = $1
                    ORDER BY domaine ASC
                    `,
                    [userId]
                );


            res.json({

                success: true,

                progress:
                    result.rows

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur progression"

            });

        }

    }
);


/* ============================================================
   MESSAGES UTILISATEUR
============================================================ */

app.get(
    "/api/users/:id/messages",
    async (req, res) => {

        try {

            const userId =
                Number(
                    req.params.id
                );


            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        sender_type,
                        audience,
                        subject,
                        message,
                        priority,
                        is_read,
                        parent_id,
                        created_at
                    FROM messages
                    WHERE
                        recipient_user_id = $1
                    ORDER BY id DESC
                    `,
                    [userId]
                );


            res.json({

                success: true,

                messages:
                    result.rows

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur messages"

            });

        }

    }
);


/* ============================================================
   MARQUER MESSAGE LU
============================================================ */

app.patch(
    "/api/users/:userId/messages/:messageId/read",
    async (req, res) => {

        try {

            const userId =
                Number(
                    req.params.userId
                );

            const messageId =
                Number(
                    req.params.messageId
                );


            const result =
                await pool.query(
                    `
                    UPDATE messages
                    SET
                        is_read = TRUE,
                        updated_at =
                            CURRENT_TIMESTAMP
                    WHERE
                        id = $1
                        AND recipient_user_id = $2
                    RETURNING id
                    `,
                    [
                        messageId,
                        userId
                    ]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Message introuvable"

                });

            }


            res.json({

                success: true,

                message:
                    "Message marqué comme lu"

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur message"

            });

        }

    }
);


/* ============================================================
   CERTIFICATS UTILISATEUR
============================================================ */

app.get(
    "/api/users/:id/certificates",
    async (req, res) => {

        try {

            const userId =
                Number(
                    req.params.id
                );


            const userResult =
                await pool.query(
                    `
                    SELECT
                        certificat_autorise,
                        certificat_obtenu,
                        progression
                    FROM users
                    WHERE id = $1
                    `,
                    [userId]
                );


            if (
                userResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"

                });

            }


            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM certificates
                    WHERE user_id = $1
                    ORDER BY id DESC
                    `,
                    [userId]
                );


            res.json({

                success: true,

                authorization: {

                    allowed:
                        Boolean(
                            userResult.rows[0]
                                .certificat_autorise
                        ),

                    obtained:
                        Boolean(
                            userResult.rows[0]
                                .certificat_obtenu
                        ),

                    progression:
                        userResult.rows[0]
                            .progression

                },

                certificates:
                    result.rows

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur certificats"

            });

        }

    }
);


/* ============================================================
   VÉRIFICATION AUTORISATION CERTIFICAT
============================================================ */

app.get(
    "/api/users/:id/certificate-access",
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        progression,
                        is_premium,
                        certificat_autorise,
                        certificat_obtenu
                    FROM users
                    WHERE id = $1
                    `,
                    [id]
                );


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


            res.json({

                success: true,

                allowed:
                    Boolean(
                        user.certificat_autorise
                    ),

                obtained:
                    Boolean(
                        user.certificat_obtenu
                    ),

                progression:
                    user.progression,

                is_premium:
                    user.is_premium

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur vérification certificat"

            });

        }

    }
);


/* ============================================================
   404 API
============================================================ */

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({

            success: false,

            message:
                "Route API introuvable",

            method:
                req.method,

            path:
                req.originalUrl

        });

    }
);


/* ============================================================
   GESTION ERREUR GLOBALE
============================================================ */

app.use(
    (error, req, res, next) => {

        console.error(
            "Erreur globale :",
            error
        );


        if (
            res.headersSent
        ) {

            return next(error);

        }


        res.status(500).json({

            success: false,

            message:
                "Erreur interne du serveur"

        });

    }
);


/* ============================================================
   ARRÊT PROPRE
============================================================ */

async function gracefulShutdown(
    signal
) {

    console.log(
        `${signal} reçu. Arrêt du serveur...`
    );


    try {

        await pool.end();


        console.log(
            "Connexion PostgreSQL fermée."
        );


        process.exit(0);

    } catch (error) {

        console.error(
            "Erreur arrêt serveur :",
            error
        );


        process.exit(1);

    }

}


process.on(
    "SIGTERM",
    () =>
        gracefulShutdown("SIGTERM")
);

process.on(
    "SIGINT",
    () =>
        gracefulShutdown("SIGINT")
);


/* ============================================================
   DÉMARRAGE
============================================================ */

async function startServer() {

    await initDatabase();


    app.listen(
        PORT,
        () => {

            console.log(
                "=================================================="
            );

            console.log(
                " BMJ SERVICE BACKEND"
            );

            console.log(
                " Serveur démarré avec succès"
            );

            console.log(
                ` Port : ${PORT}`
            );

            console.log(
                " PostgreSQL : activé"
            );

            console.log(
                " Administration : activée"
            );

            console.log(
                " Inscription : activée"
            );

            console.log(
                " Connexion utilisateur : activée"
            );

            console.log(
                " Premium : activé"
            );

            console.log(
                " Progression : activée"
            );

            console.log(
                " Certificats : activés"
            );

            console.log(
                " Messages : activés"
            );

            console.log(
                " Notifications : activées"
            );

            console.log(
                " Paiements : activés"
            );

            console.log(
                "=================================================="
            );

        }
    );

}


startServer()
    .catch(
        error => {

            console.error(
                "Impossible de démarrer le serveur :",
                error
            );

            process.exit(1);

        }
    );