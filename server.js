"use strict";

/* ============================================================
   BMJ SERVICE
   BACKEND COMPLET
   Express + PostgreSQL
============================================================ */

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { Pool } = require("pg");

const app = express();

/* ============================================================
   CONFIGURATION
============================================================ */

const PORT =
    process.env.PORT || 10000;

const DATABASE_URL =
    process.env.DATABASE_URL ||
    "postgresql://name_bmj_db_user:TjgoLRbYV0LizRgBFD1nepGqSqErgBgD@dpg-dagn0e15efls73b8rjh0-a/name_bmj_db";

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
    connectionString: DATABASE_URL,

    ssl: {
        rejectUnauthorized: false
    },

    max: 10,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000
});

pool.on("error", error => {
    console.error(
        "[POSTGRES] Erreur inattendue :",
        error
    );
});

/* ============================================================
   CORS
============================================================ */

app.use(
    cors({
        origin: true,

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
            "X-Admin-Token",
            "x-admin-token"
        ],

        credentials: false
    })
);

/* ============================================================
   BODY
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
   LOGGER
============================================================ */

app.use(
    (req, res, next) => {

        const startedAt =
            Date.now();

        res.on(
            "finish",
            () => {

                const duration =
                    Date.now() -
                    startedAt;

                console.log(
                    `[BMJ API] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`
                );
            }
        );

        next();
    }
);

/* ============================================================
   OUTILS
============================================================ */

function clean(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value).trim();
}

function safeNumber(
    value,
    fallback = 0
) {

    const number =
        Number(value);

    return Number.isFinite(number)
        ? number
        : fallback;
}

function clampProgress(value) {

    const number =
        safeNumber(
            value,
            0
        );

    return Math.min(
        100,
        Math.max(
            0,
            Math.round(number)
        )
    );
}

/*
 * IMPORTANT
 *
 * 50% ou toute valeur comprise entre 0 et 99
 * = EN COURS
 *
 * 100%
 * = TERMINÉ
 */
function progressionStatus(
    progression
) {

    return clampProgress(
        progression
    ) >= 100
        ? "Terminé"
        : "En cours";
}

function booleanValue(value) {

    return (
        value === true ||
        value === "true" ||
        value === 1 ||
        value === "1"
    );
}

function isValidEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email);
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

function publicUser(user) {

    if (!user) {
        return null;
    }

    const copy = {
        ...user
    };

    delete copy.password;

    /*
     * Pour l'administration :
     * on conserve la valeur technique progression
     * mais on ajoute un statut lisible.
     */
    if (
        Object.prototype.hasOwnProperty.call(
            copy,
            "progression"
        )
    ) {

        copy.progression_status =
            progressionStatus(
                copy.progression
            );
    }

    return copy;
}

function normalizeMessagePriority(
    priority
) {

    const allowed = [
        "normal",
        "important",
        "urgent"
    ];

    const value =
        clean(priority)
            .toLowerCase();

    return allowed.includes(value)
        ? value
        : "normal";
}

function normalizeMessageSubject(
    subject
) {

    const value =
        clean(subject);

    if (!value) {
        return "Message BMJ SERVICE";
    }

    return value.substring(
        0,
        200
    );
}

function normalizeMessageContent(
    message
) {

    return clean(message);
}

function normalizeAdminMessageData(
    body = {}
) {

    return {

        subject:
            normalizeMessageSubject(
                body.subject
            ),

        message:
            normalizeMessageContent(
                body.message
            ),

        priority:
            normalizeMessagePriority(
                body.priority
            )
    };
}

/* ============================================================
   PROGRESSION
============================================================ */

/*
 * Chaque nouvel utilisateur commence à 50%.
 */
const DEFAULT_USER_PROGRESSION = 50;

/*
 * Termine la progression uniquement lorsque
 * le processus demandé est réellement terminé.
 */
const COMPLETED_USER_PROGRESSION = 100;

/*
 * Conversion destinée à l'ADMIN.
 *
 * L'admin ne doit pas voir :
 * 50 %
 * 75 %
 * 90 %
 *
 * Il voit uniquement :
 * En cours
 * Terminé
 */
function adminProgressionStatus(
    progression
) {

    return progressionStatus(
        progression
    );
}

/*
 * Retourne une progression sous forme
 * compatible avec l'administration.
 */
function adminUserProgression(
    user
) {

    if (!user) {
        return user;
    }

    const result = {
        ...user
    };

    result.progression_status =
        adminProgressionStatus(
            result.progression
        );

    return result;
}

/* ============================================================
   TOKEN ADMIN
============================================================ */

const adminTokens =
    new Map();

function getAdminToken(req) {

    const authorization =
        req.headers.authorization ||
        "";

    if (
        authorization &&
        authorization
            .toLowerCase()
            .startsWith("bearer ")
    ) {

        return authorization
            .substring(7)
            .trim();
    }

    const headerToken =
        req.headers[
            "x-admin-token"
        ];

    if (headerToken) {

        return String(
            headerToken
        ).trim();
    }

    const queryToken =
        req.query.token;

    if (queryToken) {

        return String(
            queryToken
        ).trim();
    }

    return null;
}

/* ============================================================
   AUTH ADMIN
============================================================ */

function adminAuth(
    req,
    res,
    next
) {

    const token =
        getAdminToken(req);

    if (!token) {

        return res
            .status(401)
            .json({

                success: false,

                message:
                    "Token administrateur manquant",

                code:
                    "ADMIN_TOKEN_MISSING"
            });
    }

    const saved =
        adminTokens.get(
            tokenHash(token)
        );

    if (!saved) {

        return res
            .status(401)
            .json({

                success: false,

                message:
                    "Token administrateur invalide",

                code:
                    "ADMIN_TOKEN_INVALID"
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

        return true;

    } catch (error) {

        console.error(
            "[ADMIN LOG] Erreur :",
            error.message
        );

        return false;
    }
}

async function safeLogAdminAction(
    action,
    description = ""
) {

    try {

        await logAdminAction(
            action,
            description
        );

        return true;

    } catch (error) {

        console.error(
            "[BMJ ADMIN LOG] Erreur :",
            error.message
        );

        return false;
    }
}

/* ============================================================
   NOTIFICATION UTILISATEUR
   VERSION ROBUSTE
============================================================ */

async function createNotification(
    client,
    userId,
    title,
    message,
    type = "info"
) {

    try {

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
                title,
                message,
                type
            ]
        );

        return true;

    } catch (error) {

        /*
         * Une erreur de notification ne doit
         * jamais empêcher l'enregistrement
         * d'un message ou d'une autre opération.
         */

        console.error(
            "[BMJ NOTIFICATION] Impossible de créer la notification :",
            error.message
        );

        return false;
    }
}

/* ============================================================
   INITIALISATION BASE
   AUCUNE SUPPRESSION DE DONNÉES
============================================================ */

async function initDatabase() {

    const client =
        await pool.connect();

    try {

        await client.query(
            "BEGIN"
        );

        /* ====================================================
           USERS
        ==================================================== */

        await client.query(
            `
            CREATE TABLE IF NOT EXISTS users
            (
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
            `
        );

        const userColumns = [

            [
                "telephone",
                "VARCHAR(50)"
            ],

            [
                "domaine",
                "VARCHAR(255)"
            ],

            [
                "photo",
                "TEXT"
            ],

            [
                "progression",
                "INTEGER DEFAULT 50"
            ],

            [
                "certificat_autorise",
                "BOOLEAN DEFAULT FALSE"
            ],

            [
                "certificat_obtenu",
                "BOOLEAN DEFAULT FALSE"
            ],

            [
                "premium_until",
                "TIMESTAMP NULL"
            ],

            [
                "last_login",
                "TIMESTAMP NULL"
            ],

            [
                "updated_at",
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
            ],

            [
                "notes_admin",
                "TEXT DEFAULT ''"
            ],

            [
                "sexe",
                "VARCHAR(50)"
            ],

            [
                "pays",
                "VARCHAR(100)"
            ],

            [
                "ville",
                "VARCHAR(150)"
            ],

            [
                "niveau",
                "VARCHAR(100)"
            ]
        ];

        for (
            const [column, type]
            of userColumns
        ) {

            await client.query(
                `
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS
                ${column} ${type}
                `
            );
        }

        /*
         * Les anciens utilisateurs sans progression
         * reçoivent 50%.
         *
         * IMPORTANT :
         * Un utilisateur déjà à 100% reste à 100%.
         */
        await client.query(
            `
            UPDATE users
            SET
                progression = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE
                progression IS NULL
                OR progression < 0
                OR progression > 100
            `,
            [
                DEFAULT_USER_PROGRESSION
            ]
        );

        /* ====================================================
           DEMANDES PAIEMENT
        ==================================================== */

        await client.query(
            `
            CREATE TABLE IF NOT EXISTS demandes_paiement
            (
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
            `
        );

        const paymentColumns = [

            [
                "reference_paiement",
                "VARCHAR(255)"
            ],

            [
                "preuve_paiement",
                "TEXT"
            ],

            [
                "updated_at",
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
            ],

            [
                "admin_note",
                "TEXT DEFAULT ''"
            ]
        ];

        for (
            const [column, type]
            of paymentColumns
        ) {

            await client.query(
                `
                ALTER TABLE demandes_paiement
                ADD COLUMN IF NOT EXISTS
                ${column} ${type}
                `
            );
        }

        /* ====================================================
           ADMIN ACTIVITY
        ==================================================== */

        await client.query(
            `
            CREATE TABLE IF NOT EXISTS admin_activity
            (
                id SERIAL PRIMARY KEY,

                action VARCHAR(255),

                admin_email VARCHAR(255),

                details TEXT,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP
            )
            `
        );

        await client.query(
            `
            ALTER TABLE admin_activity
            ADD COLUMN IF NOT EXISTS
            details TEXT
            `
        );

        /* ====================================================
           MESSAGES
        ==================================================== */

        await client.query(
            `
            CREATE TABLE IF NOT EXISTS messages
            (
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
            `
        );

        const messageColumns = [

            [
                "sender_type",
                "VARCHAR(30) DEFAULT 'admin'"
            ],

            [
                "sender_id",
                "INTEGER NULL"
            ],

            [
                "recipient_type",
                "VARCHAR(30) DEFAULT 'individual'"
            ],

            [
                "recipient_user_id",
                "INTEGER NULL"
            ],

            [
                "audience",
                "VARCHAR(30) DEFAULT 'individual'"
            ],

            [
                "subject",
                "VARCHAR(255)"
            ],

            [
                "message",
                "TEXT"
            ],

            [
                "priority",
                "VARCHAR(30) DEFAULT 'normal'"
            ],

            [
                "is_read",
                "BOOLEAN DEFAULT FALSE"
            ],

            [
                "is_archived",
                "BOOLEAN DEFAULT FALSE"
            ],

            [
                "parent_id",
                "INTEGER NULL"
            ],

            [
                "created_at",
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
            ],

            [
                "updated_at",
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
            ]
        ];

        for (
            const [column, type]
            of messageColumns
        ) {

            await client.query(
                `
                ALTER TABLE messages
                ADD COLUMN IF NOT EXISTS
                ${column} ${type}
                `
            );
        }

        /* ====================================================
           NOTIFICATIONS
        ==================================================== */

        await client.query(
            `
            CREATE TABLE IF NOT EXISTS notifications
            (
                id SERIAL PRIMARY KEY,

                user_id INTEGER
                    REFERENCES users(id)
                    ON DELETE CASCADE,

                title VARCHAR(255),

                message TEXT,

                type VARCHAR(50)
                    DEFAULT 'info',

                is_read BOOLEAN
                    DEFAULT FALSE,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP
            )
            `
        );

        /* ====================================================
           CERTIFICATES
        ==================================================== */

        await client.query(
            `
            CREATE TABLE IF NOT EXISTS certificates
            (
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
            `
        );

        const certificateColumns = [

            [
                "domaine",
                "VARCHAR(255)"
            ],

            [
                "titre",
                "VARCHAR(255)"
            ],

            [
                "certificat_url",
                "TEXT"
            ],

            [
                "certificate_code",
                "VARCHAR(255)"
            ],

            [
                "is_authorized",
                "BOOLEAN DEFAULT FALSE"
            ],

            [
                "downloaded",
                "BOOLEAN DEFAULT FALSE"
            ],

            [
                "downloaded_at",
                "TIMESTAMP NULL"
            ],

            [
                "updated_at",
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
            ]
        ];

        for (
            const [column, type]
            of certificateColumns
        ) {

            await client.query(
                `
                ALTER TABLE certificates
                ADD COLUMN IF NOT EXISTS
                ${column} ${type}
                `
            );
        }

        /* ====================================================
           USER PROGRESS
        ==================================================== */

        await client.query(
            `
            CREATE TABLE IF NOT EXISTS user_progress
            (
                id SERIAL PRIMARY KEY,

                user_id INTEGER
                    REFERENCES users(id)
                    ON DELETE CASCADE,

                domaine VARCHAR(255)
                    NOT NULL,

                progression INTEGER
                    DEFAULT 0,

                chapitre_actuel INTEGER,

                chapitre_total INTEGER,

                statut VARCHAR(50)
                    DEFAULT 'en_cours',

                updated_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP,

                UNIQUE(
                    user_id,
                    domaine
                )
            )
            `
        );

        /* ====================================================
           USER ACTIVITY
        ==================================================== */

        await client.query(
            `
            CREATE TABLE IF NOT EXISTS user_activity
            (
                id SERIAL PRIMARY KEY,

                user_id INTEGER
                    REFERENCES users(id)
                    ON DELETE CASCADE,

                action VARCHAR(255),

                details TEXT,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP
            )
            `
        );

        /* ====================================================
           INDEX
        ==================================================== */

        await client.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_users_email
            ON users(email)
            `
        );

        await client.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_users_created_at
            ON users(created_at)
            `
        );

        await client.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_messages_recipient
            ON messages(recipient_user_id)
            `
        );

        await client.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_messages_created
            ON messages(created_at)
            `
        );

        await client.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_notifications_user
            ON notifications(user_id)
            `
        );

        await client.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_progress_user
            ON user_progress(user_id)
            `
        );

        await client.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_activity_user
            ON user_activity(user_id)
            `
        );

        await client.query(
            "COMMIT"
        );

        console.log(
            "=============================================="
        );

        console.log(
            "Base BMJ SERVICE vérifiée."
        );

        console.log(
            "Progression initiale : 50%"
        );

        console.log(
            "100% = vérification Premium terminée."
        );

        console.log(
            "Aucune donnée existante supprimée."
        );

        console.log(
            "=============================================="
        );

    } catch (error) {

        await client.query(
            "ROLLBACK"
        );

        console.error(
            "Erreur initialisation DB :",
            error
        );

        throw error;

    } finally {

        client.release();
    }
}

/* ============================================================
   INITIALISATION PROGRESSION
============================================================ */

async function initializeUsersProgression() {

    try {

        /*
         * On ne touche PAS aux utilisateurs
         * qui ont déjà une progression valide.
         *
         * NULL / valeur invalide => 50%.
         */
        const result =
            await pool.query(
                `
                UPDATE users
                SET
                    progression = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE
                    progression IS NULL
                    OR progression < 0
                    OR progression > 100
                RETURNING id
                `,
                [
                    DEFAULT_USER_PROGRESSION
                ]
            );

        console.log(
            `[PROGRESSION] ${result.rowCount} utilisateur(s) initialisé(s) à 50%.`
        );

    } catch (error) {

        console.error(
            "[PROGRESSION] Erreur :",
            error
        );
    }
}

/* ============================================================
   RACINE
============================================================ */

app.get(
    "/",
    (req, res) => {

        res.json({

            success: true,

            name:
                "BMJ SERVICE BACKEND",

            version:
                "23.0.0",

            status:
                "online",

            database:
                "PostgreSQL",

            progression: {

                initial:
                    "50%",

                completed:
                    "100%",

                admin: [
                    "En cours",
                    "Terminé"
                ]
            },

            message:
                "BMJ SERVICE API active"
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

            await pool.query(
                "SELECT 1"
            );

            res.json({

                success: true,

                status:
                    "healthy",

                database:
                    "connected",

                timestamp:
                    new Date()
                        .toISOString()
            });

        } catch (error) {

            res.status(503).json({

                success: false,

                status:
                    "unhealthy",

                database:
                    "disconnected",

                error:
                    error.message
            });
        }
    }
);

/* ============================================================
   TEST DB
============================================================ */

app.get(
    "/api/test-db",
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER
                        AS total
                    FROM users
                    `
                );

            res.json({

                success: true,

                database:
                    "connected",

                users:
                    result.rows[0].total
            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    "Erreur PostgreSQL",

                error:
                    error.message
            });
        }
    }
);

/* ============================================================
   LISTE API
============================================================ */

app.get(
    "/api",
    (req, res) => {

        res.json({

            success: true,

            name:
                "BMJ SERVICE API",

            version:
                "23.0.0",

            routes: [

                "GET /",
                "GET /api",
                "GET /api/health",
                "GET /api/test-db",

                "POST /api/admin/login",
                "GET /api/admin/session",
                "DELETE /api/admin/login",

                "GET /api/admin/statistiques",
                "GET /api/admin/statistiques/test",

                "GET /api/admin/users",
                "GET /api/admin/users/:id",

                "PATCH /api/admin/users/:id",
                "PATCH /api/admin/users/:id/password",

                "PATCH /api/admin/users/:id/block",
                "PATCH /api/admin/users/:id/unblock",

                "PATCH /api/admin/users/:id/premium",
                "PATCH /api/admin/users/:id/premium/remove",

                "PATCH /api/admin/users/:id/progression",
                "PATCH /api/admin/users/:id/progression/domaine",

                "PATCH /api/admin/users/:id/certificat",
                "PATCH /api/admin/users/:id/certificat-obtenu",

                "POST /api/admin/certificates",
                "GET /api/admin/users/:id/certificates",

                "GET /api/admin/users/:id/messages",
                "GET /api/admin/users/:id/notifications",
                "GET /api/admin/users/:id/activity",

                "POST /api/admin/messages/user",
                "POST /api/admin/messages/all",
                "POST /api/admin/messages/premium",
                "POST /api/admin/messages/standard",
                "POST /api/admin/messages/:id/reply",

                "GET /api/admin/demandes-paiement",

                "PATCH /api/demandes-paiement/:id/valider",
                "PATCH /api/demandes-paiement/:id/refuser",

                "GET /api/admin/activities",

                "POST /api/inscription",
                "POST /api/register",

                "POST /api/connexion",
                "POST /api/login",

                "GET /api/users/:id",
                "GET /api/users/:id/progression",

                "GET /api/users/:id/messages",

                "PATCH /api/users/:userId/messages/:messageId/read",

                "GET /api/users/:id/certificates",
                "GET /api/users/:id/certificate-access",

                "GET /api/users/:id/premium-verification",
                "POST /api/users/:id/premium-verification",

                "GET /api/demandes-paiement",
                "POST /api/demandes-paiement"
            ]
        });
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
                clean(
                    req.body?.email
                ).toLowerCase();

            const password =
                String(
                    req.body?.password ||
                    ""
                );

            if (
                email !==
                ADMIN_EMAIL.toLowerCase() ||
                password !==
                ADMIN_PASSWORD
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
                        .toISOString()
                }
            );

            await safeLogAdminAction(
                "CONNEXION_ADMIN",
                "Connexion administrateur"
            );

            res.json({

                success: true,

                message:
                    "Connexion administrateur réussie",

                token,

                admin: {

                    email:
                        ADMIN_EMAIL
                }
            });

        } catch (error) {

            console.error(
                "Erreur login admin:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur connexion administrateur"
            });
        }
    }
);

/* ============================================================
   SESSION ADMIN
============================================================ */

app.get(
    "/api/admin/session",
    adminAuth,
    (req, res) => {

        res.json({

            success: true,

            authenticated:
                true,

            admin:
                req.admin
        });
    }
);

/* ============================================================
   LOGOUT ADMIN
============================================================ */

app.delete(
    "/api/admin/login",
    adminAuth,
    async (req, res) => {

        const token =
            req.adminToken;

        adminTokens.delete(
            tokenHash(token)
        );

        await safeLogAdminAction(
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
   STATISTIQUES ADMIN
============================================================ */

app.get(
    "/api/admin/statistiques",
    adminAuth,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT

                        (
                            SELECT COUNT(*)
                            FROM users
                        )::INTEGER
                        AS users,

                        (
                            SELECT COUNT(*)
                            FROM users
                            WHERE
                                COALESCE(
                                    is_premium,
                                    FALSE
                                ) = TRUE
                        )::INTEGER
                        AS premium,

                        (
                            SELECT COUNT(*)
                            FROM users
                            WHERE
                                COALESCE(
                                    is_premium,
                                    FALSE
                                ) = FALSE
                        )::INTEGER
                        AS standard,

                        (
                            SELECT COUNT(*)
                            FROM users
                            WHERE
                                COALESCE(
                                    is_blocked,
                                    FALSE
                                ) = TRUE
                        )::INTEGER
                        AS blocked,

                        (
                            SELECT COUNT(*)
                            FROM users
                            WHERE
                                created_at::date =
                                CURRENT_DATE
                        )::INTEGER
                        AS today,

                        (
                            SELECT COUNT(*)
                            FROM demandes_paiement
                            WHERE
                                LOWER(
                                    COALESCE(
                                        statut,
                                        ''
                                    )
                                ) = 'pending'
                        )::INTEGER
                        AS pending,

                        (
                            SELECT COUNT(*)
                            FROM demandes_paiement
                            WHERE
                                LOWER(
                                    COALESCE(
                                        statut,
                                        ''
                                    )
                                ) IN (
                                    'valide',
                                    'validé',
                                    'validated'
                                )
                        )::INTEGER
                        AS validated,

                        (
                            SELECT COUNT(*)
                            FROM demandes_paiement
                            WHERE
                                LOWER(
                                    COALESCE(
                                        statut,
                                        ''
                                    )
                                ) IN (
                                    'refuse',
                                    'refusé',
                                    'refused'
                                )
                        )::INTEGER
                        AS refused,

                        (
                            SELECT COALESCE(
                                SUM(montant),
                                0
                            )
                            FROM demandes_paiement
                            WHERE
                                LOWER(
                                    COALESCE(
                                        statut,
                                        ''
                                    )
                                ) IN (
                                    'valide',
                                    'validé',
                                    'validated'
                                )
                        )::NUMERIC
                        AS revenue,

                        (
                            SELECT COUNT(*)
                            FROM demandes_paiement
                        )::INTEGER
                        AS totalPayments,

                        (
                            SELECT COUNT(*)
                            FROM messages
                        )::INTEGER
                        AS messages,

                        (
                            SELECT COUNT(*)
                            FROM certificates
                        )::INTEGER
                        AS certificates,

                        (
                            SELECT COUNT(*)
                            FROM certificates
                            WHERE
                                COALESCE(
                                    is_authorized,
                                    FALSE
                                ) = TRUE
                        )::INTEGER
                        AS authorizedCertificates
                    `
                );

            const row =
                result.rows[0];

            const stats = {

                users:
                    safeNumber(
                        row.users
                    ),

                premium:
                    safeNumber(
                        row.premium
                    ),

                standard:
                    safeNumber(
                        row.standard
                    ),

                blocked:
                    safeNumber(
                        row.blocked
                    ),

                today:
                    safeNumber(
                        row.today
                    ),

                payments:
                    safeNumber(
                        row.totalpayments
                    ),

                totalPayments:
                    safeNumber(
                        row.totalpayments
                    ),

                pending:
                    safeNumber(
                        row.pending
                    ),

                validated:
                    safeNumber(
                        row.validated
                    ),

                refused:
                    safeNumber(
                        row.refused
                    ),

                revenue:
                    Number(
                        row.revenue || 0
                    ),

                messages:
                    safeNumber(
                        row.messages
                    ),

                certificates:
                    safeNumber(
                        row.certificates
                    ),

                certificates_authorized:
                    safeNumber(
                        row.authorizedcertificates
                    ),

                authorizedCertificates:
                    safeNumber(
                        row.authorizedcertificates
                    )
            };

            res.json({

                success: true,

                stats,

                statistiques:
                    stats,

                statistics:
                    stats,

                data:
                    stats,

                message:
                    "Statistiques récupérées avec succès",

                generated_at:
                    new Date()
                    .toISOString()
            });

        } catch (error) {

            console.error(
                "[STATISTIQUES]",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur récupération statistiques",

                error:
                    error.message
            });
        }
    }
);

/* ============================================================
   TEST STATISTIQUES
============================================================ */

app.get(
    "/api/admin/statistiques/test",
    adminAuth,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER
                        AS users
                    FROM users
                    `
                );

            res.json({

                success: true,

                users:
                    result.rows[0].users,

                message:
                    "Statistiques DB accessibles"
            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    "Erreur test statistiques",

                error:
                    error.message
            });
        }
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
                        last_login,
                        notes_admin
                    FROM users
                    ORDER BY id DESC
                    `
                );

            const users =
                result.rows.map(
                    adminUserProgression
                );

            res.json({

                success: true,

                count:
                    users.length,

                users,

                utilisateurs:
                    users,

                data:
                    users
            });

        } catch (error) {

            console.error(
                "Erreur liste utilisateurs:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur récupération utilisateurs",

                error:
                    error.message
            });
        }
    }
);

/* ============================================================
   DÉTAIL UTILISATEUR ADMIN
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

            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant utilisateur invalide"
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
                        progression,
                        is_premium,
                        is_blocked,
                        certificat_autorise,
                        certificat_obtenu,
                        premium_until,
                        created_at,
                        updated_at,
                        last_login,
                        notes_admin
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
                adminUserProgression(
                    result.rows[0]
                );

            res.json({

                success: true,

                user,

                utilisateur:
                    user
            });

        } catch (error) {

            console.error(
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur utilisateur",

                error:
                    error.message
            });
        }
    }
);

/* ============================================================
   MODIFIER UTILISATEUR ADMIN
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

            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant utilisateur invalide"
                });
            }

            const allowedFields = {

                nom:
                    "nom",

                sexe:
                    "sexe",

                telephone:
                    "telephone",

                domaine:
                    "domaine",

                pays:
                    "pays",

                ville:
                    "ville",

                niveau:
                    "niveau",

                photo:
                    "photo",

                notes_admin:
                    "notes_admin"
            };

            const updates = [];
            const values = [];

            let index = 1;

            for (
                const key
                of Object.keys(
                    allowedFields
                )
            ) {

                if (
                    req.body &&
                    Object.prototype.hasOwnProperty.call(
                        req.body,
                        key
                    )
                ) {

                    updates.push(
                        `${allowedFields[key]} = $${index}`
                    );

                    values.push(
                        clean(
                            req.body[key]
                        )
                    );

                    index++;
                }
            }

            if (
                updates.length === 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Aucune donnée à modifier"
                });
            }

            updates.push(
                `updated_at = CURRENT_TIMESTAMP`
            );

            values.push(id);

            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        ${updates.join(", ")}
                    WHERE id = $${index}
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
                        last_login,
                        notes_admin
                    `,
                    values
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
                adminUserProgression(
                    result.rows[0]
                );

            await safeLogAdminAction(
                "MODIFICATION_UTILISATEUR",
                `Utilisateur ${id}`
            );

            res.json({

                success: true,

                user,

                message:
                    "Utilisateur modifié avec succès"
            });

        } catch (error) {

            console.error(
                "Modification utilisateur:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur modification utilisateur",

                error:
                    error.message
            });
        }
    }
);

/* ============================================================
   MOT DE PASSE ADMIN
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
                    req.body?.password ||
                    ""
                );

            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant invalide"
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
                    UPDATE users
                    SET
                        password = $1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                    RETURNING id
                    `,
                    [
                        hashPassword(
                            password
                        ),
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

            await safeLogAdminAction(
                "MODIFICATION_MOT_DE_PASSE",
                `Utilisateur ${id}`
            );

            res.json({

                success: true,

                message:
                    "Mot de passe modifié"
            });

        } catch (error) {

            console.error(
                error
            );

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
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING *
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

            await safeLogAdminAction(
                "BLOCAGE_UTILISATEUR",
                `Utilisateur ${id}`
            );

            res.json({

                success: true,

                message:
                    "Utilisateur bloqué",

                user:
                    adminUserProgression(
                        result.rows[0]
                    )
            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    "Erreur blocage utilisateur",

                error:
                    error.message
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
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING *
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

            await safeLogAdminAction(
                "DEBLOCAGE_UTILISATEUR",
                `Utilisateur ${id}`
            );

            res.json({

                success: true,

                message:
                    "Utilisateur débloqué",

                user:
                    adminUserProgression(
                        result.rows[0]
                    )
            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    "Erreur déblocage utilisateur",

                error:
                    error.message
            });
        }
    }
);

/* ============================================================
   PREMIUM ADMIN
============================================================ */

app.patch(
    "/api/admin/users/:id/premium",
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

            const result =
                await client.query(
                    `
                    UPDATE users
                    SET
                        is_premium = TRUE,
                        progression = $1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                    RETURNING *
                    `,
                    [
                        COMPLETED_USER_PROGRESSION,
                        id
                    ]
                );

            if (
                result.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"
                });
            }

            await createNotification(
                client,
                id,
                "Compte Premium activé",
                "Votre compte Premium a été activé. La vérification Premium est terminée.",
                "premium"
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
                    'PREMIUM_ACTIVE',
                    'Compte Premium activé et vérification terminée'
                )
                `,
                [id]
            );

            await client.query(
                "COMMIT"
            );

            await safeLogAdminAction(
                "ACTIVATION_PREMIUM",
                `Utilisateur ${id} - progression terminée`
            );

            res.json({

                success: true,

                message:
                    "Premium activé et progression terminée",

                user:
                    adminUserProgression(
                        result.rows[0]
                    )
            });

        } catch (error) {

            try {
                await client.query(
                    "ROLLBACK"
                );
            } catch (_) {}

            console.error(
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur activation Premium",

                error:
                    error.message
            });

        } finally {

            client.release();
        }
    }
);

/* ============================================================
   RETIRER PREMIUM
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
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING *
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

            await safeLogAdminAction(
                "RETRAIT_PREMIUM",
                `Utilisateur ${id}`
            );

            res.json({

                success: true,

                message:
                    "Premium retiré",

                user:
                    adminUserProgression(
                        result.rows[0]
                    )
            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    "Erreur retrait Premium",

                error:
                    error.message
            });
        }
    }
);

/* ============================================================
   PROGRESSION ADMIN
   50 = EN COURS
   100 = TERMINÉ
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

            let progression =
                safeNumber(
                    req.body?.progression,
                    DEFAULT_USER_PROGRESSION
                );

            progression =
                clampProgress(
                    progression
                );

            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        progression = $1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                    RETURNING *
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

            await safeLogAdminAction(
                "MODIFICATION_PROGRESSION",
                `Utilisateur ${id} - ${adminProgressionStatus(progression)}`
            );

            const user =
                adminUserProgression(
                    result.rows[0]
                );

            /*
             * IMPORTANT :
             * l'admin reçoit le statut.
             */
            res.json({

                success: true,

                message:
                    "Progression mise à jour",

                progression_status:
                    adminProgressionStatus(
                        progression
                    ),

                status:
                    adminProgressionStatus(
                        progression
                    ),

                user
            });

        } catch (error) {

            console.error(
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur progression",

                error:
                    error.message
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
                    req.body?.domaine
                );

            let progression =
                clampProgress(
                    req.body?.progression
                );

            if (
                !Number.isInteger(
                    userId
                ) ||
                userId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant utilisateur invalide"
                });
            }

            if (!domaine) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le domaine est obligatoire"
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
                    INSERT INTO user_progress
                    (
                        user_id,
                        domaine,
                        progression,
                        statut,
                        updated_at
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        CURRENT_TIMESTAMP
                    )
                    ON CONFLICT (
                        user_id,
                        domaine
                    )
                    DO UPDATE SET
                        progression = EXCLUDED.progression,
                        statut = EXCLUDED.statut,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING *
                    `,
                    [
                        userId,
                        domaine,
                        progression,
                        progressionStatus(
                            progression
                        ) === "Terminé"
                            ? "termine"
                            : "en_cours"
                    ]
                );

            res.json({

                success: true,

                progress:
                    result.rows[0],

                progression_status:
                    progressionStatus(
                        progression
                    )
            });

        } catch (error) {

            console.error(
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur progression domaine",

                error:
                    error.message
            });
        }
    }
);

/* ============================================================
   CERTIFICAT ADMIN
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
                    req.body?.certificat_autorise
                );

            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        certificat_autorise = $1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                    RETURNING *
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

            await safeLogAdminAction(
                "CERTIFICAT_AUTORISATION",
                `Utilisateur ${id} - autorisé: ${autorise}`
            );

            res.json({

                success: true,

                message:
                    "Autorisation certificat mise à jour",

                user:
                    adminUserProgression(
                        result.rows[0]
                    )
            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    "Erreur certificat",

                error:
                    error.message
            });
        }
    }
);

/* ============================================================
   CERTIFICAT OBTENU
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

            const obtenu =
                booleanValue(
                    req.body?.certificat_obtenu
                );

            const result =
                await pool.query(
                    `
                    UPDATE users
                    SET
                        certificat_obtenu = $1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                    RETURNING *
                    `,
                    [
                        obtenu,
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

            await safeLogAdminAction(
                "CERTIFICAT_OBTENU",
                `Utilisateur ${id} - obtenu: ${obtenu}`
            );

            res.json({

                success: true,

                message:
                    "Statut certificat mis à jour",

                user:
                    adminUserProgression(
                        result.rows[0]
                    )
            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    "Erreur certificat obtenu",

                error:
                    error.message
            });
        }
    }
);

/* ============================================================
   CRÉER CERTIFICAT ADMIN
============================================================ */

app.post(
    "/api/admin/certificates",
    adminAuth,
    async (req, res) => {

        try {

            const userId =
                Number(
                    req.body?.user_id
                );

            const domaine =
                clean(
                    req.body?.domaine
                );

            const titre =
                clean(
                    req.body?.titre
                );

            const certificatUrl =
                clean(
                    req.body?.certificat_url
                );

            const code =
                clean(
                    req.body?.certificate_code
                );

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
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        TRUE
                    )
                    RETURNING *
                    `,
                    [
                        userId,
                        domaine,
                        titre,
                        certificatUrl,
                        code
                    ]
                );

            await safeLogAdminAction(
                "CREATION_CERTIFICAT",
                `Utilisateur ${userId}`
            );

            res.status(201).json({

                success: true,

                certificate:
                    result.rows[0],

                message:
                    "Certificat créé"
            });

        } catch (error) {

            console.error(
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur création certificat",

                error:
                    error.message
            });
        }
    }
);

/* ============================================================
   CERTIFICATS ADMIN
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

                count:
                    result.rows.length,

                certificates:
                    result.rows
            });

        } catch (error) {

            console.error(
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur certificats"
            });
        }
    }
);

/* ============================================================
   MESSAGE UTILISATEUR ADMIN
============================================================ */

app.post(
    "/api/admin/messages/user",
    adminAuth,
    async (req, res) => {

        let client = null;

        let transactionStarted =
            false;

        try {

            client =
                await pool.connect();

            const userId =
                Number(
                    req.body?.user_id
                );

            const {
                subject,
                message,
                priority
            } =
                normalizeAdminMessageData(
                    req.body
                );

            if (
                !Number.isInteger(userId) ||
                userId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant utilisateur invalide."
                });
            }

            if (!message) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le message est obligatoire."
                });
            }

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
                    `,
                    [userId]
                );

            if (
                userResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable."
                });
            }

            const user =
                userResult.rows[0];

            if (
                user.is_blocked === true
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Impossible d'envoyer un message à un utilisateur bloqué."
                });
            }

            await client.query(
                "BEGIN"
            );

            transactionStarted =
                true;

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
                        subject,
                        message,
                        priority
                    ]
                );

            await createNotification(
                client,
                userId,
                subject,
                message,
                priority
            );

            await client.query(
                "COMMIT"
            );

            transactionStarted =
                false;

            await safeLogAdminAction(
                "MESSAGE_UTILISATEUR",
                `Message envoyé à l'utilisateur ${userId}`
            );

            return res.status(201).json({

                success: true,

                message:
                    "Message envoyé avec succès.",

                messageData:
                    messageResult.rows[0]
            });

        } catch (error) {

            if (
                client &&
                transactionStarted
            ) {

                try {

                    await client.query(
                        "ROLLBACK"
                    );

                } catch (_) {}
            }

            console.error(
                "[BMJ MESSAGE USER]",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de l'envoi du message.",

                error:
                    error.message
            });

        } finally {

            if (client) {
                client.release();
            }
        }
    }
);

/* ============================================================
   MESSAGE AUDIENCE
============================================================ */

async function sendAdminMessageToAudience(
    req,
    res,
    audience
) {

    let client = null;

    let transactionStarted =
        false;

    try {

        client =
            await pool.connect();

        const {
            subject,
            message,
            priority
        } =
            normalizeAdminMessageData(
                req.body
            );

        if (!message) {

            return res.status(400).json({

                success: false,

                message:
                    "Le message est obligatoire."
            });
        }

        let usersResult;

        if (
            audience === "all"
        ) {

            usersResult =
                await client.query(
                    `
                    SELECT id
                    FROM users
                    WHERE
                        COALESCE(
                            is_blocked,
                            FALSE
                        ) = FALSE
                    ORDER BY id ASC
                    `
                );

        } else if (
            audience === "premium"
        ) {

            usersResult =
                await client.query(
                    `
                    SELECT id
                    FROM users
                    WHERE
                        COALESCE(
                            is_premium,
                            FALSE
                        ) = TRUE
                        AND COALESCE(
                            is_blocked,
                            FALSE
                        ) = FALSE
                    ORDER BY id ASC
                    `
                );

        } else if (
            audience === "standard"
        ) {

            usersResult =
                await client.query(
                    `
                    SELECT id
                    FROM users
                    WHERE
                        COALESCE(
                            is_premium,
                            FALSE
                        ) = FALSE
                        AND COALESCE(
                            is_blocked,
                            FALSE
                        ) = FALSE
                    ORDER BY id ASC
                    `
                );

        } else {

            return res.status(400).json({

                success: false,

                message:
                    "Audience invalide."
            });
        }

        const users =
            usersResult.rows;

        if (
            users.length === 0
        ) {

            return res.status(200).json({

                success: true,

                count: 0,

                audience,

                message:
                    "Aucun utilisateur disponible."
            });
        }

        await client.query(
            "BEGIN"
        );

        transactionStarted =
            true;

        let count = 0;

        for (
            const user
            of users
        ) {

            const userId =
                Number(
                    user.id
                );

            if (
                !Number.isInteger(userId) ||
                userId <= 0
            ) {
                continue;
            }

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
                    $2,
                    $3,
                    $4,
                    $5
                )
                `,
                [
                    userId,
                    audience,
                    subject,
                    message,
                    priority
                ]
            );

            await createNotification(
                client,
                userId,
                subject,
                message,
                priority
            );

            count++;
        }

        await client.query(
            "COMMIT"
        );

        transactionStarted =
            false;

        let action =
            "MESSAGE_GLOBAL";

        if (
            audience === "premium"
        ) {

            action =
                "MESSAGE_PREMIUM";

        } else if (
            audience === "standard"
        ) {

            action =
                "MESSAGE_STANDARD";
        }

        await safeLogAdminAction(
            action,
            `${count} utilisateurs`
        );

        return res.status(201).json({

            success: true,

            count,

            audience,

            message:
                `Message envoyé à ${count} utilisateur(s).`
        });

    } catch (error) {

        if (
            client &&
            transactionStarted
        ) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (_) {}
        }

        console.error(
            `[BMJ MESSAGE ${audience}]`,
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Erreur lors de l'envoi du message.",

            error:
                error.message
        });

    } finally {

        if (client) {
            client.release();
        }
    }
}

/* ============================================================
   MESSAGE TOUS
============================================================ */

app.post(
    "/api/admin/messages/all",
    adminAuth,
    async (req, res) => {

        return sendAdminMessageToAudience(
            req,
            res,
            "all"
        );
    }
);

/* ============================================================
   MESSAGE PREMIUM
============================================================ */

app.post(
    "/api/admin/messages/premium",
    adminAuth,
    async (req, res) => {

        return sendAdminMessageToAudience(
            req,
            res,
            "premium"
        );
    }
);

/* ============================================================
   MESSAGE STANDARD
============================================================ */

app.post(
    "/api/admin/messages/standard",
    adminAuth,
    async (req, res) => {

        return sendAdminMessageToAudience(
            req,
            res,
            "standard"
        );
    }
);

/* ============================================================
   CONVERSATION ADMIN
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
                    FROM messages
                    WHERE
                        recipient_user_id = $1

                        OR (
                            sender_type = 'user'
                            AND sender_id = $1
                        )

                        OR (
                            parent_id IN (
                                SELECT id
                                FROM messages
                                WHERE
                                    recipient_user_id = $1

                                    OR (
                                        sender_type = 'user'
                                        AND sender_id = $1
                                    )
                            )
                        )

                    ORDER BY id ASC
                    `,
                    [userId]
                );

            res.json({

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
                "Erreur messages admin:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur lors de la récupération des messages",

                error:
                    error.message
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

        let transactionStarted =
            false;

        try {

            const messageId =
                Number(
                    req.params.id
                );

            const message =
                normalizeMessageContent(
                    req.body?.message
                );

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

            if (!message) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Réponse vide"
                });
            }

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

            const original =
                originalResult.rows[0];

            let userId = null;

            if (
                original.sender_type === "user" &&
                original.sender_id
            ) {

                userId =
                    Number(
                        original.sender_id
                    );
            }

            if (
                !userId &&
                original.recipient_user_id
            ) {

                userId =
                    Number(
                        original.recipient_user_id
                    );
            }

            if (
                !userId &&
                original.parent_id
            ) {

                const parentResult =
                    await client.query(
                        `
                        SELECT
                            sender_id,
                            recipient_user_id
                        FROM messages
                        WHERE id = $1
                        `,
                        [
                            original.parent_id
                        ]
                    );

                const parent =
                    parentResult.rows[0];

                if (parent) {

                    if (
                        parent.sender_id
                    ) {

                        userId =
                            Number(
                                parent.sender_id
                            );
                    }

                    if (
                        !userId &&
                        parent.recipient_user_id
                    ) {

                        userId =
                            Number(
                                parent.recipient_user_id
                            );
                    }
                }
            }

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

            if (
                userResult.rows[0]
                    .is_blocked
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Impossible de répondre à un utilisateur bloqué"
                });
            }

            const subject =
                normalizeMessageSubject(
                    original.subject ||
                    "Réponse BMJ SERVICE"
                );

            await client.query(
                "BEGIN"
            );

            transactionStarted =
                true;

            const reply =
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
                        subject,
                        message,
                        messageId
                    ]
                );

            await createNotification(
                client,
                userId,
                subject,
                message,
                "normal"
            );

            await client.query(
                "COMMIT"
            );

            transactionStarted =
                false;

            await safeLogAdminAction(
                "REPONSE_MESSAGE",
                `Réponse ${messageId} envoyée à l'utilisateur ${userId}`
            );

            res.status(201).json({

                success: true,

                messageData:
                    reply.rows[0],

                message:
                    "Réponse envoyée avec succès"
            });

        } catch (error) {

            if (
                transactionStarted
            ) {

                try {
                    await client.query(
                        "ROLLBACK"
                    );
                } catch (_) {}
            }

            console.error(
                "Erreur réponse message:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur lors de l'envoi de la réponse",

                error:
                    error.message
            });

        } finally {

            client.release();
        }
    }
);

/* ============================================================
   NOTIFICATIONS ADMIN
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

            console.error(
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur notifications"
            });
        }
    }
);

/* ============================================================
   PAIEMENTS ADMIN
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

                count:
                    result.rows.length,

                demandes:
                    result.rows
            });

        } catch (error) {

            console.error(
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur récupération paiements",

                error:
                    error.message
            });
        }
    }
);

/* ============================================================
   PAIEMENTS COMPATIBILITÉ
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

            res.status(500).json({

                success: false,

                message:
                    "Erreur récupération paiements"
            });
        }
    }
);

/* ============================================================
   CRÉER PAIEMENT
============================================================ */

app.post(
    "/api/demandes-paiement",
    async (req, res) => {

        try {

            const userId =
                Number(
                    req.body?.user_id
                );

            const telephone =
                clean(
                    req.body?.telephone_paiement
                );

            const montant =
                Number(
                    req.body?.montant
                );

            const methode =
                clean(
                    req.body?.methode
                );

            const reference =
                clean(
                    req.body?.reference_paiement
                );

            const preuve =
                clean(
                    req.body?.preuve_paiement
                );

            if (
                !Number.isInteger(userId) ||
                userId <= 0 ||
                !Number.isFinite(montant) ||
                montant <= 0 ||
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
                        telephone,
                        montant,
                        methode,
                        reference,
                        preuve
                    ]
                );

            try {

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
                        userId,
                        "DEMANDE_PAIEMENT",
                        `Demande de ${montant}$ - ${methode}`
                    ]
                );

            } catch (activityError) {

                console.error(
                    "[PAIEMENT] Activité :",
                    activityError.message
                );
            }

            res.status(201).json({

                success: true,

                demande:
                    result.rows[0],

                message:
                    "Demande de paiement enregistrée"
            });

        } catch (error) {

            console.error(
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur création demande paiement",

                error:
                    error.message
            });
        }
    }
);

/* ============================================================
   VALIDER PAIEMENT
   PREMIUM + PROGRESSION 100%
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

            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant paiement invalide"
                });
            }

            await client.query(
                "BEGIN"
            );

            const payment =
                await client.query(
                    `
                    SELECT
                        id,
                        user_id,
                        montant,
                        statut
                    FROM demandes_paiement
                    WHERE id = $1
                    FOR UPDATE
                    `,
                    [id]
                );

            if (
                payment.rows.length === 0
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

            const row =
                payment.rows[0];

            const userId =
                Number(
                    row.user_id
                );

            await client.query(
                `
                UPDATE demandes_paiement
                SET
                    statut = 'valide',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                `,
                [id]
            );

            /*
             * IMPORTANT :
             *
             * Validation Premium terminée
             * => progression = 100%.
             */
            const userUpdate =
                await client.query(
                    `
                    UPDATE users
                    SET
                        is_premium = TRUE,
                        progression = $1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                    RETURNING *
                    `,
                    [
                        COMPLETED_USER_PROGRESSION,
                        userId
                    ]
                );

            await createNotification(
                client,
                userId,
                "Compte Premium activé",
                "Votre paiement a été validé. Votre compte est maintenant Premium et la vérification Premium est terminée.",
                "premium"
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
                    'Paiement validé - Premium activé - vérification terminée'
                )
                `,
                [userId]
            );

            await client.query(
                "COMMIT"
            );

            await safeLogAdminAction(
                "VALIDATION_PAIEMENT",
                `Demande ${id} - utilisateur ${userId} - progression 100%`
            );

            res.json({

                success: true,

                message:
                    "Demande validée, Premium activé et progression terminée",

                progression:
                    COMPLETED_USER_PROGRESSION,

                progression_status:
                    "Terminé",

                user:
                    userUpdate.rows[0]
                        ? adminUserProgression(
                            userUpdate.rows[0]
                        )
                        : null
            });

        } catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (_) {}

            console.error(
                "Erreur validation paiement:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur validation paiement",

                error:
                    error.message
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
                    req.body?.note
                );

            const result =
                await pool.query(
                    `
                    UPDATE demandes_paiement
                    SET
                        statut = 'refuse',
                        admin_note = $1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                    RETURNING
                        id,
                        user_id,
                        statut,
                        admin_note
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

            await safeLogAdminAction(
                "PAIEMENT_REFUSE",
                `Demande ${id}`
            );

            res.json({

                success: true,

                demande:
                    result.rows[0],

                message:
                    "Paiement refusé"
            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    "Erreur refus paiement",

                error:
                    error.message
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

                count:
                    result.rows.length,

                activities:
                    result.rows
            });

        } catch (error) {

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
   ACTION ADMIN EXPLICITE
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

            await safeLogAdminAction(
                "SUPPRESSION_UTILISATEUR",
                `Utilisateur ID ${id}`
            );

            res.json({

                success: true,

                message:
                    "Utilisateur supprimé définitivement"
            });

        } catch (error) {

            console.error(
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur suppression utilisateur",

                error:
                    error.message
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

        const nom =
            clean(
                req.body?.nom
            );

        const sexe =
            clean(
                req.body?.sexe
            );

        const email =
            clean(
                req.body?.email
            ).toLowerCase();

        const telephone =
            clean(
                req.body?.telephone
            );

        const domaine =
            clean(
                req.body?.domaine
            );

        const pays =
            clean(
                req.body?.pays
            );

        const ville =
            clean(
                req.body?.ville
            );

        const niveau =
            clean(
                req.body?.niveau
            );

        const password =
            String(
                req.body?.password ||
                ""
            );

        const photo =
            clean(
                req.body?.photo
            );

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

        if (
            password.length < 6
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Le mot de passe doit contenir au moins 6 caractères"
            });
        }

        const existing =
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
            existing.rows.length > 0
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Cette adresse email est déjà utilisée",

                code:
                    "EMAIL_EXISTS"
            });
        }

        const passwordHash =
            hashPassword(
                password
            );

        /*
         * NOUVEL UTILISATEUR
         *
         * Toujours 50%.
         */
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
                    50,
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
                    passwordHash,
                    photo
                ]
            );

        const user =
            result.rows[0];

        try {

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
                    'Création du compte - progression initiale 50%'
                )
                `,
                [user.id]
            );

        } catch (activityError) {

            console.error(
                "[INSCRIPTION] Activité :",
                activityError.message
            );
        }

        return res.status(201).json({

            success: true,

            message:
                "Inscription réussie",

            user:
                publicUser(
                    user
                ),

            progression:
                50,

            progression_status:
                "En cours"
        });

    } catch (error) {

        console.error(
            "[INSCRIPTION] ERREUR :",
            error
        );

        if (
            error.code === "23505"
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "Cette adresse email est déjà utilisée",

                code:
                    "EMAIL_EXISTS"
            });
        }

        return res.status(500).json({

            success: false,

            message:
                "Erreur lors de l'inscription",

            code:
                "REGISTRATION_ERROR",

            error:
                error.message
        });
    }
}

app.post(
    "/api/inscription",
    registerUser
);

app.post(
    "/api/register",
    registerUser
);

/* ============================================================
   CONNEXION
============================================================ */

async function loginUser(
    req,
    res
) {

    try {

        const email =
            clean(
                req.body?.email
            ).toLowerCase();

        const password =
            String(
                req.body?.password ||
                ""
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
            hashPassword(
                password
            )
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

        /*
         * Sécurité de compatibilité :
         * si un ancien utilisateur a une progression NULL,
         * on lui donne 50%.
         */
        if (
            user.progression === null ||
            user.progression === undefined
        ) {

            user.progression =
                DEFAULT_USER_PROGRESSION;

            await pool.query(
                `
                UPDATE users
                SET
                    progression = $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                `,
                [
                    DEFAULT_USER_PROGRESSION,
                    user.id
                ]
            );
        }

        await pool.query(
            `
            UPDATE users
            SET
                last_login = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            `,
            [user.id]
        );

        try {

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

        } catch (activityError) {

            console.error(
                "[LOGIN] Activité :",
                activityError.message
            );
        }

        delete user.password;

        res.json({

            success: true,

            message:
                "Connexion réussie",

            user:
                publicUser(
                    user
                ),

            progression_status:
                progressionStatus(
                    user.progression
                )
        });

    } catch (error) {

        console.error(
            "Erreur connexion:",
            error
        );

        res.status(500).json({

            success: false,

            message:
                "Erreur serveur",

            error:
                error.message
        });
    }
}

app.post(
    "/api/connexion",
    loginUser
);

app.post(
    "/api/login",
    loginUser
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

            const user =
                result.rows[0];

            res.json({

                success: true,

                user:
                    publicUser(
                        user
                    ),

                progression_status:
                    progressionStatus(
                        user.progression
                    )
            });

        } catch (error) {

            console.error(
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
   PROGRESSION UTILISATEUR
============================================================ */

app.get(
    "/api/users/:id/progression",
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
                        id,
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

            const user =
                userResult.rows[0];

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

                /*
                 * La valeur technique reste disponible
                 * pour l'application utilisateur.
                 */
                progression:
                    user.progression,

                progress_status:
                    progressionStatus(
                        user.progression
                    ),

                /*
                 * Compatibilité avec l'ancien frontend.
                 */
                progress:
                    result.rows
            });

        } catch (error) {

            console.error(
                error
            );

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
                    WHERE recipient_user_id = $1
                    ORDER BY id DESC
                    `,
                    [userId]
                );

            res.json({

                success: true,

                count:
                    result.rows.length,

                messages:
                    result.rows
            });

        } catch (error) {

            console.error(
                error
            );

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
                        updated_at = CURRENT_TIMESTAMP
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

            console.error(
                error
            );

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
                        progression,
                        is_premium
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

            const user =
                userResult.rows[0];

            res.json({

                success: true,

                authorization: {

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

                    progression_status:
                        progressionStatus(
                            user.progression
                        ),

                    is_premium:
                        Boolean(
                            user.is_premium
                        )
                },

                certificates:
                    result.rows
            });

        } catch (error) {

            console.error(
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur certificats"
            });
        }
    }
);

/* ============================================================
   ACCÈS CERTIFICAT
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

                progression_status:
                    progressionStatus(
                        user.progression
                    ),

                is_premium:
                    Boolean(
                        user.is_premium
                    )
            });

        } catch (error) {

            console.error(
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Erreur vérification certificat"
            });
        }
    }
);

/* ============================================================
   VÉRIFICATION PREMIUM
============================================================ */

/*
 * IMPORTANT
 *
 * La vérification Premium possède sa propre progression.
 *
 * Progression générale :
 *
 *     users.progression
 *
 * Progression vérification Premium :
 *
 *     users.premium_verification_progression
 *
 *
 * Règles :
 *
 * NON PREMIUM :
 *
 *     premium_verification_progression = 50
 *     premium_verification_completed = false
 *
 *
 * PREMIUM :
 *
 *     premium_verification_progression = 100
 *     premium_verification_completed = true
 *
 *
 * La progression générale de l'utilisateur
 * N'EST PAS MODIFIÉE par ces routes.
 *
 *
 * ADMIN :
 *
 *     50  -> En cours
 *     100 -> Terminé
============================================================ */


/* ============================================================
   GET
   /api/users/:id/premium-verification

   Vérifie l'état actuel de la vérification Premium.

   IMPORTANT :
   Cette route ne modifie pas la progression générale.
============================================================ */

app.get(
    "/api/users/:id/premium-verification",
    async (req, res) => {

        let client = null;

        try {

            const userId =
                Number(
                    req.params.id
                );


            /* =================================================
               VALIDATION ID
            ================================================= */

            if (
                !Number.isInteger(userId) ||
                userId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant utilisateur invalide."

                });

            }


            client =
                await pool.connect();


            /* =================================================
               RECUPERER UTILISATEUR
            ================================================= */

            const result =
                await client.query(
                    `
                    SELECT
                        id,
                        nom,
                        email,
                        is_premium,
                        is_blocked,
                        progression,
                        premium_until,
                        premium_verification_progression,
                        premium_verification_completed,
                        updated_at

                    FROM users

                    WHERE id = $1

                    LIMIT 1
                    `,
                    [
                        userId
                    ]
                );


            /* =================================================
               UTILISATEUR INTROUVABLE
            ================================================= */

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


            /* =================================================
               STATUT PREMIUM
            ================================================= */

            const isPremium =
                user.is_premium === true ||
                user.is_premium === "true" ||
                user.is_premium === 1 ||
                user.is_premium === "1";


            /* =================================================
               PROGRESSION PREMIUM
            ================================================= */

            let premiumProgress =
                Number(
                    user.premium_verification_progression
                );


            if (
                !Number.isFinite(
                    premiumProgress
                )
            ) {

                premiumProgress =
                    isPremium
                        ? 100
                        : 50;

            }


            premiumProgress =
                Math.max(
                    0,
                    Math.min(
                        100,
                        premiumProgress
                    )
                );


            /* =================================================
               COMPLETION
            ================================================= */

            let completed =
                booleanValue(
                    user.premium_verification_completed
                );


            /*
             * Si Premium est déjà actif et que la progression
             * n'est pas encore à 100, on finalise la vérification.
             *
             * Cela permet également de réparer les anciens
             * comptes Premium.
             */

            if (
                isPremium &&
                (
                    premiumProgress < 100 ||
                    !completed
                )
            ) {

                const updateResult =
                    await client.query(
                        `
                        UPDATE users

                        SET

                            premium_verification_progression = 100,

                            premium_verification_completed = TRUE,

                            updated_at =
                                CURRENT_TIMESTAMP

                        WHERE id = $1

                        RETURNING
                            premium_verification_progression,
                            premium_verification_completed,
                            updated_at
                        `,
                        [
                            userId
                        ]
                    );


                if (
                    updateResult.rows.length > 0
                ) {

                    premiumProgress =
                        Number(
                            updateResult
                                .rows[0]
                                .premium_verification_progression
                        );


                    completed =
                        Boolean(
                            updateResult
                                .rows[0]
                                .premium_verification_completed
                        );

                }

            }


            /* =================================================
               STATUT FINAL
            ================================================= */

            const premiumStatus =
                completed &&
                premiumProgress >= 100

                    ? "Terminé"

                    : "En cours";


            /* =================================================
               REPONSE
            ================================================= */

            return res.json({

                success: true,

                verified:
                    completed &&
                    premiumProgress >= 100,

                premium:
                    isPremium,

                /*
                 * IMPORTANT :
                 *
                 * Ceci reste la progression générale.
                 *
                 * Elle n'est jamais modifiée ici.
                 */
                progression:
                    Number(
                        user.progression
                    ) || 50,

                progression_status:
                    progressionStatus(
                        user.progression
                    ),

                /*
                 * Progression spécifique Premium.
                 */
                premium_verification_progression:
                    premiumProgress,

                premium_progression:
                    premiumProgress,

                progression_premium:
                    premiumProgress,

                premium_verification_completed:
                    completed,

                verification_premium_terminee:
                    completed,

                premium_verification_status:
                    premiumStatus,

                premium_verification: {

                    progression:
                        premiumProgress,

                    completed:
                        completed,

                    status:
                        premiumStatus

                },

                premium_until:
                    user.premium_until,

                message:

                    premiumStatus === "Terminé"

                        ? "Vérification Premium terminée."

                        : "Vérification Premium en cours."

            });


        } catch (error) {

            console.error(
                "[PREMIUM VERIFICATION GET]",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de la vérification Premium.",

                error:
                    error.message

            });


        } finally {

            if (client) {

                client.release();

            }

        }

    }
);


/* ============================================================
   POST
   /api/users/:id/premium-verification

   FINALISATION DE LA VERIFICATION PREMIUM

   Cette route est appelée lorsque la page de vérification
   Premium doit terminer le processus.

   Elle vérifie d'abord que le compte est Premium.

   Si oui :

       premium_verification_progression = 100
       premium_verification_completed = true

   Sinon :

       aucune modification.
============================================================ */

app.post(
    "/api/users/:id/premium-verification",
    async (req, res) => {

        let client = null;

        let transactionStarted =
            false;


        try {

            const userId =
                Number(
                    req.params.id
                );


            /* =================================================
               VALIDATION ID
            ================================================= */

            if (
                !Number.isInteger(userId) ||
                userId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant utilisateur invalide."

                });

            }


            client =
                await pool.connect();


            /* =================================================
               TRANSACTION
            ================================================= */

            await client.query(
                "BEGIN"
            );

            transactionStarted =
                true;


            /* =================================================
               VERROUILLER LE COMPTE
            ================================================= */

            const result =
                await client.query(
                    `
                    SELECT
                        id,
                        nom,
                        email,
                        is_premium,
                        is_blocked,
                        progression,
                        premium_until,
                        premium_verification_progression,
                        premium_verification_completed

                    FROM users

                    WHERE id = $1

                    FOR UPDATE
                    `,
                    [
                        userId
                    ]
                );


            /* =================================================
               UTILISATEUR INTROUVABLE
            ================================================= */

            if (
                result.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );

                transactionStarted =
                    false;


                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable."

                });

            }


            const user =
                result.rows[0];


            /* =================================================
               COMPTE BLOQUE
            ================================================= */

            if (
                booleanValue(
                    user.is_blocked
                )
            ) {

                await client.query(
                    "ROLLBACK"
                );

                transactionStarted =
                    false;


                return res.status(403).json({

                    success: false,

                    message:
                        "Ce compte est bloqué."

                });

            }


            /* =================================================
               VERIFICATION PREMIUM
            ================================================= */

            const isPremium =
                user.is_premium === true ||
                user.is_premium === "true" ||
                user.is_premium === 1 ||
                user.is_premium === "1";


            /* =================================================
               PAS PREMIUM
            ================================================= */

            if (!isPremium) {

                await client.query(
                    "ROLLBACK"
                );

                transactionStarted =
                    false;


                const currentProgress =
                    Number(
                        user.premium_verification_progression
                    );


                const safeProgress =
                    Number.isFinite(
                        currentProgress
                    )

                        ? Math.max(
                            0,
                            Math.min(
                                100,
                                currentProgress
                            )
                        )

                        : 50;


                return res.json({

                    success: true,

                    verified:
                        false,

                    premium:
                        false,

                    /*
                     * Progression générale intacte.
                     */
                    progression:
                        Number(
                            user.progression
                        ) || 50,

                    progression_status:
                        progressionStatus(
                            user.progression
                        ),

                    /*
                     * Progression Premium.
                     */
                    premium_verification_progression:
                        safeProgress,

                    premium_progression:
                        safeProgress,

                    progression_premium:
                        safeProgress,

                    premium_verification_completed:
                        false,

                    verification_premium_terminee:
                        false,

                    premium_verification_status:
                        "En cours",

                    premium_verification: {

                        progression:
                            safeProgress,

                        completed:
                            false,

                        status:
                            "En cours"

                    },

                    message:
                        "Le compte Premium n'est pas encore actif."

                });

            }


            /* =================================================
               TERMINER LA PROGRESSION PREMIUM
            ================================================= */

            const updateResult =
                await client.query(
                    `
                    UPDATE users

                    SET

                        premium_verification_progression = 100,

                        premium_verification_completed = TRUE,

                        updated_at =
                            CURRENT_TIMESTAMP

                    WHERE id = $1

                    RETURNING

                        id,
                        nom,
                        email,
                        is_premium,
                        progression,
                        premium_verification_progression,
                        premium_verification_completed,
                        premium_until,
                        updated_at
                    `,
                    [
                        userId
                    ]
                );


            if (
                updateResult.rows.length === 0
            ) {

                throw new Error(
                    "Impossible de mettre à jour la vérification Premium."
                );

            }


            const updatedUser =
                updateResult.rows[0];


            /* =================================================
               ACTIVITE UTILISATEUR

               Si cette insertion échoue, elle ne doit pas
               empêcher la validation Premium.
            ================================================= */

            try {

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
                        $2,
                        $3
                    )
                    `,
                    [
                        userId,

                        "VERIFICATION_PREMIUM",

                        "Vérification Premium terminée - progression Premium 100%"
                    ]
                );

            } catch (activityError) {

                console.error(
                    "[PREMIUM VERIFICATION] " +
                    "Activité non enregistrée :",
                    activityError.message
                );

            }


            /* =================================================
               NOTIFICATION

               Elle ne doit pas faire échouer la validation
               principale si la table notification rencontre
               un problème.
            ================================================= */

            try {

                await createNotification(
                    client,
                    userId,
                    "Vérification Premium terminée",
                    "Votre vérification Premium est terminée. Votre accès Premium est confirmé.",
                    "success"
                );

            } catch (notificationError) {

                console.error(
                    "[PREMIUM VERIFICATION] " +
                    "Notification non enregistrée :",
                    notificationError.message
                );

            }


            /* =================================================
               COMMIT
            ================================================= */

            await client.query(
                "COMMIT"
            );

            transactionStarted =
                false;


            /* =================================================
               REPONSE FINALE
            ================================================= */

            return res.json({

                success: true,

                verified:
                    true,

                premium:
                    true,

                /*
                 * Progression générale :
                 * elle reste celle enregistrée avant.
                 */
                progression:
                    Number(
                        updatedUser.progression
                    ) || 50,

                progression_status:
                    progressionStatus(
                        updatedUser.progression
                    ),

                /*
                 * Progression spécifique Premium :
                 */
                premium_verification_progression:
                    100,

                premium_progression:
                    100,

                progression_premium:
                    100,

                premium_verification_completed:
                    true,

                verification_premium_terminee:
                    true,

                premium_verification_status:
                    "Terminé",

                premium_verification: {

                    progression:
                        100,

                    completed:
                        true,

                    status:
                        "Terminé"

                },

                premium_until:
                    updatedUser.premium_until,

                user:
                    publicUser(
                        updatedUser
                    ),

                message:
                    "Vérification Premium terminée avec succès."

            });


        } catch (error) {


            /* =================================================
               ROLLBACK
            ================================================= */

            if (
                transactionStarted
            ) {

                try {

                    await client.query(
                        "ROLLBACK"
                    );

                } catch (rollbackError) {

                    console.error(
                        "[PREMIUM VERIFICATION] " +
                        "Erreur rollback :",
                        rollbackError.message
                    );

                }

            }


            console.error(
                "[PREMIUM VERIFICATION POST]",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de la vérification Premium.",

                error:
                    error.message

            });


        } finally {

            if (client) {

                client.release();

            }

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
   ERREUR GLOBALE
============================================================ */

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "Erreur globale:",
            error
        );


        if (
            res.headersSent
        ) {

            return next(
                error
            );

        }


        res.status(500).json({

            success: false,

            message:
                "Erreur interne du serveur",

            error:
                error.message

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


        process.exit(
            0
        );


    } catch (error) {

        console.error(
            "Erreur arrêt serveur:",
            error
        );


        process.exit(
            1
        );

    }

}


process.on(
    "SIGTERM",
    () =>
        gracefulShutdown(
            "SIGTERM"
        )
);


process.on(
    "SIGINT",
    () =>
        gracefulShutdown(
            "SIGINT"
        )
);


/* ============================================================
   DÉMARRAGE
============================================================ */

async function startServer() {

    await initDatabase();

    await initializeUsersProgression();

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
                " Statistiques : activées"
            );

            console.log(
                " Utilisateurs : activés"
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
                " Progression initiale : 50%"
            );

            console.log(
                " Vérification Premium : 100%"
            );

            console.log(
                " Admin : En cours / Terminé"
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
                "Impossible de démarrer le serveur:",
                error
            );

            process.exit(1);
        }
    );