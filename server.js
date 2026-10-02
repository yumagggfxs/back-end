"use strict";

/* ============================================================
   BMJ SERVICE
   BACKEND NODE.JS / EXPRESS / POSTGRESQL
   VERSION CORRIGÉE
   ============================================================ */

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { Pool } = require("pg");


/* ============================================================
   CONFIGURATION
============================================================ */

const app = express();

const PORT = Number(process.env.PORT) || 10000;

const DATABASE_URL =
    String(process.env.DATABASE_URL || "postgresql://bmj_itv9_user:TVbRRuZIUlXNE6ek4hoLH3nDivmIlgJI@dpg-davnrlid0e5s738ne660-a.oregon-postgres.render.com/bmj_itv9").trim();

const ADMIN_EMAIL =
    String(
        process.env.ADMIN_EMAIL ||
        "admin@bmjservice.com"
    ).trim();

const ADMIN_PASSWORD =
    String(
        process.env.ADMIN_PASSWORD ||
        "admin123"
    );

const EMAIL_UTILISATEUR_100 =
    "celestine@gmail.com";


/* ============================================================
   PROGRESSION AUTOMATIQUE
============================================================ */

const PROGRESSION_INTERVALLE =
    24 * 60 * 60 * 1000;

const PROGRESSION_MIN = 1;
const PROGRESSION_MAX = 5;


/* ============================================================
   VARIABLES GLOBALES
============================================================ */

const adminTokens = new Map();

let progressionJobRunning = false;


/* ============================================================
   EXPRESS
============================================================ */

app.use(
    cors({
        origin: true,
        credentials: true
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
   BASE DE DONNÉES
============================================================ */

if (!DATABASE_URL) {

    console.error(
        "[DATABASE] ERREUR : DATABASE_URL est absente."
    );

}


/*
   IMPORTANT :

   Le mot de passe PostgreSQL ne doit pas être écrit
   directement dans server.js.

   Sur Render :
   DATABASE_URL doit être configurée dans Environment.
*/

const pool = new Pool({

    connectionString: DATABASE_URL,

    ssl: {
        rejectUnauthorized: false
    },

    max: 10,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000

});


pool.on(
    "error",
    (error) => {

        console.error(
            "[DATABASE] Erreur pool PostgreSQL :",
            error.message
        );

    }
);


/* ============================================================
   HELPERS GÉNÉRAUX
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


/* ============================================================
   NOMBRES
============================================================ */

function safeNumber(
    value,
    fallback = 0
) {

    const number = Number(value);

    if (!Number.isFinite(number)) {

        return fallback;

    }

    return number;

}


/* ============================================================
   NORMALISATION PROGRESSION
   UNE SEULE DÉFINITION
============================================================ */

function normalizeProgression(value) {

    const number =
        Number.parseInt(value, 10);

    if (!Number.isFinite(number)) {

        return 0;

    }

    return Math.min(
        100,
        Math.max(0, number)
    );

}


/* ============================================================
   LIMITER UNE PROGRESSION
============================================================ */

function clampProgress(value) {

    return Math.min(
        100,
        Math.max(
            0,
            normalizeProgression(value)
        )
    );

}


/* ============================================================
   PROGRESSION ALÉATOIRE
============================================================ */

function randomProgression() {

    return (
        Math.floor(
            Math.random() *
            (PROGRESSION_MAX - PROGRESSION_MIN + 1)
        ) +
        PROGRESSION_MIN
    );

}


/* ============================================================
   NOUVELLE PROGRESSION AUTOMATIQUE
============================================================ */

function progressionAleatoire() {

    return randomProgression();

}


/* ============================================================
   VÉRIFICATION CELestine
============================================================ */

function isCelestine(user) {

    if (!user) {

        return false;

    }

    return (
        clean(user.email).toLowerCase() ===
        EMAIL_UTILISATEUR_100.toLowerCase()
    );

}


/* ============================================================
   BOOLEAN
============================================================ */

function booleanValue(value) {

    if (
        value === true ||
        value === 1 ||
        value === "1" ||
        String(value).toLowerCase() === "true"
    ) {

        return true;

    }

    return false;

}


/* ============================================================
   EMAIL
============================================================ */

function isValidEmail(email) {

    const value = clean(email);

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        value
    );

}


/* ============================================================
   HASH MOT DE PASSE
============================================================ */

function hashPassword(password) {

    return crypto
        .createHash("sha256")
        .update(String(password))
        .digest("hex");

}


/* ============================================================
   TOKEN
============================================================ */

function createToken() {

    return crypto.randomBytes(32).toString("hex");

}


/* ============================================================
   HASH TOKEN
============================================================ */

function tokenHash(token) {

    return crypto
        .createHash("sha256")
        .update(String(token))
        .digest("hex");

}


/* ============================================================
   UTILISATEUR PUBLIC
============================================================ */

function publicUser(user) {

    if (!user) {

        return null;

    }

    return {

        id: user.id,

        nom: user.nom,

        sexe: user.sexe,

        email: user.email,

        telephone: user.telephone,

        domaine: user.domaine,

        pays: user.pays,

        ville: user.ville,

        niveau: user.niveau,

        photo: user.photo,

        progression:
            normalizeProgression(
                user.progression
            ),

        is_premium:
            booleanValue(
                user.is_premium
            ),

        is_blocked:
            booleanValue(
                user.is_blocked
            ),

        certificat_autorise:
            booleanValue(
                user.certificat_autorise
            ),

        certificat_obtenu:
            booleanValue(
                user.certificat_obtenu
            ),

        premium_until:
            user.premium_until,

        last_login:
            user.last_login,

        created_at:
            user.created_at

    };

}


/* ============================================================
   NORMALISATION MESSAGES
============================================================ */

function normalizeMessageData(data = {}) {

    return {

        sender_type:
            clean(data.sender_type),

        sender_id:
            safeNumber(
                data.sender_id,
                null
            ),

        recipient_user_id:
            safeNumber(
                data.recipient_user_id,
                null
            ),

        audience:
            clean(data.audience),

        subject:
            clean(data.subject),

        message:
            clean(data.message),

        priority:
            clean(data.priority) ||
            "normal",

        is_read:
            booleanValue(
                data.is_read
            ),

        is_archived:
            booleanValue(
                data.is_archived
            ),

        parent_id:
            safeNumber(
                data.parent_id,
                null
            )

    };

}


/* ============================================================
   NORMALISATION SMS
============================================================ */

function normalizeSmsData(data = {}) {

    return {

        sender_type:
            clean(data.sender_type),

        sender_id:
            safeNumber(
                data.sender_id,
                null
            ),

        recipient_user_id:
            safeNumber(
                data.recipient_user_id,
                null
            ),

        recipient_phone:
            clean(
                data.recipient_phone
            ),

        message:
            clean(data.message),

        status:
            clean(data.status) ||
            "pending",

        provider:
            clean(data.provider),

        provider_message_id:
            clean(
                data.provider_message_id
            ),

        error_message:
            clean(
                data.error_message
            ),

        parent_id:
            safeNumber(
                data.parent_id,
                null
            )

    };

}


/* ============================================================
   RÉCUPÉRER ID UTILISATEUR SMS
============================================================ */

async function getSmsUserId(
    email
) {

    const result =
        await pool.query(
            `
            SELECT id
            FROM users
            WHERE LOWER(TRIM(email))
                = LOWER(TRIM($1))
            LIMIT 1
            `,
            [email]
        );

    if (
        !result.rows.length
    ) {

        return null;

    }

    return result.rows[0].id;

}


/* ============================================================
   AUTH ADMIN
============================================================ */

function getAdminToken(req) {

    const authorization =
        clean(
            req.headers.authorization
        );

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
        clean(
            req.headers["x-admin-token"]
        );

    if (headerToken) {

        return headerToken;

    }


    const queryToken =
        clean(
            req.query.token
        );

    if (queryToken) {

        return queryToken;

    }


    return "";

}


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

        if (!token) {

            return res
                .status(401)
                .json({

                    success: false,

                    message:
                        "Token administrateur manquant."

                });

        }


        const hash =
            tokenHash(token);

        if (
            !adminTokens.has(hash)
        ) {

            return res
                .status(403)
                .json({

                    success: false,

                    message:
                        "Token administrateur invalide."

                });

        }


        req.adminToken = token;

        next();

    } catch (error) {

        console.error(
            "[ADMIN AUTH]",
            error
        );

        return res
            .status(500)
            .json({

                success: false,

                message:
                    "Erreur authentification administrateur."

            });

    }

}


/* ============================================================
   LOG ADMIN
============================================================ */

async function logAdminAction(
    adminId,
    action,
    details = null
) {

    try {

        await pool.query(
            `
            INSERT INTO admin_activity
            (
                admin_id,
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
                adminId,
                clean(action),
                details
                    ? JSON.stringify(details)
                    : null
            ]
        );

    } catch (error) {

        console.error(
            "[ADMIN ACTIVITY]",
            error.message
        );

    }

}


/* ============================================================
   LOG ADMIN SÉCURISÉ
============================================================ */

async function safeLogAdminAction(
    adminId,
    action,
    details = null
) {

    try {

        await logAdminAction(
            adminId,
            action,
            details
        );

    } catch (error) {

        console.error(
            "[SAFE ADMIN LOG]",
            error.message
        );

    }

}


/* ============================================================
   ACTIVITÉ UTILISATEUR
============================================================ */

async function logUserActivity(
    userId,
    action,
    details = null
) {

    try {

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
                userId,
                clean(action),
                details
                    ? JSON.stringify(details)
                    : null
            ]
        );

    } catch (error) {

        console.error(
            "[USER ACTIVITY]",
            error.message
        );

    }

}


/* ============================================================
   NOTIFICATION
============================================================ */

async function createNotification(
    userId,
    title,
    message,
    type = "info"
) {

    try {

        await pool.query(
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
                false,
                CURRENT_TIMESTAMP
            )
            `,
            [
                userId,
                clean(title),
                clean(message),
                clean(type)
            ]
        );

    } catch (error) {

        console.error(
            "[NOTIFICATION]",
            error.message
        );

    }

}


/* ============================================================
   INITIALISATION BASE DE DONNÉES
   NON DESTRUCTIVE
============================================================ */

async function initDatabase() {

    console.log(
        "[DATABASE] Initialisation PostgreSQL..."
    );


    if (!DATABASE_URL) {

        throw new Error(
            "DATABASE_URL est absente."
        );

    }


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

                is_premium BOOLEAN DEFAULT false,

                is_blocked BOOLEAN DEFAULT false,

                certificat_autorise BOOLEAN DEFAULT false,

                certificat_obtenu BOOLEAN DEFAULT false,

                premium_until TIMESTAMP NULL,

                last_login TIMESTAMP NULL,

                notes_admin TEXT,

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                progression_last_updated_at TIMESTAMP NULL
            )
            `
        );


        /* ====================================================
           AJOUT DES COLONNES MANQUANTES USERS
        ==================================================== */

        const userColumns = {

            nom:
                "TEXT",

            sexe:
                "TEXT",

            telephone:
                "TEXT",

            domaine:
                "TEXT",

            pays:
                "TEXT",

            ville:
                "TEXT",

            niveau:
                "TEXT",

            password:
                "TEXT",

            photo:
                "TEXT",

            progression:
                "INTEGER DEFAULT 0",

            is_premium:
                "BOOLEAN DEFAULT false",

            is_blocked:
                "BOOLEAN DEFAULT false",

            certificat_autorise:
                "BOOLEAN DEFAULT false",

            certificat_obtenu:
                "BOOLEAN DEFAULT false",

            premium_until:
                "TIMESTAMP NULL",

            last_login:
                "TIMESTAMP NULL",

            notes_admin:
                "TEXT",

            created_at:
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",

            updated_at:
                "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",

            progression_last_updated_at:
                "TIMESTAMP NULL"

        };


        for (
            const [column, type]
            of Object.entries(userColumns)
        ) {

            await client.query(
                `
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS ${column}
                ${type}
                `
            );

        }


        /* ====================================================
           DEMANDES PAIEMENT
        ==================================================== */

        await client.query(
            `
            CREATE TABLE IF NOT EXISTS demandes_paiement
            (
                id SERIAL PRIMARY KEY,

                user_id INTEGER,

                email TEXT,

                nom TEXT,

                plan TEXT,

                montant NUMERIC(12,2),

                methode TEXT,

                reference TEXT,

                statut TEXT DEFAULT 'pending',

                notes TEXT,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP
            )
            `
        );


        /* ====================================================
           ADMIN ACTIVITY
        ==================================================== */

        await client.query(
            `
            CREATE TABLE IF NOT EXISTS admin_activity
            (
                id SERIAL PRIMARY KEY,

                admin_id INTEGER,

                action TEXT,

                details TEXT,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP
            )
            `
        );


        /* ====================================================
           MESSAGES
           TABLE EXISTANTE CONSERVÉE
        ==================================================== */

        await client.query(
            `
            CREATE TABLE IF NOT EXISTS messages
            (
                id SERIAL PRIMARY KEY,

                sender_type TEXT,

                sender_id INTEGER,

                recipient_user_id INTEGER,

                audience TEXT,

                subject TEXT,

                message TEXT,

                priority TEXT DEFAULT 'normal',

                is_read BOOLEAN DEFAULT false,

                is_archived BOOLEAN DEFAULT false,

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
                "INTEGER",

            recipient_user_id:
                "INTEGER",

            audience:
                "TEXT",

            subject:
                "TEXT",

            message:
                "TEXT",

            priority:
                "TEXT DEFAULT 'normal'",

            is_read:
                "BOOLEAN DEFAULT false",

            is_archived:
                "BOOLEAN DEFAULT false",

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
                ADD COLUMN IF NOT EXISTS ${column}
                ${type}
                `
            );

        }


        /* ====================================================
           SMS
           TABLE INDÉPENDANTE
        ==================================================== */

        await client.query(
            `
            CREATE TABLE IF NOT EXISTS sms_messages
            (
                id SERIAL PRIMARY KEY,

                sender_type TEXT,

                sender_id INTEGER,

                recipient_user_id INTEGER,

                recipient_phone TEXT,

                message TEXT,

                status TEXT DEFAULT 'pending',

                provider TEXT,

                provider_message_id TEXT,

                error_message TEXT,

                parent_id INTEGER NULL,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP
            )
            `
        );


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

                is_read BOOLEAN DEFAULT false,

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

                nom TEXT,

                domaine TEXT,

                certificat_url TEXT,

                statut TEXT DEFAULT 'pending',

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP
            )
            `
        );


        /* ====================================================
           USER PROGRESS
        ==================================================== */

        await client.query(
            `
            CREATE TABLE IF NOT EXISTS user_progress
            (
                id SERIAL PRIMARY KEY,

                user_id INTEGER,

                course_id INTEGER,

                progression INTEGER DEFAULT 0,

                created_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP,

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


        await client.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_users_progression_timer
            ON users(progression_last_updated_at)
            `
        );


        /* ====================================================
           INDEX MESSAGES
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
            ON messages(sender_id)
            `
        );


        await client.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_messages_created
            ON messages(created_at)
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
            ON sms_messages(created_at)
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
           INDEX USER PROGRESS
        ==================================================== */

        await client.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_user_progress_user
            ON user_progress(user_id)
            `
        );


        /* ====================================================
           INDEX USER ACTIVITY
        ==================================================== */

        await client.query(
            `
            CREATE INDEX IF NOT EXISTS
            idx_user_activity_user
            ON user_activity(user_id)
            `
        );


        await client.query(
            "COMMIT"
        );


        console.log(
            "[DATABASE] Initialisation terminée."
        );


    } catch (error) {

        await client.query(
            "ROLLBACK"
        );

        console.error(
            "[DATABASE] Erreur initialisation :",
            error
        );

        throw error;

    } finally {

        client.release();

    }

}


/* ============================================================
   CELestine = 100 %
   PERMANENT
============================================================ */

async function ensureCelestineCompleted() {

    try {

        const result =
            await pool.query(
                `
                UPDATE users

                SET
                    progression = 100,

                    progression_last_updated_at =
                        COALESCE(
                            progression_last_updated_at,
                            CURRENT_TIMESTAMP
                        )

                WHERE
                    LOWER(TRIM(email))
                    =
                    LOWER(TRIM($1))

                AND
                (
                    COALESCE(progression, 0) <> 100

                    OR
                    progression_last_updated_at IS NULL
                )

                RETURNING
                    id,
                    email,
                    progression
                `,
                [
                    EMAIL_UTILISATEUR_100
                ]
            );


        if (result.rows.length) {

            console.log(
                "[PROGRESSION] Utilisateur 100% :",
                result.rows[0].email
            );

        }

        return result.rows[0] || null;

    } catch (error) {

        console.error(
            "[PROGRESSION] Erreur Celestine :",
            error.message
        );

        return null;

    }

}


/* ============================================================
   VÉRIFIER UTILISATEUR PREMIUM
============================================================ */

function isPremiumUser(user) {

    if (!user) {

        return false;

    }

    return booleanValue(
        user.is_premium
    );

}


/* ============================================================
   INITIALISATION DES PROGRESSIONS
   VERSION CORRIGÉE

   IMPORTANT :
   - chaque utilisateur est traité individuellement
   - aucune progression globale
   - aucun updated_at
   - timer propre à chaque utilisateur
============================================================ */

async function initializeUserProgressions() {

    console.log(
        "[PROGRESSION AUTO] Initialisation du système..."
    );


    try {

        /*
           Toujours garantir Celestine à 100 %
        */

        await ensureCelestineCompleted();


        /*
           On récupère UNIQUEMENT les utilisateurs PREMIUM.
        */

        const result =
            await pool.query(
                `
                SELECT
                    id,
                    email,
                    progression,
                    is_premium,
                    progression_last_updated_at

                FROM users

                WHERE
                    COALESCE(is_premium, false)
                    = true

                ORDER BY id ASC
                `
            );


        let initialized = 0;
        let timersInitialized = 0;


        for (
            const user
            of result.rows
        ) {

            /*
               Sécurité supplémentaire :
               Celestine reste toujours à 100 %.
            */

            if (
                isCelestine(user)
            ) {

                await pool.query(
                    `
                    UPDATE users

                    SET
                        progression = 100,

                        progression_last_updated_at =
                            COALESCE(
                                progression_last_updated_at,
                                CURRENT_TIMESTAMP
                            )

                    WHERE id = $1
                    `,
                    [
                        user.id
                    ]
                );

                continue;

            }


            const progression =
                normalizeProgression(
                    user.progression
                );


            /*
               CAS 1 :
               aucune progression.

               On donne une valeur aléatoire
               INDIVIDUELLE à cet utilisateur.
            */

            if (
                progression <= 0
            ) {

                const nouvelleProgression =
                    progressionAleatoire();


                await pool.query(
                    `
                    UPDATE users

                    SET
                        progression = $1,

                        progression_last_updated_at =
                            CURRENT_TIMESTAMP

                    WHERE
                        id = $2

                    AND
                        COALESCE(is_premium, false)
                        = true
                    `,
                    [
                        nouvelleProgression,
                        user.id
                    ]
                );


                console.log(
                    `[PROGRESSION AUTO] ${user.email} -> ${nouvelleProgression}%`
                );


                initialized++;

                continue;

            }


            /*
               CAS 2 :
               progression existante mais aucun
               timestamp de progression.

               On NE change PAS la progression.

               On démarre simplement le compteur
               de 24 heures pour cet utilisateur.
            */

            if (
                !user.progression_last_updated_at
            ) {

                await pool.query(
                    `
                    UPDATE users

                    SET
                        progression_last_updated_at =
                            CURRENT_TIMESTAMP

                    WHERE
                        id = $1

                    AND
                        COALESCE(is_premium, false)
                        = true

                    AND
                        progression_last_updated_at IS NULL
                    `,
                    [
                        user.id
                    ]
                );


                console.log(
                    `[PROGRESSION AUTO] Timer démarré pour ${user.email}`
                );


                timersInitialized++;

            }

        }


        console.log(
            `[PROGRESSION AUTO] Initialisation terminée : ${initialized} progression(s), ${timersInitialized} timer(s).`
        );


        return true;

    } catch (error) {

        console.error(
            "[PROGRESSION AUTO] Erreur initialisation :",
            error
        );

        return false;

    }

}


/* ============================================================
   COMPATIBILITÉ ANCIEN NOM

   Ton ancien code appelait :

       initializePremiumProgressions()

   On le conserve pour éviter :
       ReferenceError
============================================================ */

async function initializePremiumProgressions() {

    return initializeUserProgressions();

}


/* ============================================================
   MISE À JOUR AUTOMATIQUE DES PROGRESSIONS
   TOUS LES 24 HEURES PAR UTILISATEUR
============================================================ */

async function updatePremiumProgressions() {

    /*
       Empêcher deux traitements simultanés.
    */

    if (progressionJobRunning) {

        console.log(
            "[PROGRESSION AUTO] Traitement déjà en cours."
        );

        return;

    }


    progressionJobRunning = true;


    try {

        console.log(
            "[PROGRESSION AUTO] Vérification des progressions..."
        );


        /*
           Toujours garantir Celestine à 100 %.
        */

        await ensureCelestineCompleted();


        /*
           Date limite :
           seules les progressions dont le dernier
           changement date d'au moins 24h sont éligibles.
        */

        const dateLimite =
            new Date(
                Date.now() -
                PROGRESSION_INTERVALLE
            );


        /*
           On récupère uniquement les premiums
           qui ne sont pas encore à 100 %.
        */

        const result =
            await pool.query(
                `
                SELECT
                    id,
                    email,
                    progression,
                    progression_last_updated_at

                FROM users

                WHERE
                    COALESCE(is_premium, false)
                    = true

                AND
                    COALESCE(progression, 0)
                    < 100

                ORDER BY id ASC
                `
            );


        let updatedCount = 0;


        for (
            const user
            of result.rows
        ) {

            /*
               Celestine ne doit jamais être modifiée
               par le système normal.
            */

            if (
                isCelestine(user)
            ) {

                await pool.query(
                    `
                    UPDATE users

                    SET
                        progression = 100

                    WHERE id = $1
                    `,
                    [
                        user.id
                    ]
                );

                continue;

            }


            /*
               Si le timer est absent,
               on le crée maintenant.

               PAS d'augmentation immédiate.
            */

            if (
                !user.progression_last_updated_at
            ) {

                await pool.query(
                    `
                    UPDATE users

                    SET
                        progression_last_updated_at =
                            CURRENT_TIMESTAMP

                    WHERE
                        id = $1

                    AND
                        progression_last_updated_at IS NULL
                    `,
                    [
                        user.id
                    ]
                );

                continue;

            }


            /*
               Vérification des 24 heures.
            */

            const dernierChangement =
                new Date(
                    user.progression_last_updated_at
                );


            if (
                !Number.isFinite(
                    dernierChangement.getTime()
                )
            ) {

                await pool.query(
                    `
                    UPDATE users

                    SET
                        progression_last_updated_at =
                            CURRENT_TIMESTAMP

                    WHERE id = $1
                    `,
                    [
                        user.id
                    ]
                );

                continue;

            }


            if (
                dernierChangement.getTime()
                >
                dateLimite.getTime()
            ) {

                /*
                   Pas encore 24 heures.
                */

                continue;

            }


            /*
               Progression actuelle.
            */

            const ancienneProgression =
                normalizeProgression(
                    user.progression
                );


            /*
               Augmentation INDIVIDUELLE.

               Chaque utilisateur reçoit son propre
               nombre aléatoire entre 1 et 5.
            */

            const augmentation =
                progressionAleatoire();


            const nouvelleProgression =
                Math.min(
                    100,
                    ancienneProgression +
                    augmentation
                );


            /*
               UPDATE atomique.

               La condition sur progression_last_updated_at
               évite qu'une double exécution augmente
               deux fois le même utilisateur.
            */

            const updateResult =
                await pool.query(
                    `
                    UPDATE users

                    SET
                        progression = $1,

                        progression_last_updated_at =
                            CURRENT_TIMESTAMP

                    WHERE
                        id = $2

                    AND
                        COALESCE(is_premium, false)
                        = true

                    AND
                        COALESCE(progression, 0)
                        < 100

                    AND
                        progression_last_updated_at
                        <= $3

                    RETURNING
                        id,
                        email,
                        progression
                    `,
                    [
                        nouvelleProgression,
                        user.id,
                        dateLimite
                    ]
                );


            if (
                updateResult.rows.length
            ) {

                const updatedUser =
                    updateResult.rows[0];


                console.log(
                    `[PROGRESSION AUTO] ${updatedUser.email} : ${ancienneProgression}% -> ${updatedUser.progression}% (+${augmentation})`
                );


                updatedCount++;

            }

        }


        console.log(
            `[PROGRESSION AUTO] Vérification terminée. ${updatedCount} utilisateur(s) mis à jour.`
        );


    } catch (error) {

        console.error(
            "[PROGRESSION AUTO] Erreur mise à jour :",
            error
        );

    } finally {

        progressionJobRunning = false;

    }

}


/* ============================================================
   DÉMARRAGE DU SYSTÈME AUTOMATIQUE
============================================================ */

function startProgressionScheduler() {

    console.log(
        "[PROGRESSION AUTO] Scheduler démarré."
    );


    /*
       Première initialisation après quelques secondes.

       Cela laisse le temps à PostgreSQL et Express
       de terminer leur démarrage.
    */

    setTimeout(
        async () => {

            try {

                await initializeUserProgressions();

                await updatePremiumProgressions();

            } catch (error) {

                console.error(
                    "[PROGRESSION AUTO] Erreur démarrage :",
                    error
                );

            }

        },
        5000
    );


    /*
       Vérification toutes les heures.

       IMPORTANT :
       cela ne veut PAS dire que la progression augmente
       toutes les heures.

       Le système vérifie simplement si CHAQUE utilisateur
       a atteint ses propres 24 heures.
    */

    setInterval(
        async () => {

            await updatePremiumProgressions();

        },
        60 * 60 * 1000
    );

}


/* ============================================================
   DÉMARRAGE SCHEDULER
============================================================ */

startProgressionScheduler();


/* ============================================================
   ROUTE RACINE
============================================================ */

app.get(
    "/",
    async (req, res) => {

        console.log(
            "[BMJ API]",
            req.method,
            "/"
        );


        return res.json({

            success: true,

            message:
                "BMJ SERVICE BACKEND opérationnel",

            version:
                "30.0.0",

            database:
                Boolean(DATABASE_URL),

            timestamp:
                new Date().toISOString()

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


            return res.json({

                success: true,

                status: "healthy",

                database: "connected",

                timestamp:
                    new Date().toISOString()

            });

        } catch (error) {

            console.error(
                "[HEALTH]",
                error.message
            );


            return res
                .status(500)
                .json({

                    success: false,

                    status: "unhealthy",

                    database: "error",

                    message:
                        error.message

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

            const result =
                await pool.query(
                    `
                    SELECT
                        NOW() AS server_time
                    `
                );


            return res.json({

                success: true,

                database: "PostgreSQL",

                server_time:
                    result.rows[0]
                        .server_time

            });

        } catch (error) {

            console.error(
                "[TEST DB]",
                error.message
            );


            return res
                .status(500)
                .json({

                    success: false,

                    message:
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

            const usersResult =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER
                        AS total_users,

                        COUNT(*) FILTER
                        (
                            WHERE
                                COALESCE(
                                    is_premium,
                                    false
                                )
                                = true
                        )::INTEGER
                        AS premium_users,

                        COUNT(*) FILTER
                        (
                            WHERE
                                COALESCE(
                                    is_blocked,
                                    false
                                )
                                = true
                        )::INTEGER
                        AS blocked_users,

                        COUNT(*) FILTER
                        (
                            WHERE
                                COALESCE(
                                    is_premium,
                                    false
                                )
                                = false

                            AND
                                COALESCE(
                                    is_blocked,
                                    false
                                )
                                = false
                        )::INTEGER
                        AS standard_users,

                        COUNT(*) FILTER
                        (
                            WHERE
                                created_at >=
                                CURRENT_DATE
                        )::INTEGER
                        AS today_users

                    FROM users
                    `
                );


            const paymentsResult =
                await pool.query(
                    `
                    SELECT

                        COUNT(*)::INTEGER
                        AS total_payments,

                        COUNT(*) FILTER
                        (
                            WHERE
                                LOWER(
                                    COALESCE(
                                        statut,
                                        ''
                                    )
                                )
                                IN
                                (
                                    'pending',
                                    'en_attente',
                                    'en attente'
                                )
                        )::INTEGER
                        AS pending_payments,

                        COUNT(*) FILTER
                        (
                            WHERE
                                LOWER(
                                    COALESCE(
                                        statut,
                                        ''
                                    )
                                )
                                IN
                                (
                                    'validated',
                                    'valide',
                                    'validé',
                                    'approved',
                                    'accepte',
                                    'accepté'
                                )
                        )::INTEGER
                        AS validated_payments,

                        COUNT(*) FILTER
                        (
                            WHERE
                                LOWER(
                                    COALESCE(
                                        statut,
                                        ''
                                    )
                                )
                                IN
                                (
                                    'refused',
                                    'refuse',
                                    'refusé',
                                    'rejected'
                                )
                        )::INTEGER
                        AS refused_payments,

                        COALESCE(
                            SUM(
                                CASE
                                    WHEN LOWER(
                                        COALESCE(
                                            statut,
                                            ''
                                        )
                                    )
                                    IN
                                    (
                                        'validated',
                                        'valide',
                                        'validé',
                                        'approved',
                                        'accepte',
                                        'accepté'
                                    )
                                    THEN
                                        COALESCE(
                                            montant,
                                            0
                                        )
                                    ELSE 0
                                END
                            ),
                            0
                        )::NUMERIC
                        AS revenue

                    FROM demandes_paiement
                    `
                );


            const messagesResult =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::INTEGER
                        AS total_messages

                    FROM messages
                    `
                );


            const certificatesResult =
                await pool.query(
                    `
                    SELECT

                        COUNT(*)::INTEGER
                        AS total_certificates,

                        COUNT(*) FILTER
                        (
                            WHERE
                                LOWER(
                                    COALESCE(
                                        statut,
                                        ''
                                    )
                                )
                                IN
                                (
                                    'validated',
                                    'valide',
                                    'validé',
                                    'approved'
                                )
                        )::INTEGER
                        AS validated_certificates

                    FROM certificates
                    `
                );


            const users =
                usersResult.rows[0] || {};


            const payments =
                paymentsResult.rows[0] || {};


            const messages =
                messagesResult.rows[0] || {};


            const certificates =
                certificatesResult.rows[0] || {};


            return res.json({

                success: true,

                users:
                    safeNumber(
                        users.total_users
                    ),

                premium:
                    safeNumber(
                        users.premium_users
                    ),

                today:
                    safeNumber(
                        users.today_users
                    ),

                pending:
                    safeNumber(
                        payments.pending_payments
                    ),

                revenue:
                    safeNumber(
                        payments.revenue
                    ),

                standard:
                    safeNumber(
                        users.standard_users
                    ),

                blocked:
                    safeNumber(
                        users.blocked_users
                    ),

                messages:
                    safeNumber(
                        messages.total_messages
                    ),

                certificates:
                    safeNumber(
                        certificates.total_certificates
                    ),

                validated:
                    safeNumber(
                        payments.validated_payments
                    ),

                refused:
                    safeNumber(
                        payments.refused_payments
                    ),

                totalPayments:
                    safeNumber(
                        payments.total_payments
                    ),

                authorizedCertificates:
                    safeNumber(
                        certificates.validated_certificates
                    )

            });

        } catch (error) {

            console.error(
                "[ADMIN STATISTIQUES]",
                error
            );


            return res
                .status(500)
                .json({

                    success: false,

                    message:
                        "Impossible de récupérer les statistiques.",

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