"use strict";

/* ============================================================
   BMJ SERVICE — BACKEND
   Node.js + Express + PostgreSQL

   VERSION ORGANISÉE ET CORRIGÉE

   IMPORTANT :
   ------------------------------------------------------------
   - Aucune suppression automatique de données
   - Aucun DROP
   - Aucun TRUNCATE
   - Aucun DELETE automatique
   - Messages existants conservés
   - Ancienne table "messages" conservée
   - Nouvelle table "sms_messages" indépendante
   - Notifications conservées
   - Progression aléatoire toutes les 24 heures
   - 100 % permanent
   - celestine@gmail.com = 100 %
   - Nouveau système SMS indépendant
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
    Number(process.env.PORT) || 10000;


/*
 * DATABASE_URL DOIT ÊTRE CONFIGURÉE DANS RENDER.
 *
 * Exemple de variable Render :
 *
 * DATABASE_URL=postgresql://...
 *
 * Ne pas mettre le mot de passe PostgreSQL
 * directement dans GitHub.
 */

const DATABASE_URL =
    process.env.DATABASE_URL || "postgresql://name_bmj_db_user:TjgoLRbYV0LizRgBFD1nepGqSqErgBgD@dpg-dagn0e15efls73b8rjh0-a/name_bmj_db";


const ADMIN_EMAIL =
    process.env.ADMIN_EMAIL ||
    "admin@bmjservice.com";


const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD ||
    "admin123";


/* ============================================================
   PROGRESSION
============================================================ */

const EMAIL_UTILISATEUR_100 =
    "celestine@gmail.com";


const PROGRESSION_INTERVALLE =
    24 * 60 * 60 * 1000;


/* ============================================================
   POSTGRESQL
============================================================ */

if (!DATABASE_URL) {

    console.warn(
        "[DATABASE] ATTENTION : DATABASE_URL n'est pas configurée."
    );
}


const pool =
    new Pool({

        connectionString:
            DATABASE_URL || undefined,

        ssl:
            DATABASE_URL
                ? {
                    rejectUnauthorized: false
                }
                : false,

        max: 10,

        idleTimeoutMillis:
            30000,

        connectionTimeoutMillis:
            10000
    });


pool.on(
    "error",
    (error) => {

        console.error(
            "[DATABASE POOL] ERREUR :",
            error.message
        );
    }
);


/* ============================================================
   EXPRESS
============================================================ */

app.use(
    cors({
        origin: true,
        credentials: false
    })
);


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

        console.log(
            `[BMJ API] ${req.method} ${req.originalUrl}`
        );

        next();
    }
);


/* ============================================================
   OUTILS GÉNÉRAUX
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


/* ------------------------------------------------------------
   Nombre sécurisé
------------------------------------------------------------ */

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


/* ------------------------------------------------------------
   Progression normalisée
------------------------------------------------------------ */

function normalizeProgression(
    value
) {

    let progression =
        Number(value);


    if (
        !Number.isFinite(progression)
    ) {

        progression = 0;
    }


    progression =
        Math.round(progression);


    return Math.max(
        0,
        Math.min(
            100,
            progression
        )
    );
}


/* ------------------------------------------------------------
   Alias progression
------------------------------------------------------------ */

function clampProgress(
    value
) {

    return normalizeProgression(
        value
    );
}


/* ------------------------------------------------------------
   Progression aléatoire
 *
 * 10 → 99
 *
 * 100 n'est jamais généré automatiquement.
------------------------------------------------------------ */

function randomProgression() {

    return (
        Math.floor(
            Math.random() * 90
        ) + 10
    );
}


/* ------------------------------------------------------------
   Vérifier Celestine
------------------------------------------------------------ */

function isCelestine(
    email
) {

    return (
        clean(email)
            .toLowerCase() ===
        EMAIL_UTILISATEUR_100
            .trim()
            .toLowerCase()
    );
}


/* ------------------------------------------------------------
   Valeur booléenne
------------------------------------------------------------ */

function booleanValue(
    value
) {

    return (
        value === true ||
        value === "true" ||
        value === 1 ||
        value === "1"
    );
}


/* ------------------------------------------------------------
   Email
------------------------------------------------------------ */

function isValidEmail(
    email
) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(
            clean(email)
        );
}


/* ------------------------------------------------------------
   Hash mot de passe
------------------------------------------------------------ */

function hashPassword(
    password
) {

    return crypto
        .createHash("sha256")
        .update(
            String(password)
        )
        .digest("hex");
}


/* ------------------------------------------------------------
   Token administrateur
------------------------------------------------------------ */

function createToken() {

    return crypto
        .randomBytes(48)
        .toString("hex");
}


/* ------------------------------------------------------------
   Hash token
------------------------------------------------------------ */

function tokenHash(
    token
) {

    return crypto
        .createHash("sha256")
        .update(
            String(token)
        )
        .digest("hex");
}


/* ------------------------------------------------------------
   Utilisateur public
------------------------------------------------------------ */

function publicUser(
    user
) {

    if (!user) {

        return null;
    }


    const copy = {
        ...user
    };


    delete copy.password;


    return copy;
}


/* ============================================================
   NORMALISATION DES MESSAGES
============================================================ */

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


/* ------------------------------------------------------------
   Audience ancienne messagerie
------------------------------------------------------------ */

function normalizeMessageAudience(
    audience
) {

    const allowed = [

        "user",

        "all",

        "premium",

        "standard"

    ];


    const value =
        clean(audience)
            .toLowerCase();


    return allowed.includes(value)
        ? value
        : "";
}


/* ------------------------------------------------------------
   Sujet
------------------------------------------------------------ */

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


/* ------------------------------------------------------------
   Contenu
------------------------------------------------------------ */

function normalizeMessageContent(
    message
) {

    return clean(message);
}


/* ------------------------------------------------------------
   Données ancienne messagerie
------------------------------------------------------------ */

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
            ),

        audience:
            normalizeMessageAudience(
                body.audience
            )
    };
}


/* ============================================================
   NOUVEAU SYSTÈME SMS
============================================================ */

/* ------------------------------------------------------------
   Priorité SMS
------------------------------------------------------------ */

function normalizeSmsPriority(
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


/* ------------------------------------------------------------
   Audience SMS
------------------------------------------------------------ */

function normalizeSmsAudience(
    audience
) {

    const allowed = [

        "user",

        "all",

        "premium",

        "standard"

    ];


    const value =
        clean(audience)
            .toLowerCase();


    return allowed.includes(value)
        ? value
        : "user";
}


/* ------------------------------------------------------------
   Sujet SMS
------------------------------------------------------------ */

function normalizeSmsSubject(
    subject
) {

    const value =
        clean(subject);


    if (!value) {

        return "BMJ SERVICE";
    }


    return value.substring(
        0,
        200
    );
}


/* ------------------------------------------------------------
   Message SMS
------------------------------------------------------------ */

function normalizeSmsMessage(
    message
) {

    const value =
        clean(message);


    if (value.length > 10000) {

        return value.substring(
            0,
            10000
        );
    }


    return value;
}


/* ------------------------------------------------------------
   Extraction ID utilisateur SMS
------------------------------------------------------------ */

function getSmsUserId(
    body = {}
) {

    const possibleValues = [

        body.user_id,

        body.userId,

        body.recipient_user_id,

        body.recipientUserId,

        body.id_user,

        body.idUser

    ];


    for (
        const value
        of possibleValues
    ) {

        if (
            value !== undefined &&
            value !== null &&
            value !== ""
        ) {

            const id =
                Number(value);


            if (
                Number.isInteger(id) &&
                id > 0
            ) {

                return id;
            }
        }
    }


    return null;
}


/* ------------------------------------------------------------
   Données SMS
------------------------------------------------------------ */

function normalizeSmsData(
    body = {}
) {

    return {

        subject:
            normalizeSmsSubject(
                body.subject
            ),

        message:
            normalizeSmsMessage(
                body.message
            ),

        priority:
            normalizeSmsPriority(
                body.priority
            ),

        audience:
            normalizeSmsAudience(
                body.audience
            ),

        parentId:
            Number.isInteger(
                Number(body.parent_id)
            )
                ? Number(body.parent_id)
                : null
    };
}


/* ============================================================
   ADMIN TOKENS
============================================================ */

const adminTokens =
    new Map();


/* ------------------------------------------------------------
   Récupérer token
------------------------------------------------------------ */

function getAdminToken(
    req
) {

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
        req.headers["x-admin-token"];


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


/* ------------------------------------------------------------
   Authentification admin
------------------------------------------------------------ */

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

        return res.status(401).json({

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
    details
) {

    try {

        await pool.query(
            `
            INSERT INTO admin_activity
            (
                action,
                admin_email,
                details,
                created_at
            )
            VALUES
            (
                $1,
                $2,
                $3,
                CURRENT_TIMESTAMP
            )
            `,
            [

                clean(action),

                ADMIN_EMAIL,

                clean(details)

            ]
        );


        return true;

    } catch (error) {

        console.error(
            "[ADMIN LOG] ERREUR :",
            error.message
        );


        return false;
    }
}


async function safeLogAdminAction(
    action,
    description
) {

    try {

        return await logAdminAction(
            action,
            description
        );

    } catch (error) {

        console.error(
            "[BMJ ADMIN LOG] ERREUR :",
            error.message
        );


        return false;
    }
}


/* ============================================================
   ACTIVITÉ UTILISATEUR
============================================================ */

async function logUserActivity(
    userId,
    action,
    details = ""
) {

    try {

        const id =
            Number(userId);


        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {

            return false;
        }


        await pool.query(
            `
            INSERT INTO user_activity
            (
                user_id,
                action,
                details,
                created_at
            )
            VALUES
            (
                $1,
                $2,
                $3,
                CURRENT_TIMESTAMP
            )
            `,
            [

                id,

                clean(action),

                clean(details)

            ]
        );


        return true;

    } catch (error) {

        console.error(
            "[USER ACTIVITY] ERREUR :",
            error.message
        );


        return false;
    }
}


/* ============================================================
   NOTIFICATIONS
============================================================ */

async function createNotification(
    clientOrPool,
    userId,
    title,
    message,
    type = "info"
) {

    try {

        const id =
            Number(userId);


        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {

            return false;
        }


        await clientOrPool.query(
            `
            INSERT INTO notifications
            (
                user_id,
                title,
                message,
                type,
                is_read,
                created_at
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                FALSE,
                CURRENT_TIMESTAMP
            )
            `,
            [

                id,

                clean(title),

                clean(message),

                clean(type) || "info"

            ]
        );


        return true;

    } catch (error) {

        console.error(
            "[BMJ NOTIFICATION] ERREUR :",
            error.message
        );


        return false;
    }
}


/* ============================================================
   INITIALISATION BASE DE DONNÉES
   100 % NON DESTRUCTIVE
============================================================ */

async function initDatabase() {

    if (!DATABASE_URL) {

        throw new Error(
            "DATABASE_URL n'est pas configurée."
        );
    }


    const client =
        await pool.connect();


    try {

        console.log(
            "[DATABASE] Initialisation PostgreSQL..."
        );


        /* ====================================================
           USERS
        ==================================================== */

        await client.query(
            `
            CREATE TABLE IF NOT EXISTS users
            (
                id SERIAL PRIMARY KEY,

                nom TEXT,

                sexe TEXT,

                email TEXT UNIQUE,

                telephone TEXT,

                domaine TEXT,

                pays TEXT,

                ville TEXT,

                niveau TEXT,

                password TEXT,

                photo TEXT,

                progression INTEGER DEFAULT 0,

                is_premium BOOLEAN DEFAULT FALSE,

                is_blocked BOOLEAN DEFAULT FALSE,

                certificat_autorise BOOLEAN DEFAULT FALSE,

                certificat_obtenu BOOLEAN DEFAULT FALSE,

                premium_until TIMESTAMP NULL,

                last_login TIMESTAMP NULL,

                notes_admin TEXT,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP
            )
            `
        );


        const userColumns = {

            sexe: "TEXT",

            telephone: "TEXT",

            domaine: "TEXT",

            pays: "TEXT",

            ville: "TEXT",

            niveau: "TEXT",

            photo: "TEXT",

            progression:
                "INTEGER DEFAULT 0",

            is_premium:
                "BOOLEAN DEFAULT FALSE",

            is_blocked:
                "BOOLEAN DEFAULT FALSE",

            certificat_autorise:
                "BOOLEAN DEFAULT FALSE",

            certificat_obtenu:
                "BOOLEAN DEFAULT FALSE",

            premium_until:
                "TIMESTAMP NULL",

            last_login:
                "TIMESTAMP NULL",

            notes_admin:
                "TEXT",

            created_at:
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",

            updated_at:
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        };


        for (
            const [column, type]
            of Object.entries(
                userColumns
            )
        ) {

            await client.query(
                `
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS
                ${column} ${type}
                `
            );
        }


        /* ====================================================
           PAIEMENTS
        ==================================================== */

        await client.query(
            `
            CREATE TABLE IF NOT EXISTS demandes_paiement
            (
                id SERIAL PRIMARY KEY,

                user_id INTEGER,

                telephone_paiement TEXT,

                montant NUMERIC(12,2),

                methode TEXT,

                statut TEXT DEFAULT 'pending',

                reference_paiement TEXT,

                preuve_paiement TEXT,

                admin_note TEXT,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP
            )
            `
        );


        const paymentColumns = {

            user_id:
                "INTEGER",

            telephone_paiement:
                "TEXT",

            montant:
                "NUMERIC(12,2)",

            methode:
                "TEXT",

            statut:
                "TEXT DEFAULT 'pending'",

            reference_paiement:
                "TEXT",

            preuve_paiement:
                "TEXT",

            admin_note:
                "TEXT",

            created_at:
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",

            updated_at:
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        };


        for (
            const [column, type]
            of Object.entries(
                paymentColumns
            )
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

                action TEXT,

                admin_email TEXT,

                details TEXT,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP
            )
            `
        );


        /* ====================================================
           ANCIENS MESSAGES
           
           IMPORTANT :
           Cette table est conservée.
           AUCUNE donnée existante n'est supprimée.
        ==================================================== */

        await client.query(
            `
            CREATE TABLE IF NOT EXISTS messages
            (
                id SERIAL PRIMARY KEY,

                sender_type TEXT,

                sender_id INTEGER NULL,

                recipient_type TEXT,

                recipient_user_id INTEGER NULL,

                audience TEXT,

                subject TEXT,

                message TEXT,

                priority TEXT DEFAULT 'normal',

                is_read BOOLEAN DEFAULT FALSE,

                is_archived BOOLEAN DEFAULT FALSE,

                parent_id INTEGER NULL,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP
            )
            `
        );


        const messageColumns = {

            sender_type:
                "TEXT",

            sender_id:
                "INTEGER NULL",

            recipient_type:
                "TEXT",

            recipient_user_id:
                "INTEGER NULL",

            audience:
                "TEXT",

            subject:
                "TEXT",

            message:
                "TEXT",

            priority:
                "TEXT DEFAULT 'normal'",

            is_read:
                "BOOLEAN DEFAULT FALSE",

            is_archived:
                "BOOLEAN DEFAULT FALSE",

            parent_id:
                "INTEGER NULL",

            created_at:
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",

            updated_at:
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        };


        for (
            const [column, type]
            of Object.entries(
                messageColumns
            )
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
           NOUVEAU SYSTÈME SMS
           
           IMPORTANT :
           Table complètement indépendante.
           
           L'ancienne table messages n'est PAS modifiée.
        ==================================================== */

        await client.query(
            `
            CREATE TABLE IF NOT EXISTS sms_messages
            (
                id SERIAL PRIMARY KEY,

                sender_type TEXT
                    NOT NULL DEFAULT 'admin',

                sender_id INTEGER NULL,

                recipient_user_id INTEGER
                    NOT NULL,

                subject TEXT,

                message TEXT
                    NOT NULL,

                priority TEXT
                    DEFAULT 'normal',

                audience TEXT
                    DEFAULT 'user',

                is_read BOOLEAN
                    DEFAULT FALSE,

                is_archived BOOLEAN
                    DEFAULT FALSE,

                parent_id INTEGER NULL,

                status TEXT
                    DEFAULT 'sent',

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP
            )
            `
        );


        const smsColumns = {

            sender_type:
                "TEXT DEFAULT 'admin'",

            sender_id:
                "INTEGER NULL",

            recipient_user_id:
                "INTEGER",

            subject:
                "TEXT",

            message:
                "TEXT",

            priority:
                "TEXT DEFAULT 'normal'",

            audience:
                "TEXT DEFAULT 'user'",

            is_read:
                "BOOLEAN DEFAULT FALSE",

            is_archived:
                "BOOLEAN DEFAULT FALSE",

            parent_id:
                "INTEGER NULL",

            status:
                "TEXT DEFAULT 'sent'",

            created_at:
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",

            updated_at:
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        };


        for (
            const [column, type]
            of Object.entries(
                smsColumns
            )
        ) {

            await client.query(
                `
                ALTER TABLE sms_messages
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

                user_id INTEGER,

                title TEXT,

                message TEXT,

                type TEXT DEFAULT 'info',

                is_read BOOLEAN DEFAULT FALSE,

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

                user_id INTEGER,

                domaine TEXT,

                titre TEXT,

                certificat_url TEXT,

                certificate_code TEXT,

                is_authorized BOOLEAN DEFAULT FALSE,

                downloaded BOOLEAN DEFAULT FALSE,

                downloaded_at TIMESTAMP NULL,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP
            )
            `
        );


        const certificateColumns = {

            user_id:
                "INTEGER",

            domaine:
                "TEXT",

            titre:
                "TEXT",

            certificat_url:
                "TEXT",

            certificate_code:
                "TEXT",

            is_authorized:
                "BOOLEAN DEFAULT FALSE",

            downloaded:
                "BOOLEAN DEFAULT FALSE",

            downloaded_at:
                "TIMESTAMP NULL",

            created_at:
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",

            updated_at:
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        };


        for (
            const [column, type]
            of Object.entries(
                certificateColumns
            )
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

                user_id INTEGER,

                domaine TEXT,

                progression INTEGER DEFAULT 0,

                chapitre_actuel INTEGER DEFAULT 0,

                chapitre_total INTEGER DEFAULT 0,

                statut TEXT DEFAULT 'En cours',

                updated_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP
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

                user_id INTEGER,

                action TEXT,

                details TEXT,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP
            )
            `
        );


        /* ====================================================
           INDEX USERS
        ==================================================== */

        await client.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_users_email
            ON users(email)
            `
        );


        /* ====================================================
           INDEX ANCIENS MESSAGES
        ==================================================== */

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
            idx_messages_parent
            ON messages(parent_id)
            `
        );


        await client.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_messages_sender
            ON messages(sender_type, sender_id)
            `
        );


        await client.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_messages_created
            ON messages(created_at DESC)
            `
        );


        /* ====================================================
           INDEX SMS
        ==================================================== */

        await client.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_sms_recipient
            ON sms_messages(recipient_user_id)
            `
        );


        await client.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_sms_parent
            ON sms_messages(parent_id)
            `
        );


        await client.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_sms_created
            ON sms_messages(created_at DESC)
            `
        );


        await client.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_sms_status
            ON sms_messages(status)
            `
        );


        /* ====================================================
           INDEX NOTIFICATIONS
        ==================================================== */

        await client.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_notifications_user
            ON notifications(user_id)
            `
        );


        /* ====================================================
           INDEX PROGRESSION
        ==================================================== */

        await client.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_progress_user
            ON user_progress(user_id)
            `
        );


        /* ====================================================
           INDEX ACTIVITY
        ==================================================== */

        await client.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_activity_user
            ON user_activity(user_id)
            `
        );


        console.log(
            "[DATABASE] Initialisation terminée."
        );

    } catch (error) {

        console.error(
            "[DATABASE] ERREUR :",
            error
        );


        throw error;

    } finally {

        client.release();
    }
}


/* ============================================================
   CELESTINE = 100 %
============================================================ */

async function ensureCelestineCompleted() {

    try {

        const result =
            await pool.query(
                `
                UPDATE users

                SET
                    progression = 100,
                    updated_at = CURRENT_TIMESTAMP

                WHERE
                    LOWER(TRIM(email))
                    =
                    LOWER(TRIM($1))

                AND
                    COALESCE(
                        progression,
                        0
                    ) <> 100

                RETURNING
                    id,
                    email,
                    progression
                `,
                [
                    EMAIL_UTILISATEUR_100
                ]
            );


        if (
            result.rows.length > 0
        ) {

            console.log(
                `[PROGRESSION AUTO] ${EMAIL_UTILISATEUR_100} → 100%`
            );
        }

    } catch (error) {

        console.error(
            "[PROGRESSION AUTO] CELESTINE :",
            error.message
        );
    }
}


/* ============================================================
   INITIALISATION DES PROGRESSIONS
============================================================ */

async function initializeUserProgressions() {

    try {

        console.log(
            "[PROGRESSION AUTO] Initialisation..."
        );


        await ensureCelestineCompleted();


        const result =
            await pool.query(
                `
                SELECT
                    id,
                    email,
                    progression

                FROM users

                WHERE
                    (
                        progression IS NULL
                        OR
                        progression <= 0
                    )

                AND
                    LOWER(TRIM(email))
                    <>
                    LOWER(TRIM($1))

                ORDER BY id ASC
                `,
                [
                    EMAIL_UTILISATEUR_100
                ]
            );


        let nombreInitialise = 0;


        for (
            const user
            of result.rows
        ) {

            const nouvelleProgression =
                randomProgression();


            const updateResult =
                await pool.query(
                    `
                    UPDATE users

                    SET
                        progression = $1,
                        updated_at = CURRENT_TIMESTAMP

                    WHERE
                        id = $2

                    AND
                        COALESCE(
                            progression,
                            0
                        ) < 100

                    RETURNING
                        id,
                        email,
                        progression
                    `,
                    [

                        nouvelleProgression,

                        user.id

                    ]
                );


            if (
                updateResult.rows.length > 0
            ) {

                nombreInitialise++;


                console.log(
                    `[PROGRESSION INIT] ${user.email} → ${nouvelleProgression}%`
                );
            }
        }


        console.log(
            `[PROGRESSION INIT] ${nombreInitialise} utilisateur(s).`
        );

    } catch (error) {

        console.error(
            "[PROGRESSION INIT] ERREUR :",
            error.message
        );
    }
}


/* ============================================================
   MISE À JOUR AUTOMATIQUE PROGRESSIONS
============================================================ */

async function updateRandomProgressions() {

    try {

        console.log(
            "[PROGRESSION AUTO] Mise à jour..."
        );


        await ensureCelestineCompleted();


        const result =
            await pool.query(
                `
                SELECT
                    id,
                    email,
                    progression

                FROM users

                WHERE
                    COALESCE(
                        progression,
                        0
                    ) < 100

                AND
                    LOWER(TRIM(email))
                    <>
                    LOWER(TRIM($1))

                ORDER BY id ASC
                `,
                [
                    EMAIL_UTILISATEUR_100
                ]
            );


        let nombreModifie = 0;


        for (
            const user
            of result.rows
        ) {

            const ancienneProgression =
                normalizeProgression(
                    user.progression
                );


            if (
                ancienneProgression >= 100
            ) {

                continue;
            }


            const nouvelleProgression =
                randomProgression();


            const updateResult =
                await pool.query(
                    `
                    UPDATE users

                    SET
                        progression = $1,
                        updated_at = CURRENT_TIMESTAMP

                    WHERE
                        id = $2

                    AND
                        COALESCE(
                            progression,
                            0
                        ) < 100

                    RETURNING
                        id,
                        email,
                        progression
                    `,
                    [

                        nouvelleProgression,

                        user.id

                    ]
                );


            if (
                updateResult.rows.length > 0
            ) {

                nombreModifie++;


                console.log(
                    `[PROGRESSION AUTO] ${user.email} : ${ancienneProgression}% → ${nouvelleProgression}%`
                );
            }
        }


        await ensureCelestineCompleted();


        console.log(
            `[PROGRESSION AUTO] ${nombreModifie} utilisateur(s) mis à jour.`
        );

    } catch (error) {

        console.error(
            "[PROGRESSION AUTO] ERREUR :",
            error.message
        );
    }
}


/* ============================================================
   MODIFICATION MANUELLE PROGRESSION
============================================================ */

app.patch(
    "/api/admin/users/:id/progression",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);


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


            const existingUser =
                await pool.query(
                    `
                    SELECT
                        id,
                        email,
                        progression

                    FROM users

                    WHERE id = $1
                    `,
                    [id]
                );


            if (
                existingUser.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"
                });
            }


            const user =
                existingUser.rows[0];


            const ancienneProgression =
                normalizeProgression(
                    user.progression
                );


            let progression =
                normalizeProgression(
                    req.body?.progression
                );


            /*
             * Une fois à 100 %, impossible de redescendre.
             */

            if (
                ancienneProgression >= 100
            ) {

                progression = 100;
            }


            /*
             * Celestine est toujours à 100 %.
             */

            if (
                isCelestine(
                    user.email
                )
            ) {

                progression = 100;
            }


            const result =
                await pool.query(
                    `
                    UPDATE users

                    SET
                        progression = $1,
                        updated_at = CURRENT_TIMESTAMP

                    WHERE id = $2

                    RETURNING
                        id,
                        email,
                        progression
                    `,
                    [

                        progression,

                        id

                    ]
                );


            await safeLogAdminAction(
                "MODIFICATION_PROGRESSION",
                `Utilisateur ${id} : ${progression}%`
            );


            return res.json({

                success: true,

                user: {

                    id:
                        result.rows[0].id,

                    email:
                        result.rows[0].email,

                    progression:
                        result.rows[0].progression,

                    statut:
                        progression >= 100
                            ? "Terminé"
                            : "En cours"
                },

                message:
                    "Progression globale mise à jour"
            });

        } catch (error) {

            console.error(
                "[PROGRESSION GLOBALE]",
                error
            );


            return res.status(500).json({

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
                Number(req.params.id);


            const domaine =
                clean(
                    req.body?.domaine
                );


            let progression =
                normalizeProgression(
                    req.body?.progression
                );


            const chapitreActuel =
                Math.max(
                    0,
                    Math.round(
                        safeNumber(
                            req.body?.chapitre_actuel,
                            0
                        )
                    )
                );


            const chapitreTotal =
                Math.max(
                    0,
                    Math.round(
                        safeNumber(
                            req.body?.chapitre_total,
                            0
                        )
                    )
                );


            if (
                !Number.isInteger(userId) ||
                userId <= 0 ||
                !domaine
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Données de progression invalides"
                });
            }


            const userResult =
                await pool.query(
                    `
                    SELECT
                        id,
                        email,
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


            /*
             * Celestine :
             * domaine toujours à 100 %.
             */

            if (
                isCelestine(
                    user.email
                )
            ) {

                progression = 100;
            }


            /*
             * Si progression globale déjà terminée,
             * le domaine ne peut pas redescendre.
             */

            if (
                normalizeProgression(
                    user.progression
                ) >= 100
            ) {

                progression = 100;
            }


            const existing =
                await pool.query(
                    `
                    SELECT
                        id,
                        progression

                    FROM user_progress

                    WHERE
                        user_id = $1

                    AND
                        domaine = $2

                    LIMIT 1
                    `,
                    [

                        userId,

                        domaine

                    ]
                );


            const statut =
                progression >= 100
                    ? "Terminé"
                    : "En cours";


            if (
                existing.rows.length > 0
            ) {

                /*
                 * Si le domaine était déjà à 100 %,
                 * il reste à 100 %.
                 */

                if (
                    normalizeProgression(
                        existing.rows[0].progression
                    ) >= 100
                ) {

                    progression = 100;
                }


                await pool.query(
                    `
                    UPDATE user_progress

                    SET
                        progression = $1,
                        chapitre_actuel = $2,
                        chapitre_total = $3,
                        statut = $4,
                        updated_at = CURRENT_TIMESTAMP

                    WHERE id = $5
                    `,
                    [

                        progression,

                        chapitreActuel,

                        chapitreTotal,

                        progression >= 100
                            ? "Terminé"
                            : "En cours",

                        existing.rows[0].id

                    ]
                );

            } else {

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
                    `,
                    [

                        userId,

                        domaine,

                        progression,

                        chapitreActuel,

                        chapitreTotal,

                        statut

                    ]
                );
            }


            await safeLogAdminAction(
                "MODIFICATION_PROGRESSION_DOMAINE",
                `Utilisateur ${userId}, domaine ${domaine} : ${progression}%`
            );


            return res.json({

                success: true,

                user_id:
                    userId,

                domaine,

                progression,

                statut:
                    progression >= 100
                        ? "Terminé"
                        : "En cours",

                message:
                    "Progression du domaine mise à jour"
            });

        } catch (error) {

            console.error(
                "[PROGRESSION DOMAINE]",
                error
            );


            return res.status(500).json({

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
   STATISTIQUES ADMIN
============================================================ */

app.get(
    "/api/admin/statistiques",
    adminAuth,
    async (req, res) => {

        try {

            const [

                usersResult,

                paymentResult,

                messagesResult,

                certificatesResult

            ] =
                await Promise.all([

                    pool.query(
                        `
                        SELECT

                            COUNT(*)::INTEGER
                                AS total,

                            COUNT(*) FILTER
                            (
                                WHERE
                                    COALESCE(
                                        is_premium,
                                        FALSE
                                    ) = TRUE
                            )::INTEGER
                                AS premium,

                            COUNT(*) FILTER
                            (
                                WHERE
                                    COALESCE(
                                        is_premium,
                                        FALSE
                                    ) = FALSE
                            )::INTEGER
                                AS standard,

                            COUNT(*) FILTER
                            (
                                WHERE
                                    COALESCE(
                                        is_blocked,
                                        FALSE
                                    ) = TRUE
                            )::INTEGER
                                AS blocked,

                            COUNT(*) FILTER
                            (
                                WHERE
                                    created_at::DATE =
                                    CURRENT_DATE
                            )::INTEGER
                                AS today

                        FROM users
                        `
                    ),

                    pool.query(
                        `
                        SELECT

                            COUNT(*)::INTEGER
                                AS total,

                            COUNT(*) FILTER
                            (
                                WHERE LOWER(
                                    COALESCE(
                                        statut,
                                        ''
                                    )
                                ) IN
                                (
                                    'pending',
                                    'en_attente',
                                    'en attente'
                                )
                            )::INTEGER
                                AS pending,

                            COUNT(*) FILTER
                            (
                                WHERE LOWER(
                                    COALESCE(
                                        statut,
                                        ''
                                    )
                                ) IN
                                (
                                    'valide',
                                    'validated',
                                    'approved',
                                    'paid'
                                )
                            )::INTEGER
                                AS validated,

                            COUNT(*) FILTER
                            (
                                WHERE LOWER(
                                    COALESCE(
                                        statut,
                                        ''
                                    )
                                ) IN
                                (
                                    'refuse',
                                    'refused',
                                    'rejected'
                                )
                            )::INTEGER
                                AS refused,

                            COALESCE(
                                SUM(montant) FILTER
                                (
                                    WHERE LOWER(
                                        COALESCE(
                                            statut,
                                            ''
                                        )
                                    ) IN
                                    (
                                        'valide',
                                        'validated',
                                        'approved',
                                        'paid'
                                    )
                                ),
                                0
                            ) AS revenue

                        FROM demandes_paiement
                        `
                    ),

                    pool.query(
                        `
                        SELECT

                            COUNT(*)::INTEGER
                                AS total,

                            COUNT(*) FILTER
                            (
                                WHERE
                                    COALESCE(
                                        is_read,
                                        FALSE
                                    ) = FALSE
                            )::INTEGER
                                AS unread

                        FROM messages
                        `
                    ),

                    pool.query(
                        `
                        SELECT

                            COUNT(*)::INTEGER
                                AS total,

                            COUNT(*) FILTER
                            (
                                WHERE
                                    COALESCE(
                                        is_authorized,
                                        FALSE
                                    ) = TRUE
                            )::INTEGER
                                AS authorized

                        FROM certificates
                        `
                    )

                ]);


            const users =
                usersResult.rows[0];


            const payments =
                paymentResult.rows[0];


            const messages =
                messagesResult.rows[0];


            const certificates =
                certificatesResult.rows[0];


            const stats = {

                users:
                    Number(users.total) || 0,

                premium:
                    Number(users.premium) || 0,

                standard:
                    Number(users.standard) || 0,

                blocked:
                    Number(users.blocked) || 0,

                today:
                    Number(users.today) || 0,

                payments:
                    Number(payments.total) || 0,

                totalPayments:
                    Number(payments.total) || 0,

                pending:
                    Number(payments.pending) || 0,

                validated:
                    Number(payments.validated) || 0,

                refused:
                    Number(payments.refused) || 0,

                revenue:
                    Number(payments.revenue) || 0,

                messages:
                    Number(messages.total) || 0,

                unreadMessages:
                    Number(messages.unread) || 0,

                certificates:
                    Number(certificates.total) || 0,

                certificates_authorized:
                    Number(certificates.authorized) || 0,

                authorizedCertificates:
                    Number(certificates.authorized) || 0
            };


            return res.json({

                success: true,

                stats,

                statistiques:
                    stats,

                statistics:
                    stats,

                data:
                    stats,

                message:
                    "Statistiques récupérées",

                generated_at:
                    new Date().toISOString()
            });

        } catch (error) {

            console.error(
                "[STATISTIQUES]",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur statistiques",

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
                        COUNT(*)::INTEGER AS users
                    FROM users
                    `
                );


            return res.json({

                success: true,

                users:
                    Number(
                        result.rows[0].users
                    ) || 0

            });

        } catch (error) {

            return res.status(500).json({

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

            const search =
                clean(
                    req.query.search
                );


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
                            last_login,
                            notes_admin

                        FROM users

                        WHERE
                            CAST(id AS TEXT)
                                ILIKE $1

                            OR nom ILIKE $1

                            OR email ILIKE $1

                            OR telephone ILIKE $1

                            OR domaine ILIKE $1

                            OR pays ILIKE $1

                            OR ville ILIKE $1

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
                            last_login,
                            notes_admin

                        FROM users

                        ORDER BY id DESC
                        `
                    );
            }


            return res.json({

                success: true,

                count:
                    result.rows.length,

                users:
                    result.rows.map(
                        publicUser
                    )
            });

        } catch (error) {

            console.error(
                "[ADMIN USERS]",
                error
            );


            return res.status(500).json({

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
                Number(req.params.id);


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
                userResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"
                });
            }


            const [

                payments,

                messages,

                progress,

                certificates,

                activities,

                notifications

            ] =
                await Promise.all([

                    pool.query(
                        `
                        SELECT *

                        FROM demandes_paiement

                        WHERE user_id = $1

                        ORDER BY id DESC
                        `,
                        [id]
                    ),

                    pool.query(
                        `
                        SELECT *

                        FROM messages

                        WHERE
                            recipient_user_id = $1

                            OR
                            (
                                sender_type = 'user'
                                AND sender_id = $1
                            )

                            OR
                            parent_id IN
                            (
                                SELECT id
                                FROM messages

                                WHERE
                                    recipient_user_id = $1

                                    OR
                                    (
                                        sender_type = 'user'
                                        AND sender_id = $1
                                    )
                            )

                        ORDER BY id ASC
                        `,
                        [id]
                    ),

                    pool.query(
                        `
                        SELECT *

                        FROM user_progress

                        WHERE user_id = $1

                        ORDER BY domaine ASC
                        `,
                        [id]
                    ),

                    pool.query(
                        `
                        SELECT *

                        FROM certificates

                        WHERE user_id = $1

                        ORDER BY id DESC
                        `,
                        [id]
                    ),

                    pool.query(
                        `
                        SELECT *

                        FROM user_activity

                        WHERE user_id = $1

                        ORDER BY id DESC

                        LIMIT 200
                        `,
                        [id]
                    ),

                    pool.query(
                        `
                        SELECT *

                        FROM notifications

                        WHERE user_id = $1

                        ORDER BY id DESC

                        LIMIT 200
                        `,
                        [id]
                    )

                ]);


            return res.json({

                success: true,

                user:
                    publicUser(
                        userResult.rows[0]
                    ),

                payments:
                    payments.rows,

                messages:
                    messages.rows,

                progress:
                    progress.rows,

                certificates:
                    certificates.rows,

                activities:
                    activities.rows,

                notifications:
                    notifications.rows
            });

        } catch (error) {

            console.error(
                "[ADMIN USER DETAIL]",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur détail utilisateur",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   ============================================================
   ANCIEN SYSTÈME MESSAGES
   ============================================================
   
   IMPORTANT :
   ------------------------------------------------------------
   Ces routes sont conservées pour ne pas casser l'ancien
   système ni perdre les anciens messages.
   
   La nouvelle page SMS devra utiliser uniquement :
   
   /api/admin/sms/...
============================================================ */


/* ============================================================
   ANCIEN — MESSAGE INDIVIDUEL
============================================================ */

app.post(
    "/api/admin/messages/user",
    adminAuth,
    async (req, res) => {

        let client = null;
        let transactionStarted = false;


        try {

            const userId =
                getMessageUserId(
                    req.body
                );


            const data =
                normalizeAdminMessageData(
                    req.body
                );


            if (!userId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant utilisateur manquant",

                    code:
                        "USER_ID_MISSING"
                });
            }


            if (!data.message) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le message est vide",

                    code:
                        "MESSAGE_EMPTY"
                });
            }


            client =
                await pool.connect();


            const userResult =
                await client.query(
                    `
                    SELECT
                        id,
                        nom,
                        email,
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
                        "Utilisateur introuvable",

                    code:
                        "USER_NOT_FOUND"
                });
            }


            const user =
                userResult.rows[0];


            await client.query(
                "BEGIN"
            );

            transactionStarted = true;


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
                        priority,
                        is_read,
                        is_archived,
                        parent_id,
                        created_at,
                        updated_at
                    )
                    VALUES
                    (
                        'admin',
                        NULL,
                        'user',
                        $1,
                        'user',
                        $2,
                        $3,
                        $4,
                        FALSE,
                        FALSE,
                        NULL,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )

                    RETURNING *
                    `,
                    [

                        userId,

                        data.subject,

                        data.message,

                        data.priority

                    ]
                );


            const savedMessage =
                messageResult.rows[0];


            await client.query(
                `
                INSERT INTO user_activity
                (
                    user_id,
                    action,
                    details,
                    created_at
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    CURRENT_TIMESTAMP
                )
                `,
                [

                    userId,

                    "MESSAGE_ADMIN_RECU",

                    `Nouveau message administratif : ${data.subject}`

                ]
            );


            await client.query(
                "COMMIT"
            );

            transactionStarted = false;


            await createNotification(
                pool,
                userId,
                data.subject,
                data.message,
                data.priority === "urgent"
                    ? "urgent"
                    : "message"
            );


            await safeLogAdminAction(
                "MESSAGE_UTILISATEUR",
                `Message envoyé à ${user.email} (ID ${userId}) — ${data.subject}`
            );


            return res.status(201).json({

                success: true,

                count: 1,

                message_id:
                    savedMessage.id,

                message:
                    savedMessage,

                recipient: {

                    id:
                        user.id,

                    nom:
                        user.nom,

                    email:
                        user.email

                },

                notification:
                    true
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

                } catch (rollbackError) {

                    console.error(
                        "[MESSAGES USER] ROLLBACK :",
                        rollbackError.message
                    );
                }
            }


            console.error(
                "[MESSAGES USER] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de l'envoi du message",

                error:
                    error.message,

                code:
                    error.code || null
            });

        } finally {

            if (client) {

                client.release();
            }
        }
    }
);


/* ============================================================
   ANCIEN — MESSAGE TOUS
============================================================ */

app.post(
    "/api/admin/messages/all",
    adminAuth,
    async (req, res) => {

        let client = null;
        let transactionStarted = false;


        try {

            const data =
                normalizeAdminMessageData(
                    req.body
                );


            if (!data.message) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le message est vide"
                });
            }


            client =
                await pool.connect();


            const usersResult =
                await client.query(
                    `
                    SELECT
                        id,
                        nom,
                        email

                    FROM users

                    ORDER BY id ASC
                    `
                );


            if (
                usersResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Aucun utilisateur trouvé",

                    count: 0
                });
            }


            await client.query(
                "BEGIN"
            );

            transactionStarted = true;


            let inserted = 0;


            for (
                const user
                of usersResult.rows
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
                        priority,
                        is_read,
                        is_archived,
                        parent_id,
                        created_at,
                        updated_at
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
                        $4,
                        FALSE,
                        FALSE,
                        NULL,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )
                    `,
                    [

                        user.id,

                        data.subject,

                        data.message,

                        data.priority

                    ]
                );


                await client.query(
                    `
                    INSERT INTO user_activity
                    (
                        user_id,
                        action,
                        details,
                        created_at
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        CURRENT_TIMESTAMP
                    )
                    `,
                    [

                        user.id,

                        "MESSAGE_ADMIN_RECU",

                        `Message général : ${data.subject}`

                    ]
                );


                inserted++;
            }


            await client.query(
                "COMMIT"
            );

            transactionStarted = false;


            for (
                const user
                of usersResult.rows
            ) {

                await createNotification(
                    pool,
                    user.id,
                    data.subject,
                    data.message,
                    data.priority === "urgent"
                        ? "urgent"
                        : "message"
                );
            }


            await safeLogAdminAction(
                "MESSAGE_TOUS",
                `Message envoyé à ${inserted} utilisateur(s) — ${data.subject}`
            );


            return res.status(201).json({

                success: true,

                count:
                    inserted,

                message:
                    `${inserted} message(s) envoyé(s) avec succès`
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

                } catch (rollbackError) {

                    console.error(
                        "[MESSAGES ALL] ROLLBACK :",
                        rollbackError.message
                    );
                }
            }


            console.error(
                "[MESSAGES ALL] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de l'envoi du message à tous",

                error:
                    error.message,

                code:
                    error.code || null
            });

        } finally {

            if (client) {

                client.release();
            }
        }
    }
);


/* ============================================================
   ANCIEN — MESSAGE PREMIUM
============================================================ */

app.post(
    "/api/admin/messages/premium",
    adminAuth,
    async (req, res) => {

        let client = null;
        let transactionStarted = false;


        try {

            const data =
                normalizeAdminMessageData(
                    req.body
                );


            if (!data.message) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le message est vide"
                });
            }


            client =
                await pool.connect();


            const usersResult =
                await client.query(
                    `
                    SELECT
                        id,
                        nom,
                        email

                    FROM users

                    WHERE
                        COALESCE(
                            is_premium,
                            FALSE
                        ) = TRUE

                    ORDER BY id ASC
                    `
                );


            if (
                usersResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Aucun utilisateur Premium trouvé",

                    count: 0
                });
            }


            await client.query(
                "BEGIN"
            );

            transactionStarted = true;


            let inserted = 0;


            for (
                const user
                of usersResult.rows
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
                        priority,
                        is_read,
                        is_archived,
                        parent_id,
                        created_at,
                        updated_at
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
                        $4,
                        FALSE,
                        FALSE,
                        NULL,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )
                    `,
                    [

                        user.id,

                        data.subject,

                        data.message,

                        data.priority

                    ]
                );


                await client.query(
                    `
                    INSERT INTO user_activity
                    (
                        user_id,
                        action,
                        details,
                        created_at
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        CURRENT_TIMESTAMP
                    )
                    `,
                    [

                        user.id,

                        "MESSAGE_ADMIN_RECU",

                        `Message Premium : ${data.subject}`

                    ]
                );


                inserted++;
            }


            await client.query(
                "COMMIT"
            );

            transactionStarted = false;


            for (
                const user
                of usersResult.rows
            ) {

                await createNotification(
                    pool,
                    user.id,
                    data.subject,
                    data.message,
                    data.priority === "urgent"
                        ? "urgent"
                        : "message"
                );
            }


            await safeLogAdminAction(
                "MESSAGE_PREMIUM",
                `Message envoyé à ${inserted} Premium(s) — ${data.subject}`
            );


            return res.status(201).json({

                success: true,

                count:
                    inserted,

                message:
                    `${inserted} message(s) Premium envoyé(s)`
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

                } catch (rollbackError) {

                    console.error(
                        "[MESSAGES PREMIUM] ROLLBACK :",
                        rollbackError.message
                    );
                }
            }


            console.error(
                "[MESSAGES PREMIUM] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de l'envoi aux Premium",

                error:
                    error.message,

                code:
                    error.code || null
            });

        } finally {

            if (client) {

                client.release();
            }
        }
    }
);


/* ============================================================
   ============================================================
   NOUVEAU SYSTÈME SMS — COMPLET
   ============================================================

   TABLE UTILISÉE :
   sms_messages

   IMPORTANT :
   - L'ancien système "messages" n'est pas utilisé ici.
   - Les utilisateurs existants ne sont jamais supprimés.
   - Les SMS peuvent être :
        • envoyés
        • lus
        • répondus
        • modifiés par l'admin
        • supprimés individuellement
        • archivés
        • restaurés
   - L'utilisateur peut :
        • consulter ses SMS
        • lire ses SMS
        • répondre
        • marquer tous ses SMS comme lus

============================================================ */


/* ============================================================
   UTILITAIRE — RÉCUPÉRER UN UTILISATEUR
============================================================ */

async function getSmsUser(
    clientOrPool,
    userId
) {

    const numericUserId = Number(userId);

    if (
        !Number.isInteger(numericUserId) ||
        numericUserId <= 0
    ) {
        return null;
    }

    const result =
        await clientOrPool.query(
            `
            SELECT
                id,
                nom,
                email,
                telephone,
                photo,
                domaine,
                pays,
                ville,
                niveau,
                is_premium,
                is_blocked,
                progression
            FROM users
            WHERE id = $1
            LIMIT 1
            `,
            [numericUserId]
        );

    return result.rows[0] || null;
}


/* ============================================================
   UTILITAIRE — IDENTIFIANT UTILISATEUR SMS
============================================================ */

function getSmsUserIdFromRequest(req) {

    const possibleId =
        req.body?.user_id ??
        req.body?.userId ??
        req.headers["x-user-id"] ??
        req.headers["x-userid"] ??
        req.headers["x-bmj-user-id"] ??
        req.query?.user_id ??
        req.query?.userId;

    const userId =
        Number(possibleId);

    if (
        !Number.isInteger(userId) ||
        userId <= 0
    ) {
        return null;
    }

    return userId;
}


/* ============================================================
   AUTHENTIFICATION UTILISATEUR SMS
============================================================ */

async function userSmsAuth(
    req,
    res,
    next
) {

    try {

        const userId =
            getSmsUserIdFromRequest(req);


        if (!userId) {

            return res.status(401).json({

                success: false,

                message:
                    "Utilisateur non identifié.",

                code:
                    "SMS_USER_ID_MISSING"
            });
        }


        const user =
            await getSmsUser(
                pool,
                userId
            );


        if (!user) {

            return res.status(401).json({

                success: false,

                message:
                    "Utilisateur introuvable.",

                code:
                    "SMS_USER_NOT_FOUND"
            });
        }


        if (
            user.is_blocked === true
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Votre compte est bloqué.",

                code:
                    "SMS_USER_BLOCKED"
            });
        }


        req.smsUser =
            user;

        req.smsUserId =
            user.id;


        next();

    } catch (error) {

        console.error(
            "[SMS USER AUTH] ERREUR :",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Erreur d'authentification utilisateur.",

            error:
                error.message
        });
    }
}


/* ============================================================
   UTILITAIRE — CRÉER UN SMS ADMIN
============================================================ */

async function createSmsMessage(
    client,
    options = {}
) {

    const recipientUserId =
        Number(
            options.recipientUserId
        );


    if (
        !Number.isInteger(
            recipientUserId
        ) ||
        recipientUserId <= 0
    ) {

        throw new Error(
            "Destinataire SMS invalide."
        );
    }


    const subject =
        normalizeSmsSubject(
            options.subject
        );


    const message =
        normalizeSmsMessage(
            options.message
        );


    const priority =
        normalizeSmsPriority(
            options.priority
        );


    const audience =
        normalizeSmsAudience(
            options.audience
        );


    const parentId =
        Number.isInteger(
            Number(options.parentId)
        )
            ? Number(options.parentId)
            : null;


    if (!message) {

        throw new Error(
            "Le message SMS est vide."
        );
    }


    const result =
        await client.query(
            `
            INSERT INTO sms_messages
            (
                sender_type,
                sender_id,
                recipient_user_id,
                subject,
                message,
                priority,
                audience,
                is_read,
                is_archived,
                parent_id,
                status,
                created_at,
                updated_at
            )
            VALUES
            (
                'admin',
                NULL,
                $1,
                $2,
                $3,
                $4,
                $5,
                FALSE,
                FALSE,
                $6,
                'sent',
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            )
            RETURNING *
            `,
            [
                recipientUserId,
                subject,
                message,
                priority,
                audience,
                parentId
            ]
        );


    return result.rows[0];
}


/* ============================================================
   UTILITAIRE — CRÉER ACTIVITÉ UTILISATEUR
============================================================ */

async function createSmsUserActivity(
    client,
    userId,
    action,
    details
) {

    try {

        await client.query(
            `
            INSERT INTO user_activity
            (
                user_id,
                action,
                details,
                created_at
            )
            VALUES
            (
                $1,
                $2,
                $3,
                CURRENT_TIMESTAMP
            )
            `,
            [
                userId,
                action,
                details
            ]
        );

    } catch (error) {

        console.error(
            "[SMS USER ACTIVITY] ERREUR :",
            error.message
        );

        /*
         * On ne fait pas échouer le SMS uniquement
         * parce que l'activité n'a pas pu être enregistrée.
         */
    }
}


/* ============================================================
   SMS — ENVOI INDIVIDUEL
============================================================ */

app.post(
    "/api/admin/sms/send",
    adminAuth,
    async (req, res) => {

        let client = null;
        let transactionStarted = false;

        try {

            const userId =
                getSmsUserIdFromRequest(req);


            const data =
                normalizeSmsData(
                    req.body || {}
                );


            if (!userId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant utilisateur manquant.",

                    code:
                        "SMS_USER_ID_MISSING"
                });
            }


            if (!data.message) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le message SMS est vide.",

                    code:
                        "SMS_MESSAGE_EMPTY"
                });
            }


            client =
                await pool.connect();


            const user =
                await getSmsUser(
                    client,
                    userId
                );


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable.",

                    code:
                        "SMS_USER_NOT_FOUND"
                });
            }


            if (
                user.is_blocked === true
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Impossible d'envoyer un SMS à un utilisateur bloqué.",

                    code:
                        "SMS_USER_BLOCKED"
                });
            }


            await client.query(
                "BEGIN"
            );

            transactionStarted = true;


            const savedSms =
                await createSmsMessage(
                    client,
                    {
                        recipientUserId:
                            userId,

                        subject:
                            data.subject,

                        message:
                            data.message,

                        priority:
                            data.priority,

                        audience:
                            "user"
                    }
                );


            await createSmsUserActivity(
                client,
                userId,
                "SMS_ADMIN_RECU",
                `SMS reçu : ${data.subject || "Sans objet"}`
            );


            await client.query(
                "COMMIT"
            );

            transactionStarted = false;


            await createNotification(
                pool,
                userId,
                data.subject || "Nouveau message",
                data.message,
                data.priority === "urgent"
                    ? "urgent"
                    : "message"
            );


            await safeLogAdminAction(
                "SMS_UTILISATEUR",
                `SMS envoyé à ${user.email} (ID ${userId}) — ${data.subject || "Sans objet"}`
            );


            return res.status(201).json({

                success: true,

                count: 1,

                sms_id:
                    savedSms.id,

                sms:
                    savedSms,

                recipient: {

                    id:
                        user.id,

                    nom:
                        user.nom,

                    email:
                        user.email,

                    telephone:
                        user.telephone
                },

                status:
                    "sent"
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

                } catch (rollbackError) {

                    console.error(
                        "[SMS SEND] ROLLBACK :",
                        rollbackError.message
                    );
                }
            }


            console.error(
                "[SMS SEND] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de l'envoi du SMS.",

                error:
                    error.message,

                code:
                    error.code || null
            });

        } finally {

            if (client) {

                client.release();
            }
        }
    }
);


/* ============================================================
   SMS — ENVOI À TOUS
============================================================ */

app.post(
    "/api/admin/sms/send-all",
    adminAuth,
    async (req, res) => {

        let client = null;
        let transactionStarted = false;

        try {

            const data =
                normalizeSmsData(
                    req.body || {}
                );


            if (!data.message) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le message SMS est vide."
                });
            }


            client =
                await pool.connect();


            const usersResult =
                await client.query(
                    `
                    SELECT
                        id,
                        nom,
                        email,
                        is_blocked
                    FROM users
                    ORDER BY id ASC
                    `
                );


            if (
                usersResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Aucun utilisateur trouvé.",

                    count: 0
                });
            }


            const users =
                usersResult.rows.filter(
                    user =>
                        user.is_blocked !== true
                );


            if (
                users.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Aucun utilisateur actif trouvé.",

                    count: 0
                });
            }


            await client.query(
                "BEGIN"
            );

            transactionStarted = true;


            let inserted = 0;


            for (
                const user
                of users
            ) {

                await createSmsMessage(
                    client,
                    {
                        recipientUserId:
                            user.id,

                        subject:
                            data.subject,

                        message:
                            data.message,

                        priority:
                            data.priority,

                        audience:
                            "all"
                    }
                );


                await createSmsUserActivity(
                    client,
                    user.id,
                    "SMS_ADMIN_RECU",
                    `SMS général : ${data.subject || "Sans objet"}`
                );


                inserted++;
            }


            await client.query(
                "COMMIT"
            );

            transactionStarted = false;


            for (
                const user
                of users
            ) {

                await createNotification(
                    pool,
                    user.id,
                    data.subject || "Nouveau message",
                    data.message,
                    data.priority === "urgent"
                        ? "urgent"
                        : "message"
                );
            }


            await safeLogAdminAction(
                "SMS_TOUS",
                `SMS envoyé à ${inserted} utilisateur(s) — ${data.subject || "Sans objet"}`
            );


            return res.status(201).json({

                success: true,

                count:
                    inserted,

                skipped_blocked:
                    usersResult.rows.length - users.length,

                message:
                    `${inserted} SMS envoyé(s) avec succès.`
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

                } catch (rollbackError) {

                    console.error(
                        "[SMS ALL] ROLLBACK :",
                        rollbackError.message
                    );
                }
            }


            console.error(
                "[SMS ALL] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de l'envoi des SMS.",

                error:
                    error.message,

                code:
                    error.code || null
            });

        } finally {

            if (client) {

                client.release();
            }
        }
    }
);


/* ============================================================
   SMS — ENVOI PREMIUM
============================================================ */

app.post(
    "/api/admin/sms/send-premium",
    adminAuth,
    async (req, res) => {

        let client = null;
        let transactionStarted = false;

        try {

            const data =
                normalizeSmsData(
                    req.body || {}
                );


            if (!data.message) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le message SMS est vide."
                });
            }


            client =
                await pool.connect();


            const usersResult =
                await client.query(
                    `
                    SELECT
                        id,
                        nom,
                        email,
                        is_blocked
                    FROM users
                    WHERE COALESCE(is_premium, FALSE) = TRUE
                    ORDER BY id ASC
                    `
                );


            const users =
                usersResult.rows.filter(
                    user =>
                        user.is_blocked !== true
                );


            if (
                users.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Aucun utilisateur Premium actif trouvé.",

                    count: 0
                });
            }


            await client.query(
                "BEGIN"
            );

            transactionStarted = true;


            let inserted = 0;


            for (
                const user
                of users
            ) {

                await createSmsMessage(
                    client,
                    {
                        recipientUserId:
                            user.id,

                        subject:
                            data.subject,

                        message:
                            data.message,

                        priority:
                            data.priority,

                        audience:
                            "premium"
                    }
                );


                await createSmsUserActivity(
                    client,
                    user.id,
                    "SMS_ADMIN_RECU",
                    `SMS Premium : ${data.subject || "Sans objet"}`
                );


                inserted++;
            }


            await client.query(
                "COMMIT"
            );

            transactionStarted = false;


            for (
                const user
                of users
            ) {

                await createNotification(
                    pool,
                    user.id,
                    data.subject || "Nouveau message Premium",
                    data.message,
                    data.priority === "urgent"
                        ? "urgent"
                        : "message"
                );
            }


            await safeLogAdminAction(
                "SMS_PREMIUM",
                `SMS envoyé à ${inserted} Premium(s) — ${data.subject || "Sans objet"}`
            );


            return res.status(201).json({

                success: true,

                count:
                    inserted,

                message:
                    `${inserted} SMS Premium envoyé(s).`
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

                } catch (rollbackError) {

                    console.error(
                        "[SMS PREMIUM] ROLLBACK :",
                        rollbackError.message
                    );
                }
            }


            console.error(
                "[SMS PREMIUM] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de l'envoi aux Premium.",

                error:
                    error.message,

                code:
                    error.code || null
            });

        } finally {

            if (client) {

                client.release();
            }
        }
    }
);


/* ============================================================
   SMS — ENVOI STANDARD
============================================================ */

app.post(
    "/api/admin/sms/send-standard",
    adminAuth,
    async (req, res) => {

        let client = null;
        let transactionStarted = false;

        try {

            const data =
                normalizeSmsData(
                    req.body || {}
                );


            if (!data.message) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le message SMS est vide."
                });
            }


            client =
                await pool.connect();


            const usersResult =
                await client.query(
                    `
                    SELECT
                        id,
                        nom,
                        email,
                        is_blocked
                    FROM users
                    WHERE COALESCE(is_premium, FALSE) = FALSE
                    ORDER BY id ASC
                    `
                );


            const users =
                usersResult.rows.filter(
                    user =>
                        user.is_blocked !== true
                );


            if (
                users.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Aucun utilisateur Standard actif trouvé.",

                    count: 0
                });
            }


            await client.query(
                "BEGIN"
            );

            transactionStarted = true;


            let inserted = 0;


            for (
                const user
                of users
            ) {

                await createSmsMessage(
                    client,
                    {
                        recipientUserId:
                            user.id,

                        subject:
                            data.subject,

                        message:
                            data.message,

                        priority:
                            data.priority,

                        audience:
                            "standard"
                    }
                );


                await createSmsUserActivity(
                    client,
                    user.id,
                    "SMS_ADMIN_RECU",
                    `SMS Standard : ${data.subject || "Sans objet"}`
                );


                inserted++;
            }


            await client.query(
                "COMMIT"
            );

            transactionStarted = false;


            for (
                const user
                of users
            ) {

                await createNotification(
                    pool,
                    user.id,
                    data.subject || "Nouveau message",
                    data.message,
                    data.priority === "urgent"
                        ? "urgent"
                        : "message"
                );
            }


            await safeLogAdminAction(
                "SMS_STANDARD",
                `SMS envoyé à ${inserted} Standard(s) — ${data.subject || "Sans objet"}`
            );


            return res.status(201).json({

                success: true,

                count:
                    inserted,

                message:
                    `${inserted} SMS Standard envoyé(s).`
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

                } catch (rollbackError) {

                    console.error(
                        "[SMS STANDARD] ROLLBACK :",
                        rollbackError.message
                    );
                }
            }


            console.error(
                "[SMS STANDARD] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de l'envoi aux utilisateurs Standard.",

                error:
                    error.message,

                code:
                    error.code || null
            });

        } finally {

            if (client) {

                client.release();
            }
        }
    }
);


/* ============================================================
   SMS — LISTE DES UTILISATEURS
============================================================ */

app.get(
    "/api/admin/sms/users",
    adminAuth,
    async (req, res) => {

        try {

            const search =
                clean(
                    req.query.search || ""
                );


            let result;


            if (search) {

                result =
                    await pool.query(
                        `
                        SELECT
                            id,
                            nom,
                            email,
                            telephone,
                            domaine,
                            pays,
                            ville,
                            is_premium,
                            is_blocked,
                            progression
                        FROM users
                        WHERE
                            CAST(id AS TEXT) ILIKE $1
                            OR nom ILIKE $1
                            OR email ILIKE $1
                            OR telephone ILIKE $1
                            OR domaine ILIKE $1
                            OR pays ILIKE $1
                            OR ville ILIKE $1
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
                            email,
                            telephone,
                            domaine,
                            pays,
                            ville,
                            is_premium,
                            is_blocked,
                            progression
                        FROM users
                        ORDER BY id DESC
                        `
                    );
            }


            return res.json({

                success: true,

                count:
                    result.rows.length,

                users:
                    result.rows
            });

        } catch (error) {

            console.error(
                "[SMS USERS] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur récupération utilisateurs SMS.",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   SMS — CONVERSATION ADMIN
============================================================ */

app.get(
    "/api/admin/sms/conversation/:userId",
    adminAuth,
    async (req, res) => {

        try {

            const userId =
                Number(
                    req.params.userId
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


            const user =
                await getSmsUser(
                    pool,
                    userId
                );


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable."
                });
            }


            const messagesResult =
                await pool.query(
                    `
                    SELECT
                        id,
                        sender_type,
                        sender_id,
                        recipient_user_id,
                        subject,
                        message,
                        priority,
                        audience,
                        is_read,
                        is_archived,
                        parent_id,
                        status,
                        created_at,
                        updated_at
                    FROM sms_messages
                    WHERE recipient_user_id = $1
                    ORDER BY created_at ASC, id ASC
                    `,
                    [userId]
                );


            const unreadResult =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER AS unread
                    FROM sms_messages
                    WHERE
                        recipient_user_id = $1
                        AND COALESCE(is_read, FALSE) = FALSE
                        AND COALESCE(is_archived, FALSE) = FALSE
                    `,
                    [userId]
                );


            return res.json({

                success: true,

                user,

                count:
                    messagesResult.rows.length,

                unread:
                    Number(
                        unreadResult.rows[0]?.unread
                    ) || 0,

                messages:
                    messagesResult.rows
            });

        } catch (error) {

            console.error(
                "[SMS CONVERSATION] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur récupération conversation SMS.",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   SMS — MARQUER COMME LU — ADMIN
============================================================ */

app.patch(
    "/api/admin/sms/:smsId/read",
    adminAuth,
    async (req, res) => {

        try {

            const smsId =
                Number(
                    req.params.smsId
                );


            if (
                !Number.isInteger(smsId) ||
                smsId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant SMS invalide."
                });
            }


            const result =
                await pool.query(
                    `
                    UPDATE sms_messages
                    SET
                        is_read = TRUE,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING *
                    `,
                    [smsId]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "SMS introuvable."
                });
            }


            return res.json({

                success: true,

                sms:
                    result.rows[0],

                message:
                    "SMS marqué comme lu."
            });

        } catch (error) {

            console.error(
                "[SMS READ ADMIN] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur marquage SMS.",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   SMS — MODIFIER UN SMS — ADMIN
============================================================ */

app.patch(
    "/api/admin/sms/:smsId",
    adminAuth,
    async (req, res) => {

        try {

            const smsId =
                Number(
                    req.params.smsId
                );


            if (
                !Number.isInteger(smsId) ||
                smsId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant SMS invalide."
                });
            }


            const existingResult =
                await pool.query(
                    `
                    SELECT *
                    FROM sms_messages
                    WHERE id = $1
                    LIMIT 1
                    `,
                    [smsId]
                );


            if (
                existingResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "SMS introuvable."
                });
            }


            const existing =
                existingResult.rows[0];


            const subject =
                req.body?.subject !== undefined
                    ? normalizeSmsSubject(
                        req.body.subject
                    )
                    : normalizeSmsSubject(
                        existing.subject
                    );


            const message =
                req.body?.message !== undefined
                    ? normalizeSmsMessage(
                        req.body.message
                    )
                    : normalizeSmsMessage(
                        existing.message
                    );


            const priority =
                req.body?.priority !== undefined
                    ? normalizeSmsPriority(
                        req.body.priority
                    )
                    : normalizeSmsPriority(
                        existing.priority
                    );


            if (!message) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le message SMS ne peut pas être vide."
                });
            }


            const result =
                await pool.query(
                    `
                    UPDATE sms_messages
                    SET
                        subject = $1,
                        message = $2,
                        priority = $3,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $4
                    RETURNING *
                    `,
                    [
                        subject,
                        message,
                        priority,
                        smsId
                    ]
                );


            await safeLogAdminAction(
                "SMS_MODIFICATION",
                `SMS #${smsId} modifié.`
            );


            return res.json({

                success: true,

                sms:
                    result.rows[0],

                message:
                    "SMS modifié avec succès."
            });

        } catch (error) {

            console.error(
                "[SMS EDIT] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de la modification du SMS.",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   SMS — SUPPRIMER UN SMS — ADMIN
============================================================ */

app.delete(
    "/api/admin/sms/:smsId",
    adminAuth,
    async (req, res) => {

        try {

            const smsId =
                Number(
                    req.params.smsId
                );


            if (
                !Number.isInteger(smsId) ||
                smsId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant SMS invalide."
                });
            }


            const existingResult =
                await pool.query(
                    `
                    SELECT
                        id,
                        recipient_user_id,
                        subject,
                        message
                    FROM sms_messages
                    WHERE id = $1
                    LIMIT 1
                    `,
                    [smsId]
                );


            if (
                existingResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "SMS introuvable."
                });
            }


            const sms =
                existingResult.rows[0];


            await pool.query(
                `
                DELETE FROM sms_messages
                WHERE id = $1
                `,
                [smsId]
            );


            await safeLogAdminAction(
                "SMS_SUPPRESSION",
                `SMS #${smsId} supprimé pour l'utilisateur ID ${sms.recipient_user_id}.`
            );


            return res.json({

                success: true,

                deleted:
                    true,

                sms_id:
                    smsId,

                message:
                    "SMS supprimé avec succès."
            });

        } catch (error) {

            console.error(
                "[SMS DELETE] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de la suppression du SMS.",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   SMS — ARCHIVER
============================================================ */

app.patch(
    "/api/admin/sms/:smsId/archive",
    adminAuth,
    async (req, res) => {

        try {

            const smsId =
                Number(
                    req.params.smsId
                );


            if (
                !Number.isInteger(smsId) ||
                smsId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant SMS invalide."
                });
            }


            const result =
                await pool.query(
                    `
                    UPDATE sms_messages
                    SET
                        is_archived = TRUE,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING *
                    `,
                    [smsId]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "SMS introuvable."
                });
            }


            await safeLogAdminAction(
                "SMS_ARCHIVAGE",
                `SMS #${smsId} archivé.`
            );


            return res.json({

                success: true,

                sms:
                    result.rows[0],

                message:
                    "SMS archivé avec succès."
            });

        } catch (error) {

            console.error(
                "[SMS ARCHIVE] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur archivage SMS.",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   SMS — RESTAURER
============================================================ */

app.patch(
    "/api/admin/sms/:smsId/unarchive",
    adminAuth,
    async (req, res) => {

        try {

            const smsId =
                Number(
                    req.params.smsId
                );


            if (
                !Number.isInteger(smsId) ||
                smsId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant SMS invalide."
                });
            }


            const result =
                await pool.query(
                    `
                    UPDATE sms_messages
                    SET
                        is_archived = FALSE,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING *
                    `,
                    [smsId]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "SMS introuvable."
                });
            }


            await safeLogAdminAction(
                "SMS_RESTAURATION",
                `SMS #${smsId} restauré.`
            );


            return res.json({

                success: true,

                sms:
                    result.rows[0],

                message:
                    "SMS restauré avec succès."
            });

        } catch (error) {

            console.error(
                "[SMS UNARCHIVE] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur restauration SMS.",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   SMS — RÉPONDRE — ADMIN
============================================================ */

app.post(
    "/api/admin/sms/:smsId/reply",
    adminAuth,
    async (req, res) => {

        let client = null;
        let transactionStarted = false;

        try {

            const smsId =
                Number(
                    req.params.smsId
                );


            if (
                !Number.isInteger(smsId) ||
                smsId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant SMS invalide."
                });
            }


            const message =
                normalizeSmsMessage(
                    req.body?.message
                );


            if (!message) {

                return res.status(400).json({

                    success: false,

                    message:
                        "La réponse est vide."
                });
            }


            client =
                await pool.connect();


            const parentResult =
                await client.query(
                    `
                    SELECT *
                    FROM sms_messages
                    WHERE id = $1
                    LIMIT 1
                    `,
                    [smsId]
                );


            if (
                parentResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "SMS parent introuvable."
                });
            }


            const parent =
                parentResult.rows[0];


            const recipientUserId =
                Number(
                    parent.recipient_user_id
                );


            const user =
                await getSmsUser(
                    client,
                    recipientUserId
                );


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur destinataire introuvable."
                });
            }


            const subject =
                normalizeSmsSubject(
                    req.body?.subject ||
                    `Re: ${parent.subject || "BMJ SERVICE"}`
                );


            const priority =
                normalizeSmsPriority(
                    req.body?.priority ||
                    parent.priority
                );


            /*
             * Toujours rattacher la réponse
             * au message racine de la conversation.
             */

            const rootParentId =
                parent.parent_id
                    ? Number(parent.parent_id)
                    : Number(parent.id);


            await client.query(
                "BEGIN"
            );

            transactionStarted = true;


            const replyResult =
                await client.query(
                    `
                    INSERT INTO sms_messages
                    (
                        sender_type,
                        sender_id,
                        recipient_user_id,
                        subject,
                        message,
                        priority,
                        audience,
                        is_read,
                        is_archived,
                        parent_id,
                        status,
                        created_at,
                        updated_at
                    )
                    VALUES
                    (
                        'admin',
                        NULL,
                        $1,
                        $2,
                        $3,
                        $4,
                        'user',
                        FALSE,
                        FALSE,
                        $5,
                        'sent',
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )
                    RETURNING *
                    `,
                    [
                        recipientUserId,
                        subject,
                        message,
                        priority,
                        rootParentId
                    ]
                );


            const reply =
                replyResult.rows[0];


            await createSmsUserActivity(
                client,
                recipientUserId,
                "SMS_ADMIN_REPONSE",
                `Réponse SMS : ${subject}`
            );


            await client.query(
                `
                UPDATE sms_messages
                SET
                    is_read = TRUE,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                `,
                [smsId]
            );


            await client.query(
                "COMMIT"
            );

            transactionStarted = false;


            await createNotification(
                pool,
                recipientUserId,
                subject,
                message,
                priority === "urgent"
                    ? "urgent"
                    : "message"
            );


            await safeLogAdminAction(
                "SMS_REPONSE",
                `Réponse SMS envoyée à ${user.email} (ID ${recipientUserId}).`
            );


            return res.status(201).json({

                success: true,

                sms:
                    reply,

                message:
                    "Réponse SMS envoyée."
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

                } catch (rollbackError) {

                    console.error(
                        "[SMS ADMIN REPLY] ROLLBACK :",
                        rollbackError.message
                    );
                }
            }


            console.error(
                "[SMS ADMIN REPLY] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de la réponse SMS.",

                error:
                    error.message,

                code:
                    error.code || null
            });

        } finally {

            if (client) {

                client.release();
            }
        }
    }
);


/* ============================================================
   SMS — SUPPRIMER TOUTE LA CONVERSATION D'UN UTILISATEUR
   Suppression ciblée uniquement pour cet utilisateur.
============================================================ */

app.delete(
    "/api/admin/sms/user/:userId",
    adminAuth,
    async (req, res) => {

        try {

            const userId =
                Number(
                    req.params.userId
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


            const user =
                await getSmsUser(
                    pool,
                    userId
                );


            if (!user) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable."
                });
            }


            const result =
                await pool.query(
                    `
                    DELETE FROM sms_messages
                    WHERE recipient_user_id = $1
                    RETURNING id
                    `,
                    [userId]
                );


            await safeLogAdminAction(
                "SMS_SUPPRESSION_CONVERSATION",
                `Conversation SMS de ${user.email} (ID ${userId}) supprimée — ${result.rows.length} message(s).`
            );


            return res.json({

                success: true,

                deleted:
                    result.rows.length,

                user_id:
                    userId,

                message:
                    "Conversation SMS supprimée avec succès."
            });

        } catch (error) {

            console.error(
                "[SMS DELETE CONVERSATION] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de la suppression de la conversation.",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   SMS — STATISTIQUES ADMIN
============================================================ */

app.get(
    "/api/admin/sms/stats",
    adminAuth,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT

                        COUNT(*)::INTEGER
                            AS total,

                        COUNT(*) FILTER (
                            WHERE COALESCE(is_read, FALSE) = FALSE
                        )::INTEGER
                            AS unread,

                        COUNT(*) FILTER (
                            WHERE COALESCE(is_read, FALSE) = TRUE
                        )::INTEGER
                            AS read,

                        COUNT(*) FILTER (
                            WHERE audience = 'all'
                        )::INTEGER
                            AS all_messages,

                        COUNT(*) FILTER (
                            WHERE audience = 'premium'
                        )::INTEGER
                            AS premium,

                        COUNT(*) FILTER (
                            WHERE audience = 'standard'
                        )::INTEGER
                            AS standard,

                        COUNT(*) FILTER (
                            WHERE audience = 'user'
                        )::INTEGER
                            AS individual,

                        COUNT(*) FILTER (
                            WHERE COALESCE(is_archived, FALSE) = TRUE
                        )::INTEGER
                            AS archived

                    FROM sms_messages
                    `
                );


            const row =
                result.rows[0];


            const stats = {

                total:
                    Number(row.total) || 0,

                unread:
                    Number(row.unread) || 0,

                read:
                    Number(row.read) || 0,

                all:
                    Number(row.all_messages) || 0,

                premium:
                    Number(row.premium) || 0,

                standard:
                    Number(row.standard) || 0,

                individual:
                    Number(row.individual) || 0,

                archived:
                    Number(row.archived) || 0
            };


            return res.json({

                success: true,

                stats,

                data:
                    stats
            });

        } catch (error) {

            console.error(
                "[SMS STATS] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur statistiques SMS.",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   SMS — MESSAGES RÉCENTS
============================================================ */

app.get(
    "/api/admin/sms/recent",
    adminAuth,
    async (req, res) => {

        try {

            let limit =
                Number(
                    req.query.limit
                );


            if (
                !Number.isInteger(limit) ||
                limit <= 0
            ) {

                limit = 50;
            }


            limit =
                Math.min(
                    limit,
                    200
                );


            const result =
                await pool.query(
                    `
                    SELECT
                        sms.id,
                        sms.sender_type,
                        sms.sender_id,
                        sms.recipient_user_id,
                        sms.subject,
                        sms.message,
                        sms.priority,
                        sms.audience,
                        sms.is_read,
                        sms.is_archived,
                        sms.parent_id,
                        sms.status,
                        sms.created_at,
                        sms.updated_at,

                        u.nom AS user_nom,
                        u.email AS user_email,
                        u.telephone AS user_telephone

                    FROM sms_messages sms

                    LEFT JOIN users u
                        ON u.id = sms.recipient_user_id

                    ORDER BY
                        sms.created_at DESC,
                        sms.id DESC

                    LIMIT $1
                    `,
                    [limit]
                );


            return res.json({

                success: true,

                count:
                    result.rows.length,

                messages:
                    result.rows
            });

        } catch (error) {

            console.error(
                "[SMS RECENT] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur récupération SMS récents.",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   SMS — DIAGNOSTIC ADMIN
============================================================ */

app.get(
    "/api/admin/sms/diagnostic",
    adminAuth,
    async (req, res) => {

        try {

            const [

                tableResult,

                usersResult,

                smsResult,

                unreadResult,

                readResult,

                todayResult,

                premiumResult,

                standardResult,

                archivedResult

            ] =
                await Promise.all([

                    pool.query(
                        `
                        SELECT
                            to_regclass(
                                'public.sms_messages'
                            ) AS table_name
                        `
                    ),

                    pool.query(
                        `
                        SELECT
                            COUNT(*)::INTEGER AS total
                        FROM users
                        `
                    ),

                    pool.query(
                        `
                        SELECT
                            COUNT(*)::INTEGER AS total
                        FROM sms_messages
                        `
                    ),

                    pool.query(
                        `
                        SELECT
                            COUNT(*)::INTEGER AS total
                        FROM sms_messages
                        WHERE COALESCE(is_read, FALSE) = FALSE
                        `
                    ),

                    pool.query(
                        `
                        SELECT
                            COUNT(*)::INTEGER AS total
                        FROM sms_messages
                        WHERE COALESCE(is_read, FALSE) = TRUE
                        `
                    ),

                    pool.query(
                        `
                        SELECT
                            COUNT(*)::INTEGER AS total
                        FROM sms_messages
                        WHERE created_at::DATE = CURRENT_DATE
                        `
                    ),

                    pool.query(
                        `
                        SELECT
                            COUNT(*)::INTEGER AS total
                        FROM sms_messages
                        WHERE audience = 'premium'
                        `
                    ),

                    pool.query(
                        `
                        SELECT
                            COUNT(*)::INTEGER AS total
                        FROM sms_messages
                        WHERE audience = 'standard'
                        `
                    ),

                    pool.query(
                        `
                        SELECT
                            COUNT(*)::INTEGER AS total
                        FROM sms_messages
                        WHERE COALESCE(is_archived, FALSE) = TRUE
                        `
                    )
                ]);


            return res.json({

                success: true,

                database: {

                    sms_table:
                        tableResult.rows[0]?.table_name !== null,

                    users:
                        Number(
                            usersResult.rows[0]?.total
                        ) || 0,

                    sms:
                        Number(
                            smsResult.rows[0]?.total
                        ) || 0,

                    unread:
                        Number(
                            unreadResult.rows[0]?.total
                        ) || 0,

                    read:
                        Number(
                            readResult.rows[0]?.total
                        ) || 0,

                    today:
                        Number(
                            todayResult.rows[0]?.total
                        ) || 0,

                    premium:
                        Number(
                            premiumResult.rows[0]?.total
                        ) || 0,

                    standard:
                        Number(
                            standardResult.rows[0]?.total
                        ) || 0,

                    archived:
                        Number(
                            archivedResult.rows[0]?.total
                        ) || 0
                },

                message:
                    "Diagnostic SMS effectué."
            });

        } catch (error) {

            console.error(
                "[SMS DIAGNOSTIC] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur diagnostic SMS.",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   ============================================================
   PARTIE UTILISATEUR
   ============================================================
============================================================ */


/* ============================================================
   SMS UTILISATEUR — PROFIL
============================================================ */

app.get(
    "/api/user/sms/profile",
    userSmsAuth,
    async (req, res) => {

        try {

            return res.json({

                success: true,

                user: {

                    id:
                        req.smsUser.id,

                    nom:
                        req.smsUser.nom,

                    email:
                        req.smsUser.email,

                    telephone:
                        req.smsUser.telephone,

                    photo:
                        req.smsUser.photo,

                    domaine:
                        req.smsUser.domaine,

                    pays:
                        req.smsUser.pays,

                    ville:
                        req.smsUser.ville,

                    niveau:
                        req.smsUser.niveau,

                    is_premium:
                        req.smsUser.is_premium,

                    progression:
                        req.smsUser.progression
                }
            });

        } catch (error) {

            console.error(
                "[USER SMS PROFILE] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur récupération profil SMS.",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   SMS UTILISATEUR — LISTE DES SMS
============================================================ */

app.get(
    "/api/user/sms",
    userSmsAuth,
    async (req, res) => {

        try {

            const messagesResult =
                await pool.query(
                    `
                    SELECT
                        id,
                        sender_type,
                        sender_id,
                        recipient_user_id,
                        subject,
                        message,
                        priority,
                        audience,
                        is_read,
                        is_archived,
                        parent_id,
                        status,
                        created_at,
                        updated_at
                    FROM sms_messages
                    WHERE
                        recipient_user_id = $1
                        AND COALESCE(is_archived, FALSE) = FALSE
                    ORDER BY
                        created_at ASC,
                        id ASC
                    `,
                    [req.smsUserId]
                );


            const unreadResult =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER AS unread
                    FROM sms_messages
                    WHERE
                        recipient_user_id = $1
                        AND COALESCE(is_archived, FALSE) = FALSE
                        AND COALESCE(is_read, FALSE) = FALSE
                    `,
                    [req.smsUserId]
                );


            return res.json({

                success: true,

                user:
                    req.smsUser,

                count:
                    messagesResult.rows.length,

                unread:
                    Number(
                        unreadResult.rows[0]?.unread
                    ) || 0,

                messages:
                    messagesResult.rows
            });

        } catch (error) {

            console.error(
                "[USER SMS LIST] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur récupération de vos SMS.",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   SMS UTILISATEUR — COMPTEUR NON LUS
============================================================ */

app.get(
    "/api/user/sms/unread",
    userSmsAuth,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER AS unread
                    FROM sms_messages
                    WHERE
                        recipient_user_id = $1
                        AND COALESCE(is_archived, FALSE) = FALSE
                        AND COALESCE(is_read, FALSE) = FALSE
                    `,
                    [req.smsUserId]
                );


            const unread =
                Number(
                    result.rows[0]?.unread
                ) || 0;


            return res.json({

                success: true,

                unread,

                count:
                    unread
            });

        } catch (error) {

            console.error(
                "[USER SMS UNREAD] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur récupération compteur SMS.",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   SMS UTILISATEUR — STATUT
============================================================ */

app.get(
    "/api/user/sms/status",
    userSmsAuth,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER AS total,

                        COUNT(*) FILTER (
                            WHERE COALESCE(is_read, FALSE) = FALSE
                        )::INTEGER AS unread,

                        COUNT(*) FILTER (
                            WHERE COALESCE(is_read, FALSE) = TRUE
                        )::INTEGER AS read

                    FROM sms_messages

                    WHERE
                        recipient_user_id = $1
                        AND COALESCE(is_archived, FALSE) = FALSE
                    `,
                    [req.smsUserId]
                );


            const row =
                result.rows[0];


            return res.json({

                success: true,

                total:
                    Number(row.total) || 0,

                unread:
                    Number(row.unread) || 0,

                read:
                    Number(row.read) || 0
            });

        } catch (error) {

            console.error(
                "[USER SMS STATUS] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur statut SMS.",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   SMS UTILISATEUR — MARQUER UN SMS COMME LU
============================================================ */

app.patch(
    "/api/user/sms/:smsId/read",
    userSmsAuth,
    async (req, res) => {

        try {

            const smsId =
                Number(
                    req.params.smsId
                );


            if (
                !Number.isInteger(smsId) ||
                smsId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant SMS invalide."
                });
            }


            const result =
                await pool.query(
                    `
                    UPDATE sms_messages

                    SET
                        is_read = TRUE,
                        updated_at = CURRENT_TIMESTAMP

                    WHERE
                        id = $1
                        AND recipient_user_id = $2

                    RETURNING *
                    `,
                    [
                        smsId,
                        req.smsUserId
                    ]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "SMS introuvable ou non autorisé."
                });
            }


            return res.json({

                success: true,

                sms:
                    result.rows[0],

                message:
                    "SMS marqué comme lu."
            });

        } catch (error) {

            console.error(
                "[USER SMS READ] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur marquage SMS.",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   SMS UTILISATEUR — MARQUER TOUS COMME LUS
============================================================ */

app.patch(
    "/api/user/sms/read-all",
    userSmsAuth,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    UPDATE sms_messages

                    SET
                        is_read = TRUE,
                        updated_at = CURRENT_TIMESTAMP

                    WHERE
                        recipient_user_id = $1
                        AND COALESCE(is_read, FALSE) = FALSE
                        AND COALESCE(is_archived, FALSE) = FALSE

                    RETURNING id
                    `,
                    [req.smsUserId]
                );


            return res.json({

                success: true,

                count:
                    result.rows.length,

                message:
                    "Tous vos SMS ont été marqués comme lus."
            });

        } catch (error) {

            console.error(
                "[USER SMS READ ALL] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors du marquage des SMS.",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   SMS UTILISATEUR — RÉPONDRE À UN SMS
============================================================ */

app.post(
    "/api/user/sms/:smsId/reply",
    userSmsAuth,
    async (req, res) => {

        let client = null;
        let transactionStarted = false;

        try {

            const smsId =
                Number(
                    req.params.smsId
                );


            if (
                !Number.isInteger(smsId) ||
                smsId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant SMS invalide."
                });
            }


            const message =
                normalizeSmsMessage(
                    req.body?.message
                );


            if (!message) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Votre réponse est vide."
                });
            }


            client =
                await pool.connect();


            const parentResult =
                await client.query(
                    `
                    SELECT *
                    FROM sms_messages
                    WHERE
                        id = $1
                        AND recipient_user_id = $2
                    LIMIT 1
                    `,
                    [
                        smsId,
                        req.smsUserId
                    ]
                );


            if (
                parentResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "SMS introuvable ou non autorisé."
                });
            }


            const parent =
                parentResult.rows[0];


            const subject =
                normalizeSmsSubject(
                    req.body?.subject ||
                    `Re: ${parent.subject || "BMJ SERVICE"}`
                );


            const priority =
                normalizeSmsPriority(
                    req.body?.priority ||
                    parent.priority ||
                    "normal"
                );


            const rootParentId =
                parent.parent_id
                    ? Number(parent.parent_id)
                    : Number(parent.id);


            await client.query(
                "BEGIN"
            );

            transactionStarted = true;


            const replyResult =
                await client.query(
                    `
                    INSERT INTO sms_messages
                    (
                        sender_type,
                        sender_id,
                        recipient_user_id,
                        subject,
                        message,
                        priority,
                        audience,
                        is_read,
                        is_archived,
                        parent_id,
                        status,
                        created_at,
                        updated_at
                    )
                    VALUES
                    (
                        'user',
                        $1,
                        $1,
                        $2,
                        $3,
                        $4,
                        'admin',
                        TRUE,
                        FALSE,
                        $5,
                        'sent',
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )
                    RETURNING *
                    `,
                    [
                        req.smsUserId,
                        subject,
                        message,
                        priority,
                        rootParentId
                    ]
                );


            const reply =
                replyResult.rows[0];


            await createSmsUserActivity(
                client,
                req.smsUserId,
                "SMS_UTILISATEUR_REPONSE",
                `Réponse envoyée : ${subject}`
            );


            await client.query(
                `
                UPDATE sms_messages

                SET
                    is_read = TRUE,
                    updated_at = CURRENT_TIMESTAMP

                WHERE
                    id = $1
                    AND recipient_user_id = $2
                `,
                [
                    smsId,
                    req.smsUserId
                ]
            );


            await client.query(
                "COMMIT"
            );

            transactionStarted = false;


            await safeLogAdminAction(
                "SMS_REPONSE_UTILISATEUR",
                `Utilisateur ${req.smsUserId} a répondu au SMS #${smsId}.`
            );


            return res.status(201).json({

                success: true,

                sms:
                    reply,

                message:
                    "Votre réponse a été envoyée."
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

                } catch (rollbackError) {

                    console.error(
                        "[USER SMS REPLY] ROLLBACK :",
                        rollbackError.message
                    );
                }
            }


            console.error(
                "[USER SMS REPLY] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de l'envoi de votre réponse.",

                error:
                    error.message,

                code:
                    error.code || null
            });

        } finally {

            if (client) {

                client.release();
            }
        }
    }
);


/* ============================================================
   SMS UTILISATEUR — CONVERSATION
============================================================ */

app.get(
    "/api/user/sms/:smsId/conversation",
    userSmsAuth,
    async (req, res) => {

        try {

            const smsId =
                Number(
                    req.params.smsId
                );


            if (
                !Number.isInteger(smsId) ||
                smsId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant SMS invalide."
                });
            }


            const parentResult =
                await pool.query(
                    `
                    SELECT *
                    FROM sms_messages
                    WHERE
                        id = $1
                        AND recipient_user_id = $2
                    LIMIT 1
                    `,
                    [
                        smsId,
                        req.smsUserId
                    ]
                );


            if (
                parentResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "SMS introuvable ou non autorisé."
                });
            }


            const parent =
                parentResult.rows[0];


            const rootId =
                parent.parent_id
                    ? Number(parent.parent_id)
                    : Number(parent.id);


            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        sender_type,
                        sender_id,
                        recipient_user_id,
                        subject,
                        message,
                        priority,
                        audience,
                        is_read,
                        is_archived,
                        parent_id,
                        status,
                        created_at,
                        updated_at
                    FROM sms_messages
                    WHERE
                        recipient_user_id = $1
                        AND (
                            id = $2
                            OR parent_id = $2
                        )
                    ORDER BY
                        created_at ASC,
                        id ASC
                    `,
                    [
                        req.smsUserId,
                        rootId
                    ]
                );


            return res.json({

                success: true,

                root_id:
                    rootId,

                count:
                    result.rows.length,

                messages:
                    result.rows
            });

        } catch (error) {

            console.error(
                "[USER SMS CONVERSATION] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur récupération conversation.",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   SMS UTILISATEUR — ARCHIVER SON SMS
============================================================ */

app.patch(
    "/api/user/sms/:smsId/archive",
    userSmsAuth,
    async (req, res) => {

        try {

            const smsId =
                Number(
                    req.params.smsId
                );


            if (
                !Number.isInteger(smsId) ||
                smsId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant SMS invalide."
                });
            }


            const result =
                await pool.query(
                    `
                    UPDATE sms_messages

                    SET
                        is_archived = TRUE,
                        updated_at = CURRENT_TIMESTAMP

                    WHERE
                        id = $1
                        AND recipient_user_id = $2

                    RETURNING *
                    `,
                    [
                        smsId,
                        req.smsUserId
                    ]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "SMS introuvable ou non autorisé."
                });
            }


            return res.json({

                success: true,

                sms:
                    result.rows[0],

                message:
                    "SMS archivé."
            });

        } catch (error) {

            console.error(
                "[USER SMS ARCHIVE] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur archivage SMS.",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   SMS UTILISATEUR — RESTAURER SON SMS
============================================================ */

app.patch(
    "/api/user/sms/:smsId/unarchive",
    userSmsAuth,
    async (req, res) => {

        try {

            const smsId =
                Number(
                    req.params.smsId
                );


            if (
                !Number.isInteger(smsId) ||
                smsId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant SMS invalide."
                });
            }


            const result =
                await pool.query(
                    `
                    UPDATE sms_messages

                    SET
                        is_archived = FALSE,
                        updated_at = CURRENT_TIMESTAMP

                    WHERE
                        id = $1
                        AND recipient_user_id = $2

                    RETURNING *
                    `,
                    [
                        smsId,
                        req.smsUserId
                    ]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "SMS introuvable ou non autorisé."
                });
            }


            return res.json({

                success: true,

                sms:
                    result.rows[0],

                message:
                    "SMS restauré."
            });

        } catch (error) {

            console.error(
                "[USER SMS UNARCHIVE] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur restauration SMS.",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   FIN DU NOUVEAU SYSTÈME SMS
============================================================ */
/* ============================================================
   MESSAGES — ENVOI AUX STANDARD
============================================================ */

app.post(
    "/api/admin/messages/standard",
    adminAuth,
    async (req, res) => {

        const client =
            await pool.connect();


        try {

            const data =
                normalizeAdminMessageData(
                    req.body
                );


            if (!data.message) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Le message est vide"
                });
            }


            const usersResult =
                await client.query(
                    `
                    SELECT
                        id,
                        nom,
                        email

                    FROM users

                    WHERE
                        COALESCE(
                            is_premium,
                            FALSE
                        ) = FALSE

                    ORDER BY id ASC
                    `
                );


            if (
                usersResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Aucun utilisateur Standard trouvé",

                    count: 0
                });
            }


            await client.query(
                "BEGIN"
            );


            let inserted = 0;


            for (
                const user
                of usersResult.rows
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
                        priority,
                        is_read,
                        is_archived,
                        parent_id,
                        created_at,
                        updated_at
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
                        $4,
                        FALSE,
                        FALSE,
                        NULL,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )
                    `,
                    [
                        user.id,
                        data.subject,
                        data.message,
                        data.priority
                    ]
                );


                await client.query(
                    `
                    INSERT INTO user_activity
                    (
                        user_id,
                        action,
                        details,
                        created_at
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        CURRENT_TIMESTAMP
                    )
                    `,
                    [
                        user.id,
                        "MESSAGE_ADMIN_RECU",
                        `Message Standard : ${data.subject}`
                    ]
                );


                inserted++;
            }


            await client.query(
                "COMMIT"
            );


            for (
                const user
                of usersResult.rows
            ) {

                await createNotification(
                    pool,
                    user.id,
                    data.subject,
                    data.message,
                    data.priority === "urgent"
                        ? "urgent"
                        : "message"
                );
            }


            await safeLogAdminAction(
                "MESSAGE_STANDARD",
                `Message envoyé à ${inserted} Standard(s) — ${data.subject}`
            );


            return res.status(201).json({

                success: true,

                count:
                    inserted,

                message:
                    `${inserted} message(s) Standard envoyé(s)`
            });

        } catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (
                rollbackError
            ) {

                console.error(
                    "[MESSAGES STANDARD] ROLLBACK :",
                    rollbackError.message
                );
            }


            console.error(
                "[MESSAGES STANDARD] ERREUR :",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de l'envoi aux Standard",

                error:
                    error.message,

                code:
                    error.code || null
            });

        } finally {

            client.release();
        }
    }
);


/* ============================================================
   RÉCUPÉRER LES MESSAGES D'UN UTILISATEUR — ADMIN
============================================================ */

app.get(
    "/api/admin/users/:id/messages",
    adminAuth,
    async (req, res) => {

        try {

            const userId =
                Number(req.params.id);


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
                        email

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
                    SELECT

                        m.*,

                        u.nom AS sender_user_name,

                        u.email AS sender_user_email

                    FROM messages m

                    LEFT JOIN users u
                        ON u.id = m.sender_id

                    WHERE

                        m.recipient_user_id = $1

                        OR
                        (
                            m.sender_type = 'user'
                            AND m.sender_id = $1
                        )

                        OR
                        m.parent_id IN
                        (
                            SELECT id

                            FROM messages

                            WHERE
                                recipient_user_id = $1

                                OR
                                (
                                    sender_type = 'user'
                                    AND sender_id = $1
                                )
                        )

                    ORDER BY
                        m.id ASC
                    `,
                    [userId]
                );


            return res.json({

                success: true,

                user:
                    userResult.rows[0],

                count:
                    result.rows.length,

                messages:
                    result.rows
            });

        } catch (error) {

            console.error(
                "[ADMIN USER MESSAGES]",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur récupération messages",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   RÉCUPÉRER LES MESSAGES D'UN UTILISATEUR
============================================================ */

app.get(
    "/api/users/:id/messages",
    async (req, res) => {

        try {

            const userId =
                Number(req.params.id);


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


            const result =
                await pool.query(
                    `
                    SELECT

                        id,
                        sender_type,
                        sender_id,
                        recipient_type,
                        recipient_user_id,
                        audience,
                        subject,
                        message,
                        priority,
                        is_read,
                        is_archived,
                        parent_id,
                        created_at,
                        updated_at

                    FROM messages

                    WHERE
                        recipient_user_id = $1

                    ORDER BY
                        id DESC
                    `,
                    [userId]
                );


            return res.json({

                success: true,

                count:
                    result.rows.length,

                messages:
                    result.rows
            });

        } catch (error) {

            console.error(
                "[USER MESSAGES]",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur récupération messages",

                error:
                    error.message
            });
        }
    }
);


/* ============================================================
   MARQUER UN MESSAGE COMME LU
   ============================================================
   IMPORTANT :
   Cette route ne supprime rien.
   Elle modifie uniquement is_read.
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


            if (
                !Number.isInteger(userId) ||
                userId <= 0 ||
                !Number.isInteger(messageId) ||
                messageId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant invalide"
                });
            }


            const result =
                await pool.query(
                    `
                    UPDATE messages

                    SET
                        is_read = TRUE,
                        updated_at = CURRENT_TIMESTAMP

                    WHERE
                        id = $1

                    AND
                        recipient_user_id = $2

                    RETURNING
                        id,
                        is_read,
                        updated_at
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


            return res.json({

                success: true,

                message:
                    result.rows[0],

                message_text:
                    "Message marqué comme lu"
            });

        } catch (error) {

            console.error(
                "[MESSAGE READ]",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de la lecture du message",

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


        try {

            const parentId =
                Number(
                    req.params.id
                );


            const data =
                normalizeAdminMessageData(
                    req.body
                );


            if (
                !Number.isInteger(parentId) ||
                parentId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Identifiant du message parent invalide"
                });
            }


            if (!data.message) {

                return res.status(400).json({

                    success: false,

                    message:
                        "La réponse est vide"
                });
            }


            const parentResult =
                await client.query(
                    `
                    SELECT

                        id,
                        recipient_user_id,
                        sender_type,
                        sender_id,
                        subject

                    FROM messages

                    WHERE id = $1
                    `,
                    [parentId]
                );


            if (
                parentResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Message parent introuvable"
                });
            }


            const parent =
                parentResult.rows[0];


            let recipientUserId =
                Number(
                    parent.recipient_user_id
                );


            /*
             * Si le message parent a été envoyé
             * par l'utilisateur à l'administration,
             * on répond à sender_id.
             */

            if (
                parent.sender_type === "user" &&
                parent.sender_id
            ) {

                recipientUserId =
                    Number(
                        parent.sender_id
                    );
            }


            if (
                !Number.isInteger(
                    recipientUserId
                ) ||
                recipientUserId <= 0
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Impossible de déterminer le destinataire de la réponse"
                });
            }


            const userResult =
                await client.query(
                    `
                    SELECT
                        id,
                        nom,
                        email

                    FROM users

                    WHERE id = $1
                    `,
                    [recipientUserId]
                );


            if (
                userResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur destinataire introuvable"
                });
            }


            await client.query(
                "BEGIN"
            );


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
                        is_read,
                        is_archived,
                        parent_id,
                        created_at,
                        updated_at
                    )
                    VALUES
                    (
                        'admin',
                        NULL,
                        'user',
                        $1,
                        'user',
                        $2,
                        $3,
                        $4,
                        FALSE,
                        FALSE,
                        $5,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )

                    RETURNING *
                    `,
                    [
                        recipientUserId,

                        data.subject ||
                            parent.subject ||
                            "Réponse BMJ SERVICE",

                        data.message,

                        data.priority,

                        parentId
                    ]
                );


            await client.query(
                `
                INSERT INTO user_activity
                (
                    user_id,
                    action,
                    details,
                    created_at
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    CURRENT_TIMESTAMP
                )
                `,
                [
                    recipientUserId,
                    "REPONSE_ADMIN",
                    `Réponse au message #${parentId}`
                ]
            );


            await client.query(
                "COMMIT"
            );


            await createNotification(
                pool,
                recipientUserId,
                data.subject ||
                    parent.subject ||
                    "Réponse BMJ SERVICE",
                data.message,
                data.priority === "urgent"
                    ? "urgent"
                    : "message"
            );


            await safeLogAdminAction(
                "REPONSE_MESSAGE",
                `Réponse au message #${parentId} pour utilisateur ${recipientUserId}`
            );


            return res.status(201).json({

                success: true,

                message:
                    replyResult.rows[0],

                parent_id:
                    parentId,

                recipient_user_id:
                    recipientUserId,

                message_text:
                    "Réponse envoyée avec succès"
            });

        } catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch (
                rollbackError
            ) {

                console.error(
                    "[MESSAGE REPLY] ROLLBACK :",
                    rollbackError.message
                );
            }


            console.error(
                "[MESSAGE REPLY]",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur lors de l'envoi de la réponse",

                error:
                    error.message,

                code:
                    error.code || null
            });

        } finally {

            client.release();
        }
    }
);


/* ============================================================
   DIAGNOSTIC COMPLET — MESSAGES
   ============================================================
   Lecture uniquement.
   Aucun INSERT.
   Aucun UPDATE.
   Aucun DELETE.
   Aucun DROP.
   Aucun TRUNCATE.
============================================================ */

app.get(
    "/api/admin/messages/diagnostic",
    adminAuth,
    async (req, res) => {

        try {

            /* ====================================================
               TABLE
            ==================================================== */

            const tableResult =
                await pool.query(
                    `
                    SELECT
                        table_schema,
                        table_name

                    FROM information_schema.tables

                    WHERE
                        table_schema = 'public'

                    AND
                        table_name = 'messages'

                    LIMIT 1
                    `
                );


            const tableExists =
                tableResult.rows.length > 0;


            if (!tableExists) {

                return res.status(404).json({

                    success: false,

                    table_exists: false,

                    table:
                        "messages",

                    schema:
                        "public",

                    message:
                        "La table messages n'existe pas dans PostgreSQL."
                });
            }


            /* ====================================================
               COLONNES
            ==================================================== */

            const columnsResult =
                await pool.query(
                    `
                    SELECT

                        ordinal_position,

                        column_name,

                        data_type,

                        udt_name,

                        character_maximum_length,

                        is_nullable,

                        column_default

                    FROM information_schema.columns

                    WHERE
                        table_schema = 'public'

                    AND
                        table_name = 'messages'

                    ORDER BY
                        ordinal_position
                    `
                );


            const columns =
                columnsResult.rows;


            const columnNames =
                columns.map(
                    column =>
                        column.column_name
                );


            const requiredColumns = [

                "id",
                "sender_type",
                "sender_id",
                "recipient_type",
                "recipient_user_id",
                "audience",
                "subject",
                "message",
                "priority",
                "is_read",
                "is_archived",
                "parent_id",
                "created_at",
                "updated_at"

            ];


            const missingColumns =
                requiredColumns.filter(
                    column =>
                        !columnNames.includes(
                            column
                        )
                );


            /* ====================================================
               CONTRAINTES
            ==================================================== */

            const constraintsResult =
                await pool.query(
                    `
                    SELECT

                        tc.constraint_name,

                        tc.constraint_type

                    FROM information_schema.table_constraints tc

                    WHERE
                        tc.table_schema = 'public'

                    AND
                        tc.table_name = 'messages'

                    ORDER BY
                        tc.constraint_type,
                        tc.constraint_name
                    `
                );


            /* ====================================================
               CLÉ PRIMAIRE
            ==================================================== */

            const primaryKeyResult =
                await pool.query(
                    `
                    SELECT

                        tc.constraint_name,

                        kcu.column_name

                    FROM information_schema.table_constraints tc

                    JOIN information_schema.key_column_usage kcu

                        ON
                            tc.constraint_name =
                            kcu.constraint_name

                        AND
                            tc.table_schema =
                            kcu.table_schema

                    WHERE
                        tc.table_schema = 'public'

                    AND
                        tc.table_name = 'messages'

                    AND
                        tc.constraint_type = 'PRIMARY KEY'

                    ORDER BY
                        kcu.ordinal_position
                    `
                );


            /* ====================================================
               INDEX
            ==================================================== */

            const indexesResult =
                await pool.query(
                    `
                    SELECT

                        indexname,

                        indexdef

                    FROM pg_indexes

                    WHERE
                        schemaname = 'public'

                    AND
                        tablename = 'messages'

                    ORDER BY
                        indexname
                    `
                );


            /* ====================================================
               STATISTIQUES
            ==================================================== */

            const statisticsResult =
                await pool.query(
                    `
                    SELECT

                        COUNT(*)::INTEGER
                            AS total,

                        COUNT(*) FILTER
                        (
                            WHERE
                                COALESCE(
                                    is_read,
                                    FALSE
                                ) = FALSE
                        )::INTEGER
                            AS unread,

                        COUNT(*) FILTER
                        (
                            WHERE
                                COALESCE(
                                    is_read,
                                    FALSE
                                ) = TRUE
                        )::INTEGER
                            AS read,

                        COUNT(*) FILTER
                        (
                            WHERE
                                COALESCE(
                                    is_archived,
                                    FALSE
                                ) = TRUE
                        )::INTEGER
                            AS archived,

                        COUNT(*) FILTER
                        (
                            WHERE
                                COALESCE(
                                    is_archived,
                                    FALSE
                                ) = FALSE
                        )::INTEGER
                            AS active,

                        COUNT(*) FILTER
                        (
                            WHERE
                                recipient_user_id IS NOT NULL
                        )::INTEGER
                            AS direct,

                        COUNT(*) FILTER
                        (
                            WHERE
                                recipient_user_id IS NULL
                        )::INTEGER
                            AS without_recipient,

                        COUNT(*) FILTER
                        (
                            WHERE
                                parent_id IS NULL
                        )::INTEGER
                            AS root_messages,

                        COUNT(*) FILTER
                        (
                            WHERE
                                parent_id IS NOT NULL
                        )::INTEGER
                            AS replies

                    FROM messages
                    `
                );


            /* ====================================================
               AUDIENCE
            ==================================================== */

            const audienceResult =
                await pool.query(
                    `
                    SELECT

                        COALESCE(
                            NULLIF(
                                TRIM(audience),
                                ''
                            ),
                            'non_definie'
                        ) AS audience,

                        COUNT(*)::INTEGER
                            AS total

                    FROM messages

                    GROUP BY
                        COALESCE(
                            NULLIF(
                                TRIM(audience),
                                ''
                            ),
                            'non_definie'
                        )

                    ORDER BY
                        total DESC
                    `
                );


            /* ====================================================
               PRIORITÉ
            ==================================================== */

            const priorityResult =
                await pool.query(
                    `
                    SELECT

                        COALESCE(
                            NULLIF(
                                TRIM(priority),
                                ''
                            ),
                            'non_definie'
                        ) AS priority,

                        COUNT(*)::INTEGER
                            AS total

                    FROM messages

                    GROUP BY
                        COALESCE(
                            NULLIF(
                                TRIM(priority),
                                ''
                            ),
                            'non_definie'
                        )

                    ORDER BY
                        total DESC
                    `
                );


            /* ====================================================
               EXPÉDITEUR
            ==================================================== */

            const senderResult =
                await pool.query(
                    `
                    SELECT

                        COALESCE(
                            NULLIF(
                                TRIM(sender_type),
                                ''
                            ),
                            'non_defini'
                        ) AS sender_type,

                        COUNT(*)::INTEGER
                            AS total

                    FROM messages

                    GROUP BY
                        COALESCE(
                            NULLIF(
                                TRIM(sender_type),
                                ''
                            ),
                            'non_defini'
                        )

                    ORDER BY
                        total DESC
                    `
                );


            /* ====================================================
               DESTINATAIRE
            ==================================================== */

            const recipientResult =
                await pool.query(
                    `
                    SELECT

                        COALESCE(
                            NULLIF(
                                TRIM(recipient_type),
                                ''
                            ),
                            'non_defini'
                        ) AS recipient_type,

                        COUNT(*)::INTEGER
                            AS total

                    FROM messages

                    GROUP BY
                        COALESCE(
                            NULLIF(
                                TRIM(recipient_type),
                                ''
                            ),
                            'non_defini'
                        )

                    ORDER BY
                        total DESC
                    `
                );


            /* ====================================================
               DESTINATAIRES INVALIDES
            ==================================================== */

            const invalidRecipientResult =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER
                            AS total

                    FROM messages m

                    WHERE
                        m.recipient_user_id IS NOT NULL

                    AND NOT EXISTS
                    (
                        SELECT 1

                        FROM users u

                        WHERE
                            u.id =
                            m.recipient_user_id
                    )
                    `
                );


            /* ====================================================
               DERNIERS MESSAGES
            ==================================================== */

            const recentResult =
                await pool.query(
                    `
                    SELECT

                        id,
                        sender_type,
                        sender_id,
                        recipient_type,
                        recipient_user_id,
                        audience,
                        subject,
                        priority,
                        is_read,
                        is_archived,
                        parent_id,
                        created_at,
                        updated_at

                    FROM messages

                    ORDER BY
                        id DESC

                    LIMIT 20
                    `
                );


            const statistics =
                statisticsResult.rows[0];


            const diagnosticOK =
                missingColumns.length === 0;


            return res.json({

                success: true,

                diagnostic:
                    diagnosticOK
                        ? "OK"
                        : "ATTENTION",

                table: {

                    schema:
                        "public",

                    name:
                        "messages",

                    exists:
                        true,

                    columns_complete:
                        diagnosticOK,

                    missing_columns:
                        missingColumns
                },

                statistics: {

                    total:
                        Number(
                            statistics.total
                        ) || 0,

                    unread:
                        Number(
                            statistics.unread
                        ) || 0,

                    read:
                        Number(
                            statistics.read
                        ) || 0,

                    archived:
                        Number(
                            statistics.archived
                        ) || 0,

                    active:
                        Number(
                            statistics.active
                        ) || 0,

                    direct:
                        Number(
                            statistics.direct
                        ) || 0,

                    without_recipient:
                        Number(
                            statistics.without_recipient
                        ) || 0,

                    root_messages:
                        Number(
                            statistics.root_messages
                        ) || 0,

                    replies:
                        Number(
                            statistics.replies
                        ) || 0,

                    invalid_recipients:
                        Number(
                            invalidRecipientResult
                                .rows[0]
                                .total
                        ) || 0
                },

                structure: {

                    columns,

                    primary_key:
                        primaryKeyResult.rows,

                    constraints:
                        constraintsResult.rows,

                    indexes:
                        indexesResult.rows
                },

                distribution: {

                    audience:
                        audienceResult.rows,

                    priority:
                        priorityResult.rows,

                    sender_type:
                        senderResult.rows,

                    recipient_type:
                        recipientResult.rows
                },

                recent:
                    recentResult.rows,

                message:
                    "Diagnostic messages effectué. Aucune donnée n'a été modifiée."
            });

        } catch (error) {

            console.error(
                "[MESSAGES DIAGNOSTIC]",
                error
            );


            return res.status(500).json({

                success: false,

                diagnostic:
                    "ERROR",

                message:
                    "Erreur lors du diagnostic des messages",

                error:
                    error.message,

                code:
                    error.code || null,

                detail:
                    error.detail || null,

                hint:
                    error.hint || null
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
                Number(req.params.id);


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


            const current =
                await pool.query(
                    `
                    SELECT *
                    FROM users
                    WHERE id = $1
                    `,
                    [id]
                );


            if (
                current.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Utilisateur introuvable"
                });
            }


            const old =
                current.rows[0];


            const nom =
                clean(
                    req.body?.nom ??
                    old.nom
                );


            const sexe =
                clean(
                    req.body?.sexe ??
                    old.sexe
                );


            const email =
                clean(
                    req.body?.email ??
                    old.email
                ).toLowerCase();


            const telephone =
                clean(
                    req.body?.telephone ??
                    old.telephone
                );


            const domaine =
                clean(
                    req.body?.domaine ??
                    old.domaine
                );


            const pays =
                clean(
                    req.body?.pays ??
                    old.pays
                );


            const ville =
                clean(
                    req.body?.ville ??
                    old.ville
                );


            const niveau =
                clean(
                    req.body?.niveau ??
                    old.niveau
                );


            const photo =
                clean(
                    req.body?.photo ??
                    old.photo
                );


            const notes =
                clean(
                    req.body?.notes_admin ??
                    old.notes_admin
                );


            if (
                !isValidEmail(email)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Adresse email invalide"
                });
            }


            const result =
                await pool.query(
                    `
                    UPDATE users

                    SET

                        nom = $1,

                        sexe = $2,

                        email = $3,

                        telephone = $4,

                        domaine = $5,

                        pays = $6,

                        ville = $7,

                        niveau = $8,

                        photo = $9,

                        notes_admin = $10,

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
                    [
                        nom,
                        sexe,
                        email,
                        telephone,
                        domaine,
                        pays,
                        ville,
                        niveau,
                        photo,
                        notes,
                        id
                    ]
                );


            await safeLogAdminAction(
                "MODIFICATION_UTILISATEUR",
                `Utilisateur ${id} modifié`
            );


            return res.json({

                success: true,

                user:
                    publicUser(
                        result.rows[0]
                    ),

                message:
                    "Utilisateur modifié"
            });

        } catch (error) {

            console.error(
                "[ADMIN UPDATE USER]",
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


            return res.status(500).json({

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
   MODIFIER MOT DE PASSE
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
                        "Identifiant utilisateur invalide"
                });
            }


            if (
                !password ||
                password.length < 6
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Mot de passe invalide : minimum 6 caractères"
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

                    RETURNING
                        id,
                        email
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


            return res.json({

                success: true,

                message:
                    "Mot de passe modifié"
            });

        } catch (error) {

            console.error(
                "[ADMIN PASSWORD]",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Erreur mot de passe",

                error:
                    error.message
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

            const id =
                Number(req.params.id);


            const result =
                await pool.query(
                    `
                    UPDATE users

                    SET
                        is_blocked = TRUE,
                        updated_at = CURRENT_TIMESTAMP

                    WHERE id = $1

                    RETURNING
                        id,
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


            await logAdminAction(
                "BLOCAGE_UTILISATEUR",
                `Utilisateur ${id}`
            );


            res.json({

                success: true,

                user:
                    result.rows[0],

                message:
                    "Utilisateur bloqué"
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur blocage"
            });
        }
    }
);


/* ============================================================
   DÉBLOQUER
============================================================ */

app.patch(
    "/api/admin/users/:id/unblock",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);


            const result =
                await pool.query(
                    `
                    UPDATE users

                    SET
                        is_blocked = FALSE,
                        updated_at = CURRENT_TIMESTAMP

                    WHERE id = $1

                    RETURNING
                        id,
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


            await logAdminAction(
                "DEBLOCAGE_UTILISATEUR",
                `Utilisateur ${id}`
            );


            res.json({

                success: true,

                user:
                    result.rows[0],

                message:
                    "Utilisateur débloqué"
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur déblocage"
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

        const client =
            await pool.connect();

        try {

            const id =
                Number(req.params.id);


            await client.query(
                "BEGIN"
            );


            const result =
                await client.query(
                    `
                    UPDATE users

                    SET
                        is_premium = TRUE,
                        updated_at = CURRENT_TIMESTAMP

                    WHERE id = $1

                    RETURNING
                        id,
                        email,
                        is_premium,
                        premium_until
                    `,
                    [id]
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
                "Votre compte BMJ SERVICE est maintenant Premium.",
                "premium"
            );


            await client.query(
                "COMMIT"
            );


            await logAdminAction(
                "ACTIVATION_PREMIUM",
                `Utilisateur ${id}`
            );


            res.json({

                success: true,

                user:
                    result.rows[0],

                message:
                    "Premium activé"
            });

        } catch (error) {

            try {
                await client.query(
                    "ROLLBACK"
                );
            } catch (_) {}


            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur activation Premium"
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
                Number(req.params.id);


            const result =
                await pool.query(
                    `
                    UPDATE users

                    SET
                        is_premium = FALSE,
                        premium_until = NULL,
                        updated_at = CURRENT_TIMESTAMP

                    WHERE id = $1

                    RETURNING
                        id,
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


            await logAdminAction(
                "RETRAIT_PREMIUM",
                `Utilisateur ${id}`
            );


            res.json({

                success: true,

                user:
                    result.rows[0],

                message:
                    "Premium retiré"
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur retrait Premium"
            });
        }
    }
);


/* ============================================================
   CERTIFICAT — AUTORISATION
============================================================ */

app.patch(
    "/api/admin/users/:id/certificat",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);

            const allowed =
                booleanValue(
                    req.body?.certificat_autorise ??
                    req.body?.allowed
                );


            const result =
                await pool.query(
                    `
                    UPDATE users

                    SET
                        certificat_autorise = $1,
                        updated_at = CURRENT_TIMESTAMP

                    WHERE id = $2

                    RETURNING
                        id,
                        certificat_autorise,
                        certificat_obtenu
                    `,
                    [
                        allowed,
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
                "AUTORISATION_CERTIFICAT",
                `Utilisateur ${id}: ${allowed}`
            );


            res.json({

                success: true,

                user:
                    result.rows[0],

                message:
                    allowed
                        ? "Certificat autorisé"
                        : "Autorisation certificat retirée"
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
   CERTIFICAT OBTENU
============================================================ */

app.patch(
    "/api/admin/users/:id/certificat-obtenu",
    adminAuth,
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);


            const result =
                await pool.query(
                    `
                    UPDATE users

                    SET
                        certificat_obtenu = TRUE,
                        updated_at = CURRENT_TIMESTAMP

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


            res.json({

                success: true,

                user:
                    result.rows[0],

                message:
                    "Certificat marqué comme obtenu"
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

        const client =
            await pool.connect();

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


            const userResult =
                await client.query(
                    `
                    SELECT id
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


            const code =
                "BMJ-CERT-" +
                crypto
                    .randomBytes(8)
                    .toString("hex")
                    .toUpperCase();


            await client.query(
                "BEGIN"
            );


            const certificate =
                await client.query(
                    `
                    INSERT INTO certificates
                    (
                        user_id,
                        domaine,
                        titre,
                        certificat_url,
                        certificate_code,
                        is_authorized,
                        downloaded
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        TRUE,
                        FALSE
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


            await client.query(
                `
                UPDATE users

                SET
                    certificat_autorise = TRUE,
                    certificat_obtenu = TRUE,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = $1
                `,
                [userId]
            );


            await createNotification(
                client,
                userId,
                "Certificat disponible",
                "Votre certificat BMJ SERVICE est maintenant disponible.",
                "certificate"
            );


            await client.query(
                "COMMIT"
            );


            await logAdminAction(
                "CREATION_CERTIFICAT",
                `Certificat ${code} pour utilisateur ${userId}`
            );


            res.status(201).json({

                success: true,

                certificate:
                    certificate.rows[0],

                message:
                    "Certificat créé avec succès"
            });

        } catch (error) {

            try {
                await client.query(
                    "ROLLBACK"
                );
            } catch (_) {}


            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Erreur création certificat",

                error:
                    error.message
            });

        } finally {

            client.release();
        }
    }
);


/* ============================================================
   CERTIFICATS ADMIN UTILISATEUR
============================================================ */

app.get(
    "/api/admin/users/:id/certificates",
    adminAuth,
    async (req, res) => {

        try {

            const userId =
                Number(req.params.id);


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
                Number(req.params.id);

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
                userResult.rows[0].is_blocked
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
                        is_read,
                        is_archived,
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
                        FALSE,
                        FALSE,
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

            try {
                await client.query(
                    "ROLLBACK"
                );
            } catch (_) {}


            console.error(
                "[REPONSE MESSAGE]",
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
                Number(req.params.id);


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
                "[ADMIN PAYMENTS]",
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
                Number(req.params.id);


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
   COMPATIBILITÉ PAIEMENTS
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

            res.status(500).json({

                success: false,

                message:
                    "Erreur récupération paiements"
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
                    "[PAIEMENT ACTIVITY]",
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
                "Erreur création paiement:",
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
============================================================ */

app.patch(
    "/api/demandes-paiement/:id/valider",
    adminAuth,
    async (req, res) => {

        const client =
            await pool.connect();

        try {

            const id =
                Number(req.params.id);


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
                Number(row.user_id);


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


            await client.query(
                `
                UPDATE users

                SET
                    is_premium = TRUE,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = $1
                `,
                [userId]
            );


            await createNotification(
                client,
                userId,
                "Compte Premium activé",
                "Votre paiement a été validé. Votre compte est maintenant Premium.",
                "premium"
            );


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
                        'PAIEMENT_VALIDE',
                        'Paiement validé par administration'
                    )
                    `,
                    [userId]
                );

            } catch (activityError) {

                console.error(
                    "[PAYMENT ACTIVITY]",
                    activityError.message
                );
            }


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
                Number(req.params.id);

            const note =
                clean(req.body?.note);


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


            await logAdminAction(
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
   INSCRIPTION
============================================================ */

async function registerUser(
    req,
    res
) {

    try {

        const nom =
            clean(req.body?.nom);

        const sexe =
            clean(req.body?.sexe);

        const email =
            clean(
                req.body?.email
            ).toLowerCase();

        const indicatif =
            clean(
                req.body?.indicatif
            );

        let telephone =
            clean(
                req.body?.telephone
            );

        const domaine =
            clean(req.body?.domaine);

        const pays =
            clean(req.body?.pays);

        const ville =
            clean(req.body?.ville);

        const niveau =
            clean(req.body?.niveau);

        const password =
            String(
                req.body?.password || ""
            );

        const photo =
            clean(req.body?.photo);


        /*
         * Si le formulaire envoie un indicatif
         * séparément, on le conserve dans le
         * numéro sans ajouter une colonne inutile.
         */

        if (
            indicatif &&
            telephone &&
            !telephone.startsWith("+")
        ) {

            telephone =
                `${indicatif}${telephone}`;
        }


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
            hashPassword(password);


        /*
         * NOUVEAU :
         *
         * L'utilisateur reçoit directement
         * une progression aléatoire.
         *
         * Celestine reçoit 100 %.
         */

        const progression =
            isCelestine(email)
                ? 100
                : randomProgression();


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
                    $11,
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
                    photo,
                    progression
                ]
            );


        const user =
            result.rows[0];


        /*
         * Activité secondaire.
         * Elle ne doit jamais casser l'inscription.
         */

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
                    $2
                )
                `,
                [
                    user.id,
                    `Création du compte - progression initiale ${progression}%`
                ]
            );

        } catch (activityError) {

            console.error(
                "[INSCRIPTION] Erreur user_activity :",
                activityError.message
            );
        }


        return res.status(201).json({

            success: true,

            message:
                "Inscription réussie",

            user
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
                req.body?.password || ""
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


        /*
         * Sécurité progression :
         * Celestine est corrigée à 100 %.
         * Un utilisateur déjà à 100 % reste à 100 %.
         */

        if (
            isCelestine(user.email) &&
            Number(user.progression) !== 100
        ) {

            user.progression = 100;

            await pool.query(
                `
                UPDATE users
                SET
                    progression = 100,
                    last_login = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                `,
                [user.id]
            );

        } else {

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
        }


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
                "[LOGIN ACTIVITY]",
                activityError.message
            );
        }


        delete user.password;


        res.json({

            success: true,

            message:
                "Connexion réussie",

            user
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
                Number(req.params.id);


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


            /*
             * Celestine toujours 100.
             */

            if (
                isCelestine(user.email) &&
                Number(user.progression) !== 100
            ) {

                user.progression = 100;

                await pool.query(
                    `
                    UPDATE users
                    SET
                        progression = 100,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                    `,
                    [id]
                );
            }


            res.json({

                success: true,

                user
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
   PROGRESSION UTILISATEUR
============================================================ */

app.get(
    "/api/users/:id/progression",
    async (req, res) => {

        try {

            const userId =
                Number(req.params.id);


            const userResult =
                await pool.query(
                    `
                    SELECT
                        id,
                        email,
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


            if (
                isCelestine(user.email)
            ) {

                await pool.query(
                    `
                    UPDATE users
                    SET
                        progression = 100,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                    AND COALESCE(
                        progression,
                        0
                    ) <> 100
                    `,
                    [userId]
                );

                user.progression = 100;
            }


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

                progression:
                    normalizeProgression(
                        user.progression
                    ),

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
                Number(req.params.id);


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
                        is_archived,
                        parent_id,
                        created_at,
                        updated_at

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
   NE SUPPRIME RIEN
============================================================ */

app.patch(
    "/api/users/:userId/messages/:messageId/read",
    async (req, res) => {

        try {

            const userId =
                Number(req.params.userId);

            const messageId =
                Number(req.params.messageId);


            const result =
                await pool.query(
                    `
                    UPDATE messages

                    SET
                        is_read = TRUE,
                        updated_at = CURRENT_TIMESTAMP

                    WHERE
                        id = $1

                    AND
                        recipient_user_id = $2

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
                Number(req.params.id);


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

                    is_premium:
                        Boolean(
                            user.is_premium
                        )
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
   ACCÈS CERTIFICAT
============================================================ */

app.get(
    "/api/users/:id/certificate-access",
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);


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
                    Boolean(
                        user.is_premium
                    )
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
   CONNEXION ADMIN
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
                    req.body?.password || ""
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
                        "Identifiants administrateur incorrects"
                });
            }


            const token =
                createToken();


            adminTokens.set(
                tokenHash(token),
                {
                    email:
                        ADMIN_EMAIL,

                    created_at:
                        new Date().toISOString()
                }
            );


            await logAdminAction(
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
                "[ADMIN LOGIN]",
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
    async (req, res) => {

        res.json({

            success: true,

            authenticated: true,

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

        try {

            const token =
                req.adminToken;


            adminTokens.delete(
                tokenHash(token)
            );


            await logAdminAction(
                "DECONNEXION_ADMIN",
                "Déconnexion administrateur"
            );


            res.json({

                success: true,

                message:
                    "Déconnexion réussie"
            });

        } catch (error) {

            res.status(500).json({

                success: false,

                message:
                    "Erreur déconnexion"
            });
        }
    }
);


/* ============================================================
   ROUTE RACINE
============================================================ */

app.get(
    "/",
    (req, res) => {

        res.json({

            success: true,

            name:
                "BMJ SERVICE BACKEND",

            version:
                "31.0.0",

            status:
                "active",

            database:
                "PostgreSQL",

            progression:
                "active",

            messaging:
                "active",

            certificates:
                "active",

            payments:
                "active"
        });
    }
);


/* ============================================================
   API ROOT
============================================================ */

app.get(
    "/api",
    (req, res) => {

        res.json({

            success: true,

            name:
                "BMJ SERVICE API",

            version:
                "31.0.0",

            status:
                "active"
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

                service:
                    "BMJ SERVICE BACKEND",

                version:
                    "31.0.0",

                time:
                    new Date().toISOString()
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
                        NOW() AS server_time
                    `
                );


            res.json({

                success: true,

                database:
                    "connected",

                server_time:
                    result.rows[0].server_time
            });

        } catch (error) {

            res.status(500).json({

                success: false,

                database:
                    "error",

                message:
                    error.message
            });
        }
    }
);


/* ============================================================
   IMPORTANT :
   AUCUNE SUPPRESSION UTILISATEUR
============================================================ */

/*
 * L'ancien serveur possédait :
 *
 * DELETE /api/admin/users/:id
 *
 * Cette route pouvait supprimer l'utilisateur et,
 * selon les contraintes PostgreSQL existantes,
 * provoquer également la suppression en cascade
 * de certaines données liées.
 *
 * Comme le système BMJ SERVICE doit préserver les données,
 * cette route n'effectue plus de suppression.
 *
 * On retourne simplement une réponse explicite.
 */

app.delete(
    "/api/admin/users/:id",
    adminAuth,
    async (req, res) => {

        return res.status(405).json({

            success: false,

            code:
                "USER_DELETION_DISABLED",

            message:
                "La suppression des utilisateurs est désactivée afin de préserver les données BMJ SERVICE."
        });
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

            return next(error);
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
   PROGRESSION AUTOMATIQUE
============================================================ */

/*
 * IMPORTANT :
 *
 * On ne fait PAS :
 *
 * initializeUserProgressions()
 * PUIS
 * updateRandomProgressions()
 *
 * immédiatement.
 *
 * Sinon un utilisateur à 0 pourrait être
 * randomisé deux fois au démarrage.
 *
 * On initialise uniquement les 0/NULL.
 *
 * La prochaine randomisation générale
 * arrive 24 heures plus tard.
 */

setTimeout(
    async () => {

        console.log(
            "[PROGRESSION AUTO] Initialisation du système..."
        );


        await initializeUserProgressions();


        /*
         * Vérification spéciale Celestine.
         */

        await ensureCelestineCompleted();


    },
    5000
);


/*
 * Une nouvelle randomisation toutes les 24 heures.
 */

setInterval(
    async () => {

        await updateRandomProgressions();

    },
    PROGRESSION_INTERVALLE
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
            "Erreur arrêt serveur:",
            error
        );


        process.exit(1);
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
                " Progression aléatoire : activée"
            );

            console.log(
                " 100% permanent : activé"
            );

            console.log(
                " Celestine 100% : activé"
            );

            console.log(
                " Certificats : activés"
            );

            console.log(
                " Messages : activés"
            );

            console.log(
                " Conservation messages : activée"
            );

            console.log(
                " Notifications : activées"
            );

            console.log(
                " Paiements : activés"
            );

            console.log(
                " Suppression utilisateurs : désactivée"
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